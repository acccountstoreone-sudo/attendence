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
      const { data: profile } = await supabase.from('profiles').select('role, branch_id').eq('id', userId).single();
      if (profile && profile.role !== 'admin' && !profile.branch_id) {
        return NextResponse.json({ error: 'Cannot approve employee without an assigned branch. Please edit their profile first.' }, { status: 400 });
      }

      const { error } = await supabase
        .from('profiles')
        .update({ 
          registration_step: 'completed',
          kyc_status: 'verified',
          is_active: true
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

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg || 'Internal server error' }, { status: 500 });
  }
}

