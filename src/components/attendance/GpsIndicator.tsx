'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { MapPin, Navigation, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { calculateDistance } from '@/lib/geo';

export interface GpsIndicatorProps {
  branchLatitude?: number;
  branchLongitude?: number;
  branchName?: string;
  geofenceRadius?: number; // in meters, default 100
  onLocationVerified: (coords: { latitude: number; longitude: number; isWithinGeofence: boolean; distance: number } | null) => void;
}

export const GpsIndicator: React.FC<GpsIndicatorProps> = ({
  branchLatitude,
  branchLongitude,
  branchName = 'Assigned Store Branch',
  geofenceRadius = 100,
  onLocationVerified,
}) => {
  const [, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [status, setStatus] = useState<'locating' | 'inside' | 'approaching' | 'outside' | 'error'>('locating');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const checkPosition = () => {
    setStatus('locating');
    setErrorMessage('');

    if (!navigator.geolocation) {
      setStatus('error');
      setErrorMessage('Geolocation is not supported by your browser or device.');
      onLocationVerified(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCoords({ latitude, longitude });

        // Calculate Haversine distance in meters
        const targetLat = branchLatitude ?? 23.8103;
        const targetLon = branchLongitude ?? 90.4125;
        const distMeters = Math.round(calculateDistance(latitude, longitude, targetLat, targetLon));
        setDistance(distMeters);

        const isWithin = distMeters <= geofenceRadius;
        if (isWithin) {
          setStatus('inside');
        } else if (distMeters <= geofenceRadius * 1.5) {
          setStatus('approaching');
        } else {
          setStatus('outside');
        }

        onLocationVerified({
          latitude,
          longitude,
          isWithinGeofence: isWithin,
          distance: distMeters,
        });
      },
      (error) => {
        setStatus('error');
        if (error.code === error.PERMISSION_DENIED) {
          setErrorMessage('Location access denied. Please enable GPS permissions in browser settings.');
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setErrorMessage('Location information is currently unavailable.');
        } else {
          setErrorMessage('Location request timed out. Please retry.');
        }
        onLocationVerified(null);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  };

  useEffect(() => {
    // Bug 4 fix: Only auto-run geolocation once the parent has provided real branch coordinates.
    // Prevents a false "inside geofence" flash using default Dhaka coords while profile is loading.
    if (branchLatitude !== undefined && branchLongitude !== undefined) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      checkPosition();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchLatitude, branchLongitude]);

  return (
    <Card className="bg-[#061224] border-[#1E293B] p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div
            className={`p-2.5 rounded-xl shrink-0 ${
              status === 'inside' ? 'bg-[#D2A02A]/20 text-[#D2A02A]' :
              status === 'approaching' ? 'bg-amber-500/20 text-amber-400' :
              status === 'outside' || status === 'error' ? 'bg-rose-500/20 text-rose-400' : 'bg-[#D2A02A]/10 text-[#D2A02A]'
            }`}
          >
            {status === 'locating' ? (
              <Navigation className="w-5 h-5 animate-spin" />
            ) : status === 'inside' ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <h4 className="text-sm font-bold text-white">Geofence GPS Verification</h4>
              {status === 'inside' && <Badge status="present">Within Range</Badge>}
              {status === 'approaching' && <Badge status="late">Approaching</Badge>}
              {status === 'outside' && <Badge status="absent">Out of Bounds</Badge>}
              {status === 'error' && <Badge status="inactive">GPS Error</Badge>}
            </div>

            <p className="text-xs text-slate-400 mt-0.5 flex items-center">
              <MapPin className="w-3 h-3 mr-1 text-slate-500 shrink-0" />
              <span>{branchName} (Radius: {geofenceRadius}m)</span>
            </p>
          </div>
        </div>

        <button
          onClick={checkPosition}
          title="Refresh GPS"
          className="p-2 rounded-lg bg-[#040A15] hover:bg-[#1E293B] text-slate-300 hover:text-[#D2A02A] transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${status === 'locating' ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Distance Status Metrics */}
      {distance !== null && status !== 'error' && (
        <div className="mt-3 pt-3 border-t border-[#1E293B] flex items-center justify-between text-xs">
          <span className="text-slate-400 font-medium">Current Proximity:</span>
          <span
            className={`font-extrabold ${
              status === 'inside' ? 'text-[#D2A02A]' : status === 'approaching' ? 'text-amber-400' : 'text-rose-400'
            }`}
          >
            {distance} meters away {status === 'inside' ? `(✓ Inside ${geofenceRadius}m zone)` : `(✖ Requires within ${geofenceRadius}m)`}
          </span>
        </div>
      )}

      {/* Error Message */}
      {status === 'error' && (
        <div className="mt-3 pt-3 border-t border-[#1E293B] text-rose-300 bg-rose-950/40 p-2 rounded-lg flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}
    </Card>
  );
};
