import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole(['admin', 'branch_manager']);
    const adminClient = getAdminClient();
    if (!adminClient) {
      throw new Error('Admin client not available');
    }

    // Fetch latest system notifications to derive broadcast history
    let query = adminClient
      .from('notifications')
      .select('title, message, created_at, user_id')
      .eq('type', 'system')
      .order('created_at', { ascending: false })
      .limit(500);

    const { data, error } = await query;

    if (error) {
      throw new Error(`DB Error: ${error.message}`);
    }

    // Deduplicate broadcasts — group by title + message + hour window
    const history: any[] = [];
    const seen = new Set<string>();

    for (const item of (data || [])) {
      // Group by title and roughly the same hour to handle slight differences in created_at
      const dateHour = item.created_at ? item.created_at.substring(0, 13) : '';
      const key = `${item.title}::${item.message}::${dateHour}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        history.push({
          id: key,
          title: item.title,
          message: item.message,
          created_at: item.created_at,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: history.slice(0, 50),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
