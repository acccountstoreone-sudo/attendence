import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updateBranchSchema = z.object({
  name: z.string().min(3).optional(),
  code: z.string().min(2).optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  geofence_radius_meters: z.number().int().min(10).max(5000).optional(),
  manager_id: z.string().uuid().nullable().optional(),
  is_active: z.boolean().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: branchId } = await params;
    const user = await requireRole(['admin']);
    const body = await request.json();
    const payload = updateBranchSchema.parse(body);

    const supabase = await createClient();

    const { data: updatedBranch, error } = await supabase
      .from('branches')
      .update(payload)
      .eq('id', branchId)
      .select()
      .single();

    if (error || !updatedBranch) {
      throw new Error(`Failed to update branch: ${error?.message}`);
    }

    // If manager_id changed, update their profile
    if (payload.manager_id !== undefined) {
      if (payload.manager_id) {
        await supabase
          .from('profiles')
          .update({ role: 'branch_manager', branch_id: branchId })
          .eq('id', payload.manager_id);
      }
    }

    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: 'UPDATE',
      table_name: 'branches',
      record_id: branchId,
      new_value: payload,
      ip_address: request.headers.get('x-forwarded-for') || '127.0.0.1',
    });

    return NextResponse.json({
      success: true,
      data: updatedBranch,
      message: `Branch '${updatedBranch.name}' updated successfully.`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Soft-delete branch (set is_active = false). Do not allow deleting if active employees exist (Spec P21)
    const { id: branchId } = await params;
    const user = await requireRole(['admin']);
    const supabase = await createClient();

    // Check for active staff assigned to this branch
    const { count, error: countErr } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('branch_id', branchId)
      .eq('is_active', true);

    if (countErr) throw new Error(`Failed to check branch staff: ${countErr.message}`);

    if (count && count > 0) {
      return NextResponse.json(
        {
          success: false,
          data: { active_employees_count: count },
          error: {
            code: 'BRANCH_HAS_ACTIVE_STAFF',
            message: `Cannot delete branch: There are ${count} active employee(s) assigned to this store. Reassign or offboard them first.`,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const { data: deletedBranch, error: delErr } = await supabase
      .from('branches')
      .update({ is_active: false })
      .eq('id', branchId)
      .select()
      .single();

    if (delErr || !deletedBranch) {
      throw new Error(`Failed to soft-delete branch: ${delErr?.message}`);
    }

    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: 'DEACTIVATE',
      table_name: 'branches',
      record_id: branchId,
      old_value: { is_active: true },
      new_value: { is_active: false },
      ip_address: request.headers.get('x-forwarded-for') || '127.0.0.1',
    });

    return NextResponse.json({
      success: true,
      data: deletedBranch,
      message: `Branch '${deletedBranch.name}' has been deactivated (soft-deleted).`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
