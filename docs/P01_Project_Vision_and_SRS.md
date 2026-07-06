# Software Requirement Specification (SRS)
**Project Title**: Anchor Fashion — In-House Multi-Branch Attendance Management System  
**Document Version**: 1.0.0  
**Prepared For**: Anchor Fashion (Internal Retail & HQ Leadership)  
**Specification Reference**: Spec P01 (Category 01: Planning & Architecture)  

---

## 1. Project Overview & Objectives

### 1.1 Background & Context
Anchor Fashion is a premier clothing and fashion retail brand operating multiple retail branches across the country, managed from a central headquarters (HQ). Currently, managing daily staff attendance, tracking punctuality across decentralized store locations, monitoring leave balances, and preparing monthly payroll reports present operational challenges due to manual logs and disconnected store management.

### 1.2 Purpose of the System
The **Anchor Fashion Attendance Management System** is a private, single-company, multi-branch internal software platform. It is explicitly **NOT a multi-tenant SaaS**; it is purpose-built to serve only Anchor Fashion's corporate HQ and its growing nationwide retail store network.

### 1.3 Core Objectives
1. **Automate Biometric Attendance**: Eliminate buddy-punching and manual errors by implementing facial verification check-in/out via FaceIO on shop-floor devices (smartphones/tablets).
2. **Enforce Geolocation Compliance**: Ensure employees are physically present at their assigned retail branch by enforcing browser-based GPS geofencing (within 100 meters of registered store coordinates).
3. **Streamline Store Operations**: Provide store-level visibility to Branch Managers to oversee staff attendance, approve/reject leave applications, and handle manual corrections without burdening HQ.
4. **Centralize HQ Governance**: Empower Company Admin (Owner/HQ) with real-time, company-wide visibility across all branches, seamless new store expansion (unbounded branch scaling), and automated payroll-ready reporting.

---

## 2. Scope

### 2.1 In-Scope (v1 & Core Features)
* **Branch Administration**: Unlimited dynamic creation, editing, geocoding (latitude/longitude + radius setting), and soft-deactivation of retail branches by HQ Admin.
* **User & Role Management**: Three explicit tiers (Admin, Branch Manager, Employee) with strict database-level data isolation.
* **Biometric & GPS Check-In/Out**: FaceIO facial vector recognition coupled with Haversine GPS distance calculation.
* **Automated Attendance Evaluation**: Real-time detection and calculation of working hours, late arrivals (against branch work start times and grace periods), early departures, half-day cutoffs, and overtime minutes.
* **Leave Management Workflow**: Digital leave application by employees, workflow approval/rejection with notes by Branch Managers, and Admin escalation/fallback.
* **Reporting & Export**: Filterable monthly attendance logs and executive summaries exportable to payroll-ready PDF and Excel/CSV formats.
* **Real-Time Dashboards & Notifications**: Instant check-in updates via web sockets (Supabase Realtime) and automated reminders/alerts.
* **Offline Resilience**: Local browser queueing (IndexedDB/localStorage) of check-in attempts during store internet outages, auto-syncing upon reconnection with audit flagging.

### 2.2 Out-of-Scope (for v1 Launch)
* **Multi-Tenant SaaS Capabilities**: Subscription billing, organization self-signup, or multi-company onboarding.
* **Direct Third-Party POS/Inventory Integration**: Live sales-to-staffing correlation (deferred to v2 via external API, Spec P68).
* **Multi-Currency & Multi-Language UI**: The system will operate in BDT/local currency norms and English UI (with bilingual Bengali/English employee privacy and biometric consent forms).
* **Hardware Biometric Turnstiles**: Direct integration with physical fingerprint/facial turnstile machines (web camera via FaceIO is the sole biometric capture mechanism).

---

## 3. User Roles & High-Level Permissions

The system enforces strict Role-Based Access Control (RBAC) across three distinct roles. There is no "Super Admin" role; **Admin** represents the highest authority (Company Owner / HQ Executive).

```
+-----------------------------------------------------------------------------------+
|                                 COMPANY ADMIN                                     |
|  (Full Company-Wide Governance: All Branches, All Employees, Settings & Payroll)  |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          | (Assigns & Oversees)
                                          v
+-----------------------------------------------------------------------------------+
|                              BRANCH MANAGER (BM)                                  |
|  (Scoped Governance: Own Branch Employees Only, Leave Approval, Manual Override)  |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          | (Supervises)
                                          v
+-----------------------------------------------------------------------------------+
|                                   EMPLOYEE                                        |
|        (Self-Service: Daily Face+GPS Check-In/Out, Leave Apply, Personal History) |
+-----------------------------------------------------------------------------------+
```

