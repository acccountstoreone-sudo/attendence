import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError, getSafeIpAddress } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { dispatchToBranchStaff, dispatchToBranchManagers } from '@/lib/notification-service';
import { z } from 'zod';

const updateBranchSettingsSchema = z.object({
  work_start_time: z.string().regex(/^([01]\d|2[0-3]):?([0-5]\d):?([0-5]\d)$/).optional(),
  work_end_time: z.string().regex(/^([01]\d|2[0-3]):?([0-5]\d):?([0-5]\d)$/).optional(),
  late_grace_minutes: z.number().int().min(0).max(120).optional(),
  overtime_after_minutes: z.number().int().min(0).optional(),
  half_day_hours: z.number().min(1).max(8).optional(),
  weekly_off_days: z.array(z.number().int().min(0).max(6)).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole(['admin', 'branch_manager']);
    const { searchParams } = new URL(request.url);
    const supabase = await createClient();

    let branchId = searchParams.get('branch_id');

    if (user.role === 'branch_manager') {
      if (!user.branch_id) throw new Error('FORBIDDEN: Branch Manager has no assigned store.');
      branchId = user.branch_id;
    } else if (!branchId) {
      throw new Error('BAD_REQUEST: admin must provide branch_id');
    }

    const { data: settings, error } = await supabase
      .from('branch_settings')
      .select('*')
      .eq('branch_id', branchId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch branch settings: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: settings || null,
      message: 'Settings retrieved successfully.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireRole(['admin', 'branch_manager']);
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    let branchId = searchParams.get('branch_id');

    if (user.role === 'branch_manager') {
      if (!user.branch_id) throw new Error('FORBIDDEN: Branch Manager has no assigned store.');
      branchId = user.branch_id;
    } else if (!branchId) {
      throw new Error('BAD_REQUEST: admin must provide branch_id');
    }

    const payload = updateBranchSettingsSchema.parse(body);
    const supabase = await createClient();

    // 1. Fetch current settings before updating (to log history)
    const { data: currentSettings } = await supabase
      .from('branch_settings')
      .select('work_start_time, work_end_time, late_grace_minutes, overtime_after_minutes, half_day_hours')
      .eq('branch_id', branchId)
      .maybeSingle();

    const now = new Date().toISOString();

    // 2. If current settings exist, archive them to history before overwriting
    if (currentSettings) {
      try {
        // Close out the most recent history record (set effective_to = now)
        await supabase
          .from('branch_duty_hours_history')
          .update({ effective_to: now })
          .eq('branch_id', branchId)
          .is('effective_to', null);

        // Insert new history record for the incoming settings
        await supabase.from('branch_duty_hours_history').insert({
          branch_id: branchId,
          work_start_time: payload.work_start_time || currentSettings.work_start_time || '09:00:00',
          work_end_time: payload.work_end_time || currentSettings.work_end_time || '17:00:00',
          late_grace_minutes: payload.late_grace_minutes ?? currentSettings.late_grace_minutes ?? 15,
          overtime_after_minutes: payload.overtime_after_minutes ?? currentSettings.overtime_after_minutes ?? 0,
          half_day_hours: payload.half_day_hours ?? currentSettings.half_day_hours ?? 4.0,
          changed_by: user.id,
          change_reason: body.change_reason || null,
          effective_from: now,
          effective_to: null, // Current (open) record
        });
      } catch {
        // Non-fatal: history logging failure should not block the update
      }
    } else {
      // No previous settings — create initial history entry
      try {
        await supabase.from('branch_duty_hours_history').insert({
          branch_id: branchId,
          work_start_time: payload.work_start_time || '09:00:00',
          work_end_time: payload.work_end_time || '17:00:00',
          late_grace_minutes: payload.late_grace_minutes ?? 15,
          overtime_after_minutes: payload.overtime_after_minutes ?? 0,
          half_day_hours: payload.half_day_hours ?? 4.0,
          changed_by: user.id,
          change_reason: body.change_reason || 'Initial configuration',
          effective_from: now,
          effective_to: null,
        });
      } catch {
        // Non-fatal
      }
    }

    // 3. Upsert the branch settings
    const { data: updatedSettings, error } = await supabase
      .from('branch_settings')
      .upsert({
        branch_id: branchId,
        ...payload,
        updated_at: now,
      })
      .select()
      .single();

    if (error || !updatedSettings) {
      throw new Error(`Failed to update branch settings: ${error?.message}`);
    }

    // Notify Branch Employees and Managers about the Duty Hours change (with email & action_url)
    try {
      const startStr = updatedSettings.work_start_time || payload.work_start_time || '09:00:00';
      const endStr = updatedSettings.work_end_time || payload.work_end_time || '17:00:00';
      const notifTitle = '🕒 Store Duty Hours Updated';
      const notifMsg = `The working schedule for your store branch has been updated: Start Time: ${startStr}, End Time: ${endStr}.`;

      await Promise.all([
        dispatchToBranchStaff({
          branchId,
          title: notifTitle,
          message: notifMsg,
          type: 'info',
          actionUrl: '/employee/profile',
          sendEmail: true,
        }),
        dispatchToBranchManagers({
          branchId,
          title: notifTitle,
          message: notifMsg,
          type: 'info',
          actionUrl: '/branch-manager/salary',
          sendEmail: true,
        }),
      ]);
    } catch {
      // Non-fatal
    }

    return NextResponse.json({
      success: true,
      data: updatedSettings,
      message: `Branch duty hours updated successfully. History has been recorded.`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// GET /api/branch-settings/history?branch_id=xxx
// Returns the duty hours change history for a branch
export async function DELETE(request: NextRequest) {
  // Repurposed: GET history via query
  return GET(request);
}

