import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/leaves/list
 * Lists leave requests scoped by role:
 * - Admin: All leave requests across all branches (or filtered by branch_id)
 * - Branch Manager: Leave requests for employees in their branch
 * - Employee: Own leave requests only
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireRole(['admin', 'branch_manager', 'employee']);
    const supabase = await createClient();

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status'); // e.g. 'pending', 'approved', 'rejected', or null for all
    const branchIdFilter = searchParams.get('branch_id');
    const startDateFilter = searchParams.get('start_date');
    const endDateFilter = searchParams.get('end_date');

    let query = supabase.from('leave_requests').select('*').order('created_at', { ascending: false });

    // Scope by role
    if (user.role === 'employee') {
      query = query.or(`user_id.eq.${user.id},employee_id.eq.${user.id}`);
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

    // Bug #1 Fix: Apply start_date and end_date range filtering when specified
    if (startDateFilter) {
      query = query.gte('start_date', startDateFilter);
    }
    if (endDateFilter) {
      query = query.lte('end_date', endDateFilter);
    }

    const { data: leaves, error: leaveErr } = await query;
    if (leaveErr) throw new Error(leaveErr.message);

    if (!leaves || leaves.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Collect distinct IDs to fetch profile, branch, and leave type metadata resiliently
    const userIds = Array.from(new Set(leaves.map((l) => l.user_id || l.employee_id).filter(Boolean)));
    const reviewerIds = Array.from(new Set(leaves.map((l) => l.approved_by).filter(Boolean)));
    const allProfileIds = Array.from(new Set([...userIds, ...reviewerIds]));
    const branchIds = Array.from(new Set(leaves.map((l) => l.branch_id).filter(Boolean)));
    const leaveTypeIds = Array.from(new Set(leaves.map((l) => l.leave_type_id).filter(Boolean)));

    // Fetch profiles for both applicants and reviewers
    const { data: profiles } = allProfileIds.length > 0
      ? await supabase.from('profiles').select('id, full_name, email, role, employee_id').in('id', allProfileIds)
      : { data: [] };
    const profMap: Record<string, Record<string, unknown>> = {};
    (profiles || []).forEach((p) => { profMap[p.id] = p as unknown as Record<string, unknown>; });

    // Fetch branches
    const { data: branches } = branchIds.length > 0
      ? await supabase.from('branches').select('id, name, code').in('id', branchIds)
      : { data: [] };
    const branchMap: Record<string, Record<string, unknown>> = {};
    (branches || []).forEach((b) => { branchMap[b.id] = b as unknown as Record<string, unknown>; });

    // Fetch leave types
    const { data: leaveTypes } = leaveTypeIds.length > 0
      ? await supabase.from('leave_types').select('id, code, name').in('id', leaveTypeIds)
      : { data: [] };
    const typeMap: Record<string, Record<string, unknown>> = {};
    (leaveTypes || []).forEach((t) => { typeMap[t.id] = t as unknown as Record<string, unknown>; });

    // Enrich leaves
    const enriched = leaves.map((l) => {
      const targetUserId = l.user_id || l.employee_id;
      const prof = profMap[targetUserId] || {};
      const reviewerProf = l.approved_by ? (profMap[l.approved_by] || {}) : {};
      const branch = branchMap[l.branch_id] || {};
      const lType = typeMap[l.leave_type_id] || {};

      return {
        ...l,
        employee_name: prof.full_name || 'Unknown Employee',
        employee_email: prof.email || '',
        employee_code: prof.employee_id || '',
        branch_name: branch.name || 'Main Branch',
        branch_code: branch.code || '',
        leave_type_name: lType.name || l.type || 'General Leave',
        leave_type_code: lType.code || l.type || 'CASUAL',
        approved_by_name: reviewerProf.full_name || (l.approved_by ? 'Authorized Reviewer' : null),
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


