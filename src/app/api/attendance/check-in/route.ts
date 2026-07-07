import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { isWithinGeofence } from '@/lib/geo';
import { getEuclideanDistance } from '@/lib/biometric';
import { z } from 'zod';

const checkInSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  face_verified: z.boolean(),
  faceDescriptor: z.array(z.number()).optional(),
  facial_id: z.string().optional(),
  is_offline_sync: z.boolean().optional().default(false),
  timestamp: z.string().datetime().optional(),
  liveness_passed: z.boolean().optional(),
  photo_url: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Enforce Role: Employees & Branch Managers can check in
    const user = await requireRole(['employee', 'branch_manager']);

    // 2. Parse & Validate Body
    const body = await request.json();
    const payload = checkInSchema.parse(body);

    // 3. Biometric + Liveness Verification Check
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

    // 3a. Require liveness challenge to have been completed
    if (!payload.liveness_passed) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: { code: 'LIVENESS_REQUIRED', message: 'Liveness verification was not completed. Please complete the face challenge.' },
          timestamp: new Date().toISOString(),
        },
        { status: 403 }
      );
    }

    const supabase = await createClient();

    // 3b. Verify against stored face descriptor
    const { data: profile } = await supabase.from('profiles').select('face_descriptor').eq('id', user.id).single();
    
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
      // Bug 5 fix: Validate descriptor length before comparison to avoid silent mismatch on empty arrays
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
      if (distance > 0.75) {
        return NextResponse.json(
          {
            success: false,
            data: null,
            error: {
              code: 'BIOMETRIC_MISMATCH',
              message: `Face verification failed. Distance: ${distance.toFixed(3)}. You do not match the registered employee.`,
            },
            timestamp: new Date().toISOString(),
          },
          { status: 403 }
        );
      }
    } catch (err) {
      return NextResponse.json({ success: false, data: null, error: { code: 'BIOMETRIC_ERROR', message: 'Error processing facial comparison.' } }, { status: 500 });
    }

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
    const endOfDay = new Date(`${year}-${month}-${day}T23:59:59+06:00`);

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
    if (!user.branch_id) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'NO_BRANCH_ASSIGNED',
            message: 'Your profile is not assigned to any physical store branch. Contact HR.',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const { data: branch, error: branchErr } = await supabase
      .from('branches')
      .select('name, latitude, longitude, geofence_radius_meters, is_active')
      .eq('id', user.branch_id)
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

    if (!geo.within && !payload.is_offline_sync) {
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
      checkInTime = payload.timestamp;
    } else {
      checkInTime = new Date().toISOString();
    }

    const { data: newRecord, error: insertErr } = await supabase
      .from('attendance_records')
      .insert({
        employee_id: user.id,
        branch_id: user.branch_id,
        check_in_time: checkInTime,
        check_in_lat: payload.latitude,
        check_in_lng: payload.longitude,
        face_verified: payload.face_verified,
        status: 'present', // Will be evaluated/overridden by trigger trg_calculate_attendance_status
        is_manual_override: false,
      })
      .select()
      .single();

    if (insertErr || !newRecord) {
      throw new Error(`Database Insert Failed: ${insertErr?.message}`);
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          ...newRecord,
          distance_meters: geo.distance,
          branch_name: branch.name,
        },
        message: `Check-in successful at ${branch.name} (${newRecord.status.toUpperCase()}).`,
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
