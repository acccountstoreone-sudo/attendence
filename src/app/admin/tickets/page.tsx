'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import {
  Plus,
  Ticket,
  Search,
  CheckCircle2,
  XCircle,
  X,
  Phone,
  Store,
  CalendarDays,
  DollarSign
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';

interface TicketData {
  id: string;
  complaint_id: string;
  branch_id: string;
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
  branches?: { name: string };
}

interface Branch {
  id: string;
  name: string;
}

export default function AdminTicketsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    branch_id: '',
    ticket_datetime: new Date().toISOString().slice(0, 16),
    customer_name: '',
    mobile_number: '',
    invoice_no: '',
    product_details: '',
    complaint_type: 'Other',
    complaint_details: '',
    employee_name: '',
    priority: 'Medium'
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    
    // Load active branches for dropdown
    const { data: bData } = await supabase.from('branches').select('id, name').eq('is_active', true).order('name');
    if (bData) setBranches(bData);

    // Load tickets
    const { data, error } = await supabase
      .from('tickets')
      .select('*, branches(name)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setTickets(data as TicketData[]);
    } else if (error) {
      setFeedback({ type: 'error', text: `Failed to load tickets: ${error.message}` });
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ status: newStatus })
        .eq('id', ticketId);

      if (error) throw error;
      
      setFeedback({ type: 'success', text: 'Ticket status updated successfully.' });
      loadData();
    } catch (err: unknown) {
      setFeedback({ type: 'error', text: (err as Error).message || 'Failed to update status.' });
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const { error } = await supabase.from('tickets').insert([{
        branch_id: formData.branch_id,
        ticket_datetime: new Date(formData.ticket_datetime).toISOString(),
        customer_name: formData.customer_name,
        mobile_number: formData.mobile_number,
        invoice_no: formData.invoice_no || null,
        product_details: formData.product_details || null,
        complaint_type: formData.complaint_type,
        complaint_details: formData.complaint_details || null,
        employee_name: formData.employee_name || null,
        priority: formData.priority
      }]);

      if (error) throw error;

      setFeedback({ type: 'success', text: 'Ticket created successfully.' });
      setIsModalOpen(false);
      setFormData({
        branch_id: '',
        ticket_datetime: new Date().toISOString().slice(0, 16),
        customer_name: '',
        mobile_number: '',
        invoice_no: '',
        product_details: '',
        complaint_type: 'Other',
        complaint_details: '',
        employee_name: '',
        priority: 'Medium'
      });
      loadData();
    } catch (err: unknown) {
      setFeedback({ type: 'error', text: (err as Error).message || 'Failed to create ticket.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTickets = tickets.filter(t => 
    (t.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.mobile_number || '').includes(searchTerm) ||
    (t.branches?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-12 relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-white via-indigo-950/10 to-slate-50 p-6 rounded-3xl border border-slate-200 shadow-xl">
        <div>
          <div className="flex items-center space-x-2 text-indigo-600 text-xs font-bold uppercase tracking-widest mb-1">
            <Ticket className="w-4 h-4" />
            <span>Customer Service</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            Customer Tickets
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Manage customer product issues and returns across branches.
          </p>
        </div>
        <Button
          variant="primary"
          icon={<Plus className="w-4 h-4 text-white" />}
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          Create Ticket
        </Button>
      </div>

      {/* Feedback */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`flex items-center gap-3 p-4 rounded-xl border text-sm font-medium ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}
          >
            {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <XCircle className="w-5 h-5 shrink-0" />}
            <span>{feedback.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

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
                  <th className="px-6 py-4">Branch & Emp</th>
                  <th className="px-6 py-4">Details</th>
                  <th className="px-6 py-4">Priority</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Actions</th>
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
                    <td className="px-6 py-4 font-medium text-slate-700">
                      <div className="flex items-center">
                        <Store className="w-4 h-4 mr-1 text-indigo-500" />
                        {ticket.branches?.name || 'Unknown'}
                      </div>
                      {ticket.employee_name && (
                        <div className="text-slate-500 text-xs mt-1">Emp: {ticket.employee_name}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-600 max-w-xs truncate" title={ticket.complaint_details || 'No details'}>
                      <span className="font-semibold text-slate-800 block text-xs mb-1">{ticket.complaint_type}</span>
                      {ticket.product_details && <div className="text-xs text-slate-500 mb-1">Prod: {ticket.product_details}</div>}
                      {ticket.complaint_details || '-'}
                    </td>
                    <td className="px-6 py-4 font-semibold">
                      <span className={`text-xs px-2 py-1 rounded-full ${ticket.priority === 'Urgent' ? 'bg-rose-100 text-rose-700' : ticket.priority === 'High' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-700'}`}>
                        {ticket.priority}
                      </span>
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
                    <td className="px-6 py-4">
                      <select 
                        value={ticket.status}
                        onChange={(e) => handleStatusChange(ticket.id, e.target.value)}
                        className="text-sm border border-slate-200 rounded-lg bg-white px-2 py-1 outline-none focus:border-indigo-500"
                      >
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    </td>
                  </tr>
                ))}
                {filteredTickets.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      <Ticket className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p>No tickets found matching your search.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 sticky top-0 z-10">
              <h2 className="text-xl font-bold text-slate-900">Create New Ticket</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateTicket} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Branch <span className="text-rose-500">*</span></label>
                  <select
                    required
                    value={formData.branch_id}
                    onChange={e => setFormData({...formData, branch_id: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                  >
                    <option value="">Select a branch</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Date & Time <span className="text-rose-500">*</span></label>
                  <input
                    required
                    type="datetime-local"
                    value={formData.ticket_datetime}
                    onChange={e => setFormData({...formData, ticket_datetime: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Customer Name <span className="text-rose-500">*</span></label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. John Doe"
                    value={formData.customer_name}
                    onChange={e => setFormData({...formData, customer_name: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Contact Number <span className="text-rose-500">*</span></label>
                  <input
                    required
                    type="tel"
                    placeholder="e.g. 01700000000"
                    value={formData.mobile_number}
                    onChange={e => setFormData({...formData, mobile_number: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Invoice No.</label>
                  <input
                    type="text"
                    placeholder="Invoice Number"
                    value={formData.invoice_no}
                    onChange={e => setFormData({...formData, invoice_no: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Product Details</label>
                  <input
                    type="text"
                    placeholder="Name / Code / Size"
                    value={formData.product_details}
                    onChange={e => setFormData({...formData, product_details: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Complaint Type <span className="text-rose-500">*</span></label>
                  <select
                    required
                    value={formData.complaint_type}
                    onChange={e => setFormData({...formData, complaint_type: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                  >
                    <option value="Exchange">Exchange</option>
                    <option value="Quality">Quality</option>
                    <option value="Size">Size</option>
                    <option value="Staff">Staff</option>
                    <option value="Billing">Billing</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Priority <span className="text-rose-500">*</span></label>
                  <select
                    required
                    value={formData.priority}
                    onChange={e => setFormData({...formData, priority: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Complaint Details</label>
                <textarea
                  placeholder="Describe the customer's complaint briefly..."
                  value={formData.complaint_details}
                  onChange={e => setFormData({...formData, complaint_details: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors min-h-[80px]"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Employee Name</label>
                <input
                  type="text"
                  placeholder="Who took the complaint?"
                  value={formData.employee_name}
                  onChange={e => setFormData({...formData, employee_name: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setIsModalOpen(false)} type="button">
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white border-none min-w-[120px]">
                  {isSubmitting ? <Spinner size="sm" /> : 'Create Ticket'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
