import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError, getSafeIpAddress } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
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

    // Upsert the branch settings
    const { data: updatedSettings, error } = await supabase
      .from('branch_settings')
      .upsert({
        branch_id: branchId,
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error || !updatedSettings) {
      throw new Error(`Failed to update branch settings: ${error?.message}`);
    }

    return NextResponse.json({
      success: true,
      data: updatedSettings,
      message: `Branch settings updated successfully.`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
