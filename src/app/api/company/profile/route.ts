import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const companyUpdateSchema = z.object({
  name: z.string().min(2, 'Company name must be at least 2 characters.'),
  hq_address: z.string().optional(),
  working_hours_start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid start time format (HH:mm)'),
  working_hours_end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid end time format (HH:mm)'),
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

    return NextResponse.json({
      success: true,
      data: company,
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

    let result;
    if (existing) {
      const { data, error } = await supabase
        .from('company_profile')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw new Error(`Update failed: ${error.message}`);
      result = data;
    } else {
      const { data, error } = await supabase
        .from('company_profile')
        .insert(payload)
        .select()
        .single();
      if (error) throw new Error(`Insert failed: ${error.message}`);
      result = data;
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'UPDATE_COMPANY_PROFILE',
      table_name: 'company_profile',
      record_id: result.id,
      new_values: payload,
      ip_address: request.headers.get('x-forwarded-for') || '127.0.0.1',
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Company profile and attendance policies updated successfully.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
