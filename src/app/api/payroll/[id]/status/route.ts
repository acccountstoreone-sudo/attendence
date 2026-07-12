import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const statusSchema = z.object({
  status: z.enum(['finalized', 'paid']),
});

/**
 * PATCH /api/payroll/[id]/status
 * MISS-05 fix: Allows admin to finalize or mark as paid a payroll sheet.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(['admin']);
    const { id } = await params;
    const body = await request.json();
    const input = statusSchema.parse(body);

    const supabase = await createClient();

    const { data: sheet, error: fetchErr } = await supabase
      .from('payroll_sheets')
      .select('id, status')
      .eq('id', id)
      .single();

    if (fetchErr || !sheet) {
      return NextResponse.json({ success: false, error: 'Payroll sheet not found.' }, { status: 404 });
    }

    // Validate transitions: draft → finalized → paid
    const validTransitions: Record<string, string[]> = {
      draft: ['finalized'],
      finalized: ['paid'],
      paid: [],
    };

    if (!validTransitions[sheet.status]?.includes(input.status)) {
      return NextResponse.json(
        { success: false, error: `Cannot transition from '${sheet.status}' to '${input.status}'.` },
        { status: 422 }
      );
    }

    const { data: updated, error: updErr } = await supabase
      .from('payroll_sheets')
      .update({ status: input.status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (updErr) throw new Error(updErr.message);

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Payroll sheet marked as '${input.status}'.`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