### 3.1 Admin (Company Owner / HQ)
* **Access Scope**: Universal (Company-wide across all branches and historical records).
* **Key Permissions**:
  * Create, modify, and deactivate retail branches and company profile settings.
  * Create and manage all user accounts (Branch Managers and Employees across any store).
  * Drill down into any branch tile on the dashboard to view store-level detailed attendance and staff lists.
  * Access company-wide aggregated reporting, analytics charts, and payroll export sheets.
  * Configure system-wide or branch-specific attendance rules (grace periods, overtime rates, shifts, Bangladesh public holidays).

### 3.2 Branch Manager (BM)
* **Access Scope**: Strictly scoped to their assigned retail branch (`branch_id` enforced server-side via Row Level Security).
* **Key Permissions**:
  * View real-time daily check-in/out status and monthly summaries exclusively for employees in their store.
  * Approve or reject employee leave applications for their branch.
  * Perform manual attendance corrections or approve offline-synced/GPS-fallback records (all logged in audit trails).
  * Onboard new store employees (via individual forms or CSV bulk upload) and trigger biometric re-enrollment.
  * **Restrictions**: Cannot view, query, or modify data from any other retail branch; cannot create or delete branch structures.

### 3.3 Employee (Shop-Floor Staff)
* **Access Scope**: Strictly scoped to their own individual user record (`employee_id = auth.uid()`).
* **Key Permissions**:
  * Perform daily check-in and check-out via camera facial scan and GPS location verification.
  * View personal attendance history, monthly calendar breakdown, and accumulated working/overtime hours.
  * View leave balances and submit new leave applications.
  * **Restrictions**: Cannot view peers' attendance, store-wide metrics, or modify logged timestamps.

---

## 4. Functional Requirements

### 4.1 Branch & Company Management (Admin Only)
* **REQ-BR-01**: The system shall allow Admin to create unlimited retail branches by specifying Branch Name, Physical Address, Latitude, Longitude, and Geofence Radius (default 100 meters).
* **REQ-BR-02**: The system shall display an interactive grid of "Branch Tiles" on the Admin Dashboard showing real-time metrics: Employee Count, Today's Check-in Percentage, and Status Color Indicator.
* **REQ-BR-03**: Clicking a Branch Tile shall navigate Admin into a detailed drill-down view identical to the Branch Manager's store dashboard.
* **REQ-BR-04**: Admin shall be able to set branch-specific operational parameters (shift timings, late grace minutes, weekly off-days) which override company default policies.

### 4.2 Biometric & GPS Verification (All Roles / Employee Focus)
* **REQ-BIO-01**: The system shall integrate FaceIO Web SDK to enroll an employee's facial features into an encrypted mathematical vector (facialId) during onboarding.
* **REQ-BIO-02**: During daily check-in/out, the system shall require a live camera scan matched against the stored `facialId` with clear visual feedback (spinner, success checkmark, or failure retry prompt).
* **REQ-GPS-01**: Upon successful facial match, the system shall capture browser GPS coordinates and calculate the distance to the branch coordinates using the server-side Haversine formula.
* **REQ-GPS-02**: If the calculated distance exceeds the branch `radius_meters`, the check-in shall be rejected with a clear message indicating distance discrepancy.
* **REQ-GPS-03**: In indoor shopping malls where GPS signals fail or lack accuracy, the system shall allow a manual fallback request that flags the record for Branch Manager review.

### 4.3 Attendance Evaluation & Time Tracking
* **REQ-ATT-01**: Each attendance record shall record `check_in_time`, `check_out_time`, coordinates, facial match score, and status (`present`, `late`, `absent`, `half_day`).
* **REQ-ATT-02**: The system shall automatically mark status as `late` if check-in occurs after `work_start_time + late_grace_minutes`.
* **REQ-ATT-03**: The system shall compute `overtime_minutes` automatically when `check_out_time` exceeds scheduled shift end time plus overtime thresholds.
* **REQ-ATT-04**: The system shall support offline check-in queueing in local storage with original timestamps, syncing automatically upon network restoration and tagging records as `late-synced` for audit transparency.

### 4.4 Leave Management Workflow
* **REQ-LEV-01**: Employees shall be able to apply for leave by selecting type (`casual`, `sick`, `earned`), date range, and reason.
* **REQ-LEV-02**: The system shall track annual leave balances per employee and deduct days automatically upon approval.
* **REQ-LEV-03**: Branch Managers shall receive real-time notifications of leave requests and approve/reject them with comments.
* **REQ-LEV-04**: Admin shall have fallback authority to approve/reject any pending leave across any branch.

