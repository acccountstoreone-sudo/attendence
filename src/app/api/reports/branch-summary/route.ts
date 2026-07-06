import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'admin' && user.role !== 'branch_manager')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    let branchQuery = supabase.from('branches').select('*');
    if (user.role === 'branch_manager') {
      branchQuery = branchQuery.eq('id', user.branch_id);
    }
    
    const { data: branches, error: branchError } = await branchQuery;
    if (branchError) throw branchError;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const summary = await Promise.all(branches.map(async (branch) => {
       const { count: staffCount } = await supabase
         .from('profiles')
         .select('*', { count: 'exact', head: true })
         .eq('branch_id', branch.id)
         .eq('role', 'employee');

       const { data: attData } = await supabase
         .from('attendance_records')
         .select('status')
         .eq('branch_id', branch.id)
         .gte('check_in_time', startOfDay.toISOString())
         .lte('check_in_time', endOfDay.toISOString());

       let present = 0;
       let late = 0;
       let absent = 0;

       if (attData) {
         present = attData.filter(a => a.status === 'present').length;
         late = attData.filter(a => a.status === 'late').length;
         absent = attData.filter(a => a.status === 'absent').length;
       }

       return {
         branch_id: branch.id,
         name: branch.name,
         code: branch.id.split('-')[0].toUpperCase(),
         address: branch.address || 'Unknown Address',
         total_staff: staffCount || 0,
         present_today: present,
         late_today: late,
         absent_today: absent,
         alert_count: 0 // Mocked alerts for now
       };
    }));

    return NextResponse.json({
      success: true,
      data: summary
    });

  } catch (error) {
    return handleApiError(error);
  }
}
