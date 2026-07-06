# Development Roadmap
**Project Title**: Anchor Fashion — In-House Multi-Branch Attendance Management System  
**Document Version**: 1.0.0  
**Prepared For**: Anchor Fashion (Technical Project Management & Engineering Team)  
**Specification Reference**: Spec P07 (Category 01: Planning & Architecture)  

---

## 1. Roadmap Overview & Execution Methodology

This development roadmap defines an **8 to 10 week execution plan** to deliver a production-grade, multi-branch Attendance Management System for Anchor Fashion, engineered by a focused core team of **1 to 2 Full-Stack Developers**.

To guarantee reliable delivery without scope creep, the roadmap strictly applies the MoSCoW feature prioritization established in Spec P04:
* **Weeks 1 through 7**: Core engineering focused exclusively on **Must Have** and **Should Have** features (Database Schema, RBAC Auth, Branch/Staff CRUD, FaceIO+GPS Check-In, Dashboards, Leave Workflow, and Monthly Export Reports).
* **Week 8**: Intensive testing, security audits, and deployment preparation.
* **Weeks 9 and 10**: The **Pilot Branch Rollout Plan** — deploying to ONE real retail branch for 2 weeks of live operational testing, bug fixing, and refinement before enabling company-wide expansion.

---

## 2. Week-by-Week Implementation Schedule

### Week 1: Project Setup, Database Schema & RLS Foundation
* **Goal**: Initialize the Next.js 14 project, configure Supabase cloud/local environments, and deploy the core relational schema with strict Row Level Security (RLS).
* **Tasks**:
  1. Initialize Next.js 14 App Router project with TypeScript, Tailwind CSS, and shadcn/ui (Spec P06).
  2. Set up Supabase CLI migration directory (`supabase/migrations/`) and version control workflows.
  3. Write and apply SQL migrations for core tables: `company_profile`, `branches`, `profiles`, `attendance_records`, `leave_requests`, `branch_settings`, `audit_logs`, and `notifications` (Specs P09–P10).
  4. Write and verify PostgreSQL RLS policies ensuring strict branch-level tenant isolation (Spec P11).
  5. Create automated database triggers: `calculate_attendance_status()` and `log_audit()` (Spec P12).
* **Deliverable**: A running Next.js 14 skeleton connected to a fully migrated Supabase PostgreSQL database where RLS policies successfully block cross-branch data queries in SQL test scripts.
* **Dependency**: Approval of SRS (P01), System Architecture (P02), and RBAC Matrix (P03).

### Week 2: Authentication System, Role Middleware & Shared Guards
* **Goal**: Implement secure email/password authentication, server-side session management, and role-based route redirection.
* **Tasks**:
  1. Configure `@supabase/ssr` for secure, httpOnly, SameSite cookie session management (Spec P18).
  2. Build custom login and password-reset UI pages (`src/app/(auth)/login/page.tsx`). Explicitly disable public registration routes.
  3. Implement Next.js Edge Middleware (`src/middleware.ts`) to intercept traffic and redirect users based on role (`/admin`, `/branch-manager`, `/employee`).
  4. Build server-side helper `getCurrentUser()` and API guards `requireRole()` and `requireOwnBranch()` (Specs P18, P24).
  5. Set up global API error handling (standard JSON shapes: 400/401/403/404/500) and request logging (Spec P24).
* **Deliverable**: End-to-end authentication flow where logging in as Admin, BM, or Employee routes to their respective layout, and unauthorized API calls return strict 403 Forbidden JSON errors.
* **Dependency**: Week 1 (Database schema and `profiles` table).

### Week 3: Branch & Employee Management (Admin & BM CRUD APIs)
* **Goal**: Build the administrative backbone for onboarding store locations and provisioning shop-floor staff accounts.
* **Tasks**:
  1. Build Admin Company & Branch Management API (`/api/company/*`, `/api/branches/*`) supporting creation, geocoding (lat/lng + radius), editing, and soft-deactivation (Spec P21).
  2. Build Employee Management API (`/api/employees/*`) allowing Admin to create staff for any branch, and BMs to create staff exclusively for their assigned branch (Spec P22).
  3. Implement Admin UI: "Company Settings & Branch Management Panel" with an interactive grid of store tiles (Spec P32).
  4. Implement BM UI: Store staff directory, employee profile detail views, and "+ Add Employee" onboarding modal (Spec P27).
  5. Create staff bulk-add CSV upload feature for rapid store onboarding (Spec P66).
