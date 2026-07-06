# Feature Prioritization (MoSCoW Method)
**Project Title**: Anchor Fashion — In-House Multi-Branch Attendance Management System  
**Document Version**: 1.0.0  
**Prepared For**: Anchor Fashion (Internal Retail & HQ Leadership)  
**Specification Reference**: Spec P04 (Category 01: Planning & Architecture)  

---

## 1. Executive Summary & Launch Strategy

Anchor Fashion operates a growing network of retail stores across the country. To modernize operations without overwhelming store staff or introducing unnecessary delivery risk, we adopt a phased rollout strategy. 

Our primary objective is to launch a **working, production-ready Version 1 (v1) across the first 3 to 5 pilot retail branches within an 8 to 10 week development window**. 

To ensure we meet this timeline with zero operational regression, all features specified in the Project Vision (Spec P01) have been categorized using the **MoSCoW prioritization framework**:
* **Must Have**: Critical path features required for v1 launch. Without these, the system cannot replace paper logs or manual attendance sheets.
* **Should Have**: High-value operational enhancements that streamline daily store supervision and HR workflows. Targeted for inclusion in the 8–10 week v1 deliverable.
* **Could Have**: Advanced optimizations and intelligent automations that add significant long-term value but can be safely deferred to v1.1 or post-pilot expansion.
* **Won't Have (for v1)**: Out-of-scope capabilities explicitly excluded from the initial build to protect timeline and simplicity.

---

## 2. MoSCoW Prioritization Table

*Complexity Legend*: **S** (Small: 1–3 days) | **M** (Medium: 3–6 days) | **L** (Large: 1–2 weeks).

| Feature / Module | Priority | Strategic Reasoning & Operational Impact | Est. Complexity |
| :--- | :--- | :--- | :--- |
| **Admin Branch CRUD** (Create, Edit, Geocode, Deactivate Stores) | **MUST HAVE** | Foundational requirement. HQ Admin must be able to launch new store locations dynamically with GPS geofence coordinates and radius without code deployments. | **M** |
| **Employee & Manager CRUD** (Onboard, Assign Branch, Deactivate) | **MUST HAVE** | Core identity management. Admin and BMs must create staff accounts scoped to specific branches. Public signup is blocked for security. | **M** |
| **FaceIO Biometric Verification** (Enrollment & Check-in/out) | **MUST HAVE** | Primary objective of the software. Eliminates buddy-punching on shop-floor tablets/phones by matching facial vectors via camera. | **L** |
| **Browser GPS Geofence Verification** (Haversine Distance Check) | **MUST HAVE** | Enforces physical presence at the retail store. Prevents staff from checking in from home or transit by validating distance against store coordinates. | **M** |
| **Basic Attendance Log & Timestamps** (Daily Records & Override) | **MUST HAVE** | The core data ledger. Captures in/out timestamps, coordinates, and status. Allows BMs to make audited manual corrections for edge cases. | **S** |
| **Role-Based Dashboards** (Admin Grid, BM Portal, Employee View) | **MUST HAVE** | Tailored UX per role. BMs need store-level live attendance; Admin needs company-wide branch tiles with drill-down capability; Employees need self-check-in. | **L** |
| **Basic PDF & Excel Report Export** (Monthly Summaries) | **MUST HAVE** | Essential for HQ Accounts/HR. Monthly attendance summaries must be exportable to formatted PDF (with BM signature lines) and Excel/CSV for payroll. | **M** |
| **Database RLS Tenant Isolation** (Supabase Security Policies) | **MUST HAVE** | Critical security layer. Enforces strict branch-level data isolation so store managers cannot access data from neighboring retail branches. | **M** |
| **Leave Management Workflow** (Apply, Approve/Reject, Balances) | **SHOULD HAVE** | Streamlines store operations. Eliminates paper leave slips by allowing staff to apply digitally and BMs to approve/reject with annual balance tracking. | **M** |
| **Automated Overtime & Late Calculation** (Rules Engine & Triggers) | **SHOULD HAVE** | Automates payroll math. DB triggers evaluate check-in time against store start time + grace period, auto-flagging late arrivals and computing overtime minutes. | **M** |
| **Real-Time Check-In Notifications** (Supabase WebSockets) | **SHOULD HAVE** | Enhances store supervision. When an employee checks in on a shop-floor tablet, the BM dashboard updates instantly without manual browser refreshing. | **S** |
| **Automated Email & In-App Alerts** (Leave Alerts & Daily Digests) | **SHOULD HAVE** | Keeps managers proactive. Sends daily end-of-day digests to BMs ("3 late today, 1 leave pending") and weekly summaries to HQ Admin. | **M** |
| **Offline Check-In Queueing & Auto-Sync** (localStorage Resilience) | **COULD HAVE** | Protects against retail store internet disconnections. Queues check-ins locally with original timestamps and auto-syncs when online (flagged for review). | **M** |
| **AI-Powered Narrative Report Summary** (LLM Executive Summary) | **COULD HAVE** | Executive delight. Sends anonymized monthly aggregation numbers to an LLM to generate plain-language insights on top of HQ reports. | **S** |
| **Attendance Pattern Analytics** (Chronic Lateness & Health Score) | **COULD HAVE** | Advanced HR analytics. Detects staff late 3+ times in rolling 30 days and computes a 0–100 "Attendance Health Score" badge per branch tile. | **M** |
| **Internal Salary Sheet & Payroll Lock** (Gross Pay Estimation) | **COULD HAVE** | HR/Accounts efficiency. Admin-only confidential layer multiplying attendance hours by wage rates, with a monthly data lock to prevent accidental edits. | **L** |
| **Multi-Shift & Roster Management** (Morning/Evening Shifts) | **COULD HAVE** | Retail operational flexibility. Allows stores with rotating shifts to define shift schedules and assign staff weekly. (Can use fixed hours for pilot). | **M** |
| **Multi-Language UI (Bengali/English)** | **WON'T HAVE (v1)** | To ensure rapid delivery, core UI remains English. (Exception: Employee biometric consent and privacy notices will be bilingual Bengali/English as required by P35). | **N/A** |
| **Third-Party POS / Inventory Integration** | **WON'T HAVE (v1)** | Correlating store sales volume with staff attendance is deferred to v2. (We will design the external API schema, Spec P68, but not build integrations now). | **N/A** |
| **Multi-Currency Support** | **WON'T HAVE (v1)** | Anchor Fashion operates domestically; all financial and payroll calculations adhere strictly to local currency (BDT) norms. | **N/A** |

---

## 3. Implementation Focus for 8–10 Week Target

By focusing our engineering efforts strictly on the **Must Have** (8 features) and **Should Have** (4 features) categories during Weeks 1 through 8, the development team guarantees a robust, fully functional beta release for the 3-store pilot program. 

The **Could Have** features (Offline Sync, AI Summaries, Pattern Analytics, Salary Sheets) will be architected into the database schema from Day 1 (so no breaking changes occur later) and iteratively enabled during the Week 9–10 pilot refinement phase.

---

*Document approved by Anchor Fashion Technical Leadership. Next Step: Spec P05 (Tech Stack Justification).*
