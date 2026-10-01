'use client';

import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import {
  Search,
  Phone,
  CheckCircle2,
  XCircle,
  Percent,
  User,
  ShieldCheck,
  Star,
  Gift,
  Mail,
  Award,
  Wallet,
  Crown
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Membership {
  id: string;
  customer_name: string;
  customer_phone: string;
  discount_percentage: number;
  email?: string;
  date_of_birth?: string;
  total_spent: number;
  reward_points: number;
  membership_tier: string;
  status: boolean;
}

export default function BranchManagerMembershipsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(false);
  const [searchPhone, setSearchPhone] = useState('');
  const [result, setResult] = useState<Membership | null>(null);
  const [searched, setSearched] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Add Member Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    discount_percentage: 10,
    email: '',
    date_of_birth: '',
    total_spent: 0,
    reward_points: 0,
    membership_tier: 'Silver',
    status: true
  });

  const handleCreateMembership = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Authentication required');

      // Get branch ID
      const { data: profileData } = await supabase
        .from('profiles')
        .select('branch_id')
        .eq('id', userData.user.id)
        .single();
      
      const branchId = profileData?.branch_id;

      const { error } = await supabase.from('memberships').insert([{
        ...formData,
        branch_id: branchId,
        created_by: userData.user.id
      }]);

      if (error) throw error;
      
      setFeedback({ type: 'success', text: 'Membership created successfully!' });
      setTimeout(() => {
        setIsModalOpen(false);
        setFeedback(null);
        setFormData({
          customer_name: '', customer_phone: '', discount_percentage: 10,
          email: '', date_of_birth: '', total_spent: 0, reward_points: 0,
          membership_tier: 'Silver', status: true
        });
      }, 2000);
      
    } catch (err: unknown) {
      setFeedback({ type: 'error', text: (err as Error).message || 'Failed to create membership' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchPhone.trim()) return;
    
    setLoading(true);
    setSearched(true);
    setResult(null);
    setErrorMsg(null);

    try {
      const { data, error } = await supabase
        .from('memberships')
        .select('*')
        .eq('customer_phone', searchPhone.trim())
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          setErrorMsg('No membership found for this phone number.');
        } else {
          setErrorMsg(`Failed to check membership: ${error.message}`);
        }
      } else if (data) {
        setResult(data as Membership);
      }
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'VIP':
        return 'from-purple-900 via-indigo-900 to-purple-800 text-purple-100 border-purple-500 shadow-purple-900/50';
      case 'Platinum':
        return 'from-slate-900 via-slate-800 to-slate-900 text-slate-200 border-slate-500 shadow-slate-900/50';
      case 'Gold':
        return 'from-amber-500 via-yellow-500 to-amber-600 text-amber-950 border-amber-300 shadow-amber-600/40';
      default: // Silver
        return 'from-slate-200 via-slate-100 to-slate-300 text-slate-800 border-slate-400 shadow-slate-300/50';
    }
  };

  const getTierIconColor = (tier: string) => {
    switch (tier) {
      case 'VIP': return 'text-purple-300';
      case 'Platinum': return 'text-slate-400';
      case 'Gold': return 'text-amber-100';
      default: return 'text-slate-500';
    }
  };

  return (
    <div className="space-y-8 pb-12 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-white via-indigo-950/10 to-slate-50 p-6 md:p-8 rounded-3xl border border-slate-200 shadow-xl text-center md:text-left">
        <div>
          <div className="flex justify-center md:justify-start mb-2">
            <div className="p-3 bg-indigo-100 rounded-full text-indigo-600">
              <ShieldCheck className="w-8 h-8" />
            </div>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            Verify & Manage Membership
          </h1>
          <p className="text-sm text-slate-600 mt-2">
            Enter the customer&apos;s registered phone number to verify their VIP membership, or add a new member for your branch.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold whitespace-nowrap shrink-0"
        >
          Add New Member
        </Button>
      </div>

      <Card className="bg-white border-slate-200 p-6 shadow-md">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Phone className="w-5 h-5 text-slate-400 absolute left-4 top-3.5" />
            <input
              type="tel"
              placeholder="Enter customer phone number (e.g. 017...)"
              value={searchPhone}
              onChange={(e) => setSearchPhone(e.target.value)}
              required
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors font-medium"
            />
          </div>
          <Button 
            type="submit" 
            variant="primary" 
            disabled={loading || !searchPhone.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-8 sm:w-auto w-full flex items-center justify-center font-bold"
          >
            {loading ? <Spinner size="sm" /> : <><Search className="w-4 h-4 mr-2" /> Verify</>}
          </Button>
        </form>
      </Card>

      {/* Results Section */}
      {searched && !loading && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {errorMsg ? (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center shadow-sm">
              <XCircle className="w-12 h-12 text-rose-400 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-rose-900 mb-1">Not Found</h3>
              <p className="text-sm text-rose-600">{errorMsg}</p>
            </div>
          ) : result ? (
            <div className="relative">
              {!result.status && (
                <div className="absolute top-0 left-0 w-full h-full bg-slate-900/60 backdrop-blur-[2px] z-20 flex items-center justify-center rounded-2xl">
                  <div className="bg-white border-2 border-rose-500 p-6 rounded-2xl shadow-2xl text-center max-w-sm transform -rotate-2">
                    <XCircle className="w-16 h-16 text-rose-500 mx-auto mb-3" />
                    <h3 className="text-2xl font-black text-rose-700 uppercase tracking-widest">Inactive</h3>
                    <p className="text-sm text-slate-600 mt-2 font-bold">This membership is disabled. No discount applies.</p>
                  </div>
                </div>
              )}
              
              <div className={`relative overflow-hidden rounded-3xl p-1 shadow-2xl transition-all duration-500 bg-gradient-to-br ${getTierColor(result.membership_tier)}`}>
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Crown className="w-64 h-64 transform rotate-12" />
                </div>
                
                <div className="relative z-10 p-8 backdrop-blur-sm rounded-[22px] bg-white/10 border border-white/20">
                  <div className="flex items-start justify-between mb-8">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 shadow-inner">
                        <User className="w-8 h-8 opacity-90" />
                      </div>
                      <div>
                        <h2 className="text-3xl font-black tracking-tight">{result.customer_name}</h2>
                        <div className="flex items-center opacity-80 mt-1 font-medium">
                          <Phone className="w-4 h-4 mr-1.5" />
                          <span>{result.customer_phone}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-md text-xs font-black uppercase tracking-widest border border-white/30 shadow-sm mb-2">
                        {result.membership_tier || 'Silver'} MEMBER
                      </div>
                      <div className="inline-flex items-center text-xs font-bold opacity-80">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> ACTIVE
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                    <div className="bg-black/20 backdrop-blur-md p-4 rounded-2xl border border-white/10 flex flex-col items-center justify-center text-center hover:bg-black/30 transition-colors">
                      <Wallet className={`w-6 h-6 mb-2 ${getTierIconColor(result.membership_tier)}`} />
                      <span className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">Total Spent</span>
                      <span className="text-lg font-black">৳{Number(result.total_spent || 0).toLocaleString()}</span>
                    </div>
                    <div className="bg-black/20 backdrop-blur-md p-4 rounded-2xl border border-white/10 flex flex-col items-center justify-center text-center hover:bg-black/30 transition-colors">
                      <Star className={`w-6 h-6 mb-2 ${getTierIconColor(result.membership_tier)}`} />
                      <span className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">Points</span>
                      <span className="text-lg font-black">{result.reward_points || 0}</span>
                    </div>
                    <div className="bg-black/20 backdrop-blur-md p-4 rounded-2xl border border-white/10 flex flex-col items-center justify-center text-center hover:bg-black/30 transition-colors">
                      <Gift className={`w-6 h-6 mb-2 ${getTierIconColor(result.membership_tier)}`} />
                      <span className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">Birthday</span>
                      <span className="text-sm font-bold">
                        {result.date_of_birth ? new Date(result.date_of_birth).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'N/A'}
                      </span>
                    </div>
                    <div className="bg-black/20 backdrop-blur-md p-4 rounded-2xl border border-white/10 flex flex-col items-center justify-center text-center hover:bg-black/30 transition-colors overflow-hidden">
                      <Mail className={`w-6 h-6 mb-2 ${getTierIconColor(result.membership_tier)}`} />
                      <span className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">Email</span>
                      <span className="text-xs font-bold truncate w-full px-2" title={result.email}>
                        {result.email || 'N/A'}
                      </span>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-6 text-center shadow-xl transform hover:scale-[1.02] transition-transform">
                    <span className="text-slate-500 font-black text-xs uppercase tracking-widest block mb-2">Approved Discount Rate</span>
                    <div className="flex items-center justify-center">
                      <span className="text-7xl font-black text-slate-900 tracking-tighter leading-none">{result.discount_percentage}</span>
                      <Percent className="w-12 h-12 text-indigo-600 ml-1" />
                    </div>
                    <div className="mt-4 inline-block px-4 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-sm font-bold">
                      Ready to apply at checkout
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Add Member Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-900">Add New Member</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateMembership} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {feedback && (
                <div className={`p-3 rounded-xl text-sm font-bold flex items-center gap-2 ${feedback.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                  {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {feedback.text}
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Customer Name <span className="text-rose-500">*</span></label>
                <input
                  required
                  type="text"
                  placeholder="Full Name"
                  value={formData.customer_name}
                  onChange={e => setFormData({...formData, customer_name: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Phone Number <span className="text-rose-500">*</span></label>
                  <input
                    required
                    type="tel"
                    placeholder="e.g. 01700000000"
                    value={formData.customer_phone}
                    onChange={e => setFormData({...formData, customer_phone: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="Email (Optional)"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Membership Tier <span className="text-rose-500">*</span></label>
                  <select
                    required
                    value={formData.membership_tier}
                    onChange={e => setFormData({...formData, membership_tier: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                  >
                    <option value="Silver">Silver</option>
                    <option value="Gold">Gold</option>
                    <option value="Platinum">Platinum</option>
                    <option value="VIP">VIP</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={formData.date_of_birth}
                    onChange={e => setFormData({...formData, date_of_birth: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Discount (%) <span className="text-rose-500">*</span></label>
                  <div className="relative">
                    <Percent className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      required
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={formData.discount_percentage}
                      onChange={e => setFormData({...formData, discount_percentage: Number(e.target.value)})}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Total Spent</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.total_spent}
                    onChange={e => setFormData({...formData, total_spent: Number(e.target.value)})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Points</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.reward_points}
                    onChange={e => setFormData({...formData, reward_points: Number(e.target.value)})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <Button variant="secondary" onClick={() => setIsModalOpen(false)} type="button">
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white border-none min-w-[120px]">
                  {isSubmitting ? <Spinner size="sm" /> : 'Add Member'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
