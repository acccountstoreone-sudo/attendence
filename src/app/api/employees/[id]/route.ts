import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, requireRole, handleApiError, getSafeIpAddress } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updateEmployeeSchema = z.object({
  full_name: z.string().min(2).optional(),
  role: z.enum(['admin', 'branch_manager', 'employee']).optional(),
  branch_id: z.string().uuid().nullable().optional(),
  phone: z.string().nullable().optional(),
  photo_url: z.string().url().nullable().optional(),
  facial_id: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: targetId } = await params;
    const user = await getCurrentUser();
    if (!user) throw new Error('UNAUTHENTICATED: Active session required.');

    const supabase = await createClient();

    const { data: employee, error } = await supabase
      .from('profiles')
      .select('*, branches!profiles_branch_id_fkey(name, code, address)')
      .eq('id', targetId)
      .single();

    if (error || !employee) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'NOT_FOUND', message: 'Employee profile not found.' } },
        { status: 404 }
      );
    }

    // Scoping enforcement: Employee sees self; BM sees own branch; Admin sees all
    if (user.role === 'employee' && user.id !== targetId) {
      throw new Error('FORBIDDEN: You can only view your own profile.');
    } else if (user.role === 'branch_manager' && employee.branch_id !== user.branch_id) {
      throw new Error('FORBIDDEN: You can only view staff profiles within your assigned store.');
    }

    return NextResponse.json({
      success: true,
      data: employee,
      message: 'Employee profile retrieved successfully.',
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
    const { id: targetId } = await params;
    const user = await requireRole(['admin', 'branch_manager']);
    const body = await request.json();
    const payload = updateEmployeeSchema.parse(body);

    const supabase = await createClient();

    // Fetch existing profile to check branch ownership
    const { data: oldProfile, error: fetchErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', targetId)
      .single();

    if (fetchErr || !oldProfile) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'NOT_FOUND', message: 'Employee not found.' } },
        { status: 404 }
      );
    }

    if (user.role === 'branch_manager') {
      if (oldProfile.branch_id !== user.branch_id && oldProfile.branch_id !== null) {
        throw new Error('FORBIDDEN: Cannot modify employees of another store.');
      }
      if (payload.role === 'admin' || oldProfile.role === 'admin') {
        throw new Error('FORBIDDEN: Branch Managers cannot modify Admin accounts or promote staff to Admin.');
      }
      if (payload.branch_id !== undefined && payload.branch_id !== user.branch_id) {
        throw new Error('FORBIDDEN: Cannot transfer employees to another store or unassign them.');
      }
    }

    // Check database constraint logic (chk_role_branch): Active employees MUST have a branch assigned
    const newRole = payload.role ?? oldProfile.role;
    const newBranchId = payload.branch_id !== undefined ? payload.branch_id : oldProfile.branch_id;
    const newIsActive = payload.is_active !== undefined ? payload.is_active : oldProfile.is_active;

    if (newIsActive && newRole !== 'admin' && !newBranchId) {
      throw new Error('VALIDATION_ERROR: Cannot activate an employee without assigning them to a store/branch first.');
    }

    const { createClient: createAdminClient } = await import('@supabase/supabase-js');
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      throw new Error('INTERNAL: SUPABASE_SERVICE_ROLE_KEY is not configured.');
    }
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: updatedProfile, error: updateErr } = await adminClient
      .from('profiles')
      .update(payload)
      .eq('id', targetId)
      .select()
      .single();

    if (updateErr || !updatedProfile) {
      throw new Error(`Failed to update employee: ${updateErr?.message}`);
    }

    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'UPDATE_EMPLOYEE',
      table_name: 'profiles',
      record_id: targetId,
      old_values: { role: oldProfile.role, branch_id: oldProfile.branch_id, is_active: oldProfile.is_active },
      new_values: payload,
      ip_address: getSafeIpAddress(request),
    });

    return NextResponse.json({
      success: true,
      data: updatedProfile,
      message: `Employee '${updatedProfile.full_name}' updated successfully.`,
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
    // Soft-delete employee (set is_active = false). Log offboarding to audit_logs (Spec P22)
    const { id: targetId } = await params;
    const user = await requireRole(['admin']);
    const supabase = await createClient();

    const { data: offboardedProfile, error: delErr } = await supabase
      .from('profiles')
      .update({ is_active: false })
      .eq('id', targetId)
      .select()
      .single();

    if (delErr || !offboardedProfile) {
      throw new Error(`Failed to offboard employee: ${delErr?.message}`);
    }

    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'OFFBOARD_EMPLOYEE',
      table_name: 'profiles',
      record_id: targetId,
      old_values: { is_active: true },
      new_values: { is_active: false },
      ip_address: getSafeIpAddress(request),
    });

    return NextResponse.json({
      success: true,
      data: offboardedProfile,
      message: `Employee '${offboardedProfile.full_name}' has been offboarded (account deactivated).`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
