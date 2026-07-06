# Database Migrations Strategy & Setup
**Project Title**: Anchor Fashion — In-House Multi-Branch Attendance Management System  
**Document Version**: 1.0.0  
**Prepared For**: Anchor Fashion (Database DevOps & Engineering Team)  
**Specification Reference**: Spec P13 (Category 02: Database & Schema)  

---

## 1. Supabase CLI Migration Architecture

To ensure zero-downtime deployments and prevent accidental schema drift across local, staging, and production environments, Anchor Fashion manages all database schema changes strictly via the **Supabase CLI**. 

Manual database edits via the Supabase Dashboard SQL Editor are **strictly prohibited in Production**. Every table, column, index, trigger, RLS policy, and function must be versioned in Git as an immutable SQL migration file.

### 1.1 Folder Structure
All migration scripts and test seed files reside in the root `supabase/` directory:

```
anchor-fashion-attendance/
└── supabase/
    ├── migrations/
    │   ├── 20260704000001_core_schema.sql         # P09: Base tables & foreign keys
    │   ├── 20260704000002_advanced_schema.sql     # P10: Settings, audit logs & notifications
    │   ├── 20260704000003_rls_policies.sql        # P11: Row Level Security policies & helpers
    │   ├── 20260704000004_functions_triggers.sql  # P12: Attendance triggers & monthly summary RPCs
    │   └── 20260704000005_query_optimization.sql  # P14: Composite indexes & materialized views
    ├── config.toml                                # Supabase CLI local Docker settings
    └── seed.sql                                   # Local test seed data (branches, managers, staff)
```

### 1.2 Naming Convention
Migration files must adhere to the exact timestamp-based naming convention:
`YYYYMMDDHHMMSS_description_in_snake_case.sql`
* *Example*: `20260704000001_core_schema.sql`
* This guarantees deterministic, chronological execution across all PostgreSQL engines.

---

## 2. Sequence of Initial Migration Files (P09–P14)

To progress a completely empty PostgreSQL database to the full Anchor Fashion production schema, the Supabase CLI executes the following sequence:

| Migration File | Spec Ref | One-Line Description | Rollback Strategy Note (If Migration Fails) |
| :--- | :--- | :--- | :--- |
| `20260704000001_core_schema.sql` | **P09** | Creates custom enums, singleton `company_profile`, `branches`, `profiles`, `attendance_records`, and `leave_requests`. | `DROP TABLE IF EXISTS leave_requests, attendance_records, profiles, branches, company_profile CASCADE; DROP TYPE IF EXISTS leave_status, leave_type, attendance_status, user_role CASCADE;` |
| `20260704000002_advanced_schema.sql`| **P10** | Creates `branch_settings`, `audit_logs`, `notifications`, and attaches the `log_audit()` trigger to core tables. | `DROP TRIGGER IF EXISTS trg_audit_* ON ...; DROP FUNCTION IF EXISTS log_audit() CASCADE; DROP TABLE IF EXISTS notifications, audit_logs, branch_settings CASCADE;` |
| `20260704000003_rls_policies.sql` | **P11** | Enables RLS across all tables and creates secure SQL helper functions (`auth.user_role()`, `auth.user_branch_id()`). | `ALTER TABLE ... DISABLE ROW LEVEL SECURITY; DROP POLICY IF EXISTS ... ON ...; DROP FUNCTION IF EXISTS auth.user_role(), auth.user_branch_id() CASCADE;` |
| `20260704000004_functions_triggers.sql`|**P12** | Creates `calculate_attendance_status()` trigger, welcome alert trigger, and monthly summary RPC functions. | `DROP TRIGGER IF EXISTS trg_calculate_attendance_status ON attendance_records; DROP FUNCTION IF EXISTS get_company_wide_summary(), get_branch_monthly_summary(), calculate_attendance_status(), handle_new_employee() CASCADE;` |
| `20260704000005_query_optimization.sql`|**P14** | Adds composite high-performance B-tree indexes and nightly `monthly_branch_summary` materialized views. | `DROP MATERIALIZED VIEW IF EXISTS monthly_branch_summary CASCADE; DROP INDEX IF EXISTS idx_attendance_branch_date, idx_attendance_emp_date, ... CASCADE;` |

---

## 3. Developer Runbook & CLI Commands

### 3.1 Local Development Workflow
When building new features or modifying database schemas locally, developers follow this standard runbook:

```bash
# 1. Start local Supabase Docker container suite (Postgres, Auth, Studio, Storage)
supabase start

# 2. Create a brand new timestamped migration file
supabase migration new add_multi_shift_support

# 3. Edit the generated file in supabase/migrations/ with your SQL CREATE/ALTER statements
# ... (write SQL) ...

# 4. Apply the new migration to your local Docker database and reset seed data
supabase db reset

# 5. Check migration status to verify no drift has occurred
supabase migration list
```

### 3.2 Staging & Production Deployment Commands
In accordance with our CI/CD pipeline (Spec P55), applying migrations to live remote environments is automated via GitHub Actions or executed under strict DevOps supervision:

```bash
# 1. Link Supabase CLI to remote Staging project
supabase link --project-ref staging-project-id-12345

# 2. Push pending SQL migrations to Staging database without resetting data
supabase db push

# 3. Verify Staging schema & run automated Playwright/pgTAP integration tests
# ... (if tests pass, proceed to Production) ...

# 4. Link to remote Production project
supabase link --project-ref production-project-id-67890

# 5. Push migrations to Production (WITH MANDATORY APPROVAL GATE)
# NOTE: In CI/CD, this step requires manual sign-off by Technical Lead
supabase db push
```

---

## 4. Rollback & Disaster Recovery Protocol

Because Supabase does not currently support automated `down.sql` rollback execution in the CLI (`supabase db push` only applies forward migrations), Anchor Fashion enforces a strict two-pillar rollback protocol:

1. **Forward-Fix Rollback Migrations (Preferred)**:
   * If a non-destructive bug occurs in a deployed migration (e.g., a flawed RLS policy or slow RPC function), **do not attempt to manually edit remote production tables**.
   * Generate an immediate revert migration: `supabase migration new revert_flawed_rpc_function`.
   * Write the exact `CREATE OR REPLACE` or `DROP / ALTER` statements to restore the previous working state, and push via `supabase db push`.
2. **Point-in-Time Recovery (PITR) Restoration (Emergency Only)**:
   * If a catastrophic bad migration executes in Production (e.g., accidentally dropping `attendance_records` or deleting employee biometric IDs), initiate the emergency runbook (Spec P15):
   * Access Supabase Dashboard -> Database -> Backups -> **Point in Time Recovery**.
   * Restore the production database instance to the exact minute immediately preceding the failed migration push.

---

*Document approved by Anchor Fashion Technical Leadership. Next Step: Spec P14 (Query Optimization).*
