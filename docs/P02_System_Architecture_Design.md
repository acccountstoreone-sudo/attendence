# System Architecture Design
**Project Title**: Anchor Fashion — In-House Multi-Branch Attendance Management System  
**Document Version**: 1.0.0  
**Prepared For**: Anchor Fashion (Internal Retail & HQ Leadership)  
**Specification Reference**: Spec P02 (Category 01: Planning & Architecture)  

---

## 1. Architecture Pattern Recommendation

### 1.1 Evaluated Patterns
When designing an internal corporate platform for a single retail enterprise with growing nationwide store locations and ~3 user roles (Admin, Branch Manager, Employee), three primary architectural patterns were evaluated:
1. **Standard Monolith**: A single codebase and database where all UI, business logic, and data access are tightly intertwined without clear domain boundaries.
2. **Modular Monolith (RECOMMENDED)**: A single deployable application (Next.js 14 App Router + Supabase) structured internally into distinct, decoupled domain modules (Auth, Attendance, Branches, Leave, Reports, Notifications) with strict database-level tenant/branch isolation.
3. **Microservices**: Highly distributed, independently deployable services (e.g., separate Node.js service for attendance, separate Python service for reports, separate Go service for notifications) communicating over network APIs or event busses.

### 1.2 Justification for Modular Monolith
We recommend the **Modular Monolith** pattern using Next.js 14 (App Router) and Supabase for Anchor Fashion for the following strategic reasons:
* **Right-Sized for Single-Company Scale**: Anchor Fashion is a single enterprise. While store count will scale from 3 to 50+ branches (and thousands of staff), this traffic volume (~10,000 to 50,000 requests/day) is easily handled by a modern serverless monolith without the massive operational overhead, infrastructure costs, and network latency of microservices.
* **Developer Velocity & Maintenance**: A small development team (1–3 engineers) can build, test, debug, and deploy a modular monolith rapidly. Route groups, shared type definitions, and unified CI/CD pipelines eliminate the complexity of managing multiple repositories and inter-service API versioning.
* **Strict Boundary Enforcement**: By organizing the Next.js App Router into role-scoped route groups (`(admin)`, `(branch-manager)`, `(employee)`) and encapsulating domain logic in modular service layers (`lib/services/`), we achieve clean separation of concerns while maintaining zero-latency in-memory function calls.
* **Database-Level Multi-Branch Isolation**: Instead of building complex service-level routing to separate branch data, we leverage PostgreSQL Row Level Security (RLS) in Supabase. The database itself acts as the ultimate security boundary, ensuring that even within a unified monolith, data leakage across retail branches is cryptographically impossible.

---

## 2. Component Diagram (Text-Based)

The system comprises five core layers: **Client Layer (UI)**, **Application/API Layer (Next.js Serverless)**, **Data & Storage Layer (Supabase)**, **External Biometric Engine (FaceIO)**, and **Monitoring/Infrastructure (Vercel/Sentry)**.

