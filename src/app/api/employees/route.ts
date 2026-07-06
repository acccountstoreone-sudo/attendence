import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const createEmployeeSchema = z.object({
  email: z.string().email('Invalid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.').default('Anchor2026!'),
  full_name: z.string().min(2, 'Full name is required.'),
  role: z.enum(['admin', 'branch_manager', 'employee']).default('employee'),
  branch_id: z.string().uuid().nullable().optional(),
  phone: z.string().optional().nullable(),
  photo_url: z.string().url().optional().nullable(),
  facial_id: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole(['admin', 'branch_manager']);
    const { searchParams } = new URL(request.url);

    const branchId = searchParams.get('branch_id');
    const role = searchParams.get('role');
    const search = searchParams.get('search');
    const limit = Number(searchParams.get('limit')) || 50;
    const page = Number(searchParams.get('page')) || 1;
    const offset = (page - 1) * limit;

    const supabase = await createClient();
    let query = supabase
      .from('profiles')
      .select('*, branches!profiles_branch_id_fkey(name, code)', { count: 'exact' })
      .eq('is_active', true);

    // Branch Managers can ONLY see employees in their assigned store (Spec P22)
    if (user.role === 'branch_manager') {
      if (!user.branch_id) throw new Error('FORBIDDEN: Branch Manager has no assigned store.');
      query = query.eq('branch_id', user.branch_id);
    } else if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    if (role) query = query.eq('role', role);
    if (search) query = query.ilike('full_name', `%${search}%`);

    const { data: employees, count, error } = await query
      .order('full_name', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(`Failed to fetch employees: ${error.message}`);

    return NextResponse.json({
      success: true,
      data: employees || [],
      meta: {
        total_count: count || 0,
        page,
        limit,
        total_pages: Math.ceil((count || 0) / limit),
      },
      message: 'Employees retrieved successfully.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Admin and Branch Managers can onboard new staff (Spec P22)
    const user = await requireRole(['admin', 'branch_manager']);
    const body = await request.json();
    const payload = createEmployeeSchema.parse(body);

    // Branch Managers can only create staff for their own branch and cannot create admins
    if (user.role === 'branch_manager') {
      if (payload.role === 'admin') {
        throw new Error('FORBIDDEN: Branch Managers cannot create Admin accounts.');
      }
      if (payload.branch_id && payload.branch_id !== user.branch_id) {
        throw new Error('FORBIDDEN: You can only onboard employees to your own store.');
      }
      payload.branch_id = user.branch_id;
    }

    const supabase = await createClient();

    // Note: In a production Supabase app, creating a user account requires calling supabase.auth.admin.createUser
    // using the Service Role Key, or having the user sign up. Here we insert directly into profiles assuming
    // either custom auth trigger or service role helper.
    const { data: newProfile, error: profErr } = await supabase
      .from('profiles')
      .insert({
        email: payload.email,
        full_name: payload.full_name,
        role: payload.role,
        branch_id: payload.branch_id || null,
        phone: payload.phone || null,
        photo_url: payload.photo_url || null,
        facial_id: payload.facial_id || null,
        is_active: true,
      })
      .select()
      .single();

    if (profErr || !newProfile) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'CREATE_FAILED', message: profErr?.message || 'Profile creation failed.' } },
        { status: 400 }
      );
    }

    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'ONBOARD_EMPLOYEE',
      table_name: 'profiles',
      record_id: newProfile.id,
      new_values: { email: payload.email, full_name: payload.full_name, role: payload.role, branch_id: payload.branch_id },
      ip_address: request.headers.get('x-forwarded-for') || '127.0.0.1',
    });

    return NextResponse.json(
      {
        success: true,
        data: newProfile,
        message: `Employee '${newProfile.full_name}' onboarded successfully.`,
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
