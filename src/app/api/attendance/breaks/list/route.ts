import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

function getDhakaDayRange(dateParam?: string | null) {
  if (!dateParam || dateParam === 'all') return null;

  if (dateParam === 'yesterday') {
    const now = new Date();
    now.setDate(now.getDate() - 1);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const [mo, da, yr] = formatter.format(now).split('/');
    return {
      start: new Date(`${yr}-${mo}-${da}T00:00:00+06:00`).toISOString(),
      end: new Date(`${yr}-${mo}-${da}T23:59:59.999+06:00`).toISOString(),
    };
  }

  if (dateParam.includes('-')) {
    const [yr, mo, da] = dateParam.split('-');
    return {
      start: new Date(`${yr}-${mo.padStart(2, '0')}-${da.padStart(2, '0')}T00:00:00+06:00`).toISOString(),
      end: new Date(`${yr}-${mo.padStart(2, '0')}-${da.padStart(2, '0')}T23:59:59.999+06:00`).toISOString(),
    };
  }

  // Default 'today'
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const [mo, da, yr] = formatter.format(now).split('/');
  return {
    start: new Date(`${yr}-${mo}-${da}T00:00:00+06:00`).toISOString(),
    end: new Date(`${yr}-${mo}-${da}T23:59:59.999+06:00`).toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole(['employee', 'branch_manager', 'admin']);
    const { searchParams } = new URL(request.url);

    const branchId = searchParams.get('branch_id');
    const employeeId = searchParams.get('employee_id');
    const status = searchParams.get('status'); // 'pending', 'active', 'completed', 'overstayed', 'all'
    const dateParam = searchParams.get('date'); // 'today', 'yesterday', 'YYYY-MM-DD', 'all'
    const limit = Number(searchParams.get('limit')) || 200;

    const supabase = await createClient();
    let query = supabase
      .from('attendance_breaks')
      .select('*, profiles!attendance_breaks_employee_id_fkey(full_name, employee_id, role, photo_url), branches(name, code)', { count: 'exact' });

    // Role-based scoping
    if (user.role === 'employee') {
      query = query.eq('employee_id', user.id);
    } else if (user.role === 'branch_manager') {
      if (!user.branch_id) throw new Error('FORBIDDEN: Branch Manager has no assigned store.');
      query = query.eq('branch_id', user.branch_id);
      if (employeeId) query = query.eq('employee_id', employeeId);
    } else {
      // Admin
      if (branchId && branchId !== 'all') query = query.eq('branch_id', branchId);
      if (employeeId) query = query.eq('employee_id', employeeId);
    }

    // Determine date range
    // If viewing returned/completed passes, default date filter to 'today' unless explicitly set to 'all'
    const effectiveDateParam = dateParam || (status === 'completed' ? 'today' : null);
    const dateRange = getDhakaDayRange(effectiveDateParam);

    // Filter by status
    if (status === 'pending') {
      query = query.eq('status', 'pending');
      // Pending requests are live; do not restrict by date unless explicitly asked
      if (dateParam && dateParam !== 'all' && dateRange) {
        query = query.gte('created_at', dateRange.start).lte('created_at', dateRange.end);
      }
    } else if (status === 'active') {
      // Active passes are currently outside
      query = query.eq('status', 'active').is('return_time', null);
      if (dateParam && dateParam !== 'all' && dateRange) {
        query = query.gte('created_at', dateRange.start).lte('created_at', dateRange.end);
      }
    } else if (status === 'completed') {
      // Returned passes: includes both on-time 'completed' and late 'overstayed' returns
      query = query.not('return_time', 'is', null);
      if (dateRange) {
        query = query.gte('return_time', dateRange.start).lte('return_time', dateRange.end);
      }
    } else if (status === 'overstayed') {
      // Overstayed alerts: either marked overstayed or currently active and outside past limit
      query = query.eq('status', 'overstayed');
      if (dateRange) {
        query = query.gte('created_at', dateRange.start).lte('created_at', dateRange.end);
      }
    } else if (status && status !== 'all') {
      query = query.eq('status', status);
      if (dateRange) {
        query = query.gte('created_at', dateRange.start).lte('created_at', dateRange.end);
      }
    } else {
      // 'all' passes
      if (dateRange) {
        query = query.gte('created_at', dateRange.start).lte('created_at', dateRange.end);
      }
    }

    const { data: breaks, count, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch Gate-Pass records: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: breaks || [],
      meta: { total_count: count || 0, date: effectiveDateParam || 'all' }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
