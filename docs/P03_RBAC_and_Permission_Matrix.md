# User Role & Permission Matrix
**Project Title**: Anchor Fashion — In-House Multi-Branch Attendance Management System  
**Document Version**: 1.0.0  
**Prepared For**: Anchor Fashion (Internal Retail & HQ Leadership)  
**Specification Reference**: Spec P03 (Category 01: Planning & Architecture)  

---

## 1. Role-Based Access Control (RBAC) Overview

The **Anchor Fashion Attendance Management System** operates on a strict three-tier Role-Based Access Control (RBAC) model. This is an internal corporate system for a single fashion retail enterprise; therefore, there is **no Super Admin or Multi-Tenant Organization Admin**. 

The three explicit roles are:
1. **Admin**: Company Owner / Headquarters (HQ) Executive. Holds universal governance over the entire brand, all store branches, all staff members, system settings, and payroll exports.
2. **Branch Manager (BM)**: Store-level supervisor. Holds full operational authority over staff members assigned to their specific physical retail branch, but is strictly blocked from viewing or interacting with any other branch's data.
3. **Employee**: Shop-floor staff member. Holds self-service access to perform daily biometric/GPS check-ins, view personal attendance logs, and apply for personal leave.

---

## 2. Feature & Permission Matrix

The table below defines the exact access rights across all system modules. 
*Legend*: **Full** (Create, Read, Update, Delete / Execute) | **View-Only** (Read-Only Access) | **None** (No Access / Hidden / Blocked at API & DB Layer).

| Feature / Module | Admin (HQ / Owner) | Branch Manager (BM) | Employee (Shop-Floor) |
| :--- | :--- | :--- | :--- |
| **Company Profile** (Logo, HQ Name, Default Policy) | **Full** (Edit brand details & defaults) | **View-Only** (View logo & company name) | **View-Only** (View logo & company name) |
| **Branch CRUD** (Create, Edit, Deactivate Stores) | **Full** (Unlimited store creation & geocoding) | **None** (Cannot create, edit, or delete stores) | **None** |
| **Employee CRUD** (Create, Onboard, Deactivate Staff)| **Full** (Can onboard/assign to ANY branch) | **Full** (ONLY for staff assigned to their own branch)| **None** |
| **Attendance Records** (Check-In/Out Logs, Timestamps)| **Full** (View/edit logs across ALL branches) | **Full** (View/manual override for own branch staff) | **Full** (Self check-in/out; View-Only own history) |
| **Face & GPS Data** (Biometric Vector IDs, Coordinates)| **Full** (View biometric status & GPS logs company-wide)| **Full** (View GPS distance/coords for own branch staff)| **View-Only** (Can enroll own face & submit GPS coords)|
| **Leave Requests** (Apply, Approve, Reject, Balances) | **Full** (View all; Fallback approve/reject any branch)| **Full** (Approve/reject leave for own branch staff)| **Full** (Apply for leave; View own balances & status)|
| **Reports & Export** (Monthly Summaries, PDF/Excel) | **Full** (Company-wide rollups & per-branch comparison)| **Full** (Export reports ONLY for their own branch)| **View-Only** (View personal monthly summary only)|
| **Payroll & Salary Sheet** (Gross Pay Estimates, Lock) | **Full** (Configure salary rates, compute & lock payroll)| **None** (Strictly blocked from salary/rate figures)| **None** |
| **System Settings** (Shifts, Rules Engine, Holidays) | **Full** (Configure company & branch rules, holidays) | **View-Only** (View assigned shift & branch timings)| **View-Only** (View assigned shift & work timings) |
| **Notifications** (Alerts, Digests, Reminders) | **Full** (Receive company-wide digests & system alerts)| **Full** (Receive late/leave alerts for own branch)| **Full** (Receive check-in reminders & leave updates)|

---

## 3. Row Level Security (RLS) Logic in Plain English

To guarantee that branch data isolation is enforced at the database layer (not just hidden in the frontend UI or API middleware), Anchor Fashion utilizes **PostgreSQL Row Level Security (RLS)** in Supabase. Even if a malicious or compromised user bypasses client-side code and sends direct GraphQL/REST queries to the database, RLS policies reject unauthorized reads and writes.

### 3.1 Core Helper Functions (Plain English Logic)
To evaluate RLS policies efficiently, the database will rely on two secure SQL helper functions:
* `auth.user_role()`: Looks up the currently authenticated user's ID (`auth.uid()`) in the `profiles` table and returns their assigned role (`admin`, `branch_manager`, or `employee`).
* `auth.user_branch_id()`: Looks up the currently authenticated user's ID in the `profiles` table and returns their assigned `branch_id` (which is null/ignored for Admin, and mandatory for BMs and Employees).

### 3.2 Table-by-Table RLS Policy Description

#### A. `company_profile` (Singleton Table)
* **SELECT (Read)**: Allow access to ALL authenticated users (Admin, BM, Employee need to see the brand logo and company name).
* **INSERT / UPDATE / DELETE (Write)**: Allow ONLY if `auth.user_role() == 'admin'`. Branch Managers and Employees are strictly blocked from altering company details.

