import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const applyCorrectionSchema = z.object({
  record_id: z.string().uuid().optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  type: z.enum(['check_in', 'check_out']),
  original_time: z.string().optional().nullable(),
  requested_time: z.string().datetime({ offset: true }).or(z.string()),
  reason: z.string().min(5).max(500),
});

/**
 * POST /api/corrections/apply
 * Allows an employee to submit an attendance correction request.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(['employee', 'branch_manager', 'admin']);
    const body = await request.json();
    const input = applyCorrectionSchema.parse(body);

    const supabase = await createClient();

    // BUG-NEW-09 fix: normalize requested_time to Dhaka offset (+06:00) so DB stores correct UTC
    let requestedISO = input.requested_time;
    if (!requestedISO.includes('T')) {
      requestedISO = `${input.date}T${input.requested_time}:00+06:00`;
    } else if (!requestedISO.includes('+') && !requestedISO.endsWith('Z')) {
      // Assume Dhaka local time if no offset given
      requestedISO = `${input.date}T${input.requested_time.split('T')[1] || input.requested_time}+06:00`;
    }

    // APP-08 fix: resolve branch_id — admins have null branch_id so look it up
    let branchId = user.branch_id ?? null;
    if (!branchId && input.record_id) {
      const { data: rec } = await supabase
        .from('attendance_records')
        .select('branch_id')
        .eq('id', input.record_id)
        .single();
      branchId = rec?.branch_id ?? null;
    }

    const payload: Record<string, unknown> = {
      employee_id: user.id,
      branch_id: branchId,
      record_id: input.record_id || null,
      date: input.date,
      type: input.type,
      original_time: input.original_time || null,
      requested_time: requestedISO,
      reason: input.reason,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: requestRecord, error: reqErr } = await supabase
      .from('correction_requests')
      .insert(payload)
      .select()
      .single();

    if (reqErr) throw new Error(reqErr.message);

    return NextResponse.json({
      success: true,
      data: requestRecord,
      message: 'Attendance correction request submitted successfully.',
    });
  } catch (error) {
    return handleApiError(error);
  }
}


