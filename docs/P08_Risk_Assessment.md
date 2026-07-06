# Risk Assessment & Mitigation Register
**Project Title**: Anchor Fashion — In-House Multi-Branch Attendance Management System  
**Document Version**: 1.0.0  
**Prepared For**: Anchor Fashion (Risk Management & Technical Governance)  
**Specification Reference**: Spec P08 (Category 01: Planning & Architecture)  

---

## 1. Risk Assessment Overview

Deploying an enterprise-wide, biometric-enabled Attendance Management System across dozens of physical retail branches introduces unique technical, operational, privacy, and business continuity challenges. Unlike standard desktop SaaS tools, this system operates on shop-floor mobile devices under variable lighting, cellular connectivity fluctuations, and strict labor compliance standards.

To ensure zero operational disruption and protect employee data, we have conducted a comprehensive risk assessment across five core domains:
1. **Technical Risk**: Biometric recognition accuracy, indoor GPS drift, and database tenant isolation.
2. **Adoption Risk**: Staff and store manager resistance to facial scanning and new digital workflows.
3. **Data & Privacy Risk**: Handling sensitive biometric vectors, employee consent, and regulatory compliance.
4. **Operational Risk**: Store internet disconnections, device hardware failures, and power outages.
5. **Business Continuity Risk**: Administrative account compromise, vendor cloud outages, and disaster recovery.

---

## 2. Risk Register Table

*Evaluation Legend*:
* **Likelihood**: **High** (>60% chance) | **Medium** (30–60% chance) | **Low** (<30% chance).
* **Impact**: **Critical** (System halt / Data breach / Payroll failure) | **Moderate** (Operational friction / Delay) | **Minor** (Minor inconvenience / UI glitch).

