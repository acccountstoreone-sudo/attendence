import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    // 1. All authenticated roles can view history (scoped by RLS & query filters)
    const user = await requireRole(['admin', 'branch_manager', 'employee']);
    const { searchParams } = new URL(request.url);

    const employeeId = searchParams.get('employee_id');
    const branchId = searchParams.get('branch_id');
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const limit = Number(searchParams.get('limit')) || 50;
    const page = Number(searchParams.get('page')) || 1;
    const offset = (page - 1) * limit;

    const supabase = await createClient();
    let query = supabase
      .from('attendance_records')
      .select('*, profiles!inner(full_name, photo_url, role), branches(name)', { count: 'exact' });

    // Role-based scoping enforcement (in addition to database RLS)
    if (user.role === 'employee') {
      // Employees can only ever see their own records
      query = query.eq('employee_id', user.id);
    } else if (user.role === 'branch_manager') {
      // Branch Managers can only see records for their store
      query = query.eq('branch_id', user.branch_id!);
      if (employeeId) query = query.eq('employee_id', employeeId);
    } else if (user.role === 'admin') {
      // Admin sees all, or can filter by specific branch or employee
      if (branchId) query = query.eq('branch_id', branchId);
      if (employeeId) query = query.eq('employee_id', employeeId);
    }

    // Date filtering by month and year
    if (month && year) {
      const startOfMonth = new Date(Number(year), Number(month) - 1, 1, 0, 0, 0);
      const endOfMonth = new Date(Number(year), Number(month), 0, 23, 59, 59, 999);
      query = query
        .gte('check_in_time', startOfMonth.toISOString())
        .lte('check_in_time', endOfMonth.toISOString());
    }

    // Pagination and sorting
    const { data: records, count, error } = await query
      .order('check_in_time', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch history: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: records || [],
      meta: {
        total_count: count || 0,
        page,
        limit,
        total_pages: Math.ceil((count || 0) / limit),
      },
      message: 'Attendance history retrieved successfully.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
