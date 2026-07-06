# Anchor Fashion ERP — Vercel Deployment & Rollback SOP
# Spec P54 | Date: 2026-07-04

## 1. Initial Setup Checklist

1. **Vercel Project Creation**
   - Import the GitHub repository into Vercel.
   - Set Framework Preset to `Next.js`.
   - Set Build Command to `npm run build` and Output Directory to `.next`.
   - Ensure the server region is set to `sin1` (Singapore) for lowest latency to Bangladesh.

2. **Environment Variables Config**
   - Copy all variables from `.env.example` into Vercel's Environment Variables panel.
   - For `NEXT_PUBLIC_APP_ENV`, set to `production`.
   - Ensure `SUPABASE_SERVICE_ROLE_KEY` is securely set and not prefixed with `NEXT_PUBLIC_`.

3. **Domain Configuration**
   - Add custom domain (e.g., `erp.anchorfashion.com`).
   - Configure DNS A/CNAME records as provided by Vercel.
   - Verify SSL/TLS certificate generation.

## 2. Standard Deployment Workflow

1. **Feature Branch Merged**
   - Developer creates PR from `feature/*` to `main`.
   - GitHub Actions CI runs tests (Spec P55).
   - PR merged into `main`.

2. **Vercel Auto-Deployment**
   - Vercel hooks detect push to `main` and trigger a Production deployment.
   - Build phase runs (`npm run build`). Next.js creates optimized static/server bundles.

3. **Post-Deployment Verification**
   - Load the production URL.
   - Login as Admin, verify dashboard loads.
   - Perform a test GPS check-in (requires test store coordinates).

## 3. Rollback Procedure

If a deployment introduces a critical bug (P1/P2) that breaks production:

1. **Instant Revert via Vercel**
   - Go to the Vercel Project Dashboard → **Deployments**.
   - Locate the previous stable deployment (marked green).
   - Click the three dots (ellipsis) next to the deployment → **Promote to Production** (or **Assign Custom Domains**).
   - *Time to restore: ~5 seconds.*

2. **Codebase Synchronization**
   - After the Vercel instant revert, fix the code repository.
   - Run: `git revert <bad-commit-hash>`
   - Push the revert commit to `main`. Vercel will deploy this, keeping the repo in sync with the live state.

3. **Database Migration Rollback (If Applicable)**
   - If the bad deploy included a database migration, use Supabase CLI to rollback.
   - `supabase db reset` (for local/staging) OR apply down-migration scripts.
   - *Note: Avoid destructive migrations (like `DROP TABLE`) in production without severe testing.*
