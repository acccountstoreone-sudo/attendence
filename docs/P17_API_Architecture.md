# API Architecture Design & Route Map
**Project Title**: Anchor Fashion — In-House Multi-Branch Attendance Management System  
**Document Version**: 1.0.0  
**Prepared For**: Anchor Fashion (Backend Engineering & API Governance)  
**Specification Reference**: Spec P17 (Category 03: Backend & API)  

---

## 1. Architectural Overview & Conventions

Anchor Fashion's backend architecture is built on **Next.js 14 App Router (Route Handlers)** communicating directly with our **Supabase PostgreSQL database** via `@supabase/ssr`. Because this is an internal, single-company platform with strict role and branch data isolation requirements, every API endpoint adheres to unified security, validation, and response formatting conventions.

### 1.1 Standard Response Envelope
To ensure predictable error handling and seamless frontend integration across all shop-floor devices and dashboards, every API endpoint returns a standardized JSON envelope:

```json
// Success Response (200 OK / 201 Created)
{
  "success": true,
  "data": { ... },
  "message": "Check-in recorded successfully.",
  "timestamp": "2026-07-04T08:30:00.000Z"
}

// Error Response (400 / 401 / 403 / 404 / 500)
{
  "success": false,
  "data": null,
  "error": {
    "code": "OUT_OF_RANGE",
    "message": "Check-in failed: You are 145m away from Gulshan Branch (max allowed: 100m)."
  },
  "timestamp": "2026-07-04T08:30:00.000Z"
}
```

### 1.2 Security & Role-Checking Architecture
Role and branch verification occurs across two complementary layers:
1. **Next.js Edge Middleware (`src/middleware.ts`)**: Intercepts unauthenticated page navigations and enforces top-level route group redirections (`/admin` vs `/branch-manager` vs `/employee`).
2. **Per-Route Guard Helper (`requireRole()`)**: Executed as the very first line inside every serverless API Route Handler. It validates the Supabase JWT session, queries `profiles` for the user's role and `branch_id`, and immediately rejects unauthorized callers with `403 Forbidden` before executing any business logic or SQL queries.

```typescript
// Standard Handler Pattern
export async function POST(request: NextRequest) {
  try {
    // 1. Enforce Role & Branch Guard
    const user = await requireRole(['employee', 'branch_manager']);
    
    // 2. Validate Request Body via Zod
    const body = await request.json();
    const payload = attendanceCheckInSchema.parse(body);

    // 3. Execute Business Logic & Supabase Query...
    return NextResponse.json({ success: true, data: result, message: "Success" });
  } catch (error) {
    return handleApiError(error);
  }
}
```

---

## 2. Comprehensive API Route Map

### 2.1 Authentication & Session Domain (`/api/auth/*`)

