import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError, getSafeIpAddress } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const requestCorrectionSchema = z.object({
  record_id: z.string().uuid().optional().nullable(),
  date: z.string(), // YYYY-MM-DD
  type: z.enum(['check_in', 'check_out']),
  original_time: z.string().datetime().optional().nullable(),
  requested_time: z.string().datetime(),
  reason: z.string().min(5, 'Reason must be at least 5 characters long.'),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(['employee', 'branch_manager', 'admin']);
    const body = await request.json();
    const payload = requestCorrectionSchema.parse(body);

    const supabase = await createClient();

    // Verify employee has a branch
    if (!user.branch_id) {
      return NextResponse.json(
        { success: false, error: { message: 'You must be assigned to a branch to request a correction.' } },
        { status: 400 }
      );
    }

    // Insert correction request
    const { data: requestRecord, error: insertErr } = await supabase
      .from('correction_requests')
      .insert({
        employee_id: user.id,
        branch_id: user.branch_id,
        record_id: payload.record_id || null,
        date: payload.date,
        type: payload.type,
        original_time: payload.original_time || null,
        requested_time: payload.requested_time,
        reason: payload.reason,
        status: 'pending',
      })
      .select()
      .single();

    if (insertErr || !requestRecord) {
      throw new Error(`Failed to create correction request: ${insertErr?.message}`);
    }

    return NextResponse.json({
      success: true,
      data: requestRecord,
      message: 'Correction request submitted successfully.',
    });
  } catch (error) {
    return handleApiError(error);
  }
}

