import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError, getSafeIpAddress } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { dispatchNotification } from '@/lib/notification-service';
import { z } from 'zod';

const editExistingSchema = z.object({
  mode: z.literal('edit').optional(),
  record_id: z.string().uuid(),
  check_in_time: z.string().datetime({ offset: true }),
  check_out_time: z.string().datetime({ offset: true }).nullable(),
  status: z.enum(['present', 'late', 'half_day', 'absent']),
  approval_status: z.enum(['approved', 'pending', 'rejected']).optional().default('approved'),
  reason: z.string().min(3, 'Reason must be at least 3 characters long for audit compliance.').max(500),
});

const upsertDaysSchema = z.object({
  mode: z.literal('upsert_days'),
  employee_id: z.string().uuid(),
  branch_id: z.string().uuid().optional().nullable(),
  dates: z
    .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Each date must be YYYY-MM-DD'))
    .min(1, 'Select at least one date.')
    .max(31, 'You can update at most 31 days at a time.'),
  check_in_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Check-in time must be HH:mm'),
  check_out_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Check-out time must be HH:mm').nullable().optional(),
  status: z.enum(['present', 'late', 'half_day', 'absent']).default('present'),
  overwrite_existing: z.boolean().optional().default(true),
  reason: z.string().min(3, 'Reason must be at least 3 characters long for audit compliance.').max(500),
});

const deleteRecordSchema = z.object({
  record_id: z.string().uuid(),
  reason: z.string().min(3).max(500).optional(),
});

function normalizeTimeHMS(timeStr: string): string {
  const parts = timeStr.trim().split(':');
  const hh = (parts[0] || '09').padStart(2, '0');
  const mm = (parts[1] || '00').padStart(2, '0');
  const ss = (parts[2] || '00').slice(0, 2).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function getDhakaDateParts(isoString: string): { year: string; month: string; day: string } {
  const d = new Date(isoString);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(d);
  return {
    year: parts.find((p) => p.type === 'year')?.value || String(d.getUTCFullYear()),
    month: parts.find((p) => p.type === 'month')?.value || '01',
    day: parts.find((p) => p.type === 'day')?.value || '01',
  };
}

async function computeOvertimeMinutes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  branchId: string,
  checkInIso: string,
  checkOutIso: string | null
): Promise<number> {
  if (!checkOutIso) return 0;

  let shiftEndStr = '18:00:00';
  let overtimeAfterMinutes = 30;

  const { data: companyProfile } = await supabase
    .from('company_profile')
    .select('default_work_end_time')
    .limit(1)
    .maybeSingle();

  if (companyProfile?.default_work_end_time) {
    shiftEndStr = companyProfile.default_work_end_time;
  }

  if (branchId) {
    const { data: branchSettings } = await supabase
      .from('branch_settings')
      .select('work_end_time, overtime_after_minutes')
      .eq('branch_id', branchId)
      .maybeSingle();

    if (branchSettings?.work_end_time) {
      shiftEndStr = branchSettings.work_end_time;
    }
    if (branchSettings?.overtime_after_minutes !== undefined && branchSettings?.overtime_after_minutes !== null) {
      overtimeAfterMinutes = Number(branchSettings.overtime_after_minutes);
    }
  }

  const { year, month, day } = getDhakaDateParts(checkInIso);
  const safeEnd = normalizeTimeHMS(shiftEndStr);
  const workEndDate = new Date(`${year}-${month}-${day}T${safeEnd}+06:00`);
  const overtimeThresholdMs = workEndDate.getTime() + overtimeAfterMinutes * 60000;
  const checkOutMs = new Date(checkOutIso).getTime();

  if (checkOutMs > overtimeThresholdMs) {
    return Math.max(0, Math.floor((checkOutMs - workEndDate.getTime()) / 60000));
  }
  return 0;
}

