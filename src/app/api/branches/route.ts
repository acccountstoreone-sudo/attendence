import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

const createBranchSchema = z.object({
  name: z.string().min(3, 'Branch name must be at least 3 characters.'),
  code: z.string().min(2, 'Branch code required (e.g. DHK-01).').toUpperCase(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  geofence_radius_meters: z.number().int().min(10).max(5000).default(100),
  is_active: z.boolean().default(true),
  manager_id: z.string().uuid().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isPublic = searchParams.get('public') === 'true';

    const supabase = await createClient();

    let query;

    if (isPublic) {
      // Public request (e.g. for registration dropdown)
      // Must use service_role key to bypass RLS since unauthenticated users cannot read branches by default.
      const adminSupabase = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      query = adminSupabase
        .from('branches')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
    } else {
      // Authenticated request
      const user = await requireRole(['admin', 'branch_manager', 'employee']);
      query = supabase
        .from('branches')
        .select('*, profiles!branches_manager_id_fkey(full_name)')
        .eq('is_active', true)
        .order('name');

      // Branch Managers and Employees see their assigned store; Admin sees all
      if (user.role !== 'admin' && user.branch_id) {
        query = query.eq('id', user.branch_id);
      }
    }

    const { data: branches, error } = await query;
    if (error) throw new Error(`Failed to fetch branches: ${error.message}`);

    return NextResponse.json({
      success: true,
      data: branches || [],
      message: 'Branches retrieved successfully.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Admin-only branch creation (Spec P21)
    const user = await requireRole(['admin']);
    const body = await request.json();
    const payload = createBranchSchema.parse(body);

    const supabase = await createClient();

    // Check if code already exists
    const { data: existingCode } = await supabase
      .from('branches')
      .select('id')
      .eq('code', payload.code)
      .maybeSingle();

    if (existingCode) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'DUPLICATE_CODE', message: `Branch code '${payload.code}' is already in use.` } },
        { status: 400 }
      );
    }

    const { data: newBranch, error: insertErr } = await supabase
      .from('branches')
      .insert({
        name: payload.name,
        code: payload.code,
        address: payload.address,
        city: payload.city,
        phone: payload.phone,
        latitude: payload.latitude,
        longitude: payload.longitude,
        geofence_radius_meters: payload.geofence_radius_meters,
        manager_id: payload.manager_id || null,
        is_active: payload.is_active,
      })
      .select()
      .single();

    if (insertErr || !newBranch) {
      throw new Error(`Failed to create branch: ${insertErr?.message}`);
    }

    // If manager_id was provided, update that user's profile to branch_manager and set branch_id
    if (payload.manager_id) {
      await supabase
        .from('profiles')
        .update({ role: 'branch_manager', branch_id: newBranch.id })
        .eq('id', payload.manager_id);
    }

    // Audit log
    const auditRes = await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: 'CREATE',
      table_name: 'branches',
      record_id: newBranch.id,
      new_value: payload,
      ip_address: request.headers.get('x-forwarded-for') || '127.0.0.1',
    });

    return NextResponse.json(
      {
        success: true,
        data: newBranch,
        message: `Branch '${newBranch.name}' created successfully with ${newBranch.geofence_radius_meters}m geofence.`,
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}

