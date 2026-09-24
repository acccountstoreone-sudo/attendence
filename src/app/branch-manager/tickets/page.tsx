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
  complaint_id: string;
  ticket_datetime: string;
  customer_name: string;
  mobile_number: string;
  invoice_no?: string;
  product_details?: string;
  complaint_type?: string;
  complaint_details?: string;
  employee_name?: string;
  priority: string;
  status: 'pending' | 'processing' | 'resolved' | 'closed';
  action_taken?: string;
  remarks?: string;
  follow_up_date?: string;
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
                  <th className="px-6 py-4">ID & Date</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Details</th>
                  <th className="px-6 py-4">Priority</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredTickets.map(ticket => (
                  <tr key={ticket.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-indigo-600">{ticket.complaint_id}</div>
                      <div className="text-slate-500 text-xs flex items-center mt-1">
                        <CalendarDays className="w-3 h-3 mr-1" />
                        {new Date(ticket.ticket_datetime).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">{ticket.customer_name}</div>
                      <div className="text-slate-500 text-xs flex items-center mt-1">
                        <Phone className="w-3 h-3 mr-1" />
                        {ticket.mobile_number}
                      </div>
                      {ticket.invoice_no && (
                        <div className="text-slate-500 text-xs mt-1">Inv: {ticket.invoice_no}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {ticket.employee_name || '-'}
                    </td>
                    <td className="px-6 py-4 text-slate-600 max-w-xs truncate" title={ticket.complaint_details || 'No details'}>
                      <span className="font-semibold text-slate-800 block text-xs mb-1">{ticket.complaint_type}</span>
                      {ticket.product_details && <div className="text-xs text-slate-500 mb-1">Prod: {ticket.product_details}</div>}
                      <div className="whitespace-normal">{ticket.complaint_details || '-'}</div>
                      {(ticket.action_taken || ticket.remarks) && (
                        <div className="mt-2 text-xs border-t border-slate-200 pt-2 whitespace-normal">
                          {ticket.action_taken && <div className="text-indigo-700 mb-1"><span className="font-semibold">Action:</span> {ticket.action_taken}</div>}
                          {ticket.remarks && <div className="text-slate-500"><span className="font-semibold">Remarks:</span> {ticket.remarks}</div>}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-semibold">
                      <span className={`text-xs px-2 py-1 rounded-full ${ticket.priority === 'Urgent' ? 'bg-rose-100 text-rose-700' : ticket.priority === 'High' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-700'}`}>
                        {ticket.priority}
                      </span>
                      {ticket.follow_up_date && (
                        <div className="mt-2 text-xs text-slate-600 flex items-center font-medium bg-slate-50 px-2 py-1 rounded-md border border-slate-100 w-max">
                          <CalendarDays className="w-3 h-3 mr-1 text-indigo-500" />
                          F/U: {new Date(ticket.follow_up_date).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        ticket.status === 'resolved' || ticket.status === 'closed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        ticket.status === 'processing' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredTickets.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
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
