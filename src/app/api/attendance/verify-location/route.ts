import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

/**
 * Server-side GPS Haversine Validation (Spec P41).
 * Confirms employee coordinates are within the branch's geofence radius.
 * Also includes basic GPS spoofing heuristics.
 */

const gpsVerifySchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  branch_id: z.string().uuid().optional(),
  accuracy_meters: z.number().optional(), // Browser GPS accuracy hint
  speed: z.number().optional(), // Speed (m/s) — for spoofing heuristic
  altitude: z.number().optional(),
});

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * POST /api/attendance/verify-location
 * Validates GPS coordinates against the user's assigned branch geofence.
 * Returns distance in meters and spoofing suspicion flags.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(['admin', 'branch_manager', 'employee']);
    const body = await request.json();
    const input = gpsVerifySchema.parse(body);

    const supabase = await createClient();

    // Resolve the branch to verify against
    let targetBranchId = input.branch_id || user.branch_id;
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
      return NextResponse.json({
        success: false,
        data: null,
        error: { code: 'NO_BRANCH', message: 'No branch assigned to user. Cannot perform GPS verification.' },
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    const { data: branch, error: branchErr } = await supabase
      .from('branches')
      .select('latitude, longitude, geofence_radius_meters, name, is_active')
      .eq('id', targetBranchId)
      .single();

    if (branchErr || !branch) {
      return NextResponse.json({
        success: false,
        data: null,
        error: { code: 'BRANCH_NOT_FOUND', message: 'Branch not found or inactive.' },
        timestamp: new Date().toISOString(),
      }, { status: 404 });
    }

    if (!branch.latitude || !branch.longitude) {
      return NextResponse.json({
        success: false,
        data: null,
        error: { code: 'NO_GPS_CONFIGURED', message: 'This branch has no GPS coordinates configured. Contact admin.' },
        timestamp: new Date().toISOString(),
      }, { status: 422 });
    }

    const distanceMeters = Math.round(haversineMeters(
      input.latitude, input.longitude,
      branch.latitude, branch.longitude
    ));

    const isWithinGeofence = distanceMeters <= branch.geofence_radius_meters;

    // GPS Spoofing Heuristics (Spec P41)
    const spoofingFlags: string[] = [];
    if (input.accuracy_meters !== undefined && input.accuracy_meters < 1) {
      spoofingFlags.push('Suspiciously high GPS accuracy (<1m) — possible mock location app');
    }
    if (input.speed !== undefined && input.speed > 50) {
      // 50 m/s = 180 km/h — impossible for walk-in employee
      spoofingFlags.push('Speed implausibly high — GPS spoofing suspected');
    }
    if (input.altitude !== undefined && (input.altitude < -50 || input.altitude > 9000)) {
      spoofingFlags.push('Altitude out of realistic range — possible spoofing');
    }

    const isSuspectedSpoofed = spoofingFlags.length > 0;

    // Log the verification attempt for audit
    await supabase.from('attendance_logs').upsert({}, { onConflict: 'id' }); // no-op, just structure demo

    return NextResponse.json({
      success: true,
      data: {
        is_within_geofence: isWithinGeofence && !isSuspectedSpoofed,
        distance_meters: distanceMeters,
        geofence_radius_meters: branch.geofence_radius_meters,
        branch_name: branch.name,
        is_suspected_spoofed: isSuspectedSpoofed,
        spoofing_flags: spoofingFlags,
        verification_result: !isSuspectedSpoofed && isWithinGeofence ? 'PASS' : isSuspectedSpoofed ? 'SPOOFING_SUSPECTED' : 'OUTSIDE_GEOFENCE',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
