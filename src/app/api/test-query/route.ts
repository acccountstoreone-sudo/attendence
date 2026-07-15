import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const query = supabase
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
          photo_url
        ),
        branches!attendance_records_branch_id_fkey (
          name
        )
      `)
      .order('check_in_time', { ascending: false })
      .limit(300);

    const { data, error } = await query;
    return NextResponse.json({ success: true, data: data, error: error });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}
