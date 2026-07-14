import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// Bug 22 fix: Validate x-forwarded-for before trusting it to prevent spoofing in audit logs
const IP_REGEX = /^(\d{1,3}\.){3}\d{1,3}$|^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
export function getSafeIpAddress(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (!forwarded) return 'Internal';
  // Take only the first IP in case of proxy chain
  const firstIp = forwarded.split(',')[0].trim();
  return IP_REGEX.test(firstIp) ? firstIp : 'Unknown';
}

/**
 * Auth Security Guard (Spec P33).
 * Validates session cookie freshness, enforces role boundaries, and
 * provides typed currentUser helper for all Server Components & Route Handlers.
 */

export interface AuthUser {
  id: string;
  email: string;
  role: 'admin' | 'branch_manager' | 'employee';
  branch_id: string | null;
  full_name: string;
  is_active: boolean;
}

/**
 * Returns the currently authenticated user from the Supabase session.
 * Throws a typed error string if unauthenticated.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const supabase = await createClient();

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  // Fetch role and additional profile data
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, branch_id, is_active')
    .eq('id', user.id)
    .single();

  if (!profile) return null;
  if (!profile.is_active && profile.role !== 'admin') return null;

  return {
    id: user.id,
    email: user.email!,
    role: profile.role as AuthUser['role'],
    branch_id: profile.branch_id,
    full_name: profile.full_name,
    is_active: profile.is_active,
  };
}

/**
 * Role guard for API Route Handlers (Spec P33 & P34).
 * Usage: const user = await requireRole(['admin', 'branch_manager']);
 */
export async function requireRole(allowedRoles: AuthUser['role'][]): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHENTICATED: Please sign in to access this resource.');
  if (!allowedRoles.includes(user.role)) {
    throw new Error(`FORBIDDEN: This action requires one of these roles: ${allowedRoles.join(', ')}.`);
  }
  return user;
}

/**
 * Branch ownership guard — ensures branch_managers can only access their own branch data.
 * Admins bypass this check automatically.
 */
export async function requireOwnBranch(requestedBranchId: string): Promise<AuthUser> {
  const user = await requireRole(['admin', 'branch_manager', 'employee']);
  if (user.role !== 'admin' && user.branch_id !== requestedBranchId) {
    throw new Error('FORBIDDEN: Access restricted to your assigned branch only.');
  }
  return user;
}

/**
 * Centralized API error handler (Spec P24 & P33).
 * Maps error types to correct HTTP status codes.
 */
export function handleApiError(error: unknown): NextResponse {
  const timestamp = new Date().toISOString();
  const message =
    error instanceof z.ZodError
      ? 'VALIDATION_ERROR'
      : error instanceof Error
      ? error.message
      : 'An unexpected error occurred';

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request payload or query parameters.',
          details: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
        timestamp,
      },
      { status: 400 }
    );
  }

  const isUnauth = message.startsWith('UNAUTHENTICATED');
  const isForbidden = message.startsWith('FORBIDDEN');
  const isRateLimit = message.startsWith('RATE_LIMIT_EXCEEDED');

  return NextResponse.json(
    {
      success: false,
      data: null,
      error: {
        code: isUnauth ? 'UNAUTHORIZED' : isForbidden ? 'FORBIDDEN' : isRateLimit ? 'RATE_LIMIT' : 'INTERNAL_SERVER_ERROR',
        message: message.replace(/^(UNAUTHENTICATED|FORBIDDEN|RATE_LIMIT_EXCEEDED): /, ''),
      },
      timestamp,
    },
    { status: isUnauth ? 401 : isForbidden ? 403 : isRateLimit ? 429 : 500 }
  );
}