* **Deliverable**: Functional Admin and BM portals where HQ can launch new store branches and managers can provision employee accounts ready for biometric enrollment.
* **Dependency**: Week 2 (Auth and RBAC middleware).

### Week 4: Biometric & GPS Check-In/Out Core Engine
* **Goal**: Implement the primary shop-floor attendance workflow combining FaceIO facial recognition with server-side GPS distance validation.
* **Tasks**:
  1. Integrate FaceIO Web SDK (`fio.enroll()`) into the staff onboarding flow to capture and store encrypted facialId vectors in `profiles` (Spec P40).
  2. Build the shop-floor Check-In/Out UI modal featuring live camera preview, spinner/checkmark visual feedback, and bilingual error messaging (`fioErrHandler`) (Spec P28).
  3. Integrate HTML5 Browser Geolocation API to capture high-accuracy coordinates during check-in attempts (Spec P29).
  4. Build API Route Handlers (`POST /api/attendance/check-in`, `check-out`) executing server-side Haversine distance math against store geofence radius (Specs P19, P41).
  5. Implement indoor mall GPS fallback workflow: allow staff to request manual BM check-in override when GPS signal fails, logging reason in audit trail (Spec P41).
* **Deliverable**: Working shop-floor check-in/out sequence on mobile/tablet where facial match + GPS verification writes an evaluated attendance record in $< 3.0$ seconds.
* **Dependency**: Week 3 (Staff accounts and branch geofence coordinates).

### Week 5: Role Dashboards & Real-Time WebSocket Feeds
* **Goal**: Build role-specific web dashboards and enable live, zero-refresh attendance updates via Supabase Realtime.
* **Tasks**:
  1. Build Employee Dashboard (`src/app/(employee)/dashboard/page.tsx`): Big check-in button, today's status card, and monthly mini-calendar (Spec P26).
  2. Build Branch Manager Dashboard (`src/app/(branch-manager)/dashboard/page.tsx`): Today's live attendance list, late/absent counters, and quick stats (Spec P27).
  3. Build Admin Universal Dashboard (`src/app/(admin)/dashboard/page.tsx`): Grid of Branch Tiles showing live store check-in %, employee count, and health badge (Spec P27).
  4. Implement drill-down navigation: Admin clicking any Branch Tile loads that store's full staff list and attendance records (Spec P21, P27).
  5. Configure Supabase Realtime WebSocket subscriptions (`useRealtimeAttendance` hook) so BM and Admin dashboards update instantly upon shop-floor check-ins (Spec P23).
* **Deliverable**: Responsive, beautifully styled dashboards for all three roles with live WebSocket updating.
* **Dependency**: Week 4 (Attendance check-in API and records).

### Week 6: Leave Management Workflow & Notification Intelligence
* **Goal**: Automate digital leave applications, manager approvals, and proactive system reminders.
* **Tasks**:
  1. Build Leave Management API (`/api/leave/*`) supporting casual, sick, and earned leave application, balance tracking, and approval/rejection (Spec P63).
  2. Build Employee Leave UI: Application modal, reason text area, and annual leave balance progress bar (Spec P26, P63).
  3. Build BM Leave Approval UI: Pending request queue with approval/rejection action buttons and BM comment notes (Spec P27, P63).
  4. Build store leave calendar view for BMs to visualize who is off on which days, preventing store understaffing (Spec P63).
  5. Implement Notification Intelligence: Set up cron jobs (Vercel Cron / Supabase Edge Functions) for daily BM end-of-day digests ("3 late today, 1 leave pending") and automated check-in reminders (Spec P44).
* **Deliverable**: Complete paperless leave workflow with automated deduction of annual balances and scheduled email/in-app notifications.
* **Dependency**: Week 5 (Dashboards and user profiles).

### Week 7: Reporting Engine, PDF/Excel Export & Mobile Optimization
* **Goal**: Deliver payroll-ready report generation for HQ accounts and polish the mobile shop-floor user experience.
* **Tasks**:
  1. Build Report Generation API (`/api/reports/*`) executing database functions (`get_branch_monthly_summary`, `get_company_wide_summary`) (Spec P20).
  2. Build filterable Reports UI (by branch, month, year) with data tables showing present/absent/late/overtime rollups per staff member (Spec P30).
  3. Integrate PDF export engine (`@react-pdf/renderer`) generating branded monthly attendance sheets with store headers and BM signature lines (Spec P30).
  4. Integrate Excel/CSV export engine (`xlsx`) compiling multi-tab payroll spreadsheets (Spec P30, P62).
  5. Perform comprehensive Mobile-First Responsive Design audit across all screens, optimizing touch target sizes ($>48\text{px}$) and safe-area insets for shop-floor phones/tablets (Spec P31).
