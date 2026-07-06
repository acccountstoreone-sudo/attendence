import { NextRequest, NextResponse } from 'next/server';
import { requireOwnBranch, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: branchId } = await params;
    
    // 1. Enforce Branch Scoping: BM can only request own store; Admin can request any
    await requireOwnBranch(branchId);

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const month = Number(searchParams.get('month')) || (now.getMonth() + 1);
    const year = Number(searchParams.get('year')) || now.getFullYear();

    if (month < 1 || month > 12 || year < 2020 || year > 2100) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'INVALID_DATE', message: 'Invalid month or year.' } },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 2. Call Postgres RPC get_branch_monthly_summary (Spec P12 & P20)
    const { data: summary, error } = await supabase.rpc('get_branch_monthly_summary', {
      p_branch_id: branchId,
      p_month: month,
      p_year: year,
    });

    if (error) {
      throw new Error(`RPC Execution Failed: ${error.message}`);
    }

    // Fetch branch name for report header
    const { data: branch } = await supabase
      .from('branches')
      .select('name')
      .eq('id', branchId)
      .single();

    return NextResponse.json({
      success: true,
      data: {
        branch_id: branchId,
        branch_name: branch?.name || 'Unknown Store',
        month,
        year,
        summary: summary || [],
      },
      message: `Monthly attendance report retrieved for ${branch?.name || 'Store'}.`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
