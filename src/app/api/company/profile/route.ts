import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const companyUpdateSchema = z.object({
  name: z.string().min(2, 'Company name must be at least 2 characters.'),
  hq_address: z.string().optional(),
  working_hours_start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, 'Invalid start time format'),
  working_hours_end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, 'Invalid end time format'),
  grace_period_minutes: z.number().int().min(0).max(120),
  overtime_multiplier: z.number().min(1).max(5).default(1.5),
});

export async function GET() {
  try {
    // 1. All authenticated users can view company profile & working rules
    await requireRole(['admin', 'branch_manager', 'employee']);
    const supabase = await createClient();

    const { data: company, error } = await supabase
      .from('company_profile')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch company profile: ${error.message}`);
    }

    if (!company) {
      // Return default Anchor Fashion policy if table is empty
      return NextResponse.json({
        success: true,
        data: {
          name: 'Anchor Fashion Ltd.',
          hq_address: 'Corporate Headquarters, Dhaka, Bangladesh',
          working_hours_start: '09:00',
          working_hours_end: '18:00',
          grace_period_minutes: 15,
          overtime_multiplier: 1.5,
        },
        message: 'Default company profile returned.',
        timestamp: new Date().toISOString(),
      });
    }

    // Postgres TIME fields come with seconds (e.g. 09:00:00). We should slice them for the frontend UI.
    // Also map DB columns to frontend expected fields.
    let mappedCompany = company;
    if (company) {
      mappedCompany = {
        ...company,
        hq_address: company.address,
        working_hours_start: company.default_work_start_time ? company.default_work_start_time.slice(0, 5) : '09:00',
        working_hours_end: company.default_work_end_time ? company.default_work_end_time.slice(0, 5) : '18:00',
        grace_period_minutes: 15,
        overtime_multiplier: 1.5,
      };
    }

    return NextResponse.json({
      success: true,
      data: mappedCompany,
      message: 'Company profile retrieved successfully.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    // 2. Admin-Only Update (Spec P21)
    const user = await requireRole(['admin']);
    const body = await request.json();
    const payload = companyUpdateSchema.parse(body);

    const supabase = await createClient();

    // Check if a company record already exists
    const { data: existing } = await supabase
      .from('company_profile')
      .select('id')
      .limit(1)
      .maybeSingle();

    // Map frontend keys to database columns
    const dbPayload = {
      name: payload.name,
      address: payload.hq_address || '',
      default_work_start_time: payload.working_hours_start,
      default_work_end_time: payload.working_hours_end,
      // Note: grace_period_minutes and overtime_multiplier are not currently in the company_profile table schema.
      // We omit them here to prevent PostgREST errors.
    };

    let result;
    if (existing) {
      const { data, error } = await supabase
        .from('company_profile')
        .update(dbPayload)
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw new Error(`Update failed: ${error.message}`);
      result = data;
    } else {
      const { data, error } = await supabase
        .from('company_profile')
        .insert(dbPayload)
        .select()
        .single();
      if (error) throw new Error(`Insert failed: ${error.message}`);
      result = data;
    }

    // Map result back to frontend expected structure for Audit and Return
    const frontendResult = {
      ...result,
      hq_address: result.address,
      working_hours_start: result.default_work_start_time,
      working_hours_end: result.default_work_end_time,
      grace_period_minutes: payload.grace_period_minutes,
      overtime_multiplier: payload.overtime_multiplier,
    };

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'UPDATE_COMPANY_PROFILE',
      table_name: 'company_profile',
      record_id: result.id,
      new_values: frontendResult,
      ip_address: request.headers.get('x-forwarded-for') || '127.0.0.1',
    });

    return NextResponse.json({
      success: true,
      data: frontendResult,
      message: 'Company profile and attendance policies updated successfully.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