async function writeManualAuditLog(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    actorId: string;
    actorRole: 'admin' | 'branch_manager' | 'employee';
    action: 'MANUAL_OVERRIDE' | 'CREATE' | 'UPDATE' | 'DELETE';
    recordId: string;
    oldValue: Record<string, unknown> | null;
    newValue: Record<string, unknown> | null;
    ipAddress: string;
  }
) {
  try {
    await supabase.from('audit_logs').insert({
      actor_id: params.actorId,
      actor_role: params.actorRole,
      action: params.action,
      table_name: 'attendance_records',
      record_id: params.recordId,
      old_value: params.oldValue,
      new_value: params.newValue,
      ip_address: params.ipAddress,
    });
  } catch (err) {
    console.error('[manual-correction] Audit log insert warning:', err);
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Only Admins and Branch Managers can perform manual attendance edits/entries
    const user = await requireRole(['admin', 'branch_manager']);
    const body = await request.json();
    const supabase = await createClient();
    const ipAddress = getSafeIpAddress(request);

    // ── MODE B: Manual Create / Bulk Upsert for Missing Day(s) ────────────────
    if (body?.mode === 'upsert_days' || (body?.employee_id && Array.isArray(body?.dates))) {
      const payload = upsertDaysSchema.parse({ ...body, mode: 'upsert_days' });

      // Validate check_out > check_in time on the same day if both given
      const safeInHms = normalizeTimeHMS(payload.check_in_time);
      const safeOutHms = payload.check_out_time ? normalizeTimeHMS(payload.check_out_time) : null;
      if (safeOutHms) {
        const testIn = new Date(`2026-01-01T${safeInHms}+06:00`).getTime();
        const testOut = new Date(`2026-01-01T${safeOutHms}+06:00`).getTime();
        if (testOut <= testIn) {
          return NextResponse.json(
            {
              success: false,
              data: null,
              error: { code: 'INVALID_TIME_RANGE', message: 'Check-out time must be later than check-in time.' },
            },
            { status: 400 }
          );
        }
      }

      // Fetch target employee profile
      const { data: targetEmployee, error: empErr } = await supabase
        .from('profiles')
        .select('id, full_name, branch_id, role')
        .eq('id', payload.employee_id)
        .single();

      if (empErr || !targetEmployee) {
        return NextResponse.json(
          { success: false, data: null, error: { code: 'NOT_FOUND', message: 'Employee not found.' } },
          { status: 404 }
        );
      }

      // Enforce Branch Manager scope
      if (user.role === 'branch_manager') {
        if (!user.branch_id || targetEmployee.branch_id !== user.branch_id) {
          return NextResponse.json(
            {
              success: false,
              data: null,
              error: { code: 'FORBIDDEN', message: 'Cannot add or edit attendance for employees of another branch.' },
            },
            { status: 403 }
          );
        }
      }

      // Resolve branch_id and branch GPS coordinates (attendance_records requires NOT NULL lat/lng)
      let targetBranchId: string | null =
        user.role === 'branch_manager'
          ? user.branch_id
          : payload.branch_id || targetEmployee.branch_id || null;

      if (!targetBranchId) {
        const { data: firstActiveBranch } = await supabase
          .from('branches')
          .select('id')
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();
        targetBranchId = firstActiveBranch?.id || null;
      }

      if (!targetBranchId) {
        return NextResponse.json(
          {
            success: false,
            data: null,
            error: {
              code: 'NO_BRANCH',
              message: 'Employee is not assigned to any branch. Please assign a branch first.',
            },
          },
          { status: 400 }
        );
      }

      const { data: branchInfo } = await supabase
        .from('branches')
        .select('id, name, latitude, longitude')
        .eq('id', targetBranchId)
        .maybeSingle();

      const fallbackLat = Number(branchInfo?.latitude ?? 23.8103);
      const fallbackLng = Number(branchInfo?.longitude ?? 90.4125);

      const uniqueSortedDates = Array.from(new Set(payload.dates)).sort();
      const created: Array<{ date: string; id: string }> = [];
      const updated: Array<{ date: string; id: string }> = [];
      const skipped: Array<{ date: string; reason: string }> = [];
      const nowIso = new Date().toISOString();

      for (const dateStr of uniqueSortedDates) {
        const checkInIso = new Date(`${dateStr}T${safeInHms}+06:00`).toISOString();
        const checkOutIso = safeOutHms ? new Date(`${dateStr}T${safeOutHms}+06:00`).toISOString() : null;
        const startOfDayIso = new Date(`${dateStr}T00:00:00.000+06:00`).toISOString();
        const endOfDayIso = new Date(`${dateStr}T23:59:59.999+06:00`).toISOString();

        const overtimeMinutes = await computeOvertimeMinutes(supabase, targetBranchId, checkInIso, checkOutIso);

        // Check whether an attendance record already exists on this Dhaka date
        const { data: existingList } = await supabase
          .from('attendance_records')
          .select('*')
          .eq('employee_id', payload.employee_id)
          .gte('check_in_time', startOfDayIso)
          .lte('check_in_time', endOfDayIso)
          .order('check_in_time', { ascending: true });

        const existingRec = existingList && existingList.length > 0 ? existingList[0] : null;

        if (existingRec) {
          if (!payload.overwrite_existing) {
            skipped.push({ date: dateStr, reason: 'Attendance record already exists' });
            continue;
          }

          const { data: updRec, error: updErr } = await supabase
            .from('attendance_records')
            .update({
              branch_id: targetBranchId,
              check_in_time: checkInIso,
              check_out_time: checkOutIso,
              status: payload.status,
              overtime_minutes: overtimeMinutes,
              is_manual_override: true,
              override_reason: payload.reason,
              approval_status: 'approved',
              approved_by: user.id,
              approved_at: nowIso,
              approval_note: payload.reason,
            })
            .eq('id', existingRec.id)
            .select()
            .single();

          if (updErr || !updRec) {
            throw new Error(`Failed to update attendance for ${dateStr}: ${updErr?.message}`);
          }

          updated.push({ date: dateStr, id: updRec.id });

          await writeManualAuditLog(supabase, {
            actorId: user.id,
            actorRole: user.role,
            action: 'MANUAL_OVERRIDE',
            recordId: updRec.id,
            oldValue: {
              check_in_time: existingRec.check_in_time,
              check_out_time: existingRec.check_out_time,
              status: existingRec.status,
              overtime_minutes: existingRec.overtime_minutes,
            },
            newValue: {
              date: dateStr,
              check_in_time: checkInIso,
              check_out_time: checkOutIso,
              status: payload.status,
              overtime_minutes: overtimeMinutes,
              reason: payload.reason,
              corrected_by: user.full_name,
              corrected_role: user.role,
            },
            ipAddress,
          });
        } else {
          // Insert new manual attendance record
          const { data: insRec, error: insErr } = await supabase
            .from('attendance_records')
            .insert({
              employee_id: payload.employee_id,
              branch_id: targetBranchId,
              check_in_time: checkInIso,
              check_out_time: checkOutIso,
              check_in_lat: fallbackLat,
              check_in_lng: fallbackLng,
              check_out_lat: checkOutIso ? fallbackLat : null,
              check_out_lng: checkOutIso ? fallbackLng : null,
              face_verified: false,
              status: payload.status,
              overtime_minutes: overtimeMinutes,
              is_manual_override: true,
              override_reason: payload.reason,
              approval_status: 'approved',
              approved_by: user.id,
              approved_at: nowIso,
              approval_note: payload.reason,
            })
            .select()
            .single();

          if (insErr || !insRec) {
            throw new Error(`Failed to create manual attendance for ${dateStr}: ${insErr?.message}`);
          }

          // Guard against DB trigger `OLD.is_manual_override IS NULL` overwriting status on INSERT:
          // On UPDATE, `OLD.is_manual_override` is `true` (not NULL), so the trigger preserves our exact status.
          if (insRec.status !== payload.status) {
            await supabase
              .from('attendance_records')
              .update({
                status: payload.status,
                is_manual_override: true,
                override_reason: payload.reason,
              })
              .eq('id', insRec.id);
          }

          created.push({ date: dateStr, id: insRec.id });

          await writeManualAuditLog(supabase, {
            actorId: user.id,
            actorRole: user.role,
            action: 'MANUAL_OVERRIDE',
            recordId: insRec.id,
            oldValue: null,
            newValue: {
              date: dateStr,
              employee_id: payload.employee_id,
              employee_name: targetEmployee.full_name,
              check_in_time: checkInIso,
              check_out_time: checkOutIso,
              status: payload.status,
              overtime_minutes: overtimeMinutes,
              reason: payload.reason,
              created_by: user.full_name,
              created_role: user.role,
            },
            ipAddress,
          });
        }
      }

      const totalAffected = created.length + updated.length;

      // Send one consolidated notification to the employee (non-fatal)
      if (totalAffected > 0) {
        try {
          const affectedDates = [...created.map((c) => c.date), ...updated.map((u) => u.date)].sort();
          const dateSummary =
            affectedDates.length === 1
              ? affectedDates[0]
              : `${affectedDates[0]} to ${affectedDates[affectedDates.length - 1]} (${affectedDates.length} days)`;

          await dispatchNotification({
            userId: payload.employee_id,
            title: 'Attendance Updated by Admin ✅',
            message: `Your attendance for ${dateSummary} has been manually marked as ${payload.status.replace('_', ' ').toUpperCase()} by ${user.full_name}. Reason: ${payload.reason}`,
            type: 'attendance_decision',
            actionUrl: '/employee/history',
            sendEmail: false,
          });
        } catch {
          // Non-fatal
        }
      }

      return NextResponse.json(
        {
          success: true,
          data: {
            employee_id: payload.employee_id,
            employee_name: targetEmployee.full_name,
            created,
            updated,
            skipped,
            total_affected: totalAffected,
          },
          message:
            totalAffected > 0
              ? `Manual attendance saved for ${targetEmployee.full_name}: ${created.length} added, ${updated.length} updated${skipped.length > 0 ? `, ${skipped.length} skipped` : ''}.`
              : `No records modified (${skipped.length} date(s) already had attendance records).`,
          timestamp: new Date().toISOString(),
        },
        { status: created.length > 0 ? 201 : 200 }
      );
    }

    // ── MODE A: Edit Existing Attendance Record ───────────────────────────────
    const payload = editExistingSchema.parse(body);

    if (payload.check_out_time && new Date(payload.check_out_time) <= new Date(payload.check_in_time)) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: { code: 'INVALID_TIME_RANGE', message: 'Check-out time must be after check-in time.' },
        },
        { status: 400 }
      );
    }

    // 2. Fetch existing record to verify branch ownership and capture old values
    const { data: oldRecord, error: fetchErr } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('id', payload.record_id)
      .single();

    if (fetchErr || !oldRecord) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'NOT_FOUND', message: 'Attendance record not found.' } },
        { status: 404 }
      );
    }

    // Branch Managers can only modify records within their own store
    if (user.role === 'branch_manager' && oldRecord.branch_id !== user.branch_id) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'FORBIDDEN', message: 'Cannot modify records of another branch.' } },
        { status: 403 }
      );
    }

    // 3. Compute overtime in Asia/Dhaka timezone using branch_settings
    const newOvertime = await computeOvertimeMinutes(
      supabase,
      oldRecord.branch_id,
      payload.check_in_time,
      payload.check_out_time
    );

    const nowIso = new Date().toISOString();

    // 4. Update Attendance Record with is_manual_override = true & override_reason
    const { data: updatedRecord, error: updateErr } = await supabase
      .from('attendance_records')
      .update({
        check_in_time: payload.check_in_time,
        check_out_time: payload.check_out_time,
        status: payload.status,
        overtime_minutes: newOvertime,
        is_manual_override: true,
        override_reason: payload.reason,
        approval_status: payload.approval_status,
        approved_by: user.id,
        approved_at: nowIso,
        approval_note: payload.reason,
      })
      .eq('id', payload.record_id)
      .select()
      .single();

    if (updateErr || !updatedRecord) {
      throw new Error(`Failed to update record: ${updateErr?.message}`);
    }

    // 5. Mandatory Audit Logging with valid schema columns
    await writeManualAuditLog(supabase, {
      actorId: user.id,
      actorRole: user.role,
      action: 'MANUAL_OVERRIDE',
      recordId: payload.record_id,
      oldValue: {
        check_in_time: oldRecord.check_in_time,
        check_out_time: oldRecord.check_out_time,
        status: oldRecord.status,
        approval_status: oldRecord.approval_status,
        overtime_minutes: oldRecord.overtime_minutes,
      },
      newValue: {
        check_in_time: payload.check_in_time,
        check_out_time: payload.check_out_time,
        status: payload.status,
        approval_status: payload.approval_status,
        overtime_minutes: newOvertime,
        reason: payload.reason,
        corrected_by: user.full_name,
        corrected_role: user.role,
      },
      ipAddress,
    });

    // 6. Notify employee about the update (non-fatal)
    try {
      const { year, month, day } = getDhakaDateParts(payload.check_in_time);
      await dispatchNotification({
        userId: oldRecord.employee_id,
        title: 'Attendance Record Edited by Management ✏️',
        message: `Your attendance for ${year}-${month}-${day} was manually updated to ${payload.status.replace('_', ' ').toUpperCase()} by ${user.full_name}. Reason: ${payload.reason}`,
        type: 'attendance_decision',
        actionUrl: '/employee/history',
        sendEmail: false,
      });
    } catch {
      // Non-fatal
    }

    return NextResponse.json({
      success: true,
      data: updatedRecord,
      message: 'Attendance record corrected successfully. Audit log created.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Only Admins can delete attendance records (matches RLS DELETE policy)
    const user = await requireRole(['admin']);
    const supabase = await createClient();

    const { searchParams } = new URL(request.url);
    let recordId = searchParams.get('record_id') || '';
    let reason = searchParams.get('reason') || 'Deleted by Admin';

    if (!recordId) {
      try {
        const body = await request.json();
        const parsed = deleteRecordSchema.parse(body);
        recordId = parsed.record_id;
        if (parsed.reason) reason = parsed.reason;
      } catch {
        return NextResponse.json(
          { success: false, data: null, error: { code: 'VALIDATION_ERROR', message: 'Valid record_id is required.' } },
          { status: 400 }
        );
      }
    } else {
      deleteRecordSchema.parse({ record_id: recordId, reason });
    }

    const { data: existing, error: fetchErr } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('id', recordId)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'NOT_FOUND', message: 'Attendance record not found.' } },
        { status: 404 }
      );
    }

    const { error: delErr } = await supabase
      .from('attendance_records')
      .delete()
      .eq('id', recordId);

    if (delErr) {
      throw new Error(`Failed to delete attendance record: ${delErr.message}`);
    }

    await writeManualAuditLog(supabase, {
      actorId: user.id,
      actorRole: user.role,
      action: 'DELETE',
      recordId,
      oldValue: {
        employee_id: existing.employee_id,
        check_in_time: existing.check_in_time,
        check_out_time: existing.check_out_time,
        status: existing.status,
      },
      newValue: {
        reason,
        deleted_by: user.full_name,
      },
      ipAddress: getSafeIpAddress(request),
    });

    return NextResponse.json({
      success: true,
      data: { id: recordId },
      message: 'Attendance record deleted successfully.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole(['admin', 'branch_manager']);
    const supabase = await createClient();

    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branch_id');

    let query = supabase
      .from('correction_requests')
      .select('*, profiles!correction_requests_employee_id_fkey(full_name)')
      .order('created_at', { ascending: false });

    // Branch managers only see their branch's requests
    if (user.role === 'branch_manager' && user.branch_id) {
      query = query.eq('branch_id', user.branch_id);
    } else if (user.role === 'admin' && branchId && branchId !== 'all') {
      query = query.eq('branch_id', branchId);
    }

    const { data: requests, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch correction requests: ${error.message}`);
    }

    const formattedData = (requests || []).map((req) => ({
      id: req.id,
      user_id: req.employee_id,
      employee_name: (req.profiles as unknown as { full_name?: string })?.full_name || 'Unknown',
      date: req.date,
      type: req.type,
      original_time: req.original_time,
      requested_time: req.requested_time,
      reason: req.reason,
      status: req.status,
      created_at: req.created_at,
    }));

    return NextResponse.json({
      success: true,
      data: formattedData,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
