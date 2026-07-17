import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/cron/refresh-mv
 * Endpoint intended to be called by a cron job (e.g., Vercel Cron or GitHub Actions)
 * to refresh the `mv_monthly_branch_summary` materialized view nightly.
 */
export async function GET(request: Request) {
  try {
    // Optional: Add authorization header check to ensure only the cron job can trigger this
    // const authHeader = request.headers.get('authorization');
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    //   return new NextResponse('Unauthorized', { status: 401 });
    // }

    const supabase = await createClient();

    // Call the stored procedure created in migration 20260704000005_query_optimization.sql
    const { error } = await supabase.rpc('refresh_monthly_branch_summary_mv');

    if (error) {
      console.error('Failed to refresh materialized view:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Materialized view mv_monthly_branch_summary refreshed successfully.'
    });
  } catch (error: any) {
    console.error('Cron job error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