```
+-------------------------------------------------------------------------------------------+
|                                      CLIENT LAYER                                         |
|  +-----------------------+  +---------------------------+  +---------------------------+  |
|  |  Employee Touchpoint  |  |  Branch Manager Portal    |  |     HQ Admin Console      |  |
|  |  (Mobile Web / Tablet)|  |  (Store PC / Tablet)      |  |     (Desktop / Laptop)    |  |
|  +-----------+-----------+  +-------------+-------------+  +-------------+-------------+  |
|              |                            |                              |                |
|              | (HTTPS / WebSockets / HTML5 Geolocation API / Camera SDK) |                |
+--------------|----------------------------|------------------------------|----------------+
               |                            |                              |
               v                            v                              v
+-------------------------------------------------------------------------------------------+
|                              APPLICATION & API LAYER (Next.js 14)                         |
|  +-------------------------------------------------------------------------------------+  |
|  | Route Groups & UI:  /(auth)  |  /(employee)  |  /(branch-manager)  |  /(admin)        |  |
|  +-------------------------------------------------------------------------------------+  |
|  | API Route Handlers (/api/*):                                                        |  |
|  |  +------------------+  +------------------+  +------------------+  +--------------+ |  |
|  |  | /attendance/*    |  | /branches/*      |  | /leave/*         |  | /reports/*   | |  |
|  |  +------------------+  +------------------+  +------------------+  +--------------+ |  |
|  +-------------------------------------------------------------------------------------+  |
|  | Shared Middleware & Guard Layer: requireRole() | requireOwnBranch() | Zod Validation|  |
|  +-------------------------------------------------------------------------------------+  |
|  | Domain Services: AttendanceEngine | DistanceCalculator | PayrollExporter | AuditLog |  |
|  +-------------------------------------------------------------------------------------+  |
+--------------------------------------------+----------------------------------------------+
                                             |
                     +-----------------------+-----------------------+
                     | (Supabase SSR Client / SQL / RPC / Realtime)  | (HTTPS REST / SDK)
                     v                                               v
+-----------------------------------------+     +-------------------------------------------+
|       DATA & STORAGE LAYER (Supabase)   |     |       EXTERNAL SERVICES & TOOLS           |
|  +-----------------------------------+  |     |  +-------------------------------------+  |
|  | PostgreSQL Database               |  |     |  | FaceIO Biometric Engine             |  |
|  |  - Tables: branches, profiles,    |  |     |  | (Facial Vector Matching & Liveness) |  |
|  |    attendance_records, leave      |  |     |  +-------------------------------------+  |
|  |  - RLS Policies (Branch Isolation)|  |     |  | Vercel Edge Network & Cron Jobs     |  |
|  |  - Triggers & RPC Aggregations    |  |     |  | (Hosting, CDN, Scheduled Digests)   |  |
|  +-----------------------------------+  |     |  +-------------------------------------+  |
|  | Supabase Auth (JWT / Sessions)    |  |     |  | Sentry & Vercel Speed Insights      |  |
|  +-----------------------------------+  |     |  | (Error Tracking & Performance Log)  |  |
|  | Supabase Storage (PDF/Excel Docs) |  |     |  +-------------------------------------+  |
|  +-----------------------------------+  |     +-------------------------------------------+
|  | Supabase Realtime (WebSockets)    |  |
|  +-----------------------------------+  |
+-----------------------------------------+
```

---

## 3. Daily Check-In / Check-Out Data Flow

The following step-by-step sequence illustrates the lifecycle of a daily attendance event, from shop-floor initiation to HQ executive rollup:

```
[Employee] 
   │
   ├─ 1. Opens App & Taps "Check In" (Mobile/Tablet)
   │
[FaceIO Web SDK]
   │
   ├─ 2. Prompts Camera → Scans Face → Validates Liveness & Matches Vector
   │     └─► Returns: { facialId, confidence_score, status: "SUCCESS" }
   │
[Browser Geolocation API]
   │
   ├─ 3. Captures High-Accuracy GPS Coordinates
   │     └─► Returns: { latitude: 23.7925, longitude: 90.4078, accuracy: 12m }
   │
[Next.js API Handler: POST /api/attendance/check-in]
   │
   ├─ 4. Receives Payload & Verifies Session (auth.uid() -> branch_id, role)
   │
   ├─ 5. Fetches Branch Coordinates from DB & Executes Server-Side Haversine Formula
   │     ├─► IF Distance > radius_meters (e.g., 100m): Reject (400 Bad Request - Out of Range)
   │     └─► IF Distance <= radius_meters: Proceed
   │
[Supabase PostgreSQL DB]
   │
   ├─ 6. Inserts Row into `attendance_records` (employee_id, branch_id, timestamps, coords)
   │
   ├─ 7. Database Trigger `calculate_attendance_status()` Fires
   │     └─► Evaluates check_in_time vs. branch work_start_time + grace_period
   │     └─► Auto-sets status: 'present' OR 'late'
   │
[Supabase Realtime Engine]
   │
   ├─ 8. Broadcasts WebSocket Event on Channel `branch_attendance:${branch_id}`
   │
[Branch Manager Portal] & [HQ Admin Console]
   │
   ├─ 9. BM Dashboard Instantly Appends Check-in Row without Page Refresh
   │
   └─ 10. Admin Company-Wide Dashboard Increments "Live Check-in Counter" for that Branch Tile
```

---

## 4. Integration Points

