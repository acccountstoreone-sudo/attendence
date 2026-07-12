import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updateProfileSchema = z.object({
  address: z.string().optional(),
  whatsapp_number: z.string().optional(),
  photo_url: z.string().url().optional().or(z.literal('')),
});

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest) {
  try {
    // Only employees (or admins/managers editing themselves) can use this
    const user = await requireRole(['employee', 'branch_manager', 'admin']);

    const body = await request.json();
    const payload = updateProfileSchema.parse(body);

    const supabase = await createClient();

    // Prepare update object, only including provided fields
    const updates: Record<string, any> = {};
    if (payload.address !== undefined) updates.address = payload.address;
    if (payload.whatsapp_number !== undefined) updates.whatsapp_number = payload.whatsapp_number;
    if (payload.photo_url !== undefined) updates.photo_url = payload.photo_url || null; // allow clearing

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: true, message: 'No changes provided' });
    }

    const { error: updateErr } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (updateErr) {
      throw new Error(`Failed to update profile: ${updateErr.message}`);
    }

    // Log the action
    await supabase.from('audit_logs').insert({
      action: 'UPDATE',
      table_name: 'profiles',
      record_id: user.id,
      performed_by: user.id,
      new_data: updates,
    });

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