| Endpoint | Method | Purpose & Description | Allowed Roles | Request Shape | Response Shape |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/auth/callback` | `GET` | Exchanges Supabase Auth OAuth/email code for secure httpOnly SSR session cookies. | **Public / All** | Query param: `?code=...` | Redirects to role dashboard |
| `/api/auth/logout` | `POST` | Invalidates user JWT session and clears browser httpOnly cookies. | **All Authenticated** | Empty | `{ success: true, message: "Logged out" }` |
| `/api/auth/session` | `GET` | Returns current user profile metadata (`role`, `branch_id`, `full_name`). | **All Authenticated** | Empty | `{ success: true, data: { id, role, branch_id } }` |

---

### 2.2 Core Attendance Domain (`/api/attendance/*`)

| Endpoint | Method | Purpose & Description | Allowed Roles | Request Shape | Response Shape |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/attendance/check-in` | `POST` | Records morning check-in. Validates FaceIO flag + server-side Haversine GPS distance. | `employee`, `branch_manager` | `{ lat: number, lng: number, face_verified: true, facial_id: string }` | `{ success: true, data: { id, status, check_in_time, distance_meters } }` |
| `/api/attendance/check-out` | `POST` | Records shift end. Updates today's record and calculates `overtime_minutes`. | `employee`, `branch_manager` | `{ lat: number, lng: number, face_verified: true }` | `{ success: true, data: { id, status, check_out_time, overtime_minutes } }` |
| `/api/attendance/today` | `GET` | Returns current user's attendance status for today (checked-in, checked-out, or none). | **All Authenticated** | Empty | `{ success: true, data: { checked_in: bool, check_in_time, check_out_time } }` |
| `/api/attendance/history` | `GET` | Retrieves historical attendance logs. Scoped by RLS (Employee: self; BM: own branch; Admin: all). | **All Authenticated** | Query: `?employee_id=&month=&year=` | `{ success: true, data: AttendanceRecord[] }` |
| `/api/attendance/manual-correction`|`POST`| BM or Admin manual override for indoor mall GPS failures or hardware outages. Writes to `audit_logs`. | `admin`, `branch_manager` | `{ employee_id, check_in_time, check_out_time, status, reason }` | `{ success: true, data: AttendanceRecord, message: "Override logged" }` |
| `/api/attendance/sync-offline` | `POST` | Batch ingestion endpoint for offline-queued check-ins from shop-floor localStorage. | `employee`, `branch_manager` | `{ queue: Array<{ timestamp, lat, lng, type }> }` | `{ success: true, data: { synced_count, flagged_late_sync_count } }` |

---

### 2.3 Company & Branch Management Domain (`/api/branches/*` & `/api/company/*`)

| Endpoint | Method | Purpose & Description | Allowed Roles | Request Shape | Response Shape |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/company/profile` | `GET`, `PUT` | View or update HQ brand name, logo, address, and default work policies. | `GET`: **All**<br>`PUT`: `admin` | `PUT`: `{ name, logo_url, address, default_work_start_time }` | `{ success: true, data: CompanyProfile }` |
| `/api/branches` | `GET` | Returns all branches with live employee count and today's attendance % (Admin Tiles). | `admin` | Empty | `{ success: true, data: Array<Branch & { emp_count, attendance_pct }> }` |
| `/api/branches` | `POST` | Creates a new physical store location with geofenced coordinates and radius. | `admin` | `{ name, address, latitude, longitude, radius_meters }` | `{ success: true, data: Branch }` |
| `/api/branches/[id]` | `GET`, `PUT` | View or edit store details and branch-specific work timings (`branch_settings`). | `admin`, `branch_manager` (own) | `PUT`: `{ name, address, radius_meters, work_start_time }` | `{ success: true, data: BranchWithSettings }` |
| `/api/branches/[id]/deactivate`|`PATCH`| Soft-deactivates a closed retail store while preserving historical attendance archives. | `admin` | `{ is_active: false }` | `{ success: true, message: "Branch deactivated" }` |
| `/api/branches/[id]/employees`|`GET`| Returns full staff list for a store with detailed attendance (Admin drill-down requirement). | `admin`, `branch_manager` (own) | Query: `?status=present&role=` | `{ success: true, data: EmployeeWithAttendance[] }` |

---

### 2.4 Employee Management Domain (`/api/employees/*`)

| Endpoint | Method | Purpose & Description | Allowed Roles | Request Shape | Response Shape |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/employees` | `GET` | Returns staff directory. Scoped by RLS (Admin: all/filter; BM: own branch only). | `admin`, `branch_manager` | Query: `?branch_id=&role=&is_active=` | `{ success: true, data: Profile[] }` |
| `/api/employees` | `POST` | Provisions new staff account. BM can ONLY create employee role under their own branch. | `admin`, `branch_manager` | `{ email, full_name, role, branch_id, phone }` | `{ success: true, data: Profile, message: "Account provisioned" }` |
| `/api/employees/[id]` | `GET` | Full staff profile detail (photo, FaceIO enrollment status, leave balance, attendance summary).| **All** (Scoped by RLS) | Empty | `{ success: true, data: ProfileDetail }` |
| `/api/employees/[id]` | `PUT` | Edit profile contact info. Role or branch changes restricted strictly to Admin. | `admin`, `branch_manager` (scoped)| `{ full_name, phone, role, branch_id }` | `{ success: true, data: Profile }` |
| `/api/employees/[id]/deactivate`|`PATCH`| Offboards staff member (`is_active = false`) and nullifies biometric vector string. | `admin`, `branch_manager` (own) | `{ reason: string }` | `{ success: true, message: "Employee offboarded" }` |
| `/api/employees/[id]/enroll-face`|`POST`| Links returned FaceIO `facialId` vector string to profile upon successful camera enrollment.| `admin`, `branch_manager`, `employee` (self)| `{ facial_id: string }` | `{ success: true, data: { face_enrolled: true } }` |
| `/api/employees/bulk-upload` | `POST` | CSV bulk ingestion endpoint for onboarding entire store staff lists rapidly (Spec P66). | `admin`, `branch_manager` (own) | FormData (CSV file) | `{ success: true, data: { created_count, error_rows[] } }` |

---

### 2.5 Leave Management Domain (`/api/leave/*`)

| Endpoint | Method | Purpose & Description | Allowed Roles | Request Shape | Response Shape |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/leave` | `GET` | Returns leave requests. Scoped by RLS (Employee: self; BM: own branch; Admin: all). | **All Authenticated** | Query: `?status=pending&month=` | `{ success: true, data: LeaveRequest[] }` |
| `/api/leave` | `POST` | Submits digital leave application and triggers in-app notification to Branch Manager. | `employee` | `{ type: 'casual'\|'sick'\|'earned', start_date, end_date, reason }` | `{ success: true, data: LeaveRequest }` |
| `/api/leave/[id]/approve` | `PUT` | BM/Admin approval or rejection with notes. Auto-deducts employee annual leave balance. | `admin`, `branch_manager` (own) | `{ status: 'approved'\|'rejected', reviewer_note }` | `{ success: true, data: LeaveRequest }` |
| `/api/leave/calendar/[branchId]`|`GET`| Store calendar view showing who is scheduled off on which days to prevent understaffing. | `admin`, `branch_manager` (own) | Query: `?month=&year=` | `{ success: true, data: Array<{ date, employees_off[] }> }` |

---

### 2.6 Report Generation Domain (`/api/reports/*`)

| Endpoint | Method | Purpose & Description | Allowed Roles | Request Shape | Response Shape |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/reports/branch/[id]/monthly`|`GET`| Returns per-employee present/absent/late/overtime summary for a store (calls P12 RPC). | `admin`, `branch_manager` (own) | Query: `?month=&year=` | `{ success: true, data: BranchMonthlySummary[] }` |
| `/api/reports/company/monthly`| `GET` | Admin company-wide summary across all branches with store-by-store comparison (calls P14 RPC).| `admin` | Query: `?month=&year=` | `{ success: true, data: CompanyWideSummary[] }` |
| `/api/reports/employee/[id]` | `GET` | Individual employee detailed monthly log and attendance health metrics. | **All** (Scoped by RLS) | Query: `?month=&year=` | `{ success: true, data: EmployeeDetailedReport }` |
| `/api/reports/export` | `POST` | Generates downloadable PDF/Excel workbook and returns 60-minute Supabase Signed URL. | `admin`, `branch_manager` (own) | `{ format: 'pdf'\|'excel', branch_id, month, year }` | `{ success: true, data: { signed_url: string, expires_in: 3600 } }` |
| `/api/reports/ai-summary` | `GET` | Retrieves or generates LLM narrative summary for monthly executive report (Spec P43). | `admin` | Query: `?month=&year=` | `{ success: true, data: { summary_text: string, cached: bool } }` |

---

### 2.7 Notifications & Realtime Domain (`/api/notifications/*`)

| Endpoint | Method | Purpose & Description | Allowed Roles | Request Shape | Response Shape |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/notifications` | `GET` | Retrieves user's recent in-app alerts and unread bell badge count. | **All Authenticated** | Query: `?unread_only=true&limit=20` | `{ success: true, data: { notifications[], unread_count } }` |
| `/api/notifications/[id]/read`| `PATCH`| Marks a specific notification as read. | **All Authenticated** | `{ is_read: true }` | `{ success: true, data: { id, is_read: true } }` |
| `/api/notifications/read-all` | `POST` | Marks all unread alerts for the current user as read in bulk. | **All Authenticated** | Empty | `{ success: true, message: "All marked as read" }` |

---

*Document approved by Anchor Fashion Technical Leadership. Next Step: Project Initialization & Auth Implementation (Spec P18).*
