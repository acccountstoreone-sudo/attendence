import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { userId, action } = await request.json(); // action = 'approve' | 'reject'

    if (!userId || !action) {
      return NextResponse.json({ error: 'User ID and Action are required' }, { status: 400 });
    }

    const supabase = await createClient();
    
    // In a real app, verify that the logged-in user is an admin or manager
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (action === 'approve') {
      // Get manager's branch to assign to the new employee
      const { data: bmProfile } = await supabase.from('profiles').select('branch_id').eq('id', currentUser.id).single();

      const { error } = await supabase
        .from('profiles')
        .update({ 
          registration_step: 'completed',
          kyc_status: 'verified',
          is_active: true,
          branch_id: bmProfile?.branch_id || null
        })
        .eq('id', userId);

      if (error) throw error;
      return NextResponse.json({ success: true, message: 'Employee Approved' });
    } else {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          registration_step: 'rejected',
          kyc_status: 'rejected',
          is_active: false
        })
        .eq('id', userId);

      if (error) throw error;
      return NextResponse.json({ success: true, message: 'Employee Rejected' });
    }

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