| Risk ID | Risk Description | Category | Likelihood | Impact | Mitigation Strategy | Owner |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RSK-01** | **FaceIO False Rejections in Low Store Lighting**: Employees entering dimly lit store entrances or wearing heavy makeup/facial hair experience biometric check-in failures, causing shift queues and frustration. | Technical | **Medium** | **Moderate** | **1.** Enforce minimum camera lighting guidelines during store onboarding.<br>**2.** Implement `fioErrHandler` to give immediate visual feedback ("Move to brighter light").<br>**3.** Provide BM manual check-in override fallback with mandatory audit logging.<br>**4.** Enable BM triggered re-enrollment flow for significant appearance changes. | Frontend Lead / Store BM |
| **RSK-02** | **Indoor GPS Inaccuracy / Geofence Drift**: In dense multi-story shopping malls, cellular/GPS signals reflect or weaken, causing browser accuracy to degrade (>150m error) and falsely rejecting on-site staff check-ins. | Technical | **High** | **Moderate** | **1.** Make geofence radius configurable per branch in Admin settings (`branches.radius_meters`, default 100m, expandable to 200m for dense malls).<br>**2.** Log browser accuracy metadata (`accuracy_meters`) on server.<br>**3.** Provide indoor mall manual fallback workflow approved by BM. | Backend Lead / HQ Admin |
| **RSK-03** | **Supabase RLS Misconfiguration / Data Leak**: A flaw in database security policies or an RPC function running with `SECURITY DEFINER` allows a Branch Manager or Employee to query attendance records from another retail branch. | Technical | **Low** | **Critical** | **1.** Enforce strict PostgreSQL Row Level Security (RLS) on every table (`ENABLE ROW LEVEL SECURITY`).<br>**2.** Build automated pgTAP / integration tests asserting 403 Forbidden when BM-A queries Branch-B data.<br>**3.** Never trust client-provided `branch_id`; derive strictly from server session JWT. | Database Architect / Security Lead |
| **RSK-04** | **Staff Resistance to Facial Scanning**: Shop-floor employees or trade unions express apprehension or refuse to scan faces due to privacy fears of "photograph surveillance." | Adoption | **Medium** | **Moderate** | **1.** Conduct clear internal communication explaining that **no photographs are stored**—only irreversible mathematical vector strings.<br>**2.** Provide mandatory bilingual (Bengali & English) privacy notices and consent forms (Spec P35).<br>**3.** Establish formal manual fallback process for staff who formally decline biometrics. | HR Director / Store BM |
| **RSK-05** | **Biometric Data Privacy & Regulatory Non-Compliance**: Storing employee biometric vectors without formal consent or retaining records indefinitely after employee termination violates labor and privacy norms. | Data / Privacy| **Low** | **Critical** | **1.** Enforce explicit digital checkbox consent during initial onboarding before triggering FaceIO SDK.<br>**2.** Implement automated data retention policy: instantly delete `facial_id` vectors upon employee offboarding/deactivation.<br>**3.** Restrict database access strictly to authenticated SSL endpoints. | HR Legal Counsel / Security Lead |
| **RSK-06** | **Retail Store Internet Disconnection**: A store broadband or cellular outage prevents shop-floor devices from reaching Vercel or Supabase, halting morning shift check-ins. | Operational | **High** | **Moderate** | **1.** Build Offline-First Check-In Queue (Spec P45) using browser `localStorage` / `IndexedDB`.<br>**2.** Store timestamps and GPS coords locally during offline states.<br>**3.** Auto-sync queued records when internet returns, tagging as `late-synced` for BM review to prevent time tampering. | Full-Stack Lead / Store BM |
| **RSK-07** | **Shop-Floor Device Failure / Battery Loss**: The dedicated store tablet or smartphone breaks, gets lost, or loses battery right before a major shift change. | Operational | **Medium** | **Moderate** | **1.** System is browser-based (responsive HTML5/JS); staff can temporarily check in using the BM's store PC or any authorized smartphone.<br>**2.** Require stores to maintain a charging station and backup power bank for attendance devices.<br>**3.** BM can manually log attendance via dashboard if hardware fails completely. | Store BM / IT Support |
| **RSK-08** | **HQ Admin Account Compromise**: A phishing attack or weak password compromises an Admin account, granting an unauthorized actor full company-wide access to payroll, staff records, and branch settings. | Business Continuity | **Low** | **Critical** | **1.** Enforce strong password policies (minimum 12 characters, alphanumeric/symbols).<br>**2.** Enforce Mandatory Multi-Factor Authentication (MFA/2FA) via Supabase Auth for all Admin accounts.<br>**3.** Log all Admin administrative actions in immutable `audit_logs` table.<br>**4.** Establish formal Incident Response Plan (Spec P39) for immediate key rotation and account freezing. | Security Lead / HQ Owner |
| **RSK-09** | **Cloud Vendor Outage (Vercel / Supabase)**: An unexpected cloud infrastructure outage halts live check-ins and dashboard access during business hours. | Business Continuity | **Low** | **Moderate** | **1.** Maintain documented manual fallback runbook (paper attendance sheet / Excel template, Spec P73) in every branch.<br>**2.** BM records attendance manually during outage.<br>**3.** When systems recover, BM inputs manual timestamps via audited `/api/attendance/manual-correction` endpoint.<br>**4.** Enforce Supabase daily backups and Point-in-Time Recovery (PITR). | DevOps Engineer / HQ Admin |

---

## 3. Summary of Critical Safeguards

To summarize for company leadership, the highest-risk operational threats are fully mitigated by three foundational engineering designs:
1. **Against GPS Drift in Malls**: Configurable store geofence radii plus BM manual approval fallbacks.
2. **Against Store Internet Outages**: Offline browser queueing that saves timestamps locally and auto-syncs when reconnected.
3. **Against Data Leaks Across Stores**: Cryptographic PostgreSQL Row Level Security (RLS) that locks store data at the database engine level.

---

*Document approved by Anchor Fashion Leadership. Category 01 (Planning & Architecture, Specs P01–P08) Complete.*
