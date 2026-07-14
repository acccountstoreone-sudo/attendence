import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { computeEmployeeDutySummary } from '@/lib/dutyEngine';
import { z } from 'zod';

const generatePayrollSchema = z.object({
  branch_id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  month_year: z.string().regex(/^\d{4}-\d{2}$/, 'Format must be YYYY-MM'),
});

/**
 * POST /api/payroll/generate
 * Generates Monthly Payroll accurately integrating exact duty summary engine (Spec P65).
 * Automatically accounts for approved leaves, holidays, overtime pay (1.5x), and late/missed deductions.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(['admin', 'branch_manager']);
    const body = await request.json();
    const input = generatePayrollSchema.parse(body);

    const supabase = await createClient();

    let profilesQuery = supabase.from('profiles').select('id, full_name, branch_id');
    
    if (input.user_id) {
      profilesQuery = profilesQuery.eq('id', input.user_id);
    } else if (input.branch_id) {
      if (user.role === 'branch_manager' && input.branch_id !== user.branch_id) {
        return NextResponse.json({ success: false, error: 'Unauthorized branch' }, { status: 403 });
      }
      profilesQuery = profilesQuery.eq('branch_id', input.branch_id);
    } else {
      if (user.role !== 'admin') {
         profilesQuery = profilesQuery.eq('branch_id', user.branch_id);
      }
    }

    const { data: employees, error: empErr } = await profilesQuery;
    if (empErr || !employees) throw new Error('Failed to fetch employees for payroll generation');

    const results = [];
    const [yearStr, monthStr] = input.month_year.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const daysInMonth = new Date(year, month, 0).getDate();

    for (const employee of employees) {
      try {
        // 1. Fetch Salary Settings
        const { data: settings } = await supabase
          .from('salary_settings')
          .select('*')
          .eq('user_id', employee.id)
          .single();

        if (!settings) {
          results.push({ user_id: employee.id, full_name: employee.full_name, status: 'error', reason: 'No salary settings configured' });
          continue;
        }

        // 2. Compute exact duty report using dutyEngine
        const dutySummary = await computeEmployeeDutySummary(supabase, employee.id, month, year);
        const { summary } = dutySummary;

        // 3. Calculate Deductions & Overtime
        // 3 lates = 1 absent penalty, half day = 0.5 absent
        const latePenalties = Math.floor(summary.total_late_days / 3);
        const totalAbsences = summary.total_missed_days + latePenalties + (summary.total_half_days * 0.5);

        const totalPayableDays = Math.max(0, daysInMonth - totalAbsences);

        const baseSalary = Number(settings.base_salary || 0);
        const houseRent = Number(settings.house_rent_allowance || 0);
        const medical = Number(settings.medical_allowance || 0);
        const transport = Number(settings.transport_allowance || 0);
        const grossSalary = baseSalary + houseRent + medical + transport;

        const dailyRate = grossSalary / daysInMonth;
        const deductions = totalAbsences * dailyRate;

        // Overtime & Snack Allowance Calculation (using custom override or store default rates from dutyEngine)
        const hourlyFallbackRate = baseSalary > 0 ? (baseSalary / daysInMonth) / 8 : dailyRate / 8;
        const overtimeRateUsed = summary.overtime_rate_per_hour ?? (hourlyFallbackRate * 1.5);
        const overtimePay = summary.total_overtime_pay !== undefined
          ? summary.total_overtime_pay
          : ((summary.total_overtime_minutes / 60) * overtimeRateUsed);

        const snackRateUsed = summary.daily_snack_allowance ?? 0;
        const snackPay = summary.total_snack_allowance_pay !== undefined
          ? summary.total_snack_allowance_pay
          : (summary.total_present_days * snackRateUsed);

        const netPayable = grossSalary - deductions + overtimePay + snackPay;

        // 4. Save/Upsert into payroll_sheets with exact audit breakdown
        const { data: sheet, error: sheetErr } = await supabase
          .from('payroll_sheets')
          .upsert({
            user_id: employee.id,
            month_year: input.month_year,
            total_payable_days: Number(totalPayableDays.toFixed(1)),
            gross_salary: parseFloat(grossSalary.toFixed(2)),
            deductions: parseFloat(deductions.toFixed(2)),
            net_payable: parseFloat(netPayable.toFixed(2)),
            overtime_hours: summary.total_overtime_hours,
            overtime_rate_used: parseFloat(Number(overtimeRateUsed).toFixed(2)),
            overtime_pay: parseFloat(overtimePay.toFixed(2)),
            present_days: summary.total_present_days,
            snack_allowance_used: parseFloat(Number(snackRateUsed).toFixed(2)),
            snack_allowance_pay: parseFloat(snackPay.toFixed(2)),
            status: 'draft',
            created_at: new Date().toISOString()
          }, { onConflict: 'user_id, month_year' })
          .select()
          .single();

        if (sheetErr) {
          results.push({ user_id: employee.id, full_name: employee.full_name, status: 'error', reason: sheetErr.message });
        } else {
          results.push({
            user_id: employee.id,
            full_name: employee.full_name,
            status: 'success',
            data: {
              ...sheet,
              duty_summary_snapshot: {
                present_days: summary.total_present_days,
                on_leave_days: summary.total_on_leave_days,
                missed_days: summary.total_missed_days,
                overtime_hours: summary.total_overtime_hours,
                regular_overtime_hours: summary.total_regular_overtime_hours ?? summary.total_overtime_hours,
                holiday_overtime_hours: summary.total_holiday_overtime_hours ?? 0,
                overtime_rate_used: parseFloat(Number(overtimeRateUsed).toFixed(2)),
                holiday_overtime_multiplier: summary.holiday_overtime_multiplier ?? 2.0,
                overtime_pay: parseFloat(overtimePay.toFixed(2)),
                regular_overtime_pay: summary.regular_overtime_pay ?? parseFloat(overtimePay.toFixed(2)),
                holiday_overtime_pay: summary.holiday_overtime_pay ?? 0,
                snack_allowance_used: parseFloat(Number(snackRateUsed).toFixed(2)),
                snack_allowance_pay: parseFloat(snackPay.toFixed(2)),
              }
            }
          });
        }
      } catch (err: unknown) {
        results.push({ user_id: employee.id, full_name: employee.full_name, status: 'error', reason: err instanceof Error ? err.message : String(err) });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Payroll generation completed for ${results.length} employees (${input.month_year}).`,
      data: results
    });
  } catch (error) {
    return handleApiError(error);
  }
}

