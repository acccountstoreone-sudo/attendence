# Anchor Fashion ERP — Incident Response Plan
# Spec P39 | Version 1.0 | Date: 2026-07-04

## 1. Purpose & Scope

This plan defines the process for detecting, containing, and recovering from security incidents
affecting the Anchor Fashion Attendance Management System. It covers all environments:
production (Vercel + Supabase), staging, and local development.

---

## 2. Incident Classification

| Severity | Description | Response Time | Examples |
|---|---|---|---|
| **P1 — Critical** | Active breach, data exfiltration, or system-wide outage | < 15 minutes | DB compromise, unauthorized admin access, biometric data leak |
| **P2 — High** | Security vulnerability exploited, partial data exposure | < 1 hour | RLS bypass found, API authentication failure |
| **P3 — Medium** | Suspicious activity detected, no confirmed breach | < 4 hours | Rate limit violations, unusual login patterns |
| **P4 — Low** | Informational, no immediate risk | < 24 hours | Failed login attempts within normal range |

---

## 3. Incident Response Team

| Role | Responsibility | Contact |
|---|---|---|
| Incident Commander | Coordinates overall response | CTO / Lead Developer |
| Security Analyst | Investigates root cause, collects evidence | DevOps / Backend Lead |
| Communications Lead | Notifies affected users and stakeholders | HR Director |
| Database Admin | Executes DB containment (RLS, revoke access) | Supabase Admin |

---

## 4. Detection Channels

- **Sentry** — Application errors, unusual exception spikes
- **Supabase Audit Logs** — SQL access logs, auth events
- **Vercel Analytics** — Traffic anomalies, error rate spikes
- **UptimeRobot** — Availability monitoring alerts
- **Employee Reports** — Phishing reports, suspicious behavior

---

## 5. Response Procedures

### 5.1 Immediate Containment (P1/P2)

```bash
# 1. Revoke all active sessions
# Supabase Dashboard → Authentication → Users → Force logout all

# 2. Rotate API keys immediately
# Supabase Dashboard → Settings → API → Regenerate anon + service keys
# Update Vercel environment variables

# 3. Enable Supabase maintenance mode
# Supabase Dashboard → Settings → Pausing (temporarily pause DB if needed)

# 4. Pull emergency admin override
supabase db execute --sql "REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;"
```

### 5.2 Investigation Steps

1. Export Supabase Auth logs for the incident time window
2. Review `attendance_logs` and `profiles` for unauthorized INSERT/UPDATE
3. Check Vercel function logs for unusual request patterns
4. Determine breach vector (credential stuffing, RLS bypass, IDOR, etc.)

### 5.3 Recovery Steps

1. Patch the identified vulnerability in codebase
2. Re-deploy via Vercel with security fix
3. Restore DB access with updated RLS policies
4. Reset affected employee accounts and send password reset emails
5. Notify all affected employees within 72 hours (GDPR requirement)

---

## 6. Communication Templates

### 6.1 Employee Notification (Data Breach)

```
Subject: Important Security Notice — Anchor Fashion Attendance System

Dear [Name],

We are writing to inform you that we recently identified a security incident
that may have affected your attendance data. We take your privacy seriously
and have taken immediate steps to secure our systems.

What happened: [Brief description without technical details]
What data was involved: [Attendance records / Profile data]
What we are doing: [Steps taken to secure and notify]
What you should do: [Reset password, verify attendance records]

If you have questions, contact HR at hr@anchorfashion.com

Sincerely,
Anchor Fashion Management
```

---

## 7. Post-Incident Review

Within 48 hours of resolution:
- [ ] Root cause analysis completed
- [ ] Timeline documented
- [ ] Control gaps identified and patched
- [ ] Security audit checklist updated (P38)
- [ ] Lessons learned shared with development team
- [ ] Regulatory reporting completed if required (Bangladesh DPA)

---

## 8. Testing

Incident response plan to be tested via tabletop exercise every 6 months.
Last tested: N/A (Initial version — schedule first exercise within 90 days of go-live)
