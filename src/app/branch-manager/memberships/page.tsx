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
  Award
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

  return (
    <div className="space-y-8 pb-12 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 bg-gradient-to-r from-white via-indigo-950/10 to-slate-50 p-6 md:p-8 rounded-3xl border border-slate-200 shadow-xl text-center">
        <div className="flex justify-center mb-2">
          <div className="p-3 bg-indigo-100 rounded-full text-indigo-600">
            <ShieldCheck className="w-8 h-8" />
          </div>
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
          Verify Membership & Discount
        </h1>
        <p className="text-sm text-slate-600">
          Enter the customer&apos;s registered phone number to verify their VIP membership and available discounts.
        </p>
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
            <Card className="bg-white border-slate-200 overflow-hidden shadow-lg border-t-4 border-t-emerald-500 relative">
              {!result.status && (
                <div className="absolute top-0 left-0 w-full h-full bg-slate-50/80 backdrop-blur-[1px] z-10 flex items-center justify-center">
                  <div className="bg-white border border-rose-200 p-6 rounded-2xl shadow-xl text-center max-w-sm">
                    <XCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
                    <h3 className="text-xl font-bold text-rose-700">Membership Inactive</h3>
                    <p className="text-sm text-slate-600 mt-2">This customer&apos;s membership is currently inactive. No discount applies.</p>
                  </div>
                </div>
              )}
              
              <div className="p-8">
                <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                      <User className="w-8 h-8" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">{result.customer_name}</h2>
                      <div className="flex items-center text-slate-500 mt-1">
                        <Phone className="w-4 h-4 mr-1.5" />
                        <span>{result.customer_phone}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 mb-2">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Active Member
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center">
                    <Award className="w-6 h-6 text-indigo-500 mb-1" />
                    <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Tier</span>
                    <span className={`text-sm font-bold mt-1 px-2 py-0.5 rounded-full ${
                      result.membership_tier === 'VIP' ? 'bg-purple-100 text-purple-700' :
                      result.membership_tier === 'Platinum' ? 'bg-slate-800 text-slate-200' :
                      result.membership_tier === 'Gold' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-200 text-slate-700'
                    }`}>
                      {result.membership_tier || 'Silver'}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center">
                    <Star className="w-6 h-6 text-amber-500 mb-1" />
                    <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Points</span>
                    <span className="text-base font-bold text-slate-800 mt-1">{result.reward_points || 0}</span>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center">
                    <Gift className="w-6 h-6 text-rose-500 mb-1" />
                    <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Birthday</span>
                    <span className="text-sm font-bold text-slate-800 mt-1">
                      {result.date_of_birth ? new Date(result.date_of_birth).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'N/A'}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center">
                    <Mail className="w-6 h-6 text-sky-500 mb-1" />
                    <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Email</span>
                    <span className="text-xs font-bold text-slate-800 mt-1 break-all px-1">
                      {result.email || 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 text-center">
                  <span className="text-indigo-600 font-bold text-sm uppercase tracking-widest block mb-2">Approved Discount</span>
                  <div className="flex items-center justify-center">
                    <span className="text-6xl font-black text-indigo-700 tracking-tighter">{result.discount_percentage}</span>
                    <Percent className="w-10 h-10 text-indigo-500 ml-1" />
                  </div>
                  <p className="text-indigo-800 text-sm mt-4 font-medium">
                    Apply a {result.discount_percentage}% discount on the customer&apos;s total purchase.
                  </p>
                </div>
              </div>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}