#### B. `branches` (Retail Store Locations)
* **SELECT (Read)**: Allow access to ALL authenticated users so employees and managers can load their assigned store name, geofence radius, and coordinates during check-in.
* **INSERT / UPDATE / DELETE (Write)**: Allow ONLY if `auth.user_role() == 'admin'`. Only HQ can launch new store locations or modify geofence coordinates.

#### C. `profiles` (Staff Accounts & Biometric Status)
* **SELECT (Read)**:
  * If `auth.user_role() == 'admin'`: Allow reading ALL employee profiles across the entire company.
  * If `auth.user_role() == 'branch_manager'`: Allow reading ONLY profiles where `profile.branch_id == auth.user_branch_id()`. A BM in Gulshan cannot see a profile belonging to Dhanmondi.
  * If `auth.user_role() == 'employee'`: Allow reading ONLY their own profile (`profile.id == auth.uid()`).
* **INSERT (Create Account)**:
  * If `auth.user_role() == 'admin'`: Allow inserting a profile for any `branch_id`.
  * If `auth.user_role() == 'branch_manager'`: Allow inserting a profile ONLY IF the new profile's `branch_id` exactly matches `auth.user_branch_id()` AND the assigned role is `'employee'`. BMs cannot create Admin or BM accounts.
* **UPDATE / DELETE (Modify/Deactivate)**:
  * If `auth.user_role() == 'admin'`: Allow updating or deactivating any profile.
  * If `auth.user_role() == 'branch_manager'`: Allow updating profiles ONLY where `profile.branch_id == auth.user_branch_id()` AND `profile.role == 'employee'`. (BMs cannot change an employee's role or reassign them to another branch).
  * If `auth.user_role() == 'employee'`: Allow updating ONLY personal non-sensitive fields (e.g., phone number) on `profile.id == auth.uid()`. Cannot change role, branch, or facial ID.

#### D. `attendance_records` (Daily Check-In/Out & GPS Logs)
* **SELECT (Read)**:
  * If `auth.user_role() == 'admin'`: Allow reading ALL attendance records across all branches.
  * If `auth.user_role() == 'branch_manager'`: Allow reading ONLY records where `record.branch_id == auth.user_branch_id()`.
  * If `auth.user_role() == 'employee'`: Allow reading ONLY records where `record.employee_id == auth.uid()`.
* **INSERT (Check-In)**:
  * Allow IF the authenticated user is inserting a record for themselves (`record.employee_id == auth.uid()`) AND the `record.branch_id` matches their profile's assigned branch.
  * Allow IF `auth.user_role() == 'branch_manager'` AND `record.branch_id == auth.user_branch_id()` (for manual BM check-in overrides).
  * Allow IF `auth.user_role() == 'admin'`.
* **UPDATE (Check-Out & Manual Correction)**:
  * If `auth.user_role() == 'employee'`: Allow updating ONLY their own record for today (`record.employee_id == auth.uid()`) to append `check_out_time` and checkout coordinates. Cannot modify check-in time or status.
  * If `auth.user_role() == 'branch_manager'`: Allow updating records where `record.branch_id == auth.user_branch_id()` (to perform manual time corrections or approve offline syncs).
  * If `auth.user_role() == 'admin'`: Allow updating any attendance record company-wide.
* **DELETE**: Allow ONLY if `auth.user_role() == 'admin'`. Attendance logs are permanent audit trails; BMs and Employees cannot delete records.

#### E. `leave_requests` (Employee Leave Applications)
* **SELECT (Read)**:
  * If `auth.user_role() == 'admin'`: Allow reading all leave requests company-wide.
  * If `auth.user_role() == 'branch_manager'`: Allow reading ONLY leave requests where `request.branch_id == auth.user_branch_id()`.
  * If `auth.user_role() == 'employee'`: Allow reading ONLY their own leave applications (`request.employee_id == auth.uid()`).
* **INSERT (Apply for Leave)**:
  * Allow IF `request.employee_id == auth.uid()` AND `request.branch_id == auth.user_branch_id()`. Employees can only submit leave for themselves under their assigned branch.
* **UPDATE (Approve / Reject / Cancel)**:
  * If `auth.user_role() == 'employee'`: Allow updating ONLY to cancel a request if its status is still `'pending'` AND `request.employee_id == auth.uid()`.
  * If `auth.user_role() == 'branch_manager'`: Allow updating status (`'approved'` or `'rejected'`), adding reviewer notes, and setting `approved_by` ONLY for requests where `request.branch_id == auth.user_branch_id()`.
  * If `auth.user_role() == 'admin'`: Allow updating any leave request across any branch (HQ fallback authority).

#### F. `branch_settings` & `salary_settings` (Rules & Confidential Payroll)
* **`branch_settings`**: Read allowed for all users in that branch (to know work start times and grace periods). Write/Modify allowed ONLY for Admin (and BM if Admin delegates store timing edits).
* **`salary_settings` (CRITICAL CONFIDENTIALITY)**:
  * **SELECT / INSERT / UPDATE / DELETE**: Allow ONLY if `auth.user_role() == 'admin'`.
  * **Strict Exclusion**: Branch Managers and Employees have **ZERO ACCESS** to salary figures, base pay, or hourly overtime financial rates. RLS drops all queries from non-admin roles instantly.

---

*Document approved by Anchor Fashion Technical Leadership. Next Step: Spec P04 (MoSCoW Feature Prioritization).*