### 4.1 FaceIO Biometric SDK Integration
* **Purpose**: Facial enrollment during staff onboarding and instant authentication during daily check-in/out.
* **Integration Mechanism**: Client-side JavaScript SDK (`@faceio/fiojs`) initialized with Anchor Fashion's Public Application ID.
* **Data Payload & Storage**: FaceIO handles image processing on edge servers and returns an encrypted alphanumeric string (`facialId`). Anchor Fashion stores **only** this `facialId` string in the `profiles.facial_id` database column. No images or biometric raw data touch Supabase storage.
* **Error Handling**: Implements `fioErrHandler` to catch lighting errors, face occlusion, multiple faces, and PIN-lock fallbacks, presenting bilingual instructions to the user.

### 4.2 Supabase Auth & Storage Integration
* **Authentication**: Utilizes `@supabase/ssr` to manage secure, httpOnly, SameSite cookies. Login is restricted to email/password. Public signup routes are completely disabled; accounts are provisioned exclusively via Admin or Branch Manager APIs.
* **Session Derivation**: Middleware and Route Handlers never trust client-supplied user IDs or branch IDs. On every request, the server inspects the validated JWT session and queries `profiles` to derive the authenticated user's true `role` and `branch_id`.
* **File Storage**: Supabase Storage buckets (`reports-export`) store generated PDF and Excel payroll spreadsheets. The API generates short-lived Signed URLs (valid for 60 minutes) for authorized Admin and Branch Manager downloads.

### 4.3 Report Generation & Export Integration
* **PDF Engine**: Uses `@react-pdf/renderer` or server-side HTML-to-PDF rendering to construct high-resolution, branded monthly attendance and leave reports featuring Anchor Fashion headers, store metadata, data tables, and formal signature blocks.
* **Excel/CSV Engine**: Uses `xlsx` (SheetJS) or `exceljs` in serverless route handlers (`/api/reports/export`) to compile multi-tab workbooks containing raw attendance logs, late deductions, overtime hours, and salary sheet estimates.

---

## 5. Environment Strategy

To ensure zero disruption to store operations and payroll accuracy, Anchor Fashion will maintain three strict, isolated environments:

```
+-----------------------------------------------------------------------------------+
|                         LOCAL DEVELOPMENT ENVIRONMENT                             |
|  - Host: localhost:3000 | Local Supabase CLI (Docker) | Local Mock FaceIO / GPS   |
|  - Purpose: Feature development, unit testing (Jest), schema migration crafting.   |
+-----------------------------------------------------------------------------------+
                                          │
                                          │ Git Push (PR to `staging` branch)
                                          v
+-----------------------------------------------------------------------------------+
|                           STAGING / QA ENVIRONMENT                                |
|  - Host: staging.attendance.anchorfashion.com                                     |
|  - Infra: Vercel Preview Deployments | Supabase Staging DB (Mirror of Prod Schema)|
|  - Purpose: E2E testing (Playwright), BM user acceptance testing, pilot simulation|
+-----------------------------------------------------------------------------------+
                                          │
                                          │ Git Merge (PR to `main` branch + Manual Gate)
                                          v
+-----------------------------------------------------------------------------------+
|                         PRODUCTION ENVIRONMENT (LIVE)                             |
|  - Host: attendance.anchorfashion.com                                             |
|  - Infra: Vercel Production | Supabase Production DB (PITR Enabled, PgBouncer)    |
|  - Purpose: Daily shop-floor attendance, live biometric check-in, payroll export  |
+-----------------------------------------------------------------------------------+
```

### 5.1 Environment Configuration & Secrets Management
* **Environment Variables**: Managed strictly via `.env.local` (for local dev) and Vercel Environment Settings (for Staging and Production).
* **Key Separation**:
  * `NEXT_PUBLIC_SUPABASE_URL` & `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Publicly accessible for client-side Auth and Realtime subscriptions.
  * `SUPABASE_SERVICE_ROLE_KEY`: **Strictly Server-Only**. Used exclusively in Next.js Route Handlers for administrative tasks (e.g., creating user accounts across branches without logging out the admin). Never exposed to client bundles.
  * `NEXT_PUBLIC_FACEIO_APP_ID`: Public application identifier for initializing the FaceIO widget on shop-floor devices.
* **Database Mirroring & Migrations**: Staging and Production Supabase projects operate completely independent PostgreSQL instances. All database schema changes are versioned as sequential SQL files in `supabase/migrations/` and applied via CI/CD pipelines (Spec P55) after passing automated tests.

---

*Document approved by Anchor Fashion Technical Leadership. Next Step: Spec P03 (User Role & Permission Matrix).*
