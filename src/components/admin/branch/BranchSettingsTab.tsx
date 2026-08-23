'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Branch } from './types';
import dynamic from 'next/dynamic';

const LocationMapViewer = dynamic(
  () => import('@/components/admin/LocationMapViewer').then(mod => mod.LocationMapViewer),
  { ssr: false, loading: () => <div className="h-64 w-full bg-slate-100 animate-pulse rounded-xl" /> }
);
import { Globe, Settings, MapPin, Clock, DollarSign, CheckCircle, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface BranchSettingsTabProps {
  branch: Branch;
}

export const BranchSettingsTab: React.FC<BranchSettingsTabProps> = ({ branch }) => {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [overtimeRate, setOvertimeRate] = useState<number>(100);
  const [snackAllowance, setSnackAllowance] = useState<number>(50);
  const [loadingRates, setLoadingRates] = useState<boolean>(true);
  const [savingRates, setSavingRates] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string>('');

  useEffect(() => {
    async function fetchBranchSettings() {
      setLoadingRates(true);
      const { data } = await supabase
        .from('branch_settings')
        .select('overtime_rate_per_hour, daily_snack_allowance')
        .eq('branch_id', branch.id)
        .maybeSingle();

      if (data) {
        if (data.overtime_rate_per_hour !== undefined && data.overtime_rate_per_hour !== null) {
          setOvertimeRate(Number(data.overtime_rate_per_hour));
        }
        if (data.daily_snack_allowance !== undefined && data.daily_snack_allowance !== null) {
          setSnackAllowance(Number(data.daily_snack_allowance));
        }
      }
      setLoadingRates(false);
    }
    fetchBranchSettings();
  }, [branch.id]);

  const handleSavePayrollConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRates(true);
    setSaveMessage('');
    try {
      const { error } = await supabase
        .from('branch_settings')
        .upsert({
          branch_id: branch.id,
          overtime_rate_per_hour: Number(overtimeRate),
          daily_snack_allowance: Number(snackAllowance),
          updated_at: new Date().toISOString()
        }, { onConflict: 'branch_id' });

      if (error) {
        setSaveMessage(`Error: ${error.message}`);
      } else {
        setSaveMessage('✅ Automated Payroll configuration saved!');
        setTimeout(() => setSaveMessage(''), 4000);
      }
    } catch (err: any) {
      setSaveMessage(`Error: ${err.message || 'Failed to save'}`);
    } finally {
      setSavingRates(false);
    }
  };

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

      {/* Automated Payroll Settings */}
      <Card className="bg-gradient-to-br from-[#1dbf73]/[0.06] via-white to-slate-50/80 border border-[#1dbf73]/25 p-6 shadow-xl rounded-3xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#1dbf73]/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16"></div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-4 mb-5 relative z-10">
          <div>
            <h4 className="text-base font-extrabold text-[#1dbf73] uppercase tracking-wider flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-[#1dbf73]/10 text-[#1dbf73]"><DollarSign className="w-5 h-5" /></div>
              Automated Payroll Calculation Rates
            </h4>
            <p className="text-xs text-slate-900 font-medium mt-1">
              Set branch-level hourly rates for overtime and daily snack/refreshment allowance. The system automatically multiplies exact work minutes & present days on payroll!
            </p>
          </div>
          {saveMessage && (
            <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 flex items-center gap-1.5 shadow-sm">
              {saveMessage}
            </span>
          )}
        </div>

        <form onSubmit={handleSavePayrollConfig} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end relative z-10">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Overtime Rate (Tk / Hour)</Label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">৳</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={overtimeRate}
                onChange={(e) => setOvertimeRate(Number(e.target.value))}
                className="pl-8 bg-white border border-slate-200 text-slate-900 font-extrabold text-base rounded-xl shadow-sm focus:border-[#1dbf73] focus:ring-2 focus:ring-[#1dbf73]/20 transition-all"
                required
              />
            </div>
            <span className="text-[11px] text-slate-500 font-medium block">System auto-calculates: Total Overtime Hours × Rate</span>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Daily Snack Allowance (Tk / Present Day)</Label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">৳</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={snackAllowance}
                onChange={(e) => setSnackAllowance(Number(e.target.value))}
                className="pl-8 bg-white border border-slate-200 text-slate-900 font-extrabold text-base rounded-xl shadow-sm focus:border-[#1dbf73] focus:ring-2 focus:ring-[#1dbf73]/20 transition-all"
                required
              />
            </div>
            <span className="text-[11px] text-slate-500 font-medium block">System auto-calculates: Total Present Days × Allowance</span>
          </div>

          <div>
            <Button
              type="submit"
              disabled={savingRates || loadingRates}
              className="w-full bg-[#1dbf73] hover:bg-[#19a563] text-white font-extrabold py-3 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm"
            >
              <Save className="w-4 h-4" />
              {savingRates ? 'Saving Rates...' : 'Save Automated Rates'}
            </Button>
          </div>
        </form>
      </Card>

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
              <div className="mt-4 p-3 bg-white rounded-lg text-sm text-slate-900 flex justify-between">
                <span>Radius:</span>
                <span className="font-bold text-slate-900">{branch.geofence_radius_meters} meters</span>
              </div>
            </div>
          ) : (
            <div className="h-[300px] flex flex-col justify-center items-center text-center bg-white rounded-lg border border-dashed border-slate-200">
              <Globe className="w-10 h-10 text-slate-700 mb-2" />
              <p className="text-sm font-medium text-slate-900">GPS Coordinates Not Set</p>
              <p className="text-xs text-slate-500 mt-1">Biometric check-in requires a geofence.</p>
            </div>
          )}
        </Card>

        {/* Office Timings & Rules */}
        <Card className="bg-white border-slate-200 p-6 shadow-xl relative">
           <h4 className="text-sm font-semibold text-[#1dbf73] uppercase tracking-wider mb-4 flex items-center">
            <Clock className="w-4 h-4 mr-2" /> Office Timings & Rules
          </h4>
          
          <div className="absolute top-4 right-4 z-10 flex flex-col items-center justify-center bg-white/60 backdrop-blur-[1px] rounded-xl border border-slate-200">
            <span className="text-sm font-bold text-slate-900 bg-white px-3 py-1 rounded-full shadow-sm flex items-center gap-1.5">
              <span className="text-[#1dbf73]">🔒</span> Managed via Duty Hours settings
            </span>
          </div>

          <div className="space-y-4 pointer-events-none opacity-50 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-slate-900">Office Start Time</Label>
                <Input type="time" defaultValue={branch.office_start_time || "09:00"} className="bg-white border-slate-200" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-900">Office End Time</Label>
                <Input type="time" defaultValue={branch.office_end_time || "18:00"} className="bg-white border-slate-200" />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-slate-900">Grace Time (Minutes)</Label>
              <Input type="number" defaultValue={branch.grace_time_minutes?.toString() || "15"} className="bg-white border-slate-200" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-900">Late Rules</Label>
              <Input defaultValue={branch.late_rules || "Deduct half day after 3 late days"} className="bg-white border-slate-200" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-900">Overtime Rules</Label>
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

