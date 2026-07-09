import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { isWithinGeofence } from '@/lib/geo';
import { getEuclideanDistance } from '@/lib/biometric';
import { z } from 'zod';

const checkOutSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  face_verified: z.boolean(),
  faceDescriptor: z.array(z.number()).optional(),
  facial_id: z.string().optional(),
  is_offline_sync: z.boolean().optional().default(false),
  timestamp: z.string().datetime().optional(),
  liveness_passed: z.boolean().optional(),
  photo_url: z.string().optional(),
  webauthn_verified: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(['employee', 'branch_manager']);
    const body = await request.json();
    const payload = checkOutSchema.parse(body);

    // 3. Biometric Verification Check
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

      // 3a. Liveness verification requirement
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
    } // End of !payload.webauthn_verified block

    // Find today's open attendance record (or the record for the offline sync date)
    let targetDate = new Date();
    
    if (payload.is_offline_sync && payload.timestamp) {
      targetDate = new Date(payload.timestamp);
      
      const todayDate = new Date();
      const offlineFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' });
      const [offMonth, offDay, offYear] = offlineFormatter.format(targetDate).split('/');
      const [curMonth, curDay, curYear] = offlineFormatter.format(todayDate).split('/');
      
      if (`${offYear}-${offMonth}-${offDay}` !== `${curYear}-${curMonth}-${curDay}`) {
        return NextResponse.json(
          {
            success: false,
            data: null,
            error: {
              code: 'OFFLINE_SYNC_DATE_MISMATCH',
              message: 'Offline check-out timestamp must be for today. Backdated sync is not permitted.',
            },
            timestamp: new Date().toISOString(),
          },
          { status: 400 }
        );
      }
    }

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const [month, day, year] = formatter.format(targetDate).split('/');
    
    const startOfDay = new Date(`${year}-${month}-${day}T00:00:00+06:00`);
    const endOfDay = new Date(`${year}-${month}-${day}T23:59:59+06:00`);

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
            message: 'No open check-in record found for the given date. Please check in first.',
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

        if (!geo.within && !payload.is_offline_sync) {
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
