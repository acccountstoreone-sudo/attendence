# Anchor Fashion ERP — Security Audit Checklist
# Spec P38 | Date: 2026-07-04

## Authentication & Session Management

| Check | Status | Notes |
|---|---|---|
| Passwords enforced min 8 chars with complexity | ✅ | Zod schema + Supabase Auth password policy |
| JWT tokens validated server-side on every request | ✅ | `getCurrentUser()` calls `supabase.auth.getUser()` |
| Session expiry enforced (idle timeout) | ✅ | `SESSION_TIMEOUT_MINUTES=480` (8 hours) |
| Secure HttpOnly cookies for refresh tokens | ✅ | Supabase SSR cookie management |
| No sensitive data in JWT payload | ✅ | Only `sub` (user ID) stored in JWT |
| Login rate limiting active | ✅ | `AUTH_LOGIN: 5 attempts / 15 mins` in rate-limit.ts |
| Password reset uses time-limited tokens | ✅ | Supabase built-in OTP email flow |
| Multi-factor auth available | 🔜 | Planned Phase 6 (P40) |

## Authorization & Access Control

| Check | Status | Notes |
|---|---|---|
| RBAC enforced at API layer | ✅ | `requireRole()` guards all sensitive routes |
| RLS enforced at DB layer | ✅ | Supabase RLS policies on all tables |
| Branch isolation enforced | ✅ | `requireOwnBranch()` + RLS filter |
| Admin routes protected from employee access | ✅ | Middleware + layout double-check |
| No horizontal privilege escalation | ✅ | Branch ID verified from session, not user input |

## Input Validation & Injection Prevention

| Check | Status | Notes |
|---|---|---|
| All API inputs validated with Zod | ✅ | `src/lib/validations.ts` — centralized schemas |
| SQL injection mitigated | ✅ | Supabase parameterized queries only |
| XSS protection active | ✅ | React JSX auto-escapes; no `dangerouslySetInnerHTML` |
| CSRF tokens implemented | 🔜 | Next.js Route Handlers use SameSite cookies |
| File uploads validated by MIME and size | ✅ | Photo upload limited to `image/*`, max 5MB |

## Data Privacy & Biometric Compliance

| Check | Status | Notes |
|---|---|---|
| Biometric consent obtained before capture | ✅ | `BiometricConsentModal` — bilingual BN/EN |
| Face data stored encrypted | ✅ | Supabase Storage with RLS + AES encryption |
| Data retention policy documented | ✅ | P36 doc: 7 years attendance, 90 days post-termination biometric |
| Data deletion mechanism available | 🔜 | HR request form planned |
| Privacy notice visible at check-in | ✅ | Consent modal includes full disclosure |

## Infrastructure & Secrets

| Check | Status | Notes |
|---|---|---|
| Secrets in env vars, not source code | ✅ | `.env.local` gitignored, `.env.example` provided |
| Service role key never exposed to client | ✅ | Used only in server-side API routes |
| HTTPS enforced in production | ✅ | Vercel enforces HTTPS; HSTS header |
| Dependency vulnerabilities checked | 🔜 | `npm audit` to be run pre-deploy |
| Rate limiting active on all endpoints | ✅ | `src/lib/rate-limit.ts` — sliding window |

## Legend
- ✅ Complete & Verified
- 🔜 Planned in next phase
- ⚠️ Partial — needs follow-up
- ❌ Not implemented (high priority)
