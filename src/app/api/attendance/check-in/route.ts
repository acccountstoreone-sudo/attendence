import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { isWithinGeofence } from '@/lib/geo';
import { z } from 'zod';

const checkInSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  face_verified: z.boolean(),
  facial_id: z.string().optional(),
  is_offline_sync: z.boolean().optional().default(false),
  timestamp: z.string().datetime().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Enforce Role: Employees & Branch Managers can check in
    const user = await requireRole(['employee', 'branch_manager']);

    // 2. Parse & Validate Body
    const body = await request.json();
    const payload = checkInSchema.parse(body);

    // 3. Biometric Verification Check (Spec P35 & P19)
    // B2 note: face_verified is currently client-reported. For production hardening,
    // replace this boolean with a FaceIO session token and verify it server-side
    // via: POST https://api.faceio.net/verify with your app secret key.
    // The current check prevents accidental skips but does NOT prevent intentional bypass.
    if (!payload.face_verified) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'BIOMETRIC_FAILED',
            message: 'FaceIO biometric verification failed or was bypassed. Check-in denied.',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 403 }
      );
    }

    const supabase = await createClient();

    // 4. Check if user already checked in today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

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
      .select('name, latitude, longitude, geofence_radius_meters')
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
    const checkInTime = payload.timestamp || new Date().toISOString();

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
