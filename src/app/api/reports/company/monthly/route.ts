import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    // 1. Admin-Only Guard (Spec P20)
    await requireRole(['admin']);

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const month = Number(searchParams.get('month')) || (now.getMonth() + 1);
    const year = Number(searchParams.get('year')) || now.getFullYear();

    if (month < 1 || month > 12 || year < 2020 || year > 2100) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'INVALID_DATE', message: 'Invalid month or year.' } },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 2. Call optimized company-wide RPC get_company_wide_summary_optimized (Spec P14 & P20)
    const { data: summary, error } = await supabase.rpc('get_company_wide_summary_optimized', {
      p_month: month,
      p_year: year,
    });

    if (error) {
      // Fallback to P12 base RPC if optimized version fails or is not found
      const { data: baseSummary, error: baseErr } = await supabase.rpc('get_company_wide_summary', {
        p_month: month,
        p_year: year,
      });
      if (baseErr) throw new Error(`Company Summary RPC Failed: ${baseErr.message}`);
      return NextResponse.json({
        success: true,
        data: { month, year, summary: baseSummary || [] },
        message: 'Company-wide monthly attendance summary retrieved.',
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        month,
        year,
        summary: summary || [],
      },
      message: 'Company-wide monthly attendance summary retrieved successfully.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

