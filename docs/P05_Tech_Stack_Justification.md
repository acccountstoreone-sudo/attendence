# Tech Stack Justification
**Project Title**: Anchor Fashion — In-House Multi-Branch Attendance Management System  
**Document Version**: 1.0.0  
**Prepared For**: Anchor Fashion (Company Leadership & HQ Sign-Off)  
**Specification Reference**: Spec P05 (Category 01: Planning & Architecture)  

---

## 1. Executive Summary

To build Anchor Fashion's internal, multi-branch Attendance Management System within an 8–10 week timeline, we have selected a modern, highly cohesive, serverless technology stack:
* **Frontend & API Layer**: Next.js 14 (App Router) with TypeScript, Tailwind CSS, and shadcn/ui.
* **Database, Auth & Storage**: Supabase (PostgreSQL, Supabase Auth, Supabase Storage, and Realtime WebSockets).
* **Biometric Engine**: FaceIO Web SDK (Facial vector recognition).
* **Geolocation Engine**: HTML5 Browser Geolocation API + Server-Side Haversine Math.

This document provides company leadership with a decision-focused evaluation of why this exact stack is optimal for a single-company internal platform, analyzes trade-offs against alternative technologies, outlines licensing/cost implications, and details our risk mitigation strategies.

---

## 2. Technology Evaluation & Justification

### 2.1 Next.js 14 (App Router) + TypeScript
* **Why it fits our internal tool & small team**: Next.js 14 allows a small engineering team (1–2 developers) to build both the rich interactive frontend dashboards and the secure backend API route handlers within a **single, unified codebase**. TypeScript ensures strict type safety across database queries, API payloads, and UI components, drastically reducing runtime bugs during rapid store expansion.
* **Trade-offs vs. Alternatives (e.g., Separate React SPA + Custom Node.js/Express Backend)**:
  * *Separate SPA + Node*: Requires maintaining two repositories, two deployment pipelines, complex CORS configurations, and manual API contract synchronization.
  * *Next.js 14 Monolith*: Eliminates network latency between UI and backend, simplifies deployment to Vercel, and allows sharing role-checking middleware and Zod validation schemas seamlessly across frontend and backend.

### 2.2 Supabase (PostgreSQL + Auth + Storage + Realtime)
* **Why it fits our internal tool & small team**: Supabase provides an enterprise-grade, open-source PostgreSQL database bundled with out-of-the-box authentication, file storage for payroll PDF reports, and WebSocket real-time capabilities. It eliminates the need to hire dedicated DevOps or database administrators while giving us full SQL power.
* **Trade-offs vs. Alternatives (Supabase vs. Firebase vs. Custom Postgres + Node ORM)**:
  * *Firebase (NoSQL)*: Highly rigid for complex relational queries (e.g., joining branches, employees, attendance logs, and leave balances for payroll rollups). Enforcing strict multi-branch security rules in NoSQL JSON trees is notoriously error-prone.
  * *Custom Postgres + Node (AWS RDS/Docker)*: Requires weeks of boilerplate setup for authentication, JWT refresh tokens, WebSocket servers, and S3 bucket IAM policies.
  * *Supabase (PostgreSQL)*: Gives us true relational SQL with **Row Level Security (RLS)**. We cryptographically lock branch data at the database engine level while utilizing pre-built SSR cookie auth and instant Realtime live check-in feeds.

### 2.3 Tailwind CSS + shadcn/ui
* **Why it fits our internal tool & small team**: Tailwind CSS provides utility-first styling for rapid UI development, while `shadcn/ui` offers accessible, customizable, professional-grade React components (Data Tables, Dialogs, Cards, Badges) owned directly in our codebase.
* **Trade-offs vs. Alternatives (e.g., Material-UI / Bootstrap / Ant Design)**:
  * *Heavy UI Libraries (MUI/AntD)*: Impose rigid, generic "corporate SaaS" visual aesthetics that are difficult to customize and inflate JavaScript bundle sizes, slowing down mobile devices on retail shop floors.
  * *Tailwind + shadcn/ui*: Zero runtime styling bloat, maximum performance, and complete creative control to craft a polished, fashion-retail branded aesthetic that wows store managers.