* **Deliverable**: Downloadable, payroll-ready PDF and Excel reports, and a fully mobile-optimized web application.
* **Dependency**: Week 6 (Complete attendance and leave data).

### Week 8: End-to-End Testing, Security Audit & CI/CD Pipeline
* **Goal**: Rigorously verify system reliability, enforce security hardening, and automate production deployment pipelines.
* **Tasks**:
  1. Write Jest/Vitest unit tests for core business logic: Haversine distance math, attendance status evaluation, and RBAC middleware guards (Spec P48).
  2. Write Playwright E2E automated test suites simulating Admin, BM, and Employee user journeys (mocking camera and GPS APIs) (Spec P50).
  3. Execute Database & RLS Security QA (pgTAP scripts): Verify that cross-branch API tampering attempts return 403 Forbidden (Specs P36, P49, P51).
  4. Perform pre-launch Security Audit Checklist: Zod input validation, CSRF checks, secret scanning, and Supabase schema hardening (Specs P34, P37, P38).
  5. Configure GitHub Actions CI/CD pipeline (`.github/workflows/ci.yml`, `deploy.yml`) running tests on PRs and automating Vercel production deployment upon merge (Specs P54, P55).
* **Deliverable**: A hardened, tested, and audited release candidate automatically deployed to Staging and ready for real-world store piloting.
* **Dependency**: Weeks 1–7 complete codebase.

---

## 3. Pilot Branch Rollout Plan (Weeks 9 & 10)

Before flipping the switch for company-wide adoption across all retail branches, Anchor Fashion will execute a **2-Week Pilot Program in ONE real physical retail branch** (e.g., Flagship Gulshan Store). This ensures biometric lighting, indoor GPS accuracy, and staff adoption are proven in real-world retail conditions.

```
+-----------------------------------------------------------------------------------+
|                        WEEK 9: PILOT LAUNCH (SINGLE STORE)                        |
|  - Target: 1 Flagship Branch (~20–30 Shop-Floor Employees, 1 Branch Manager)      |
|  - Day 1: On-site staff onboarding; BM conducts FaceIO biometric enrollment.      |
|  - Day 2–7: Live daily check-in/out on store tablet; Parallel paper log backup.   |
|  - Focus: Monitor FaceIO lighting/rejection rates & indoor GPS Haversine accuracy.|
+-----------------------------------------------------------------------------------+
                                          │
                                          │ Review & Refine (End of Week 9)
                                          v
+-----------------------------------------------------------------------------------+
|                     WEEK 10: PILOT REFINEMENT & EXPANSION PREP                    |
|  - Day 8–10: Analyze audit logs; adjust store geofence radius if indoor drift occurs|
|  - Day 11–12: Test BM leave approval & month-end PDF/Excel payroll export generation|
|  - Day 13–14: Admin sign-off review; Enable Feature Flags for next 5 store branches.|
+-----------------------------------------------------------------------------------+
                                          │
                                          │ Executive Sign-Off
                                          v
+-----------------------------------------------------------------------------------+
|                       COMPANY-WIDE ROLLOUT (WEEKS 11+)                            |
|  - Phased expansion: 5 branches/week until all nationwide stores are live.        |
|  - Paper/Excel attendance logs formally decommissioned company-wide.              |
+-----------------------------------------------------------------------------------+
```

### 3.1 Pilot Success Criteria & Gate Checklist
To exit the pilot phase and initiate company-wide expansion, the flagship branch must achieve the following verified metrics over 14 consecutive days:
1. **Biometric Reliability**: $< 1.0\%$ false rejection rate on FaceIO scans under normal store entrance lighting.
2. **Geofence Stability**: Zero false GPS rejections for staff physically present inside the store boundary.
3. **Zero Data Leakage**: Audit confirmation that the pilot BM could never view or query records from non-pilot stores.
4. **Payroll Sign-Off**: HQ Accounts team successfully imports the pilot store's exported Excel spreadsheet into their payroll workflow without manual formatting fixes.

---

*Document approved by Anchor Fashion Technical Leadership. Next Step: Spec P08 (Risk Assessment).*
