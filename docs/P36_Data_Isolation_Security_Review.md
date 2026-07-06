# Anchor Fashion — Multi-Branch Data Isolation Security Review
# Spec P36 | Prepared: 2026-07-04

## Overview

This checklist verifies that all data access boundaries are enforced at every layer
(Database RLS, API middleware, frontend routing, and Supabase Realtime).

---

## 1. Database — Row Level Security (RLS)

### 1.1 Core RLS Policies Verified
- [x] `profiles`: Users can only SELECT/UPDATE their own profile row (`id = auth.uid()`)
- [x] `attendance_logs`: Employees see only their own logs; managers see only their branch's logs
- [x] `branches`: All authenticated users can SELECT; only admins can INSERT/UPDATE/DELETE
- [x] `notifications`: Users can only SELECT/UPDATE notifications where `user_id = auth.uid()`
- [x] `manual_corrections`: Employee can create for themselves; branch_manager approves their branch only
- [x] `company_settings`: Read-only for all roles; write restricted to admin only

### 1.2 Auth Helper Functions (PostgreSQL)
- [x] `auth.user_branch_id()` — Returns the calling user's assigned branch_id from `profiles`
- [x] `auth.user_role()` — Returns the calling user's role (used in all RLS policies)
- [x] All RLS policies use `USING` + `WITH CHECK` clauses (not just one)

### 1.3 Service Role Key Usage
- [x] Service role key is ONLY used in server-side API routes (never exposed to client)
- [x] Anon key is used for all client-side Supabase queries (correctly scoped by RLS)

---

## 2. API Layer — Server-Side Guards

### 2.1 Route Handler Guards
- [x] All API routes import `requireRole()` or `getCurrentUser()` from `src/lib/auth.ts`
- [x] Branch Manager routes include `requireOwnBranch()` check before any data query
- [x] Admin-only routes explicitly check `role === 'admin'`
- [x] No API route trusts a user-supplied `branch_id` without cross-referencing the session

### 2.2 Input Validation
- [x] All POST/PUT payloads validated with Zod schemas from `src/lib/validations.ts`
- [x] No raw SQL string interpolation (all queries use parameterized Supabase client)
- [x] File upload endpoints validate MIME type and size limits

---

## 3. Frontend — Route Protection

### 3.1 Next.js Middleware
- [x] `src/middleware.ts` intercepts all `/admin/*`, `/branch-manager/*`, `/employee/*` paths
- [x] Unauthenticated users are redirected to `/login`
- [x] Role mismatch redirects to `/unauthorized` (e.g., employee accessing `/admin`)

### 3.2 Layout-Level Auth
- [x] Each layout (`AdminLayout`, `BranchManagerLayout`, `EmployeeLayout`) performs a secondary
      session check on mount via `supabase.auth.getUser()`
- [x] Stale sessions trigger immediate redirect to `/login`

---

## 4. Supabase Realtime

- [x] Realtime channel is filtered with `filter: \`user_id=eq.${userId}\``
- [x] No channel broadcasts unscoped company-wide data to employees
- [x] Channel cleanup (`removeChannel`) is called on component unmount

---

## 5. Identified Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Branch Manager guessing another branch's UUID | HIGH | `requireOwnBranch()` enforces session branch_id match |
| Employee accessing `/admin` URL directly | HIGH | Middleware + layout double-check redirects |
| SQL injection via user inputs | HIGH | Supabase parameterized client, Zod validation |
| Realtime eavesdropping | MEDIUM | Per-user filtered channels with RLS on table |
| Expired JWT still making requests | MEDIUM | Supabase auto-refreshes tokens; server validates on each request |
| Photo upload storing PII without consent | HIGH | BiometricConsentModal shown before camera activation |

---

## 6. Sign-off

| Reviewer | Role | Date | Status |
|---|---|---|---|
| Development Team | System Architect | 2026-07-04 | ✅ Complete |
