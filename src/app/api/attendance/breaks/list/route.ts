import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole(['employee', 'branch_manager', 'admin']);
    const { searchParams } = new URL(request.url);

    const branchId = searchParams.get('branch_id');
    const employeeId = searchParams.get('employee_id');
    const status = searchParams.get('status'); // 'active', 'completed', 'overstayed'
    const limit = Number(searchParams.get('limit')) || 50;

    const supabase = await createClient();
    let query = supabase
      .from('attendance_breaks')
      .select('*, profiles(full_name, employee_id, role, profile_picture), branches(name, code)', { count: 'exact' });

    if (user.role === 'employee') {
      query = query.eq('employee_id', user.id);
    } else if (user.role === 'branch_manager') {
      if (!user.branch_id) throw new Error('FORBIDDEN: Branch Manager has no assigned store.');
      query = query.eq('branch_id', user.branch_id);
      if (employeeId) query = query.eq('employee_id', employeeId);
    } else {
      // Admin
      if (branchId) query = query.eq('branch_id', branchId);
      if (employeeId) query = query.eq('employee_id', employeeId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: breaks, count, error } = await query
      .order('out_time', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch Gate-Pass records: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: breaks || [],
      meta: { total_count: count || 0 }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
