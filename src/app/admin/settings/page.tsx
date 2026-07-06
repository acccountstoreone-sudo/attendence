'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Settings, Shield, Bell, Clock, Building, Save } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'attendance' | 'security'>('general');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate API save
    setTimeout(() => {
      setLoading(false);
      alert('Settings updated successfully!');
    }, 1000);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header Banner */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#061224] p-6 rounded-3xl border border-[#1E293B] shadow-2xl relative overflow-hidden"
      >
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#D2A02A_1px,transparent_1px)] [background-size:40px_40px] mix-blend-overlay z-0" />
        
        <div className="relative z-10 pointer-events-none">
          <div className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-[#D2A02A]" />
            <span className="px-3 py-1 rounded-full bg-[#D2A02A]/20 border border-[#D2A02A]/30 text-[#D2A02A] text-xs font-bold uppercase tracking-widest">
              System Configuration
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-3 tracking-tight">
            Platform Settings
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage global operational parameters, security thresholds, and company preferences.
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        
        {/* Navigation Tabs */}
        <div className="md:col-span-1 space-y-2">
          <button
            onClick={() => setActiveTab('general')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'general' 
                ? 'bg-[#D2A02A]/20 text-[#D2A02A] border border-[#D2A02A]/30' 
                : 'text-slate-400 hover:bg-[#1E293B] hover:text-white border border-transparent'
            }`}
          >
            <Building className="w-4 h-4" />
            General Information
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'attendance' 
                ? 'bg-[#D2A02A]/20 text-[#D2A02A] border border-[#D2A02A]/30' 
                : 'text-slate-400 hover:bg-[#1E293B] hover:text-white border border-transparent'
            }`}
          >
            <Clock className="w-4 h-4" />
            Attendance Rules
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'security' 
                ? 'bg-[#D2A02A]/20 text-[#D2A02A] border border-[#D2A02A]/30' 
                : 'text-slate-400 hover:bg-[#1E293B] hover:text-white border border-transparent'
            }`}
          >
            <Shield className="w-4 h-4" />
            Security & Access
          </button>
        </div>

        {/* Configuration Forms */}
        <div className="md:col-span-3">
          <Card className="bg-[#061224] border-[#1E293B] shadow-2xl relative overflow-hidden">
            <form onSubmit={handleSave} className="space-y-6">
              
              {activeTab === 'general' && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">Company Profile</h3>
                    <p className="text-xs text-slate-400">Basic information about the organization.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Company Name</label>
                      <input type="text" defaultValue="Anchor Fashion" className="w-full bg-[#040A15] border border-[#1E293B] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#D2A02A]" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Contact Email</label>
                      <input type="email" defaultValue="admin@anchorfashion.com" className="w-full bg-[#040A15] border border-[#1E293B] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#D2A02A]" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Headquarters Address</label>
                      <textarea rows={2} defaultValue="Anchor Tower, Dhaka, Bangladesh" className="w-full bg-[#040A15] border border-[#1E293B] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#D2A02A]" />
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'attendance' && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">Attendance Parameters</h3>
                    <p className="text-xs text-slate-400">Configure global shift timings and grace periods.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Default Shift Start</label>
                      <input type="time" defaultValue="09:00" className="w-full bg-[#040A15] border border-[#1E293B] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#D2A02A]" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Default Shift End</label>
                      <input type="time" defaultValue="18:00" className="w-full bg-[#040A15] border border-[#1E293B] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#D2A02A]" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Late Grace Period (Mins)</label>
                      <input type="number" defaultValue={15} className="w-full bg-[#040A15] border border-[#1E293B] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#D2A02A]" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Geofence Radius (Meters)</label>
                      <input type="number" defaultValue={50} className="w-full bg-[#040A15] border border-[#1E293B] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#D2A02A]" />
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'security' && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">Security & Access</h3>
                    <p className="text-xs text-slate-400">Adjust biometric strictness and session policies.</p>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-[#040A15] border border-[#1E293B] rounded-xl">
                      <div>
                        <p className="text-sm font-bold text-white">Strict Face Matching</p>
                        <p className="text-xs text-slate-400 mt-0.5">Require higher confidence score (distance &lt; 0.4) for check-in.</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" defaultChecked className="sr-only peer" />
                        <div className="w-11 h-6 bg-[#1E293B] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#D2A02A]"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-[#040A15] border border-[#1E293B] rounded-xl">
                      <div>
                        <p className="text-sm font-bold text-white">Device Spoof Protection</p>
                        <p className="text-xs text-slate-400 mt-0.5">Block fake GPS mock locations and rooted devices.</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" defaultChecked className="sr-only peer" />
                        <div className="w-11 h-6 bg-[#1E293B] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#D2A02A]"></div>
                      </label>
                    </div>
                  </div>
                </motion.div>
              )}

              <div className="pt-6 border-t border-[#1E293B] flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  className="bg-[#D2A02A] text-[#040A15] hover:bg-[#C08F1E] font-bold border-none"
                  icon={<Save className="w-4 h-4" />}
                  isLoading={loading}
                >
                  Save Configuration
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
