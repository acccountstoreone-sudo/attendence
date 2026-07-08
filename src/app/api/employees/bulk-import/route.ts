import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError, getSafeIpAddress } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const csvRowSchema = z.object({
  full_name: z.string().min(2, 'Full name required'),
  email: z.string().email('Invalid email'),
  phone: z.string().optional().nullable(),
  employee_id: z.string().optional().nullable(),
  role: z.enum(['admin', 'branch_manager', 'employee']).default('employee'),
  branch_id: z.string().uuid().optional().nullable(),
  password: z.string().min(8).optional().default('Anchor2026!'),
});

const bulkImportSchema = z.object({
  rows: z.array(z.any()).min(1, 'At least 1 row required').max(200, 'Maximum 200 rows per batch'),
  default_branch_id: z.string().uuid().optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(['admin', 'branch_manager']);
    const body = await request.json();
    const payload = bulkImportSchema.parse(body);

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

    const supabase = await createClient();

    // Verify default branch or enforced branch for Branch Managers
    let branchIdToUse = payload.default_branch_id;
    if (user.role === 'branch_manager') {
      branchIdToUse = user.branch_id;
    }

    const results: { email: string; full_name: string; status: 'success' | 'error'; reason?: string }[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (const rawRow of payload.rows) {
      try {
        const row = csvRowSchema.parse({
          full_name: rawRow.full_name?.trim() || rawRow.Name?.trim() || '',
          email: rawRow.email?.trim() || rawRow.Email?.trim() || '',
          phone: rawRow.phone?.trim() || rawRow.Phone?.trim() || null,
          employee_id: rawRow.employee_id?.trim() || rawRow.ID?.trim() || rawRow['Employee ID']?.trim() || null,
          role: rawRow.role?.trim() || rawRow.Role?.trim() || 'employee',
          branch_id: rawRow.branch_id?.trim() || branchIdToUse || null,
          password: rawRow.password?.trim() || 'Anchor2026!',
        });

        if (user.role === 'branch_manager' && row.role === 'admin') {
          throw new Error('Branch Managers cannot create admin accounts.');
        }

        const effectiveBranchId = user.role === 'branch_manager' ? user.branch_id : (row.branch_id || branchIdToUse);

        // Check existing profile by email
        const { data: existing } = await adminClient.from('profiles').select('id').eq('email', row.email).maybeSingle();
        if (existing) {
          throw new Error(`Email '${row.email}' already exists.`);
        }

        // Create auth account
        const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
          email: row.email,
          password: row.password || 'Anchor2026!',
          email_confirm: true,
        });

        if (authErr || !authData.user) {
          throw new Error(authErr?.message || 'Auth creation failed.');
        }

        const isEmployeeActive = row.role === 'admin' || !!effectiveBranchId;

        const { error: profErr } = await adminClient.from('profiles').upsert({
          id: authData.user.id,
          email: row.email,
          full_name: row.full_name,
          role: row.role as 'admin' | 'branch_manager' | 'employee',
          branch_id: effectiveBranchId || null,
          phone: row.phone || null,
          employee_id: row.employee_id || null,
          is_active: isEmployeeActive,
        });

        if (profErr) {
          throw new Error(profErr.message);
        }

        successCount++;
        results.push({ email: row.email, full_name: row.full_name, status: 'success' });
      } catch (err: unknown) {
        errorCount++;
        const msg = err instanceof z.ZodError ? err.errors.map(e => e.message).join(', ') : (err instanceof Error ? err.message : 'Unknown error');
        results.push({
          email: rawRow.email || rawRow.Email || 'Unknown',
          full_name: rawRow.full_name || rawRow.Name || 'Unknown',
          status: 'error',
          reason: msg,
        });
      }
    }

    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'BULK_IMPORT_EMPLOYEES',
      table_name: 'profiles',
      new_values: { success_count: successCount, error_count: errorCount },
      ip_address: getSafeIpAddress(request),
    });

    return NextResponse.json({
      success: true,
      data: {
        success_count: successCount,
        error_count: errorCount,
        results,
      },
      message: `Bulk import completed: ${successCount} added, ${errorCount} failed.`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
