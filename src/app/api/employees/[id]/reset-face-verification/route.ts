import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: targetEmployeeId } = await params;
    const user = await getCurrentUser();
    if (!user || (user.role !== 'admin' && user.role !== 'branch_manager')) {
      return NextResponse.json(
        { success: false, error: { message: 'UNAUTHORIZED: Only Admin or Branch Manager can cancel/reset face verification.' } },
        { status: 403 }
      );
    }

    const supabase = await createClient();

    // Verify target exists
    const { data: targetProfile, error: profErr } = await supabase
      .from('profiles')
      .select('id, full_name, role, branch_id')
      .eq('id', targetEmployeeId)
      .single();

    if (profErr || !targetProfile) {
      return NextResponse.json(
        { success: false, error: { message: 'Employee profile not found.' } },
        { status: 404 }
      );
    }

    if (user.role === 'branch_manager' && targetProfile.branch_id !== user.branch_id) {
      return NextResponse.json(
        { success: false, error: { message: 'UNAUTHORIZED: Cannot reset face verification for employee in another branch.' } },
        { status: 403 }
      );
    }

    // Try updating with requires_face_reverification first (if migration applied)
    const updatePayloadWithCol: Record<string, unknown> = {
      face_enrolled: false,
      facial_id: null,
      face_descriptor: null,
      requires_face_reverification: true,
      face_reset_at: new Date().toISOString(),
      face_reset_by: user.id,
    };

    let { error: updateErr } = await supabase
      .from('profiles')
      .update(updatePayloadWithCol)
      .eq('id', targetEmployeeId);

    // Fallback if column requires_face_reverification has not been migrated on live DB yet
    if (updateErr && (updateErr.message?.includes('requires_face_reverification') || updateErr.code === '42703')) {
      const fallbackPayload: Record<string, unknown> = {
        face_enrolled: false,
        facial_id: null,
        face_descriptor: null,
      };
      const fallbackRes = await supabase
        .from('profiles')
        .update(fallbackPayload)
        .eq('id', targetEmployeeId);
      updateErr = fallbackRes.error;
    }

    if (updateErr) {
      throw new Error(`Failed to reset face verification: ${updateErr.message}`);
    }

    // Send high-priority notification to the employee so when they open app or click notification they go right to re-verification
    try {
      await supabase.from('notifications').insert({
        user_id: targetEmployeeId,
        title: '⚠️ Face Verification Reset by Admin',
        message: 'Your previous biometric face verification has been cancelled by management. You must re-verify your face right now before checking in.',
        type: 'warning',
        action_url: '/employee/check-in?reverify=true',
      });
    } catch (err) {
      console.error('Notification insert failed:', err);
    }

    return NextResponse.json({
      success: true,
      message: `Biometric face verification cancelled and reset for ${targetProfile.full_name}. Notification sent.`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
