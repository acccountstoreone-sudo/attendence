import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError, getSafeIpAddress } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const createEmployeeSchema = z.object({
  email: z.string().email('Invalid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.').optional(),
  full_name: z.string().min(2, 'Full name is required.'),
  role: z.enum(['admin', 'branch_manager', 'employee']).default('employee'),
  branch_id: z.string().uuid().nullable().optional(),
  phone: z.string().optional().nullable(),
  photo_url: z.string().url().optional().nullable(),
  facial_id: z.string().optional().nullable(),
  employee_id: z.string().optional().nullable(),
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
    // Bug 17 fix: Support fetching inactive employees for restoration
    const includeInactive = searchParams.get('include_inactive') === 'true';

    const supabase = await createClient();
    let query = supabase
      .from('profiles')
      .select('*, branches!profiles_branch_id_fkey(name, code)', { count: 'exact' });

    // Only filter to active by default; admin can request inactive employees too
    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

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

    const employeeList = employees || [];
    
    // Fetch today's attendance for these employees (APP-09 fix: use Dhaka UTC+6 timezone)
    if (employeeList.length > 0) {
      const now = new Date();
      const dhakaFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit',
      });
      const [mo, da, yr] = dhakaFormatter.format(now).split('/');
      const todayStart = new Date(`${yr}-${mo}-${da}T00:00:00+06:00`);
      const todayEnd = new Date(`${yr}-${mo}-${da}T23:59:59+06:00`);
      
      const { data: attendanceData } = await supabase
        .from('attendance_records')
        .select('employee_id')
        .in('employee_id', employeeList.map(e => e.id))
        .gte('check_in_time', todayStart.toISOString())
        .lte('check_in_time', todayEnd.toISOString());
        
      const presentIds = new Set(attendanceData?.map(a => a.employee_id) || []);
      
      employeeList.forEach(e => {
        e.is_present_today = presentIds.has(e.id);
      });
    }

    return NextResponse.json({
      success: true,
      data: employeeList,
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

    // Use Service Role Key to create auth user (so they can actually log in)
    const { createClient: createAdminClient } = await import('@supabase/supabase-js');
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      throw new Error('INTERNAL: SUPABASE_SERVICE_ROLE_KEY is not configured. Contact system administrator.');
    }
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const generatedPassword = payload.password || Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase() + '!';
    const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
      email: payload.email,
      password: generatedPassword,
      email_confirm: true, // Auto-confirm so they can log in immediately
    });

    if (authErr || !authData.user) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'AUTH_CREATE_FAILED', message: authErr?.message || 'Failed to create auth account.' } },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const isEmployeeActive = payload.role === 'admin' || !!payload.branch_id;

    // Upsert the profile record with the real auth UUID
    const { data: newProfile, error: profErr } = await adminClient
      .from('profiles')
      .upsert({
        id: authData.user.id, // Use the auth user's UUID as the primary key
        email: payload.email,
        full_name: payload.full_name,
        role: payload.role,
        branch_id: payload.branch_id || null,
        phone: payload.phone || null,
        photo_url: payload.photo_url || null,
        facial_id: payload.facial_id || null,
        employee_id: payload.employee_id || null,
        is_active: isEmployeeActive,
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
      action: 'CREATE',
      table_name: 'profiles',
      record_id: newProfile.id,
      new_value: { email: payload.email, full_name: payload.full_name, role: payload.role, branch_id: payload.branch_id },
      ip_address: getSafeIpAddress(request),
    });

    // MISS-01: Initialize leave balances for new employees
    if (payload.role === 'employee') {
      const currentYear = new Date().getFullYear();
      const { data: leaveTypes } = await supabase.from('leave_types').select('id, default_days').eq('is_active', true);
      if (leaveTypes && leaveTypes.length > 0) {
        const balances = leaveTypes.map((lt: { id: string; default_days?: number }) => ({
          user_id: newProfile.id,
          leave_type_id: lt.id,
          year: currentYear,
          allocated_days: lt.default_days ?? 10,
          used_days: 0,
        }));
        await supabase.from('leave_balances').upsert(balances, { onConflict: 'user_id,leave_type_id,year', ignoreDuplicates: true });
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: newProfile,
        generatedPassword: !payload.password ? generatedPassword : null,
        message: `Employee '${newProfile.full_name}' onboarded successfully.`,
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}

