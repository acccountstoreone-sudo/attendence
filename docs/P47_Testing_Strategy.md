# Anchor Fashion — Attendance System Testing Strategy
# Spec P47 | Date: 2026-07-04

## Testing Philosophy

This system handles biometric data, payroll-linked attendance, and multi-branch HR operations.
Testing must be thorough, layered, and include real-world edge cases like GPS spoofing,
camera permission denial, late-night check-ins, and cross-branch data access attempts.

---

## Testing Pyramid

```
          [E2E — Playwright]
      Camera/GPS Flows, Role Guards
     ─────────────────────────────────
     [Integration — Supertest / Jest]
    API Route Handlers, DB Interactions
   ─────────────────────────────────────
   [Unit — Vitest / Jest]
  Haversine, Status Logic, Zod Schemas,
  Rate Limiter, Offline Queue, Auth Guards
```

---

## Test Suites by Category

### 1. Unit Tests (Spec P48) — `src/__tests__/unit/`

| Module | Tests |
|---|---|
| `src/lib/geo.ts` | Haversine accuracy, edge cases (poles, meridian), exact meters |
| `src/lib/auth.ts` | `requireRole` blocks wrong roles, `requireOwnBranch` blocks cross-branch |
| `src/lib/rate-limit.ts` | Window reset, limit enforcement, multi-key isolation |
| `src/lib/offline-queue.ts` | Enqueue, mark synced, retry count increment, sync all |
| `src/lib/validations.ts` | Schema pass/fail for all Zod schemas |
| Attendance status logic | present/late/absent/half_day status derivation |

### 2. API Integration Tests (Spec P49) — `src/__tests__/api/`

| Endpoint | Test Cases |
|---|---|
| `POST /api/attendance/check-in` | Valid check-in, outside geofence → 422, missing GPS → 400, duplicate same day → 409 |
| `POST /api/attendance/check-out` | Valid checkout, check-out before check-in → 422 |
| `GET /api/attendance/today` | Employee sees own data only, manager sees branch only |
| `GET /api/reports/branch-summary` | Admin gets all branches, BM gets own branch only |
| `POST /api/employees` | Admin can create, employee cannot → 403 |
| `POST /api/notifications` | Admin can broadcast, employee cannot → 403 |
| `POST /api/attendance/verify-location` | Within geofence → PASS, outside → OUTSIDE_GEOFENCE, mock GPS → SPOOFING_SUSPECTED |

### 3. E2E Tests with Playwright (Spec P50) — `e2e/`

| Flow | Mocking |
|---|---|
| Employee login → dashboard → check-in | Mock `navigator.geolocation` with valid branch coords |
| Employee check-in outside geofence | Mock GPS 500m from branch — expect UI block |
| Camera permission denied → error state | Mock `getUserMedia` rejection |
| Admin login → branch management → add branch | Real browser flow |
| Branch manager views corrections → approve | Real browser flow |
| Role guard: employee accessing `/admin` | Expect redirect to `/login?error=unauthorized` |
| Offline queue: check-in while offline, sync on reconnect | Mock `navigator.onLine = false` then restore |

### 4. Database Tests (Spec P51) — `supabase/tests/`

| Test | Verification |
|---|---|
| RLS — Employee cannot read other branch attendance | Direct DB query as authenticated user |
| RLS — Branch Manager cannot update another branch's data | INSERT/UPDATE attempt → expect denied |
| Trigger — `updated_at` auto-updates on profile change | Check timestamp changes after UPDATE |
| Function — `auth.user_branch_id()` returns correct value | Call function as test user |
| Geofence constraint — negative radius rejected | INSERT with `geofence_radius_meters = -10` |

### 5. Performance / Load Tests (Spec P52) — `load-tests/`

| Scenario | Tool | Target |
|---|---|---|
| Simultaneous check-ins (100 employees, 1 branch) | k6 | < 300ms p99 |
| Report generation for 12-month data | k6 | < 3s response time |
| Realtime notification delivery | Custom WebSocket test | < 500ms delivery |
| Rate limiter under DDoS (1000 req/min) | Artillery | 429 responses, no crashes |

---

## Test Environment Setup

```bash
# Unit tests
npx vitest run

# Integration tests (with test Supabase project)
SUPABASE_TEST_URL=... npx jest --testPathPattern=api

# E2E tests
npx playwright test

# Load tests (k6 required)
k6 run load-tests/check-in-burst.js
```

---

## Coverage Targets

| Layer | Target Coverage |
|---|---|
| Unit Tests | ≥ 80% line coverage |
| Integration Tests | All happy paths + critical error paths |
| E2E Tests | All 6 primary user flows |
| Security Tests | OWASP Top 10 checklist per P38 |
