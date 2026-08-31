import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { isWithinGeofence } from '@/lib/geo';
import { getEuclideanDistance } from '@/lib/biometric';
import { dispatchToBranchManagers, dispatchToAdmins } from '@/lib/notification-service';
import { z } from 'zod';

const checkOutSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  face_verified: z.boolean(),
  faceDescriptor: z.array(z.number()).optional(),
  facial_id: z.string().optional(),
  branch_id: z.string().uuid().optional(),
  is_offline_sync: z.boolean().optional().default(false),
  timestamp: z.string().datetime().optional(),
  liveness_passed: z.boolean().optional(),
  photo_url: z.string().optional(),
  webauthn_verified: z.boolean().optional(),
  is_manual_override: z.boolean().optional(),
});

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(['admin', 'employee', 'branch_manager']);
    const body = await request.json();
    const payload = checkOutSchema.parse(body);

    const supabase = await createClient();
    const { data: profile } = await supabase.from('profiles').select('full_name, face_descriptor').eq('id', user.id).single();

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

      // 3b. Verify against stored face descriptor
      
      if (!profile || !profile.face_descriptor) {
        return NextResponse.json(
          {
            success: false,
            data: null,
            error: {
              code: 'BIOMETRIC_ENROLLMENT_MISSING',
              message: 'No facial biometric data found for this employee. Please register your face first.',
            },
            timestamp: new Date().toISOString(),
          },
          { status: 403 }
        );
      }

      try {
        const isManualBypass = payload.faceDescriptor.length === 1024 && payload.faceDescriptor.every((v: number) => v === 0);

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
                  message: `Your face was enrolled using an older system. Please ask your manager to reset your face scan.`,
                },
                timestamp: new Date().toISOString(),
              },
              { status: 403 }
            );
          }
          const incomingDesc = payload.faceDescriptor;
          const storedDesc = profile.face_descriptor;
          
          const distance = getEuclideanDistance(storedDesc, incomingDesc);
        
          // Face match failed! Instead of blocking, we set manual override and flag face_verified as false.
          // This allows the check-out to succeed immediately, and lets the manager approve it manually.
          if (distance >= 0.60) {
            payload.is_manual_override = true;
            payload.face_verified = false;
          } else {
            payload.face_verified = true;
          }
        }
      } catch (err) {
        return NextResponse.json({ success: false, data: null, error: { code: 'BIOMETRIC_ERROR', message: 'Error processing facial comparison.' } }, { status: 500 });
      }
    } // End of !payload.webauthn_verified block

    // Find today's open attendance record (or the record for the offline sync date)
    let targetDate = new Date();
    
    if (payload.is_offline_sync && payload.timestamp) {
      targetDate = new Date(payload.timestamp);
      const todayDate = new Date();
      const diffHours = (todayDate.getTime() - targetDate.getTime()) / (1000 * 3600);
      
      if (diffHours < -0.1 || diffHours > 36) {
        return NextResponse.json(
          {
            success: false,
            data: null,
            error: {
              code: 'OFFLINE_SYNC_DATE_MISMATCH',
              message: 'Offline check-out timestamp must be within the last 36 hours. Backdated or future sync is not permitted.',
            },
            timestamp: new Date().toISOString(),
          },
          { status: 400 }
        );
      }
    }

    // Find the most recent check-in within 24 hours of targetDate
    const lookbackDate = new Date(targetDate.getTime() - 24 * 60 * 60 * 1000);

    const { data: record, error: recErr } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', user.id)
      .gte('check_in_time', lookbackDate.toISOString())
      .lte('check_in_time', targetDate.toISOString())
      .order('check_in_time', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recErr || !record) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'NO_CHECKIN_FOUND',
            message: 'No recent open check-in record found. Please check in first.',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    if (record.check_out_time) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'ALREADY_CHECKED_OUT',
            message: `You already checked out today at ${new Date(record.check_out_time).toLocaleTimeString()}.`,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Verify Geofence if branch is assigned
    let targetBranchId = payload.branch_id || user.branch_id;
    let isGeoWithin = true;
    
    // Security Fix: Prevent Employees from spoofing their branch_id on check-out
    if (user.role === 'employee') {
      if (payload.branch_id && user.branch_id && payload.branch_id !== user.branch_id) {
        return NextResponse.json(
          {
            success: false,
            data: null,
            error: {
              code: 'FORBIDDEN_BRANCH',
              message: 'Check-out denied: You cannot check out of a branch other than your assigned store.',
            },
            timestamp: new Date().toISOString(),
          },
          { status: 403 }
        );
      }
      targetBranchId = user.branch_id;
    }

    if (targetBranchId) {
      const { data: branch } = await supabase
        .from('branches')
        .select('latitude, longitude, geofence_radius_meters')
        .eq('id', targetBranchId)
        .single();

      if (branch && branch.latitude && branch.longitude) {
        const geo = isWithinGeofence(
          payload.latitude,
          payload.longitude,
          Number(branch.latitude),
          Number(branch.longitude),
          branch.geofence_radius_meters || 100
        );
        isGeoWithin = geo.within;

        const isAdminOrMgr = user.role === 'admin' || user.role === 'branch_manager';

        const maxAllowedDistance = payload.is_manual_override 
          ? (branch.geofence_radius_meters || 100) * 1.5 
          : (branch.geofence_radius_meters || 100);

        if (!payload.is_offline_sync && !isAdminOrMgr && !payload.is_manual_override && geo.distance > maxAllowedDistance) {
          return NextResponse.json(
            {
              success: false,
              data: { distance_meters: geo.distance },
              error: {
                code: 'OUT_OF_GEOFENCE',
                message: `Check-out denied: You are ${geo.distance}m away from your store.`,
              },
              timestamp: new Date().toISOString(),
            },
            { status: 403 }
          );
        }
      }
    }

    const checkOutTime = payload.timestamp || new Date().toISOString();
    const checkOutDateObj = new Date(checkOutTime);
    const checkInDateObj = new Date(record.check_in_time);

    // 1. Minimum Duration Constraint (e.g., 15 minutes)
    const diffMinutes = (checkOutDateObj.getTime() - checkInDateObj.getTime()) / 60000;
    if (diffMinutes < 15) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'CHECK_OUT_TOO_EARLY',
            message: 'You cannot check out within 15 minutes of checking in.',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 403 }
      );
    }

    // 2. Fetch shift end time to block abnormally late checkouts (e.g., > 4 hours after shift)
    const { data: companyProfile } = await supabase.from('company_profile').select('default_work_end_time').single();
    let workEndTime = companyProfile?.default_work_end_time || '18:00:00';

    if (targetBranchId) {
      const { data: branchSettings } = await supabase
        .from('branch_settings')
        .select('work_end_time')
        .eq('branch_id', targetBranchId)
        .maybeSingle();
      if (branchSettings && branchSettings.work_end_time) {
        workEndTime = branchSettings.work_end_time;
      }
    }

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const [month, day, year] = formatter.format(checkInDateObj).split('/');

    // Override with Dynamic Shift Roster if assigned
    const { data: activeShiftAssgn } = await supabase
      .from('employee_shifts')
      .select('shifts(end_time)')
      .eq('user_id', user.id)
      .lte('effective_from', `${year}-${month}-${day}`)
      .or(`effective_to.gte.${year}-${month}-${day},effective_to.is.null`)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeShiftAssgn?.shifts) {
      const shiftData = Array.isArray(activeShiftAssgn.shifts) ? activeShiftAssgn.shifts[0] : activeShiftAssgn.shifts;
      if (shiftData) {
        workEndTime = shiftData.end_time || workEndTime;
      }
    }

    const safeEndTime = workEndTime.split(':').length === 2 ? `${workEndTime}:00` : workEndTime;
    const workEndTimestamp = new Date(`${year}-${month}-${day}T${safeEndTime}+06:00`);

    const diffLateHours = (checkOutDateObj.getTime() - workEndTimestamp.getTime()) / (1000 * 3600);
    const MAX_LATE_HOURS = 4;

    if (diffLateHours > MAX_LATE_HOURS) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'CHECK_OUT_TOO_LATE',
            message: `Check-out denied: You cannot check out more than ${MAX_LATE_HOURS} hours after your shift ended (${workEndTime}). Please submit a Manual Correction request instead.`,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 403 }
      );
    }

    // Update check_out_time (Trigger trg_calculate_attendance_status computes overtime_minutes & half_day)
    const { data: updatedRecord, error: updateErr } = await supabase
      .from('attendance_records')
      .update({
        check_out_time: checkOutTime,
        check_out_lat: payload.latitude,
        check_out_lng: payload.longitude,
        // Reset approval_status to pending if check-out has manual override or failed face match
        ...(!isGeoWithin || Boolean(payload.is_manual_override) || !payload.face_verified ? {
          is_manual_override: true,
          approval_status: 'pending',
        } : {}),
        // face_verified is true only if both check-in and check-out passed face matching
        face_verified: Boolean(record.face_verified) && Boolean(payload.face_verified),
      })
      .eq('id', record.id)
      .select()
      .single();

    if (updateErr || !updatedRecord) {
      throw new Error(`Database Update Failed: ${updateErr?.message}`);
    }

    // Notify Branch Managers and Admins about check-out event (with email & action_url)
    try {
      const timeStr = new Date(checkOutTime).toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dhaka' });
      const notifTitle = '🏁 Employee Check-Out Logged';
      const notifMsg = `${profile?.full_name || 'An employee'} has checked out at ${timeStr}. Overtime: ${updatedRecord.overtime_minutes || 0} mins.`;

      await Promise.all([
        dispatchToBranchManagers({
          branchId: targetBranchId,
          title: notifTitle,
          message: notifMsg,
          type: 'attendance',
          actionUrl: '/branch-manager/attendance',
          sendEmail: true,
        }),
        dispatchToAdmins({
          title: notifTitle,
          message: notifMsg,
          type: 'attendance',
          actionUrl: '/admin/attendance',
          sendEmail: true,
        }),
      ]);
    } catch {
      // Non-fatal
    }

    const res = NextResponse.json(
      {
        success: true,
        data: updatedRecord,
        message: `Check-out successful! Total overtime logged: ${updatedRecord.overtime_minutes || 0} minutes.`,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );

    // Clear the WebAuthn token so it cannot be reused for another check-out
    if (payload.webauthn_verified) {
      res.cookies.set('webauthn_verified_token', '', { maxAge: 0, path: '/' });
    }

    return res;
  } catch (error) {
    return handleApiError(error);
  }
}

