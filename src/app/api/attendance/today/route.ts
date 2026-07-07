import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const supabase = await createClient();
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const [month, day, year] = formatter.format(now).split('/');
    
    const startOfDay = new Date(`${year}-${month}-${day}T00:00:00+06:00`);
    const endOfDay = new Date(`${year}-${month}-${day}T23:59:59+06:00`);

    const { data: record, error } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', user.id)
      .gte('check_in_time', startOfDay.toISOString())
      .lte('check_in_time', endOfDay.toISOString())
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch today status: ${error.message}`);
    }

    if (!record) {
      return NextResponse.json({
        success: true,
        data: {
          checked_in: false,
          checked_out: false,
          status: 'none',
          check_in_time: null,
          check_out_time: null,
          overtime_minutes: 0,
        },
        message: "No check-in recorded for today yet.",
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        checked_in: true,
        checked_out: !!record.check_out_time,
        status: record.status,
        check_in_time: record.check_in_time,
        check_out_time: record.check_out_time,
        overtime_minutes: record.overtime_minutes || 0,
        record_id: record.id,
      },
      message: "Today's attendance status retrieved.",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
