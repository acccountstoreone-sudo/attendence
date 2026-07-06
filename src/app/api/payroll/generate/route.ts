import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const generatePayrollSchema = z.object({
  branch_id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  month_year: z.string().regex(/^\d{4}-\d{2}$/, 'Format must be YYYY-MM'),
});

/**
 * Generates Monthly Payroll (Spec P65).
 * Calculates total payable days based on attendance and deducts for absences.
 */
export async function POST(request: NextRequest) {
  try {
    // Only admins or branch managers can generate payroll
    const user = await requireRole(['admin', 'branch_manager']);
    const body = await request.json();
    const input = generatePayrollSchema.parse(body);

    const supabase = await createClient();

    // Determine target scope
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
    if (empErr || !employees) throw new Error('Failed to fetch employees');

    const results = [];

    // Calculate for each employee
    for (const employee of employees) {
      // 1. Fetch Salary Settings
      const { data: settings } = await supabase
        .from('salary_settings')
        .select('*')
        .eq('user_id', employee.id)
        .single();

      if (!settings) {
        results.push({ user_id: employee.id, status: 'error', reason: 'No salary settings found' });
        continue;
      }

      // 2. Fetch Attendance for the month
      const [year, month] = input.month_year.split('-');
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1).toISOString();
      const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59).toISOString();

      const { data: logs } = await supabase
        .from('attendance_logs')
        .select('status')
        .eq('user_id', employee.id)
        .gte('check_in_time', startDate)
        .lte('check_in_time', endDate);

      let presentDays = 0;
      let lateDays = 0;
      let absentDays = 0;
      let halfDays = 0;

      if (logs) {
        for (const log of logs) {
          if (log.status === 'present') presentDays++;
          if (log.status === 'late') lateDays++; // E.g., 3 lates = 1 absent penalty (simplified)
          if (log.status === 'absent') absentDays++;
          if (log.status === 'half_day') halfDays++;
        }
      }

      // 3. Compute Net Payable (Simplified rules)
      const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
      
      // Assumption: Weekends are paid. We only deduct for explicitly marked absences.
      // 3 Lates = 1 Absent penalty
      const latePenalties = Math.floor(lateDays / 3);
      const totalAbsences = absentDays + latePenalties + (halfDays * 0.5);

      const totalPayableDays = Math.max(0, daysInMonth - totalAbsences);
      
      const grossSalary = Number(settings.base_salary) + 
                          Number(settings.house_rent_allowance) + 
                          Number(settings.medical_allowance) + 
                          Number(settings.transport_allowance);
      
      const dailyRate = grossSalary / daysInMonth;
      const deductions = totalAbsences * dailyRate;
      const netPayable = grossSalary - deductions;

      // 4. Save to payroll_sheets
      const { data: sheet, error: sheetErr } = await supabase
        .from('payroll_sheets')
        .upsert({
          user_id: employee.id,
          month_year: input.month_year,
          total_payable_days: totalPayableDays,
          gross_salary: parseFloat(grossSalary.toFixed(2)),
          deductions: parseFloat(deductions.toFixed(2)),
          net_payable: parseFloat(netPayable.toFixed(2)),
          status: 'draft'
        }, { onConflict: 'user_id, month_year' })
        .select()
        .single();

      if (sheetErr) {
        results.push({ user_id: employee.id, status: 'error', reason: sheetErr.message });
      } else {
        results.push({ user_id: employee.id, status: 'success', data: sheet });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Payroll generation completed for ${results.length} employees`,
      data: results
    });

  } catch (error) {
    return handleApiError(error);
  }
}
