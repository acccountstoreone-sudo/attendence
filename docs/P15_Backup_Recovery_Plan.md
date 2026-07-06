# Data Backup & Disaster Recovery Plan
**Project Title**: Anchor Fashion — In-House Multi-Branch Attendance Management System  
**Document Version**: 1.0.0  
**Prepared For**: Anchor Fashion (Database Reliability & HR Governance)  
**Specification Reference**: Spec P15 (Category 02: Database & Schema)  

---

## 1. Out-of-the-Box Supabase Capabilities & Required Additions

Anchor Fashion's Attendance Management System relies on PostgreSQL as the single source of truth for daily shop-floor check-ins and monthly employee payroll calculations. To guarantee 100% data durability, we combine Supabase's managed cloud infrastructure with custom off-site backup automation.

### 1.1 Out-of-the-Box Supabase Features (Pro Plan Tier)
* **Automated Daily Backups**: Supabase takes automated snapshots of the entire PostgreSQL database once every 24 hours and retains them for 7 days.
* **Point-in-Time Recovery (PITR)**: Provides continuous Write-Ahead Log (WAL) archiving, allowing database administrators to restore the database to any exact second within the last 7 to 14 days (vital for reverting accidental data deletions or bad migrations).
* **Storage Bucket Backups**: Supabase Storage maintains high durability across AWS S3 availability zones for exported payroll PDF and Excel spreadsheets.

### 1.2 What We Must Add Ourselves (Custom Safeguards)
While Supabase protects against hardware failure, corporate governance and labor audit compliance require **vendor-independent off-site backups**. We must implement:
1. **Weekly Automated Off-Site Payroll Export**: A scheduled background worker (Vercel Cron / Supabase Edge Function) that dumps `attendance_records`, `profiles`, and `leave_requests` to an independent encrypted cloud bucket (e.g., AWS S3 Glacier or Google Cloud Storage HQ Archive).
2. **Immutable Audit Trail Mirroring**: Exporting the `audit_logs` table monthly to permanent cold storage for legal labor dispute protection.

---

## 2. Weekly Off-Site Backup Export Approach & Script

Because attendance logs directly dictate employee wage payouts, Anchor Fashion will execute an automated weekly export script every Sunday at midnight (BST / UTC+6).

### 2.1 Export Architecture & Node.js Script
The following script utilizes the Supabase Service Role Client to fetch payroll-critical tables in JSON/CSV format and stream them to an encrypted external Amazon S3 bucket owned by Anchor Fashion HQ.

```typescript
// scripts/backup-attendance-offsite.ts
// Run via GitHub Actions or Vercel Cron every Sunday at 00:00 BST
import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Bypass RLS for full company dump
);

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

async function executeWeeklyBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  console.log(`[Backup] Initiating weekly attendance dump: ${timestamp}`);

  // 1. Fetch profiles and attendance records for the last 30 days
  const { data: profiles, error: profErr } = await supabase.from('profiles').select('*');
  const { data: records, error: recErr } = await supabase
    .from('attendance_records')
    .select('*')
    .gte('check_in_time', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  if (profErr || recErr) throw new Error(`Supabase Query Failed: ${profErr?.message || recErr?.message}`);

  // 2. Prepare encrypted archive payload
  const backupPayload = JSON.stringify({
    generated_at: new Date().toISOString(),
    total_profiles: profiles.length,
    total_attendance_records: records.length,
    data: { profiles, attendance_records: records },
  });

  // 3. Upload to off-site S3 Glacier Vault
  const command = new PutObjectCommand({
    Bucket: process.env.HQ_OFFSITE_BACKUP_BUCKET!,
    Key: `attendance-backups/week-${timestamp}.json`,
    Body: backupPayload,
    ContentType: 'application/json',
    ServerSideEncryption: 'AES256',
  });

  await s3.send(command);
  console.log(`[Backup] Successfully archived to S3: attendance-backups/week-${timestamp}.json`);
}

executeWeeklyBackup().catch(console.error);
```

---

