import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { computeEmployeeDutySummary } from '@/lib/dutyEngine';

/**
 * GET /api/reports/employee/[id]/duty-summary?month=MM&year=YYYY
 * Computes exhaustive daily duty hours, overtime, lates, and missed days using shared dutyEngine.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(['admin', 'branch_manager', 'employee']);
    const { id: targetEmployeeId } = await params;
    const supabase = await createClient();

    // Enforce permissions: employees can only view their own
    if (user.role === 'employee' && user.id !== targetEmployeeId) {
      return NextResponse.json(
        { success: false, error: 'Access denied: You can only view your own duty report.' },
        { status: 403 }
      );
    }

    // Branch managers can only view employees in their assigned branch
    if (user.role === 'branch_manager') {
      const { data: targetProfile } = await supabase
        .from('profiles')
        .select('branch_id')
        .eq('id', targetEmployeeId)
        .single();
      if (!targetProfile || targetProfile.branch_id !== user.branch_id) {
        return NextResponse.json(
          { success: false, error: 'Access denied: Employee does not belong to your assigned branch.' },
          { status: 403 }
        );
      }
    }

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const month = Number(searchParams.get('month')) || (now.getMonth() + 1);
    const year = Number(searchParams.get('year')) || now.getFullYear();

    const summaryResult = await computeEmployeeDutySummary(supabase, targetEmployeeId, month, year);

    return NextResponse.json({
      success: true,
      data: summaryResult,
      message: `Detailed duty and overtime calculation completed for ${summaryResult.employee.full_name} (${month}/${year}).`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
