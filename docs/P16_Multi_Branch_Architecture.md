# Multi-Branch Data Architecture
**Project Title**: Anchor Fashion — In-House Multi-Branch Attendance Management System  
**Document Version**: 1.0.0  
**Prepared For**: Anchor Fashion (Database Architecture & Technical Governance)  
**Specification Reference**: Spec P16 (Category 02: Database & Schema)  

---

## 1. Single-Company, Multi-Branch Data Architecture

Anchor Fashion is a single corporate entity expanding across dozens of retail store branches nationwide. This system is **NOT a multi-tenant SaaS**; there is no `companies` or `tenants` table with billing plans. Instead, the architectural foundation rests entirely on **Branch Isolation**: every shop-floor employee and every operational transaction is scoped directly to a physical store location.

### 1.1 Single Source of Truth (`branch_id` Foreign Key)
To guarantee strict data integrity and prevent cross-store data mixing, every operational table in the PostgreSQL database carries an explicit, mandatory `branch_id` foreign key referencing `public.branches(id)`:
* **`profiles`**: Every staff member (`role = 'employee'` or `'branch_manager'`) must be assigned to exactly one retail branch.
* **`attendance_records`**: Every check-in/out timestamp and GPS coordinate is stamped with the employee's `branch_id`.
* **`leave_requests`**: Leave applications and manager approvals belong to the specific store where the staff member works.
* **`branch_settings`**: Store-specific work timings, late grace periods, and weekly off-days are keyed by `branch_id`.

---

## 2. Query Scoping & Visibility Rules

The system enforces a clear dichotomy between universal headquarters governance and localized store supervision:

```
+-----------------------------------------------------------------------------------+
|                        ADMIN (HQ / OWNER) - UNIVERSAL VIEW                        |
|  Query: SELECT * FROM attendance_records;                                         |
|  RLS Policy: Returns ALL rows across ALL 50+ store branches by default.           |
+-----------------------------------------------------------------------------------+
                                          │
                                          │ (Branch Drill-Down Filter)
                                          v
+-----------------------------------------------------------------------------------+
|                   BRANCH MANAGER (BM) - SCOPED STORE VIEW                         |
|  Query: SELECT * FROM attendance_records;                                         |
|  RLS Policy: Intercepts query & injects `WHERE branch_id = auth.user_branch_id()` |
|  Result: Returns ONLY records belonging to Gulshan Branch (Neighbor stores hidden)|
+-----------------------------------------------------------------------------------+
```

### 2.1 Admin Universal Visibility (Default)
* When an Admin queries `profiles` or `attendance_records` from the HQ dashboard or API, **no branch filtering is applied by default**.
* Admin possesses universal visibility across all store locations to compile company-wide attendance rates, compare store performance, and run payroll rollups.
* When Admin wishes to inspect a specific store, the frontend explicitly passes a filter (e.g., `WHERE branch_id = 'target-store-uuid'`).

### 2.2 Branch Manager Strict Scoping (RLS Enforced)
* When a Branch Manager queries the database, they do not need to rely on frontend React code or Next.js API parameters to filter their store's data.
* **Database Row Level Security (RLS) from Spec P11 automatically intercepts the query at the PostgreSQL engine level**, evaluating `auth.user_branch_id()` and dropping all rows where `branch_id` does not match the manager's assigned store.

---

## 3. New Branch Launch Data Flow (Zero Code Deploy)

When Anchor Fashion opens a new physical retail store (e.g., "Banani Store"), launching the branch digitally requires **zero code deployments, zero Vercel config changes, and zero database schema modifications**. 

The entire lifecycle occurs dynamically through the Admin UI:

```
[1. HQ Admin Console]
   │
   ├─► Taps "+ Add New Branch" -> Inputs: Name ("Banani Store"), Address, GPS Coords, Radius (100m)
   │
[2. POST /api/branches]
   │
   ├─► Inserts row into `public.branches` (id: uuid, name: "Banani Store", is_active: true)
   ├─► Auto-creates default row in `public.branch_settings` (09:00 to 18:00, 15m grace)
   │
[3. Admin Assigns Branch Manager]
   │
   ├─► Taps "Assign Manager" -> Creates BM profile (role: 'branch_manager', branch_id: new_uuid)
   │
[4. Instant Dashboard Tile Manifestation]
   │
   └─► Admin Dashboard grid automatically renders a new "Banani Store" Branch Tile!
       (Shows: 0 Employees, 0% Check-in, Live Health Badge) -> Ready for staff onboarding!
```

1. **Branch Row Creation**: Admin submits the store name, physical address, latitude/longitude, and geofence radius via the Admin Dashboard. The API inserts a new row into `public.branches`.
2. **Settings Initialization**: A database trigger automatically initializes default work hours (09:00 to 18:00) in `public.branch_settings` for the new store UUID.
3. **Manager Assignment**: Admin provisions a user account for the store supervisor, setting `role = 'branch_manager'` and linking `branch_id` to the newly created store UUID.
4. **Automatic Tile Rendering**: The very next time Admin loads the HQ Dashboard, the query `SELECT * FROM branches` retrieves the new store. It instantly manifests as an interactive "Branch Tile" on the dashboard grid, ready for staff onboarding and daily check-ins.

---

## 4. Future Franchising & Semi-Independent Spinoff Strategy

While Anchor Fashion operates today as a unified corporate brand, company leadership has noted the future possibility of **franchising store locations or spinning off regional branches as semi-independent operational units**.

We have designed the database architecture to keep operations simple today while ensuring that future franchising does not require over-engineering or database refactoring:

### 4.1 How We Keep It Simple Today
* We avoid building complex multi-tenant organization tables, subscription billing tiers, or complicated hierarchical group structures.
* Every store is simply a row in `public.branches` linked to staff in `public.profiles`.

### 4.2 How We Protect Future Franchising (Without Refactoring)
If Anchor Fashion decides to franchise 10 stores to an independent operator ("Franchise Group A") three years from now, our architecture adapts cleanly through a simple **non-breaking schema additive**:
1. **Add an Optional `franchise_group_id` Column**: We can add a nullable `franchise_group_id UUID` column to `public.branches`. For corporate-owned stores, this remains `NULL`.
2. **Introduce a `franchisee_admin` Role**: We can add `'franchisee_admin'` to our `user_role` enum.
3. **Extend RLS Policies Cleanly**: We simply add one line to our PostgreSQL RLS read policies:
   ```sql
   -- Allow Franchisee Admin to read branches and attendance ONLY within their franchise group
   OR (auth.user_role() = 'franchisee_admin' AND branch_id IN (
       SELECT id FROM public.branches WHERE franchise_group_id = auth.user_franchise_group_id()
   ))
   ```
This architectural foresight ensures that Anchor Fashion enjoys lightweight, high-speed software today while retaining complete structural flexibility for decade-long retail expansion.

---

*Document approved by Anchor Fashion Leadership. Category 02 (Database & Schema, Specs P09–P16) Complete.*
