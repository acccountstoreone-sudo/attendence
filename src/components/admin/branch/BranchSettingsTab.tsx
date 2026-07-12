'use client';

import React from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Branch } from './types';
import { LocationMapViewer } from '@/components/admin/LocationMapViewer';
import { Globe, Settings, MapPin, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface BranchSettingsTabProps {
  branch: Branch;
}

export const BranchSettingsTab: React.FC<BranchSettingsTabProps> = ({ branch }) => {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-bold text-slate-900 flex items-center">
          <Settings className="w-5 h-5 mr-2 text-[#1dbf73]" /> Branch Configuration
        </h4>
        <Button variant="secondary" onClick={() => router.push(`/admin/branches/${branch.id}/edit`)}>
          Edit Settings
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Geofence & Location */}
        <Card className="bg-white border-slate-200 p-6 shadow-xl">
          <h4 className="text-sm font-semibold text-[#1dbf73] uppercase tracking-wider mb-4 flex items-center">
            <MapPin className="w-4 h-4 mr-2" /> Geofence Settings & Map
          </h4>
          {branch.latitude && branch.longitude ? (
            <div className="space-y-4">
              <LocationMapViewer
                latitude={branch.latitude}
                longitude={branch.longitude}
                radiusMeters={branch.geofence_radius_meters}
                branchName={branch.name}
              />
              <div className="mt-4 p-3 bg-white rounded-lg text-sm text-slate-600 flex justify-between">
                <span>Radius:</span>
                <span className="font-bold text-slate-900">{branch.geofence_radius_meters} meters</span>
              </div>
            </div>
          ) : (
            <div className="h-[300px] flex flex-col justify-center items-center text-center bg-white rounded-lg border border-dashed border-slate-200">
              <Globe className="w-10 h-10 text-slate-700 mb-2" />
              <p className="text-sm font-medium text-slate-600">GPS Coordinates Not Set</p>
              <p className="text-xs text-slate-500 mt-1">Biometric check-in requires a geofence.</p>
            </div>
          )}
        </Card>

        {/* Office Timings & Rules */}
        <Card className="bg-white border-slate-200 p-6 shadow-xl">
           <h4 className="text-sm font-semibold text-[#1dbf73] uppercase tracking-wider mb-4 flex items-center">
            <Clock className="w-4 h-4 mr-2" /> Office Timings & Rules
          </h4>
          
          <div className="space-y-4 pointer-events-none opacity-80">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-slate-600">Office Start Time</Label>
                <Input type="time" defaultValue={branch.office_start_time || "09:00"} className="bg-white border-slate-200" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-600">Office End Time</Label>
                <Input type="time" defaultValue={branch.office_end_time || "18:00"} className="bg-white border-slate-200" />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-slate-600">Grace Time (Minutes)</Label>
              <Input type="number" defaultValue={branch.grace_time_minutes?.toString() || "15"} className="bg-white border-slate-200" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-600">Late Rules</Label>
              <Input defaultValue={branch.late_rules || "Deduct half day after 3 late days"} className="bg-white border-slate-200" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-600">Overtime Rules</Label>
              <Input defaultValue={branch.overtime_rules || "Calculated after 18:30"} className="bg-white border-slate-200" />
            </div>
            
            <div className="pt-4 border-t border-slate-200/50 flex justify-between items-center">
              <span className="text-xs text-slate-500">Settings apply only to {branch.name}</span>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => router.push(`/admin/branches/${branch.id}/edit`)}>Edit Static Metadata</Button>
            <Button variant="primary" onClick={() => router.push(`/admin/duty-hours`)} className="bg-[#1dbf73] text-white hover:bg-[#16965a] border-none font-bold">
              Manage Live Duty Hours & Grace
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

