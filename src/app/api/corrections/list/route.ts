import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/corrections/list
 * Lists correction requests scoped by role:
 * - Admin: All requests
 * - Branch Manager: Requests in their assigned branch
 * - Employee: Own requests
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireRole(['admin', 'branch_manager', 'employee']);
    const supabase = await createClient();

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const branchIdFilter = searchParams.get('branch_id');

    let query = supabase.from('correction_requests').select('*').order('created_at', { ascending: false });

    // Role-based scope
    if (user.role === 'employee') {
      query = query.eq('employee_id', user.id);
    } else if (user.role === 'branch_manager') {
      query = query.eq('branch_id', user.branch_id);
    } else if (user.role === 'admin') {
      if (branchIdFilter && branchIdFilter !== 'all') {
        query = query.eq('branch_id', branchIdFilter);
      }
    }

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data: corrections, error: corrErr } = await query;
    if (corrErr) throw new Error(corrErr.message);

    if (!corrections || corrections.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Enrich with employee & branch metadata
    const userIds = Array.from(new Set(corrections.map((c) => c.employee_id).filter(Boolean)));
    const branchIds = Array.from(new Set(corrections.map((c) => c.branch_id).filter(Boolean)));

    const { data: profiles } = userIds.length > 0
      ? await supabase.from('profiles').select('id, full_name, email, role, employee_id').in('id', userIds)
      : { data: [] };
    const profMap: Record<string, Record<string, unknown>> = {};
    (profiles || []).forEach((p) => { profMap[p.id] = p as unknown as Record<string, unknown>; });

    const { data: branches } = branchIds.length > 0
      ? await supabase.from('branches').select('id, name, code').in('id', branchIds)
      : { data: [] };
    const branchMap: Record<string, Record<string, unknown>> = {};
    (branches || []).forEach((b) => { branchMap[b.id] = b as unknown as Record<string, unknown>; });

    const enriched = corrections.map((c) => {
      const prof = profMap[c.employee_id] || {};
      const branch = branchMap[c.branch_id] || {};
      return {
        ...c,
        employee_name: prof.full_name || 'Unknown Employee',
        employee_email: prof.email || '',
        employee_code: prof.employee_id || '',
        branch_name: branch.name || 'Main Branch',
        branch_code: branch.code || '',
      };
    });

    return NextResponse.json({
      success: true,
      data: enriched,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
