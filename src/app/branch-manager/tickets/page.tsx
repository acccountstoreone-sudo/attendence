'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import {
  Ticket,
  Search,
  Phone,
  CalendarDays,
  DollarSign
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface TicketData {
  id: string;
  customer_name: string;
  mobile_number: string;
  phone_number?: string;
  ticket_date: string;
  product_price: number;
  status: 'pending' | 'in_review' | 'success';
  created_at: string;
}

export default function BranchManagerTicketsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    
    // First, get the current user's branch_id
    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('branch_id')
        .eq('id', userData.user.id)
        .single();

      if (profileData?.branch_id) {
        // Load tickets for this branch
        const { data, error } = await supabase
          .from('tickets')
          .select('*')
          .eq('branch_id', profileData.branch_id)
          .order('created_at', { ascending: false });

        if (!error && data) {
          setTickets(data as TicketData[]);
        } else if (error) {
          setErrorMsg(`Failed to load tickets: ${error.message}`);
        }
      }
    }
    
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredTickets = tickets.filter(t => 
    (t.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.mobile_number || '').includes(searchTerm)
  );

  return (
    <div className="space-y-8 pb-12 relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-white via-indigo-950/10 to-slate-50 p-6 rounded-3xl border border-slate-200 shadow-xl">
        <div>
          <div className="flex items-center space-x-2 text-indigo-600 text-xs font-bold uppercase tracking-widest mb-1">
            <Ticket className="w-4 h-4" />
            <span>Branch Service</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            Customer Tickets
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            View customer product issues and returns for your branch.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl border bg-rose-50 border-rose-200 text-rose-700 text-sm font-medium">
          {errorMsg}
        </div>
      )}

      {/* Search */}
      <Card className="bg-white border-slate-200 p-4">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search tickets by customer name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
      </Card>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" label="Loading Tickets..." />
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Product Price</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredTickets.map(ticket => (
                  <tr key={ticket.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">{ticket.customer_name}</div>
                      <div className="text-slate-500 text-xs flex items-center mt-1">
                        <Phone className="w-3 h-3 mr-1" />
                        {ticket.mobile_number}
                        {ticket.phone_number && <span>, {ticket.phone_number}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      <div className="flex items-center">
                        <CalendarDays className="w-4 h-4 mr-1 text-slate-400" />
                        {new Date(ticket.ticket_date).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      <div className="flex items-center">
                        <DollarSign className="w-4 h-4 mr-1 text-emerald-500" />
                        {ticket.product_price.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        ticket.status === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        ticket.status === 'in_review' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {ticket.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredTickets.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      <Ticket className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p>No tickets found for your branch.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
