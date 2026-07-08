'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Store, MapPin, Phone, Globe, UserCheck, ChevronLeft, Building2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { LocationMapViewer } from '@/components/admin/LocationMapViewer';

interface Branch {
  id: string;
  name: string;
  code: string;
  address?: string;
  city?: string;
  phone?: string;
  is_active: boolean;
  latitude?: number;
  longitude?: number;
  geofence_radius_meters: number;
  manager_id?: string;
}

interface BranchEmployee {
  id: string;
  role: string;
  full_name: string;
  email: string;
}

export default function BranchDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const supabase = createClient();
  const [branchId, setBranchId] = useState<string>('');
  const [branch, setBranch] = useState<Branch | null>(null);
  const [employees, setEmployees] = useState<BranchEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  useEffect(() => {
    params.then((p) => {
      setBranchId(p.id);
      loadBranchData(p.id);
      loadBranchEmployees(p.id);
    });
  }, [params]);

  async function loadBranchData(id: string) {
    setLoading(true);
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .eq('id', id)
      .single();
    
    if (data) {
      setBranch(data);
    } else if (error) {
      console.error(error);
      alert('Failed to load branch details');
    }
    setLoading(false);
  };

  async function loadBranchEmployees(id: string) {
    setLoadingEmployees(true);
    try {
      const res = await fetch(`/api/employees?branch_id=${id}`);
      if (res.ok) {
        const json = await res.json();
        setEmployees(json.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const handleSetManager = async (employeeId: string) => {
    if (!branch) return;
    if (!confirm('Are you sure you want to set this employee as the Branch Manager?')) return;
    
    try {
      const res = await fetch(`/api/branches/${branch.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_id: employeeId }),
      });
      if (res.ok) {
        await loadBranchData(branch.id);
        await loadBranchEmployees(branch.id);
      } else {
        const err = await res.json();
        alert(`Failed to set manager: ${err.error?.message || err.message}`);
      }
    } catch (error) {
      console.error(error);
      alert('An error occurred while setting the manager.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D2A02A]"></div>
      </div>
    );
  }

  if (!branch) {
    return (
      <div className="text-center py-12">
        <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Branch Not Found</h2>
        <Button onClick={() => router.push('/admin/branches')} variant="secondary">Go Back</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Link href="/admin/branches" className="flex items-center text-slate-400 hover:text-white transition-colors text-sm mb-2 w-fit">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to Branches
          </Link>
          <div className="flex items-center space-x-2 text-[#D2A02A] text-xs font-bold uppercase tracking-widest mb-1">
            <Store className="w-4 h-4" />
            <span>Branch Dashboard</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            {branch.name} <span className="text-xl text-slate-500 font-normal">({branch.code})</span>
          </h1>
          <p className="text-sm text-slate-400">
            View branch settings, GPS configuration, and manage assigned staff.
          </p>
        </div>
        <div className="flex space-x-3">
          <Button variant="secondary" onClick={() => router.push(`/admin/branches/${branch.id}/edit`)}>
            Edit Settings
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-slate-900 border-slate-800 p-6 shadow-xl">
          <h4 className="text-sm font-semibold text-[#D2A02A] uppercase tracking-wider mb-4">Location Info</h4>
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-slate-950 rounded-lg">
                <MapPin className="w-5 h-5 text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">{branch.address || 'No street address provided'}</p>
                <p className="text-xs text-slate-500 mt-1">{branch.city ? `${branch.city}, Bangladesh` : 'City not specified'}</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-slate-950 rounded-lg">
                <Phone className="w-5 h-5 text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">{branch.phone || 'No phone number'}</p>
                <p className="text-xs text-slate-500 mt-1">Primary Contact</p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="bg-slate-900 border-slate-800 p-6 shadow-xl">
          <h4 className="text-sm font-semibold text-[#D2A02A] uppercase tracking-wider mb-4">Geofence Settings & Map</h4>
          {branch.latitude && branch.longitude ? (
            <div className="space-y-4">
              <LocationMapViewer
                latitude={branch.latitude}
                longitude={branch.longitude}
                radiusMeters={branch.geofence_radius_meters}
                branchName={branch.name}
              />
            </div>
          ) : (
            <div className="h-full flex flex-col justify-center items-center py-6 text-center">
              <Globe className="w-10 h-10 text-slate-700 mb-2" />
              <p className="text-sm font-medium text-slate-400">GPS Coordinates Not Set</p>
              <p className="text-xs text-slate-500 mt-1">Biometric check-in requires a geofence.</p>
              <Button size="sm" variant="outline" className="mt-4" onClick={() => router.push(`/admin/branches/${branch.id}/edit`)}>
                Set Location on Map
              </Button>
            </div>
          )}
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-bold text-white">Assigned Employees ({employees.length})</h4>
          <Button variant="outline" size="sm" onClick={() => router.push('/admin/employees/new')}>
            Add Staff
          </Button>
        </div>
        
        <Card className="bg-slate-900 border-slate-800 overflow-hidden shadow-xl">
          {loadingEmployees ? (
            <div className="p-12 text-center text-slate-400">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#D2A02A] mx-auto mb-4"></div>
              Loading staff roster...
            </div>
          ) : employees.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <UserCheck className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <p className="text-sm font-medium">No employees assigned to this branch yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Employee Name</th>
                    <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Role</th>
                    <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {employees.map((emp) => {
                    const isManager = branch.manager_id === emp.id || emp.role === 'branch_manager';
                    return (
                      <tr key={emp.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-white">{emp.full_name}</div>
                          <div className="text-xs text-slate-500 mt-1">{emp.email}</div>
                        </td>
                        <td className="px-6 py-4">
                          {isManager ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#D2A02A]/10 text-[#D2A02A] border border-[#D2A02A]/20">
                              Branch Manager
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300">
                              {emp.role}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {!isManager ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs text-[#D2A02A] hover:bg-[#D2A02A]/10 hover:text-[#D2A02A]"
                              onClick={() => handleSetManager(emp.id)}
                            >
                              <UserCheck className="w-3.5 h-3.5 mr-1.5" />
                              Promote to Manager
                            </Button>
                          ) : (
                            <span className="text-xs text-slate-500 italic">Current Manager</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