## 3. Disaster Recovery Runbook

This step-by-step runbook instructs engineering and DevOps personnel on how to respond immediately to database corruption or destructive migration failures.

### 3.1 Scenario A: Bad Migration Deletes Production Columns or Tables
* **Step 1 (T+0 min - Identify & Freeze)**: Immediately freeze all store check-ins by toggling the Vercel environment variable `NEXT_PUBLIC_KILL_SWITCH_ACTIVE="true"`. This instructs store tablets to fallback to offline queueing (Spec P59).
* **Step 2 (T+5 min - Assess Scope)**: Open Supabase Studio -> SQL Editor and check which tables or columns were affected by the flawed migration push.
* **Step 3 (T+10 min - Initiate PITR)**:
  1. Navigate to Supabase Dashboard -> Database -> Backups -> **Point in Time Recovery**.
  2. Select the exact date and time **2 minutes prior** to the execution of the failed migration.
  3. Click **Restore Database**. (Restoration typically takes 3 to 8 minutes depending on data volume).
* **Step 4 (T+20 min - Verify & Re-enable)**:
  1. Verify that `attendance_records` and `profiles` are intact via SQL `COUNT(*)` queries.
  2. Toggle `NEXT_PUBLIC_KILL_SWITCH_ACTIVE="false"` in Vercel to resume shop-floor biometric check-ins.
  3. Post post-mortem summary in HQ internal Slack/communication channel.

### 3.2 Scenario B: Total Cloud Region Outage
* **Step 1**: Instruct store Branch Managers via SMS/WhatsApp to switch immediately to the documented **Manual Fallback Paper/Excel Sheet (Spec P73)**.
* **Step 2**: When cloud infrastructure recovers, BMs log into the portal and input the manual timestamps using the audited `/api/attendance/manual-correction` endpoint, attaching the reason `"Cloud Outage Recovery"`.

---

## 4. Data Retention & Labor Law Compliance

### 4.1 Bangladesh Labor Law & Record-Keeping Norms
Under the **Bangladesh Labour Act, 2006 (and Labour Rules, 2015)**, employers are legally mandated to maintain service books, muster rolls, attendance registers, and wage calculation sheets for every worker. These formal labor records must be preserved for a **minimum of 3 years** to protect against wage disputes or government factory/shop inspector audits.

### 4.2 Recommended Data Retention Schedule
To balance labor law compliance with database storage costs and biometric privacy, Anchor Fashion enforces the following retention lifecycle:

| Data Category | Retention Period | Post-Retention Action & Storage Tier | Legal & Privacy Justification |
| :--- | :--- | :--- | :--- |
| **Daily Attendance Records** (`attendance_records`) | **3 Years (36 Months)** | Move records $> 36$ months old to compressed cold archive storage (S3 Glacier); delete from live PostgreSQL database. | Mandated by Bangladesh Labour Rules for wage muster roll inspections and overtime audit defense. |
| **Leave Applications** (`leave_requests`) | **3 Years (36 Months)** | Archive alongside attendance records; delete from live database. | Required to substantiate annual leave deductions and encashment during labor audits. |
| **Biometric Facial Vectors** (`profiles.facial_id`) | **Duration of Employment ONLY** | **Instant Deletion upon Termination/Offboarding**. When an employee leaves Anchor Fashion, their `facial_id` string is nullified immediately. | Enforces biometric data privacy (Spec P35). Never retain biometric vectors of ex-employees. |
| **Security Audit Logs** (`audit_logs`) | **5 Years (60 Months)** | Archive to immutable WORM (Write Once, Read Many) cold storage after 1 year in live DB. | Protects corporate governance against historical fraud or unauthorized system override investigations. |
| **Generated Monthly Payroll Reports** (PDF / Excel) | **7 Years (84 Months)** | Retained in secure HQ financial cloud storage. | Adheres to national corporate tax and accounting ledger retention standards. |

---

*Document approved by Anchor Fashion Technical Leadership. Next Step: Spec P16 (Multi-Branch Data Architecture).*
