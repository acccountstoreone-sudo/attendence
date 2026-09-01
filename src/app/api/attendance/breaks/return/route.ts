import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { dispatchToAdmins, dispatchToBranchManagers } from '@/lib/notification-service';
import { isWithinGeofence } from '@/lib/geo';
import { z } from 'zod';

const returnBreakSchema = z.object({
  break_id: z.string().uuid().optional(),
  employee_id: z.string().uuid().optional(),
  return_note: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(['employee', 'branch_manager', 'admin']);
    const body = await request.json().catch(() => ({}));
    const input = returnBreakSchema.parse(body);

    const supabase = await createClient();

    let targetEmployeeId = user.id;
    if (input.employee_id && input.employee_id !== user.id) {
      if (user.role === 'employee') {
        throw new Error('FORBIDDEN: Employees can only verify return for themselves.');
      }
      targetEmployeeId = input.employee_id;
    }

    // 1. Find active break record
    let query = supabase
      .from('attendance_breaks')
      .select('*, profiles!attendance_breaks_employee_id_fkey(full_name, branch_id)')
      .eq('status', 'active');

    if (input.break_id) {
      query = query.eq('id', input.break_id);
    } else {
      query = query.eq('employee_id', targetEmployeeId);
    }

    const { data: breakRecord, error: findErr } = await query.order('out_time', { ascending: false }).limit(1).maybeSingle();

    if (findErr || !breakRecord) {
      if (findErr) console.error('[Gate-Pass Return Error]:', findErr);
      return NextResponse.json({
        success: false,
        error: 'No active Gate-Pass found to return from.'
      }, { status: 404 });
    }

    // GPS Location Verification for Employees Returning Themselves
    if (user.role === 'employee') {
      if (!input.latitude || !input.longitude) {
        return NextResponse.json({
          success: false,
          error: {
            code: 'MISSING_LOCATION',
            message: 'Location access is required to verify return. Please enable GPS permissions.',
          }
        }, { status: 400 });
      }

      const { data: branch, error: branchErr } = await supabase
        .from('branches')
        .select('name, latitude, longitude, geofence_radius_meters, is_active')
        .eq('id', breakRecord.branch_id)
        .single();

      if (branchErr || !branch || !branch.latitude || !branch.longitude) {
        return NextResponse.json({
          success: false,
          error: {
            code: 'BRANCH_GEO_MISSING',
            message: 'Branch geofence coordinates are not configured.',
          }
        }, { status: 500 });
      }

      const geo = isWithinGeofence(
        input.latitude,
        input.longitude,
        Number(branch.latitude),
        Number(branch.longitude),
        branch.geofence_radius_meters || 100
      );

      if (!geo.within) {
        return NextResponse.json({
          success: false,
          error: {
            code: 'OUT_OF_GEOFENCE',
            message: `Return denied: You are ${geo.distance}m away from ${branch.name} (max allowed: ${branch.geofence_radius_meters || 100}m). Please return to the branch to verify.`,
          }
        }, { status: 403 });
      }
    }

    // Role check if verifying someone else's break
    if (user.role === 'branch_manager' && breakRecord.branch_id !== user.branch_id) {
      throw new Error('FORBIDDEN: This Gate-Pass belongs to another store.');
    }

    const now = new Date();
    const outTime = new Date(breakRecord.out_time);
    const diffMillis = now.getTime() - outTime.getTime();
    const actualDurationMinutes = Math.max(1, Math.round(diffMillis / 60000));

    // If actual duration exceeds expected duration (with 2 min buffer), mark as overstayed
    const isOverstayed = actualDurationMinutes > (breakRecord.expected_duration_minutes + 2);
    const newStatus = isOverstayed ? 'overstayed' : 'completed';

    // 2. Update break record
    const { data: updatedBreak, error: updateErr } = await supabase
      .from('attendance_breaks')
      .update({
        return_time: now.toISOString(),
        actual_duration_minutes: actualDurationMinutes,
        status: newStatus,
        updated_at: now.toISOString(),
      })
      .eq('id', breakRecord.id)
      .select('*')
      .single();

    if (updateErr || !updatedBreak) {
      throw new Error(`Failed to update Gate-Pass return time: ${updateErr?.message}`);
    }

    // 3. Send notification alert
    const empName = breakRecord.profiles?.full_name || 'Employee';
    const breakLabelMap: Record<string, string> = {
      namaz_prayer: '🕌 Prayer / Namaz Break',
      tea_lunch: '☕ Tea / Lunch Break',
      official_bank: '🏦 Official Duty / Bank Pass',
      short_emergency: '🏥 Short Emergency Leave',
      personal: '🚶 Personal Gate Pass',
    };
    const breakTitle = breakLabelMap[breakRecord.break_type] || 'Gate Pass';

    if (isOverstayed) {
      await dispatchToBranchManagers({
        branchId: breakRecord.branch_id,
        title: `⚠️ Gate-Pass Overstay Alert: ${empName}`,
        message: `Returned from ${breakTitle} after ${actualDurationMinutes}m (Expected: ${breakRecord.expected_duration_minutes}m. Overstayed by ${actualDurationMinutes - breakRecord.expected_duration_minutes}m).`,
        type: 'alert',
        actionUrl: `/admin/attendance?branch=${breakRecord.branch_id}&tab=breaks`,
      });
      await dispatchToAdmins({
        title: `⚠️ Gate-Pass Overstay: ${empName}`,
        message: `${empName} overstayed ${breakTitle} by ${actualDurationMinutes - breakRecord.expected_duration_minutes} minutes (${actualDurationMinutes}m total vs ${breakRecord.expected_duration_minutes}m allowed).`,
        type: 'alert',
        actionUrl: `/admin/attendance?branch=${breakRecord.branch_id}&tab=breaks`,
      });
    } else {
      await dispatchToBranchManagers({
        branchId: breakRecord.branch_id,
        title: `✅ ${empName} Returned to Store`,
        message: `Verified return from ${breakTitle} inside allowed limit (${actualDurationMinutes} mins total).`,
        type: 'success',
        actionUrl: `/admin/attendance?branch=${breakRecord.branch_id}&tab=breaks`,
      });
    }

    return NextResponse.json({
      success: true,
      data: updatedBreak,
      message: isOverstayed 
        ? `Returned and verified after ${actualDurationMinutes} mins (Marked OVERSTAYED by ${actualDurationMinutes - breakRecord.expected_duration_minutes} mins).`
        : `Break return verified successfully (${actualDurationMinutes} mins). Welcome back!`
    });

  } catch (error) {
    return handleApiError(error);
  }
}
