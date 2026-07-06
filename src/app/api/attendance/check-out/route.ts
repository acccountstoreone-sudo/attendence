import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { isWithinGeofence } from '@/lib/geo';
import { z } from 'zod';

const checkOutSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  face_verified: z.boolean(),
  timestamp: z.string().datetime().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(['employee', 'branch_manager']);
    const body = await request.json();
    const payload = checkOutSchema.parse(body);

    if (!payload.face_verified) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'BIOMETRIC_FAILED',
            message: 'FaceIO biometric verification required for check-out.',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 403 }
      );
    }

    const supabase = await createClient();

    // Find today's open attendance record
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const { data: record, error: recErr } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', user.id)
      .gte('check_in_time', startOfDay.toISOString())
      .lte('check_in_time', endOfDay.toISOString())
      .maybeSingle();

    if (recErr || !record) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'NO_CHECKIN_FOUND',
            message: 'No open check-in record found for today. Please check in first.',
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
    if (user.branch_id) {
      const { data: branch } = await supabase
        .from('branches')
        .select('latitude, longitude, geofence_radius_meters')
        .eq('id', user.branch_id)
        .single();

      if (branch && branch.latitude && branch.longitude) {
        const geo = isWithinGeofence(
          payload.latitude,
          payload.longitude,
          Number(branch.latitude),
          Number(branch.longitude),
          branch.geofence_radius_meters || 100
        );

        if (!geo.within) {
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

    // Update check_out_time (Trigger trg_calculate_attendance_status computes overtime_minutes & half_day)
    const { data: updatedRecord, error: updateErr } = await supabase
      .from('attendance_records')
      .update({
        check_out_time: checkOutTime,
        check_out_lat: payload.latitude,
        check_out_lng: payload.longitude,
      })
      .eq('id', record.id)
      .select()
      .single();

    if (updateErr || !updatedRecord) {
      throw new Error(`Database Update Failed: ${updateErr?.message}`);
    }

    return NextResponse.json(
      {
        success: true,
        data: updatedRecord,
        message: `Check-out successful! Total overtime logged: ${updatedRecord.overtime_minutes || 0} minutes.`,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