### 4.5 Reporting, Analytics & Payroll Export
* **REQ-REP-01**: The system shall generate monthly attendance summaries per employee (days present, absent, late count, overtime hours).
* **REQ-REP-02**: Admin and Branch Managers shall be able to export reports as branded PDF documents (with signature sign-off lines) and Excel/CSV spreadsheets.
* **REQ-REP-03**: The system shall provide AI-generated executive narrative summaries on monthly company reports (e.g., highlighting attendance dips or chronic lateness trends across branches).
* **REQ-REP-04**: Admin shall be able to "Lock/Finalize" a month's attendance record for payroll processing, preventing further edits without strict override auditing.

---

## 5. Non-Functional Requirements

### 5.1 Performance & Scalability
* **NFR-PERF-01 (Check-in Latency)**: The entire check-in sequence (camera opening, FaceIO authentication, GPS validation, and database write) must complete in **< 3.0 seconds** at the 95th percentile to prevent shop-floor queues during shift changes.
* **NFR-PERF-02 (UI Responsiveness)**: Dashboards and data tables must utilize pagination and virtualization when displaying > 50 branches or > 1,000 employees, ensuring page load times under 1.5 seconds.
* **NFR-SCAL-01 (Unbounded Scaling)**: The database architecture and connection pooling (Supabase/PgBouncer) must seamlessly scale from 3 pilot stores to 50+ branches and 5,000+ daily active employees without refactoring core schemas.

### 5.2 Security & Data Privacy
* **NFR-SEC-01 (Row Level Security)**: Data isolation between branches must be cryptographically enforced at the PostgreSQL database layer via Supabase RLS policies. Application-level filtering is insufficient.
* **NFR-SEC-02 (Biometric Privacy)**: No raw facial photographs shall be stored on Anchor Fashion servers or Supabase storage for attendance matching; only irreversible FaceIO mathematical vector IDs shall be persisted.
* **NFR-SEC-03 (Audit Integrity)**: All administrative overrides, manual attendance corrections, branch modifications, and payroll locks must be immutable and automatically recorded in an `audit_logs` table via database triggers.
* **NFR-SEC-04 (Transport & Session Security)**: All communications must occur over TLS/HTTPS. Authentication sessions must utilize secure, httpOnly, SameSite cookies with server-side role re-verification on every protected route.

### 5.3 Availability & Reliability
* **NFR-AVL-01 (Uptime Target)**: The application platform (Vercel + Supabase) must maintain **99.9% uptime** during core retail operating hours (8:00 AM to 11:00 PM BST).
* **NFR-REL-01 (Offline Tolerance)**: Shop-floor check-in interfaces must remain functional during temporary store internet disconnections via offline web storage, ensuring zero lost attendance logs.
* **NFR-REL-02 (Disaster Recovery)**: Point-in-Time Recovery (PITR) and automated daily database backups must be enabled, with a documented Maximum Tolerable Downtime (RTO) of 4 hours and RPO of 1 hour.

---

## 6. Success Metrics

The rollout and ongoing success of the Attendance Management System will be evaluated against the following measurable Key Performance Indicators (KPIs):

| Metric Category | Target KPI | Measurement Method |
| :--- | :--- | :--- |
| **Adoption Rate** | **> 98%** of active shop-floor staff checking in digitally via Face+GPS within 14 days of branch go-live. | Daily attendance logs vs. active employee headcount per branch. |
| **Time-to-Check-In** | **< 3.0 seconds** average duration from tapping "Check In" to receiving confirmation screen. | Frontend performance monitoring (Vercel Speed Insights / Sentry). |
| **Payroll Processing Speed** | **60% reduction** in time spent by HR/Accounts compiling monthly attendance and calculating overtime/deductions. | HR operational audit before vs. after system deployment. |
| **Location Compliance** | **Zero (< 0.1%)** unflagged off-site check-ins accepted by the system. | GPS spoofing logs and Haversine distance rejection reports. |
| **System Reliability** | **< 0.5%** failure rate on FaceIO biometric matching under normal shop-floor lighting conditions. | FaceIO error code tracking (`fioErrHandler`) and manual correction rates. |
| **Manager Satisfaction** | **> 90%** positive feedback from Branch Managers regarding dashboard usability and leave approval workflows. | Quarterly technical health-check surveys (Spec P74). |

---

*Document approved by Anchor Fashion Technical Leadership. Next Step: Spec P02 (System Architecture Design).*
