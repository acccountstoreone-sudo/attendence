# Project Folder Structure
**Project Title**: Anchor Fashion — In-House Multi-Branch Attendance Management System  
**Document Version**: 1.0.0  
**Prepared For**: Anchor Fashion (Engineering Team & Architecture Review)  
**Specification Reference**: Spec P06 (Category 01: Planning & Architecture)  

---

## 1. Production-Grade Folder Structure (Next.js 14 App Router)

The following tree defines the exact architectural layout for Anchor Fashion's application. It utilizes Next.js 14 App Router route groups (`(admin)`, `(branch-manager)`, `(employee)`, `(auth)`) to segregate role-based dashboards and UI workflows cleanly. It also establishes dedicated directories for Supabase SQL migrations, FaceIO biometric adapters, shared UI components (`shadcn/ui`), and server-side utilities.

```
anchor-fashion-attendance/
├── .github/
│   └── workflows/
│       ├── ci.yml                             # Automated linting, type-checking, and unit tests on PR
│       └── deploy.yml                         # Production Vercel deployment & Supabase migration pipeline
├── public/
│   ├── brand/
│   │   ├── anchor-logo.svg                    # Anchor Fashion official corporate logo
│   │   └── anchor-logo-dark.svg               # Dark mode logo variant
│   └── sounds/
│       ├── checkin-success.mp3                # Audio chime for shop-floor check-in success
│       └── checkin-error.mp3                  # Audio alert for biometric/GPS rejection
├── supabase/
│   ├── migrations/
│   │   ├── 20260704000001_core_schema.sql     # Core tables: company_profile, branches, profiles, attendance_records
│   │   ├── 20260704000002_advanced_schema.sql # Advanced tables: branch_settings, audit_logs, notifications
│   │   ├── 20260704000003_rls_policies.sql    # Row Level Security policies for branch data isolation
│   │   └── 20260704000004_functions.sql       # Triggers: calculate_attendance_status(), log_audit()
│   ├── tests/
│   │   └── rls_isolation.test.sql             # pgTAP test scripts verifying cross-branch access rejection
│   ├── config.toml                            # Supabase CLI local development configuration
│   └── seed.sql                               # Local test seed data (3 pilot branches, 2 BMs, 10 employees)
├── src/
│   ├── app/
│   │   ├── (auth)/                            # Route Group: Unauthenticated authentication flows
│   │   │   ├── login/
│   │   │   │   └── page.tsx                   # Email/Password login page (public signup disabled)
│   │   │   ├── forgot-password/
│   │   │   │   └── page.tsx                   # Supabase password reset request page
│   │   │   └── layout.tsx                     # Minimal auth layout with brand header
│   │   ├── (employee)/                        # Route Group: Shop-floor Employee self-service
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx                   # Big Check-In/Out button, today status card, mini calendar
│   │   │   ├── leave/
│   │   │   │   └── page.tsx                   # Leave application form and balance tracker
│   │   │   ├── profile/
│   │   │   │   └── page.tsx                   # Personal profile view (read-only except phone/contact)
│   │   │   └── layout.tsx                     # Employee navigation bar & mobile bottom bar
│   │   ├── (branch-manager)/                  # Route Group: Store-level Branch Manager portal
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx                   # Live attendance feed (Realtime), late alerts, quick stats
│   │   │   ├── employees/
│   │   │   │   ├── page.tsx                   # Store staff directory & quick "+ Add Employee" modal
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx               # Individual employee attendance log & biometric status
│   │   │   ├── leave-approvals/
│   │   │   │   └── page.tsx                   # Pending leave approval/rejection queue with BM notes
│   │   │   ├── reports/
│   │   │   │   └── page.tsx                   # Branch monthly report export (PDF / Excel)
│   │   │   └── layout.tsx                     # Branch Manager sidebar & store indicator
│   │   ├── (admin)/                           # Route Group: HQ Company Admin universal console
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx                   # Grid of "Branch Tiles", company summary chart, "+ Add Branch"
│   │   │   ├── branches/
│   │   │   │   ├── page.tsx                   # Master list of all retail store branches
│   │   │   │   └── [branchId]/                # Nested route: Admin drilling into a specific store
│   │   │   │       ├── page.tsx               # Branch overview tile & settings
│   │   │   │       ├── employees/
│   │   │   │       │   └── page.tsx           # Full staff list for this store with detailed attendance
│   │   │   │       └── reports/
│   │   │   │           └── page.tsx           # Store-specific report generation & export
│   │   │   ├── company-settings/
│   │   │   │   └── page.tsx                   # HQ Profile, default work hours, timezone, holidays
│   │   │   ├── payroll-export/
│   │   │   │   └── page.tsx                   # Monthly salary sheet estimation & payroll lock
│   │   │   ├── audit-logs/
│   │   │   │   └── page.tsx                   # Company-wide activity & security audit trail viewer
│   │   │   └── layout.tsx                     # Admin executive navigation sidebar & HQ header
│   │   ├── api/                               # Next.js 14 Serverless API Route Handlers
│   │   │   ├── auth/
│   │   │   │   ├── callback/route.ts          # Supabase Auth cookie exchange & session callback
│   │   │   │   └── logout/route.ts            # Server-side session termination handler
│   │   │   ├── attendance/
│   │   │   │   ├── check-in/route.ts          # Validates FaceIO flag + Haversine GPS -> inserts log
│   │   │   │   ├── check-out/route.ts         # Updates checkout time & computes overtime minutes
│   │   │   │   ├── today/route.ts             # Returns current user's live check-in status for today
│   │   │   │   ├── history/route.ts           # Role-scoped historical attendance logs query
│   │   │   │   ├── manual-correction/route.ts # BM/Admin override endpoint with mandatory audit logging
│   │   │   │   └── sync-offline/route.ts      # Batch ingestion for offline-queued check-ins
│   │   │   ├── branches/
│   │   │   │   ├── route.ts                   # GET all branches (Admin tiles) / POST create new branch
│   │   │   │   └── [branchId]/
│   │   │   │       ├── route.ts               # PUT edit branch / PATCH soft-deactivate store
│   │   │   │       └── employees/route.ts     # GET branch staff list (Admin drill-down requirement)
│   │   │   ├── employees/
│   │   │   │   ├── route.ts                   # POST create account (Admin any branch, BM own branch)
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts               # GET profile / PUT edit / PATCH deactivate staff
│   │   │   │       └── enroll-face/route.ts   # Updates profile with FaceIO facialId vector
│   │   │   ├── leave/
│   │   │   │   ├── route.ts                   # POST apply for leave / GET role-scoped requests
│   │   │   │   └── [id]/approve/route.ts      # PUT approve/reject leave with BM comment
│   │   │   ├── reports/
│   │   │   │   ├── branch/[branchId]/route.ts # Store monthly summary aggregation endpoint
│   │   │   │   ├── company/monthly/route.ts   # Admin company-wide branch comparison endpoint
│   │   │   │   └── export/route.ts            # Generates PDF/Excel & returns Supabase Signed URL
│   │   │   ├── notifications/
│   │   │   │   └── route.ts                   # GET user alerts / PATCH mark notification read
│   │   │   └── company/
│   │   │       └── profile/route.ts           # GET/PUT company name, logo, address, policies
│   │   ├── favicon.ico                        # Browser tab icon
│   │   ├── globals.css                        # Tailwind CSS imports & custom fashion-retail tokens
│   │   ├── layout.tsx                         # Root Next.js HTML layout with font & theme providers
│   │   └── page.tsx                           # Root landing page -> redirects to /login or role dashboard
│   ├── components/                            # Reusable UI component library
│   │   ├── ui/                                # shadcn/ui primitives (Card, Table, Badge, Dialog, Button)
│   │   ├── auth/
│   │   │   └── LoginForm.tsx                  # Email/password form with Zod client validation
│   │   ├── attendance/
│   │   │   ├── CheckInButton.tsx              # Large shop-floor action button with state animations
│   │   │   ├── FaceVerificationModal.tsx      # FaceIO camera capture modal with visual spinner/chime
│   │   │   ├── GpsStatusBadge.tsx             # Distance indicator ("You are 35m from Gulshan Branch")
│   │   │   └── OfflineSyncBanner.tsx          # Warning banner: "Saved offline (3 queued). Will sync online"
│   │   ├── dashboard/
│   │   │   ├── BranchTile.tsx                 # Admin card: Branch Name, Employee Count, % Attendance, Badge
│   │   │   ├── AttendanceStatsCard.tsx        # Metric summary box (Present, Late, Absent, Overtime)
│   │   │   └── LiveAttendanceFeed.tsx         # Realtime table updating check-ins via WebSockets
│   │   ├── leave/
│   │   │   ├── LeaveApplyModal.tsx            # Date range picker & leave type selector
│   │   │   └── LeaveBalanceBar.tsx            # Visual progress bar showing remaining casual/sick days
│   │   └── reports/
│   │       ├── ReportFilterBar.tsx            # Month/Year & Branch selector dropdowns
│   │       ├── PdfExportButton.tsx            # Triggers server-side PDF generation and file download
│   │       └── BranchComparisonChart.tsx      # Recharts bar chart comparing attendance % across stores
│   ├── lib/                                   # Shared core utilities and external service clients
│   │   ├── supabase/
│   │   │   ├── client.ts                      # Browser-side Supabase client (for Realtime & public read)
│   │   │   ├── server.ts                      # Server-side SSR cookie client (for Route Handlers / RSC)
│   │   │   └── admin.ts                       # Service Role client (Strictly server-only for admin tasks)
│   │   ├── faceio/
│   │   │   ├── client.ts                      # FaceIO SDK initializer (`fio.enroll()`, `fio.authenticate()`)
│   │   │   └── errors.ts                      # `fioErrHandler` mapping error codes to Bengali/English text
│   │   ├── gps/
│   │   │   └── haversine.ts                   # Server-side distance math between coords (lat1,lng1 -> lat2,lng2)
│   │   ├── utils/
│   │   │   ├── auth-helpers.ts                # `getCurrentUser()` helper returning role + branch_id
│   │   │   ├── rbac.ts                        # `requireRole()` and `requireOwnBranch()` route guard logic
│   │   │   ├── formatters.ts                  # BDT currency, time/date formatting (BST / UTC+6)
│   │   │   └── export-helpers.ts              # Excel workbook builder and PDF layout generator
│   │   └── validations/
│   │       ├── auth.schema.ts                 # Zod schema for login and password reset
│   │       ├── attendance.schema.ts           # Zod schema verifying lat/lng numbers and FaceIO flags
│   │       ├── branch.schema.ts               # Zod schema for store creation and geofencing limits
│   │       └── leave.schema.ts                # Zod schema for date ranges and leave reasons
│   ├── types/                                 # TypeScript interfaces and Supabase DB definitions
│   │   ├── database.types.ts                  # Auto-generated Supabase SQL table types
│   │   ├── auth.types.ts                      # UserRole enum ('admin' | 'branch_manager' | 'employee')
│   │   ├── attendance.types.ts                # AttendanceStatus enum ('present' | 'late' | 'absent' | 'half_day')
│   │   └── reports.types.ts                   # Monthly aggregation and salary estimation interfaces
│   ├── hooks/                                 # Custom React client hooks
│   │   ├── useRealtimeAttendance.ts           # Subscribes to Supabase WebSocket channel for store check-ins
│   │   ├── useGeolocation.ts                  # Captures browser GPS coords & handles permission denied states
│   │   └── useOfflineQueue.ts                 # Monitors IndexedDB/localStorage for offline check-in syncing
│   └── middleware.ts                          # Next.js Edge Middleware: Session refresh & role route redirect
├── .env.example                               # Template of required environment variables (secrets excluded)
├── .env.local                                 # Local development secrets (ignored by Git)
├── .gitignore                                 # Excludes node_modules, .next, .env*, and build artifacts
├── .eslintrc.json                             # ESLint configuration enforcing strict TypeScript rules
├── next.config.mjs                            # Next.js build settings & image optimization domains
├── package.json                               # Dependencies: next, @supabase/ssr, tailwindcss, lucide-react, zod
├── tailwind.config.ts                         # Design system color tokens, dark mode, and custom breakpoints
└── tsconfig.json                              # TypeScript strict compiler options & path aliases (@/* -> src/*)
```

