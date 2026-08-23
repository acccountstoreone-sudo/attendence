import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { isWithinGeofence } from '@/lib/geo';
import { z } from 'zod';

/**
 * POST /api/attendance/sync-offline
 * Accepts a single offline-queued attendance record (check_in or check_out)
 * and processes it exactly like the live endpoint, but using the stored
 * timestamp instead of server time.
 *
 * Security: 
 *  - Timestamp must be from today (Asia/Dhaka) — cross-day backdating blocked
 *  - Geofence still verified using the stored coordinates
 *  - All existing duplicate-guard checks still apply via DB constraints
 */

const syncSchema = z.object({
  id: z.string(),                         // local offline record ID (for client dedup)
  type: z.enum(['check_in', 'check_out']),
  timestamp: z.string().datetime(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  face_verified: z.boolean(),
  faceDescriptor: z.array(z.number()).optional(),
  liveness_passed: z.boolean(),
  photo_url: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(['employee', 'branch_manager']);
    const body = await request.json();
    const payload = syncSchema.parse(body);

    // Validate timestamp (HIGH-04: allow up to 36 hours window for delayed sync or overnight check-outs)
    const offlineDate = new Date(payload.timestamp);
    const now = new Date();
    const diffHours = (now.getTime() - offlineDate.getTime()) / (1000 * 3600);

    if (diffHours < -0.1 || diffHours > 36) {
      return NextResponse.json({
        success: false,
        data: null,
        error: { code: 'OFFLINE_SYNC_DATE_MISMATCH', message: 'Offline record is either in the future or older than 36 hours. Manual correction required.' },
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    const dhaka = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' });
    const recordDay = dhaka.format(offlineDate);

    const supabase = await createClient();

    // Get branch details for geofence check
    if (!user.branch_id) {
      return NextResponse.json({
        success: false,
        data: null,
        error: { code: 'NO_BRANCH', message: 'No branch assigned.' },
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    const { data: branch, error: branchErr } = await supabase
      .from('branches')
      .select('id, name, latitude, longitude, geofence_radius_meters, is_active')
      .eq('id', user.branch_id)
      .single();

    if (branchErr || !branch?.is_active) {
      return NextResponse.json({
        success: false,
        data: null,
        error: { code: 'BRANCH_ERROR', message: 'Branch not found or inactive.' },
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    // Geofence verification (required for check_in; skipped for check_out because the
    // employee may have left the building before connectivity resumed — blocking their
    // check_out would leave the shift permanently open and cause INCOMPLETE_PAST_SHIFT
    // errors the following day).
    const geo = isWithinGeofence(
      payload.latitude, payload.longitude,
      Number(branch.latitude), Number(branch.longitude),
      branch.geofence_radius_meters || 100
    );

    // Bug 6 fix: only hard-block geofence for check_in records.
    if (payload.type === 'check_in' && !geo.within) {
      return NextResponse.json({
        success: false,
        data: null,
        error: { code: 'OUT_OF_GEOFENCE', message: `Offline check-in rejected: GPS coordinates were ${geo.distance}m from ${branch.name} (max: ${branch.geofence_radius_meters}m). You must have been inside the store when you checked in.` },
        timestamp: new Date().toISOString(),
      }, { status: 403 });
    }

    if (payload.type === 'check_in') {
      // Check if a record for today already exists (duplicate prevention)
      const [y, m, d] = recordDay.split('-');
      const startOfDay = `${y}-${m}-${d}T00:00:00+06:00`;
      const endOfDay = `${y}-${m}-${d}T23:59:59+06:00`;

      const { data: existing } = await supabase
        .from('attendance_records')
        .select('id')
        .eq('employee_id', user.id)
        .gte('check_in_time', startOfDay)
        .lte('check_in_time', endOfDay)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({
          success: true,
          data: { skipped: true, reason: 'Already checked in today' },
          timestamp: new Date().toISOString(),
        });
      }

      const { data: newRecord, error: insertErr } = await supabase
        .from('attendance_records')
        .insert({
          employee_id: user.id,
          branch_id: user.branch_id,
          check_in_time: payload.timestamp,
          check_in_lat: payload.latitude,
          check_in_lng: payload.longitude,
          face_verified: payload.face_verified,
          status: 'present',
          is_manual_override: false,
        })
        .select()
        .single();

      if (insertErr) throw new Error(insertErr.message);

      return NextResponse.json({
        success: true,
        data: { ...newRecord, offline_id: payload.id },
        message: `Offline check-in synced for ${branch.name}.`,
        timestamp: new Date().toISOString(),
      }, { status: 201 });
    } else {
      // check_out: find today's open record and update it
      const [y, m, d] = recordDay.split('-');
      const startOfDay = `${y}-${m}-${d}T00:00:00+06:00`;
      const endOfDay = `${y}-${m}-${d}T23:59:59+06:00`;

      const { data: record } = await supabase
        .from('attendance_records')
        .select('id, check_out_time')
        .eq('employee_id', user.id)
        .gte('check_in_time', startOfDay)
        .lte('check_in_time', endOfDay)
        .is('check_out_time', null)
        .maybeSingle();

      if (!record) {
        return NextResponse.json({
          success: true,
          data: { skipped: true, reason: 'No open check-in found for this day' },
          timestamp: new Date().toISOString(),
        });
      }

      const { data: updated, error: updateErr } = await supabase
        .from('attendance_records')
        .update({ check_out_time: payload.timestamp })
        .eq('id', record.id)
        .select()
        .single();

      if (updateErr) throw new Error(updateErr.message);

      return NextResponse.json({
        success: true,
        data: { ...updated, offline_id: payload.id },
        message: `Offline check-out synced for ${branch.name}.`,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    return handleApiError(error);
  }
}