### 2.4 FaceIO Web SDK & Browser Geolocation API
* **Why it fits our internal tool**: FaceIO operates entirely via standard browser cameras (smartphones, tablets, PCs) without requiring expensive, proprietary physical biometric turnstiles or fingerprint scanners in stores. Combined with the native HTML5 Geolocation API, it converts any existing store tablet into a secure biometric attendance kiosk.

---

## 3. Licensing & Cost Implications at Expected Scale

Anchor Fashion's operational scale is well-defined: starting with 3–5 pilot branches (~50 to 100 employees) and expanding to 50+ branches (~1,500 to 5,000 employees).

| Technology / Service | Recommended Tier | Estimated Monthly Cost (Pilot: ~100 Staff) | Estimated Monthly Cost (At Scale: ~3,000 Staff) | Cost Notes & Economics |
| :--- | :--- | :--- | :--- | :--- |
| **Vercel (Hosting & Edge)** | Pro Plan | $20 / month (1 seat) | $40–$80 / month (2–4 dev seats) | Generous bandwidth and Serverless function execution included. Extremely cost-effective. |
| **Supabase (DB & Auth)** | Pro Plan | $25 / month | $25–$85 / month (depending on DB storage/compute) | Includes 100,000 monthly active users, daily backups, PITR, and 8GB storage. Easily covers 5,000 daily staff logs. |
| **FaceIO Biometric API** | Standard / Business Tier | ~$100–$250 / month (based on daily authentication volume) | ~$300–$600 / month (tier scaling with authentication volume) | FaceIO charges based on enrolled facial vectors and daily authentication API calls. Highly economical compared to buying $500+ physical biometric machines per store. |
| **Resend (Email Alerts)** | Free / Pro Tier | $0 (Free up to 3k emails) | $20 / month (up to 50k emails) | Handles daily BM digests and monthly report emails cleanly. |
| **TOTAL ESTIMATED COST** | | **~$145 – $295 / month** | **~$385 – $785 / month** | **ROI**: Eliminating buddy-punching and automating 50+ stores' payroll saves thousands of dollars monthly in wage leakage and HR administrative hours. |

---

## 4. Risk Assessment & Mitigation Strategies

When adopting cloud services and biometric workflows, specific operational and security risks must be mitigated:

### 4.1 Risk: Vendor Lock-in (Supabase & FaceIO)
* **Description**: Over-reliance on proprietary cloud APIs could make future migrations difficult.
* **Mitigation**: 
  * *Database*: Supabase is 100% open-source PostgreSQL. Our entire schema, RLS policies, and triggers are written in standard SQL (`supabase/migrations/`). If needed, we can export our database and host it on AWS RDS, Google Cloud SQL, or self-hosted Docker in under 2 hours.
  * *Biometrics*: FaceIO is isolated within a modular adapter (`lib/faceio/client.ts`). If FaceIO pricing or service changes, we can swap the biometric provider (e.g., AWS Rekognition or Azure Face API) without altering core attendance schemas or business logic.

### 4.2 Risk: Retail Store Offline / Internet Outages
* **Description**: Retail branches occasionally suffer cellular or broadband disconnections. If check-in fails offline, store staff get frustrated and attendance logs are lost.
* **Mitigation**: We implement an **Offline-First Check-In Queue (Spec P45)** using browser `localStorage` / `IndexedDB`. When offline, the app captures the check-in timestamp and GPS coordinates locally. Upon network restoration, a background worker automatically syncs queued records to the server, flagging them as `late-synced` for Branch Manager audit review.

### 4.3 Risk: GPS Spoofing by Employees
* **Description**: Tech-savvy staff might use "Mock Location" / GPS spoofing apps on smartphones to check in from home or transit while claiming to be at the store.
* **Mitigation**:
  1. **Server-Side Verification (Spec P41)**: The client app never decides "is within range". It only submits raw latitude/longitude. The Next.js server recomputes the Haversine distance against stored branch geofence coordinates.
  2. **Accuracy & Liveness Metadata**: The API logs browser accuracy metrics (`accuracy_meters`). Coordinates that are suspiciously perfect (e.g., exactly 0.0000m error) or exhibit unnatural jumping are flagged for Branch Manager review.
  3. **Biometric + GPS Coupling**: Because check-in requires a live camera facial scan simultaneously with GPS capture, buddy-punching via remote location spoofing is rendered impractical.

---

*Document approved by Anchor Fashion Leadership. Next Step: Spec P06 (Project Folder Structure).*
