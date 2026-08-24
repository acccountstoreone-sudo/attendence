import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { isWithinGeofence } from '@/lib/geo';
import { getEuclideanDistance } from '@/lib/biometric';
import { dispatchToBranchManagers, dispatchToAdmins } from '@/lib/notification-service';
import { z } from 'zod';

const checkInSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  face_verified: z.boolean(),
  faceDescriptor: z.array(z.number()).optional(),
  facial_id: z.string().optional(),
  branch_id: z.string().uuid().optional(),
  is_manual_override: z.boolean().optional(),
  is_offline_sync: z.boolean().optional().default(false),
  timestamp: z.string().datetime().optional(),
  liveness_passed: z.boolean().optional(), // kept for backward compat but no longer required
  photo_url: z.string().optional(),
  webauthn_verified: z.boolean().optional(),
});

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 1. Enforce Role: Employees, Branch Managers, & Admins can check in
    const user = await requireRole(['admin', 'employee', 'branch_manager']);

    // 2. Parse & Validate Body
    const body = await request.json();
    const payload = checkInSchema.parse(body);

    const supabase = await createClient();
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

    // 3. Biometric Verification Check (face match only — no liveness challenge required)
    if (!payload.webauthn_verified) {
      if (!payload.face_verified || !payload.faceDescriptor || payload.faceDescriptor.length === 0) {
        return NextResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'BIOMETRIC_FAILED', message: 'Biometric verification failed. Face descriptor missing or empty.' },
            timestamp: new Date().toISOString(),
          },
          { status: 403 }
        );
      }

      // Verify against stored face descriptor & reverification status
      if (!profile || !profile.face_descriptor || profile.face_enrolled === false || (profile as Record<string, unknown>).requires_face_reverification === true) {
        return NextResponse.json(
          {
            success: false,
            data: null,
            error: {
              code: 'BIOMETRIC_REVERIFICATION_REQUIRED',
              message: (profile as Record<string, unknown>)?.requires_face_reverification
                ? 'Admin has cancelled and reset your face verification. You must re-verify your face right now before checking in.'
                : 'No facial biometric data found for this employee. Please enroll and verify your face first before checking in.',
            },
            timestamp: new Date().toISOString(),
          },
          { status: 403 }
        );
      }

      try {
        const isManualBypass = payload.faceDescriptor.length === 128 && payload.faceDescriptor.every((v: number) => v === 0);

        if (isManualBypass) {
          // Manual capture bypass: employee clicked "Capture Now" to bypass auto-scan.
          // We allow this to proceed; the manager will approve it based on the photo.
          payload.is_manual_override = true;
          payload.face_verified = false; // flag as unverified so manager knows
        } else {
          if (payload.faceDescriptor.length !== profile.face_descriptor.length) {
            return NextResponse.json(
              {
                success: false,
                data: null,
                error: {
                  code: 'BIOMETRIC_DIMENSION_MISMATCH',
                  message: `Face descriptor dimension mismatch: received ${payload.faceDescriptor.length}, expected ${profile.face_descriptor.length}.`,
                },
                timestamp: new Date().toISOString(),
              },
              { status: 403 }
            );
          }
          const distance = getEuclideanDistance(payload.faceDescriptor, profile.face_descriptor);
          if (distance > 1.20) {
            return NextResponse.json(
              {
                success: false,
                data: null,
                error: {
                  code: 'BIOMETRIC_MISMATCH',
                  message: `Face does not match. Distance: ${distance.toFixed(3)}. Please re-enroll or contact your manager.`,
                },
                timestamp: new Date().toISOString(),
              },
              { status: 403 }
            );
          }
        }
      } catch {
        return NextResponse.json({ success: false, data: null, error: { code: 'BIOMETRIC_ERROR', message: 'Error processing facial comparison.' } }, { status: 500 });
      }
    } // End of !payload.webauthn_verified block

    // 4. Check if user already checked in today
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const [month, day, year] = formatter.format(now).split('/');
    
    const startOfDay = new Date(`${year}-${month}-${day}T00:00:00+06:00`);
    const endOfDay = new Date(`${year}-${month}-${day}T23:59:59.999+06:00`);

    // 4a. Check for unresolved incomplete past shifts
    const { data: incompleteShift } = await supabase
      .from('attendance_records')
      .select('id, check_in_time')
      .eq('employee_id', user.id)
      .is('check_out_time', null)
      .lt('check_in_time', startOfDay.toISOString())
      .order('check_in_time', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (incompleteShift) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'INCOMPLETE_PAST_SHIFT',
            message: 'You have an unresolved check-in from a previous day. Please submit a manual correction before checking in today.',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 403 }
      );
    }

    // 4b. Check if user already checked in today
    const { data: existingRecord } = await supabase
      .from('attendance_records')
      .select('id, check_in_time')
      .eq('employee_id', user.id)
      .gte('check_in_time', startOfDay.toISOString())
      .lte('check_in_time', endOfDay.toISOString())
      .maybeSingle();

    if (existingRecord) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'ALREADY_CHECKED_IN',
            message: `You have already checked in today at ${new Date(existingRecord.check_in_time).toLocaleTimeString()}.`,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // 5. Fetch Branch Geofence Coordinates & Settings
    let targetBranchId = payload.branch_id || user.branch_id;
    
    // Security Fix: Prevent Employees from spoofing their branch_id
    if (user.role === 'employee') {
      if (payload.branch_id && user.branch_id && payload.branch_id !== user.branch_id) {
        return NextResponse.json(
          {
            success: false,
            data: null,
            error: {
              code: 'FORBIDDEN_BRANCH',
              message: 'Check-in denied: You cannot check into a branch other than your assigned store.',
            },
            timestamp: new Date().toISOString(),
          },
          { status: 403 }
        );
      }
      targetBranchId = user.branch_id;
    }

    if (!targetBranchId && (user.role === 'admin' || user.role === 'branch_manager')) {
      const { data: firstActive } = await supabase
        .from('branches')
        .select('id')
        .eq('is_active', true)
        .not('latitude', 'is', null)
        .limit(1)
        .maybeSingle();
      if (firstActive) targetBranchId = firstActive.id;
    }

    if (!targetBranchId) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'NO_BRANCH_ASSIGNED',
            message: 'Your profile is not assigned to any physical store branch. Contact HR or select a branch.',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const { data: branch, error: branchErr } = await supabase
      .from('branches')
      .select('name, latitude, longitude, geofence_radius_meters, is_active')
      .eq('id', targetBranchId)
      .single();

    if (branchErr || !branch || !branch.latitude || !branch.longitude) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'BRANCH_GEO_MISSING',
            message: 'Assigned branch geofence coordinates are not configured.',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    if (!branch.is_active) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'BRANCH_INACTIVE',
            message: 'Your assigned branch is currently inactive. Check-in denied.',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 403 }
      );
    }

    // 6. Haversine GPS Distance Verification (Spec P19)
    const geo = isWithinGeofence(
      payload.latitude,
      payload.longitude,
      Number(branch.latitude),
      Number(branch.longitude),
      branch.geofence_radius_meters || 100
    );

    const isAdminOrManager = user.role === 'admin' || user.role === 'branch_manager';

    const maxAllowedDistance = payload.is_manual_override 
      ? (branch.geofence_radius_meters || 100) * 1.5 
      : (branch.geofence_radius_meters || 100);

    if (!payload.is_offline_sync && !isAdminOrManager && geo.distance > maxAllowedDistance) {
      return NextResponse.json(
        {
          success: false,
          data: { distance_meters: geo.distance, allowed_radius: branch.geofence_radius_meters },
          error: {
            code: 'OUT_OF_GEOFENCE',
            message: `Check-in denied: You are ${geo.distance}m away from ${branch.name} (max allowed: ${branch.geofence_radius_meters}m).`,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 403 }
      );
    }

    // 6.5 Shift Timing Check (Early Block & Post-Shift Block)
    const { data: companyProfile } = await supabase.from('company_profile').select('default_work_start_time, default_work_end_time').single();
    let workStartTime = companyProfile?.default_work_start_time || '09:00:00';
    let workEndTime = companyProfile?.default_work_end_time || '18:00:00';
    
    if (targetBranchId) {
      const { data: branchSettings } = await supabase
        .from('branch_settings')
        .select('work_start_time, work_end_time')
        .eq('branch_id', targetBranchId)
        .maybeSingle();
      if (branchSettings && branchSettings.work_start_time) {
        workStartTime = branchSettings.work_start_time;
      }
      if (branchSettings && branchSettings.work_end_time) {
        workEndTime = branchSettings.work_end_time;
      }
    }

    // Override with Dynamic Shift Roster if assigned
    const { data: activeShiftAssgn } = await supabase
      .from('employee_shifts')
      .select('shifts(start_time, end_time)')
      .eq('user_id', user.id)
      .lte('effective_from', `${year}-${month}-${day}`)
      .or(`effective_to.gte.${year}-${month}-${day},effective_to.is.null`)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeShiftAssgn?.shifts) {
      const shiftData = Array.isArray(activeShiftAssgn.shifts) ? activeShiftAssgn.shifts[0] : activeShiftAssgn.shifts;
      if (shiftData) {
        workStartTime = shiftData.start_time || workStartTime;
        workEndTime = shiftData.end_time || workEndTime;
      }
    }

    const checkInDateObj = payload.is_offline_sync && payload.timestamp ? new Date(payload.timestamp) : new Date();
    
    // Parse start and end times explicitly in Asia/Dhaka timezone
    // to avoid server timezone (UTC) issues when deployed.
    const safeStartTime = workStartTime.split(':').length === 2 ? `${workStartTime}:00` : workStartTime;
    const safeEndTime = workEndTime.split(':').length === 2 ? `${workEndTime}:00` : workEndTime;
    
    const workStartTimestamp = new Date(`${year}-${month}-${day}T${safeStartTime}+06:00`);
    const workEndTimestamp = new Date(`${year}-${month}-${day}T${safeEndTime}+06:00`);

    const diffEarlyMinutes = (workStartTimestamp.getTime() - checkInDateObj.getTime()) / 60000;
    const MAX_EARLY_MINUTES = 120; // 2 hours limit

    if (diffEarlyMinutes > MAX_EARLY_MINUTES) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'CHECK_IN_TOO_EARLY',
            message: `Check-in denied: You cannot check in more than ${MAX_EARLY_MINUTES / 60} hours before your shift starts (${workStartTime}).`,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 403 }
      );
    }

    // Post-Shift Block: If checking in after the shift has ended
    if (checkInDateObj.getTime() > workEndTimestamp.getTime()) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'CHECK_IN_TOO_LATE',
            message: `Check-in denied: Your shift for today has already ended at ${workEndTime}.`,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 403 }
      );
    }

    // 6.6 Off-Day Block Check
    // Friday (5) is the weekly off day. 
    // Check if there is an approved off-day request for today.
    let isHolidayDuty = false;
    const isFriday = new Date(`${year}-${month}-${day}T12:00:00Z`).getUTCDay() === 5;
    
    if (isFriday) {
      const requestDateStr = `${year}-${month}-${day}`;
      const { data: offDayReq, error: offDayErr } = await supabase
        .from('off_day_overtime_requests')
        .select('status')
        .eq('employee_id', user.id)
        .eq('requested_date', requestDateStr)
        .eq('status', 'approved')
        .maybeSingle();

      if (!isAdminOrManager && (offDayErr || !offDayReq)) {
        return NextResponse.json(
          {
            success: false,
            data: null,
            error: {
              code: 'OFF_DAY_CHECKIN_DENIED',
              message: 'Check-in denied: Today is an off-day (Friday). You must request off-day overtime and have it approved by a manager before checking in.',
            },
            timestamp: new Date().toISOString(),
          },
          { status: 403 }
        );
      }
      isHolidayDuty = true;
    }

    // 7. Insert Attendance Record (Database Trigger calculate_attendance_status computes punctuality)
    // Bug 6 fix: For offline sync, validate that the provided timestamp falls within today (Asia/Dhaka)
    // to prevent backdated cross-day check-ins from bypassing the duplicate-guard above.
    let checkInTime: string;
    if (payload.is_offline_sync && payload.timestamp) {
      const offlineDate = new Date(payload.timestamp);
      const offlineFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Dhaka',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const [offMonth, offDay, offYear] = offlineFormatter.format(offlineDate).split('/');
      if (`${offYear}-${offMonth}-${offDay}` !== `${year}-${month}-${day}`) {
        return NextResponse.json(
          {
            success: false,
            data: null,
            error: {
              code: 'OFFLINE_SYNC_DATE_MISMATCH',
              message: 'Offline check-in timestamp must be for today. Backdated sync is not permitted.',
            },
            timestamp: new Date().toISOString(),
          },
          { status: 400 }
        );
      }
      const todayDate = new Date();
      const diffHours = (todayDate.getTime() - offlineDate.getTime()) / (1000 * 3600);
      if (diffHours < -0.2) {
        return NextResponse.json(
          {
            success: false,
            data: null,
            error: {
              code: 'OFFLINE_SYNC_FUTURE_TIME',
              message: 'Offline check-in timestamp cannot be significantly in the future.',
            },
            timestamp: new Date().toISOString(),
          },
          { status: 400 }
        );
      }
      checkInTime = payload.timestamp;
    } else {
      checkInTime = new Date().toISOString();
    }

    const { data: newRecord, error: insertErr } = await supabase
      .from('attendance_records')
      .insert({
        employee_id: user.id,
        branch_id: targetBranchId,
        check_in_time: checkInTime,
        check_in_lat: payload.latitude,
        check_in_lng: payload.longitude,
        face_verified: payload.face_verified,
        status: 'present', // Will be evaluated/overridden by trigger trg_calculate_attendance_status
        is_manual_override: !geo.within || Boolean(payload.is_manual_override),
        is_holiday_duty: isHolidayDuty,
        approval_status: 'pending', // Requires Branch Manager approval before counting
      })
      .select()
      .single();

    if (insertErr || !newRecord) {
      throw new Error(`Database Insert Failed: ${insertErr?.message}`);
    }

    // Notify Branch Managers AND Admins about pending check-in approval (with email & action_url)
    try {
      const timeStr = new Date(checkInTime).toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dhaka' });
      const notifTitle = '⏳ Attendance Check-In Approval Required';
      const notifMsg = `${profile?.full_name || 'An employee'} has checked in at ${branch.name} at ${timeStr}. Please approve or reject.`;

      await Promise.all([
        dispatchToBranchManagers({
          branchId: targetBranchId,
          title: notifTitle,
          message: notifMsg,
          type: 'attendance_approval',
          actionUrl: '/branch-manager/attendance',
          sendEmail: true,
        }),
        dispatchToAdmins({
          title: notifTitle,
          message: notifMsg,
          type: 'attendance_approval',
          actionUrl: '/admin/attendance',
          sendEmail: true,
        }),
      ]);
    } catch {
      // Non-fatal: notification failure should not block check-in
    }

    // Update live location and first verified location if not yet set
    const locUpdate: Record<string, unknown> = {
      last_known_latitude: payload.latitude,
      last_known_longitude: payload.longitude,
      last_location_updated_at: new Date().toISOString(),
    };
    if (!(profile as Record<string, unknown>).first_verified_at) {
      locUpdate.first_verified_latitude = payload.latitude;
      locUpdate.first_verified_longitude = payload.longitude;
      locUpdate.first_verified_at = new Date().toISOString();
    }
    try {
      await supabase.from('profiles').update(locUpdate).eq('id', user.id);
    } catch {
      // Ignore non-fatal location update errors
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          ...newRecord,
          distance_meters: geo.distance,
          branch_name: branch.name,
        },
        message: `Check-in successful at ${branch.name}. Pending Branch Manager approval.`,
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}