---

## 2. Environment Variables Configuration (`.env.example`)

The following `.env.example` file defines all required configuration keys. It explicitly documents which keys are safe for client-side exposure (`NEXT_PUBLIC_*`) versus which must remain strictly server-side.

```env
# ==============================================================================
# ANCHOR FASHION — ATTENDANCE MANAGEMENT SYSTEM (.env.example)
# ==============================================================================
# INSTRUCTIONS: Copy this file to `.env.local` for local development.
# NEVER commit actual secret keys or `.env.local` to Git repository!
# In Vercel, paste these variables under Project Settings -> Environment Variables.
# ==============================================================================

# 1. SUPABASE DATABASE & AUTH CONFIGURATION
# ------------------------------------------------------------------------------
# Public URL of your Supabase project (Safe to expose in browser bundle)
NEXT_PUBLIC_SUPABASE_URL="https://your-project-ref.supabase.co"

# Public Anonymous API Key (Safe to expose; restricted by database RLS policies)
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# STRICTLY SERVER-ONLY: Supabase Service Role Key (Bypasses ALL RLS policies!)
# WARNING: NEVER prefix with NEXT_PUBLIC_. Use ONLY in server-side API Route Handlers!
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.server_only_secret..."

# PostgreSQL Database Connection String (For running CLI migrations / Prisma / Drizzle)
DATABASE_URL="postgresql://postgres:password@db.your-project-ref.supabase.co:5432/postgres"


# 2. FACEIO BIOMETRIC RECOGNITION ENGINE
# ------------------------------------------------------------------------------
# Public Application ID from FaceIO Console (Safe to expose for client camera widget)
NEXT_PUBLIC_FACEIO_APP_ID="fio_app_anchor_fashion_prod_12345"

# Server-side API Key for querying FaceIO REST API (Optional for audit verification)
FACEIO_SERVER_API_KEY="fio_secret_key_server_only_67890"


# 3. APPLICATION DOMAIN & SECURITY
# ------------------------------------------------------------------------------
# Base canonical URL of the application (Used for OAuth callbacks & report links)
NEXT_PUBLIC_APP_URL="https://attendance.anchorfashion.com"

# Node environment ('development' | 'staging' | 'production')
NODE_ENV="development"


# 4. TRANSACTIONAL EMAIL ENGINE (Resend / Supabase SMTP)
# ------------------------------------------------------------------------------
# Server-only API key for sending daily manager digests and monthly reports
RESEND_API_KEY="re_123456789_server_only_secret_key"
DEFAULT_FROM_EMAIL="attendance-notifications@anchorfashion.com"


# 5. PERFORMANCE MONITORING & ERROR TRACKING
# ------------------------------------------------------------------------------
# Sentry DSN for capturing production API and frontend runtime exceptions
NEXT_PUBLIC_SENTRY_DSN="https://key@sentry.io/project"
```

---

*Document approved by Anchor Fashion Technical Leadership. Next Step: Spec P07 (Development Roadmap).*
