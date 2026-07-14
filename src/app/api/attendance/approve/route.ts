import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { dispatchNotification } from '@/lib/notification-service';
import { z } from 'zod';

const approveSchema = z.object({
  attendance_id: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
  note: z.string().optional(),
});

// GET /api/attendance/approve?date=YYYY-MM-DD|all&status=pending|approved|rejected|all
// Returns pending (or all) attendance records for Admins & Branch Managers
export async function GET(request: NextRequest) {
  try {
    const user = await requireRole(['admin', 'branch_manager']);
    const { searchParams } = new URL(request.url);
    const supabase = await createClient();

    const dateParam = searchParams.get('date');
    const statusFilter = searchParams.get('status') || 'pending'; // pending | approved | rejected | all

    let query = supabase
      .from('attendance_records')
      .select(`
        id,
        employee_id,
        branch_id,
        check_in_time,
        check_out_time,
        status,
        approval_status,
        is_manual_override,
        approved_by,
        approved_at,
        approval_note,
        overtime_minutes,
        overtime_approval_status,
        approved_overtime_minutes,
        overtime_approval_note,
        is_holiday_duty,
        face_verified,
        profiles!attendance_records_employee_id_fkey (
          full_name,
          photo_url,
          employee_id
        ),
        branches!attendance_records_branch_id_fkey (
          name
        )
      `)
      .order('check_in_time', { ascending: false });

    // Handle date filtering (if not 'all' or when specific date requested)
    if (dateParam && dateParam !== 'all' && dateParam.includes('-')) {
      const [year, month, day] = dateParam.split('-');
      const startOfDay = new Date(`${year}-${month}-${day}T00:00:00+06:00`);
      const endOfDay   = new Date(`${year}-${month}-${day}T23:59:59+06:00`);
      query = query.gte('check_in_time', startOfDay.toISOString()).lte('check_in_time', endOfDay.toISOString());
    } else if (!dateParam && statusFilter !== 'pending') {
      // Default to today if no date specified and not fetching pending list
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Dhaka',
        year: 'numeric', month: '2-digit', day: '2-digit',
      });
      const [m, d, y] = formatter.format(now).split('/');
      const startOfDay = new Date(`${y}-${m}-${d}T00:00:00+06:00`);
      const endOfDay   = new Date(`${y}-${m}-${d}T23:59:59+06:00`);
      query = query.gte('check_in_time', startOfDay.toISOString()).lte('check_in_time', endOfDay.toISOString());
    } else {
      // Limit to 300 recent items when querying across all dates to keep performance snappy
      query = query.limit(300);
    }

    // Scope to BM's branch
    if (user.role === 'branch_manager') {
      if (!user.branch_id) throw new Error('Branch Manager has no assigned branch.');
      query = query.eq('branch_id', user.branch_id);
    } else if (searchParams.get('branch_id') && searchParams.get('branch_id') !== 'all') {
      query = query.eq('branch_id', searchParams.get('branch_id')!);
    }

    // Status / Overtime filter
    if (searchParams.get('type') === 'overtime') {
      query = query.gt('overtime_minutes', 0);
      if (statusFilter !== 'all') {
        if (statusFilter === 'pending') {
          query = query.or('overtime_approval_status.eq.pending,overtime_approval_status.is.null');
        } else {
          query = query.eq('overtime_approval_status', statusFilter);
        }
      }
    } else if (statusFilter !== 'all') {
      query = query.eq('approval_status', statusFilter);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch attendance: ${error.message}`);

    return NextResponse.json({
      success: true,
      data: data || [],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/attendance/approve
// Body: { attendance_id, action: 'approve' | 'reject', note? }
export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(['admin', 'branch_manager']);
    const body = await request.json();
    const payload = approveSchema.parse(body);
    const supabase = await createClient();

    // Fetch the attendance record
    const { data: record, error: fetchErr } = await supabase
      .from('attendance_records')
      .select('id, branch_id, employee_id, check_in_time, approval_status')
      .eq('id', payload.attendance_id)
      .single();

    if (fetchErr || !record) {
      return NextResponse.json({
        success: false,
        data: null,
        error: { code: 'NOT_FOUND', message: 'Attendance record not found.' },
        timestamp: new Date().toISOString(),
      }, { status: 404 });
    }

    // BM can only approve records from their branch
    if (user.role === 'branch_manager' && record.branch_id !== user.branch_id) {
      return NextResponse.json({
        success: false,
        data: null,
        error: { code: 'FORBIDDEN', message: 'You can only approve attendance records from your branch.' },
        timestamp: new Date().toISOString(),
      }, { status: 403 });
    }

    // Update approval status
    const { data: updated, error: updateErr } = await supabase
      .from('attendance_records')
      .update({
        approval_status: payload.action === 'approve' ? 'approved' : 'rejected',
        is_manual_override: payload.action === 'approve' ? true : false,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        approval_note: payload.note || null,
      })
      .eq('id', payload.attendance_id)
      .select()
      .single();

    if (updateErr || !updated) {
      throw new Error(`Failed to update approval: ${updateErr?.message}`);
    }

    // Notify the employee about the decision (with email & action_url)
    try {
      const actionText = payload.action === 'approve' ? 'approved ✅' : 'rejected ❌';
      const checkInTime = new Date(record.check_in_time).toLocaleTimeString('en-BD', {
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dhaka',
      });
      await dispatchNotification({
        userId: record.employee_id,
        title: `Check-in ${payload.action === 'approve' ? 'Approved ✅' : 'Rejected ❌'}`,
        message: `Your ${checkInTime} check-in has been ${actionText} by Management.${payload.note ? ` Note: ${payload.note}` : ''}`,
        type: 'attendance_decision',
        actionUrl: '/employee/history',
        sendEmail: true,
      });
    } catch {
      // Non-fatal
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Check-in has been ${payload.action === 'approve' ? 'approved' : 'rejected'} successfully.`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

