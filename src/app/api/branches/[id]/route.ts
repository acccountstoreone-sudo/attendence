import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { revalidatePath } from 'next/cache';

const updateBranchSchema = z.object({
  name: z.string().min(3).optional(),
  code: z.string().min(2).optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
  longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
  geofence_radius_meters: z.coerce.number().min(10).max(50000).optional().transform((v) => v !== undefined ? Math.round(v) : undefined),
  manager_id: z.string().uuid().nullable().optional(),
  is_active: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: branchId } = await params;
    const user = await requireRole(['admin', 'branch_manager', 'employee']);

    if (user.role !== 'admin' && user.branch_id !== branchId) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'FORBIDDEN', message: 'You can only view your assigned branch.' } },
        { status: 403 }
      );
    }

    const supabase = await createClient();
    const { data: branch, error } = await supabase
      .from('branches')
      .select('*, profiles!branches_manager_id_fkey(full_name)')
      .eq('id', branchId)
      .single();

    if (error || !branch) {
      throw new Error(`Failed to fetch branch: ${error?.message}`);
    }

    return NextResponse.json({
      success: true,
      data: branch,
      message: 'Branch retrieved successfully.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: branchId } = await params;
    const user = await requireRole(['admin', 'branch_manager']);
    const body = await request.json();
    const payload = updateBranchSchema.parse(body);

    if (user.role === 'branch_manager') {
      if (user.branch_id !== branchId) {
        return NextResponse.json(
          { success: false, data: null, error: { code: 'FORBIDDEN', message: 'You can only update your own assigned branch.' } },
          { status: 403 }
        );
      }
      // Branch Managers cannot modify store manager assignments, deactivation state, or branch code
      delete payload.manager_id;
      delete payload.is_active;
      delete payload.code;
    }

    const supabase = await createClient();
    const dbClient = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
      : supabase;

    // Fetch existing branch state for safety checks and manager demotion
    const { data: existingBranch } = await dbClient
      .from('branches')
      .select('manager_id, is_active')
      .eq('id', branchId)
      .single();

    // Prevent deactivation if active staff exist
    if (payload.is_active === false && existingBranch?.is_active === true) {
      const { count, error: countErr } = await dbClient
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
              message: `Cannot deactivate branch: There are ${count} active employee(s) assigned to this store. Reassign or offboard them first.`,
            },
            timestamp: new Date().toISOString(),
          },
          { status: 400 }
        );
      }
    }

    const { data: updatedBranch, error } = await dbClient
      .from('branches')
      .update(payload)
      .eq('id', branchId)
      .select()
      .single();

    if (error || !updatedBranch) {
      throw new Error(`Failed to update branch: ${error?.message}`);
    }

    // If manager_id changed, update their profile and demote old manager (Admin only since we stripped manager_id for BM)
    if (payload.manager_id !== undefined && existingBranch) {
      // Demote old manager if it changed
      if (existingBranch.manager_id && existingBranch.manager_id !== payload.manager_id) {
        await dbClient
          .from('profiles')
          .update({ role: 'employee' })
          .eq('id', existingBranch.manager_id);
      }

      // Promote new manager
      if (payload.manager_id) {
        await dbClient
          .from('profiles')
          .update({ role: 'branch_manager', branch_id: branchId })
          .eq('id', payload.manager_id);
      }
    }

    await dbClient.from('audit_logs').insert({
      actor_id: user.id,
      action: 'UPDATE',
      table_name: 'branches',
      record_id: branchId,
      new_value: payload,
      ip_address: request.headers.get('x-forwarded-for') || '127.0.0.1',
    });

    try {
      revalidatePath('/admin/branches');
      revalidatePath(`/admin/branches/${branchId}`);
      revalidatePath('/employee/check-in');
      revalidatePath('/branch-manager/store');
    } catch {
      // Ignore if revalidatePath fails outside Next route context
    }

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
