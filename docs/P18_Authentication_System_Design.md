# Authentication System Design & Security Architecture
**Project Title**: Anchor Fashion — In-House Multi-Branch Attendance Management System  
**Document Version**: 1.0.0  
**Prepared For**: Anchor Fashion (Security Engineering & Technical Leadership)  
**Specification Reference**: Spec P18 (Category 03: Backend & API)  

---

## 1. Executive Summary

Anchor Fashion’s Attendance Management System handles sensitive employee attendance logs, biometric verification flags, and payroll-relevant calculation sheets across dozens of physical retail stores. To secure this data, we implement a robust authentication and authorization architecture using **Supabase Auth (JWTs)** integrated with **Next.js 14 App Router Edge Middleware** and **Server-Side Route Handlers**.

This document details:
1. How user role and branch metadata are attached to sessions.
2. Why our two-tier verification approach (Middleware + Database Query / Custom Claims) guarantees maximum security without sacrificing performance.
3. The specification for our core security deliverables: `src/middleware.ts`, `src/lib/auth.ts`, and `src/app/login/page.tsx`.

---

## 2. Attaching Role & Branch Information to Sessions

In Supabase, user accounts reside in the system-managed `auth.users` table, while business-specific attributes (such as `role = 'admin' | 'branch_manager' | 'employee'`, `branch_id`, and `full_name`) reside in our public `profiles` table (linked via `id = auth.uid()`).

To make this role information available during API requests and page navigations, we utilize a **Hybrid Custom Claims + Server-Side Profile Lookup Strategy**:

### 2.1 Why Not Rely Solely on Client-Side LocalStorage or Cookies?
* Storing roles in plain browser cookies or localStorage is vulnerable to client-side tampering (e.g., a malicious employee editing their cookie from `role: "employee"` to `role: "admin"`).
* Therefore, role verification **must always be cryptographically validated or verified against the database** on the server side.

### 2.2 Our Implementation: Secure JWT Session + Profile Lookup
1. **Supabase Auth JWT**: When an employee or manager logs in via `/login`, Supabase Auth issues an access token (JWT) signed with our project's secret key and sets an **`httpOnly`, `Secure`, `SameSite=Lax` cookie** via `@supabase/ssr`. This cookie cannot be accessed or modified by client-side JavaScript.
2. **Server-Side Profile Query (`requireRole`)**: When a request hits a Server Action or API Route Handler, our server-side helper (`src/lib/auth.ts`) calls `supabase.auth.getUser()`, extracts the authenticated user UUID, and queries `public.profiles` using the Supabase Service/Server client:
   ```sql
   SELECT role, branch_id, is_active FROM public.profiles WHERE id = :auth_uid LIMIT 1;
   ```
3. **Database RLS Enforceability**: Because our PostgreSQL database has Row Level Security (RLS) enabled (Spec P11), even if an attacker bypassed the Next.js API layer and attempted to query Supabase directly using an API key, the database engine evaluates `auth.user_role()` and `auth.user_branch_id()`, blocking unauthorized data access at the kernel level.

---

## 3. Defense-in-Depth Architecture (Why This is Secure)

Our architecture provides **Three Layers of Security Defense**:

```
[Client Browser / Tablet]
        │
        ▼ (HTTP Request with httpOnly Session Cookie)
+-----------------------------------------------------------------------------------+
| LAYER 1: Next.js Edge Middleware (src/middleware.ts)                              |
|  - Runs on Vercel Edge Network before page rendering.                             |
|  - Checks if session cookie exists and is valid.                                  |
|  - Enforces route group isolation:                                                |
|    * /admin/*          -> Rejects if role != 'admin'                              |
|    * /branch-manager/* -> Rejects if role != 'branch_manager'                     |
|    * /employee/*       -> Rejects if role != 'employee'                           |
|  - Redirects unauthenticated users immediately to /login.                         |
+-----------------------------------------------------------------------------------+
        │
        ▼ (Allowed through Middleware)
+-----------------------------------------------------------------------------------+
| LAYER 2: Server-Side Route Guard (src/lib/auth.ts -> requireRole())               |
|  - Executed at line 1 of every API Route Handler (/api/*) & Server Action.        |
|  - Queries live DB profile to verify user is still active (`is_active = true`).   |
|  - Prevents race conditions where an employee was terminated 5 minutes ago        |
|    but their JWT cookie hasn't expired yet.                                       |
+-----------------------------------------------------------------------------------+
        │
        ▼ (API executes Supabase Query)
+-----------------------------------------------------------------------------------+
| LAYER 3: PostgreSQL Row Level Security (RLS Policies from Spec P11)               |
|  - The database engine checks `auth.uid()`, `auth.user_role()`, and `branch_id`.  |
|  - Guarantees Branch Managers CANNOT read records from neighboring stores.       |
+-----------------------------------------------------------------------------------+
```

### 3.1 Key Security Benefits
* **Instant Revocation**: By checking `is_active = true` in `requireRole()`, if HR terminates an employee or deactivates a store manager via the Admin portal, their API access is cut off instantly—even before their JWT session token expires.
* **No CSRF Vulnerabilities**: By using Next.js App Router with `@supabase/ssr` server cookies (`SameSite=Lax`), cross-site request forgery attacks are mitigated by default.
* **No Privilege Escalation**: Role assignments can only be mutated by users holding the `'admin'` role, enforced by database RLS policies on the `profiles` table.

---

## 4. Deliverables Specification (Spec P18)

### 4.1 `src/middleware.ts` (Edge Routing Guard)
* Intercepts all incoming requests matching `/*` (excluding static assets `/_next/static`, `/favicon.ico`, and `/api/auth/*`).
* Refreshes expired Supabase Auth tokens automatically via `@supabase/ssr` `createServerClient`.
* Redirects unauthenticated users attempting to access protected dashboards to `/login`.
* Redirects authenticated users away from `/login` directly to their designated home dashboard (`/admin`, `/branch-manager`, or `/employee`).

### 4.2 `src/lib/auth.ts` (Server-Side Auth Helpers)
* **`getCurrentUser()`**: Returns the authenticated user's session and profile data (`id`, `email`, `role`, `branch_id`, `full_name`, `photo_url`).
* **`requireRole(allowedRoles: UserRole[])`**: Validates user identity and checks if their role is in the allowed list. If unauthorized or inactive, throws a `403 Forbidden` error or returns an error response envelope.
* **`requireOwnBranch(targetBranchId: string)`**: Enforces branch scoping for Branch Managers. If the user is an Admin, allows access; if a Branch Manager, checks `user.branch_id === targetBranchId`.

### 4.3 `src/app/login/page.tsx` (Login UI Component)
* Built using modern Tailwind CSS and Lucide icons, styled according to our premium design aesthetic (vibrant indigo/slate palette, glassmorphism card, smooth micro-animations).
* Features:
  * Email and Password input fields with real-time validation.
  * Loading spinner and disabled submit state during authentication.
  * Clean error alert banners for invalid credentials or deactivated accounts.
  * Automatic post-login redirection based on assigned role.

---

*Document approved by Anchor Fashion Security Leadership. Proceeding to implementation.*
