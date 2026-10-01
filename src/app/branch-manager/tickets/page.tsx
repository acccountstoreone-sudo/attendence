'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import {
  Ticket,
  Search,
  Phone,
  CalendarDays,
  Plus,
  CheckCircle2,
  XCircle,
  X,
  FileText,
  Download
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  compliment?: string;
  call_status?: string;
  call_note?: string;
  created_at: string;
}

export default function BranchManagerTicketsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState<string>('');
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedTicketIds, setSelectedTicketIds] = useState<Set<string>>(new Set());
  const [userBranchId, setUserBranchId] = useState<string>('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    ticket_datetime: new Date().toISOString().slice(0, 16),
    customer_name: '',
    mobile_number: '',
    invoice_no: '',
    product_details: '',
    complaint_type: 'Other',
    complaint_details: '',
    employee_name: '',
    priority: 'Medium',
    action_taken: '',
    remarks: '',
    follow_up_date: '',
    compliment: '',
    call_status: 'Not Called',
    call_note: ''
  });

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
        setUserBranchId(profileData.branch_id);
        // Load tickets for this branch
        const { data, error } = await supabase
          .from('tickets')
          .select('*')
          .eq('branch_id', profileData.branch_id)
          .order('created_at', { ascending: false });

        if (!error && data) {
          setTickets(data as TicketData[]);
        } else if (error) {
          setFeedback({ type: 'error', text: `Failed to load tickets: ${error.message}` });
        }
      }
    }
    
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCallStatusChange = async (ticketId: string, newCallStatus: string) => {
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ call_status: newCallStatus })
        .eq('id', ticketId);

      if (error) throw error;
      
      setFeedback({ type: 'success', text: 'Call status updated successfully.' });
      loadData();
    } catch (err: unknown) {
      setFeedback({ type: 'error', text: (err as Error).message || 'Failed to update call status.' });
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userBranchId) {
      setFeedback({ type: 'error', text: 'Branch ID not found.' });
      return;
    }
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const { error } = await supabase.from('tickets').insert([{
        branch_id: userBranchId,
        ticket_datetime: new Date(formData.ticket_datetime).toISOString(),
        customer_name: formData.customer_name,
        mobile_number: formData.mobile_number,
        invoice_no: formData.invoice_no || null,
        product_details: formData.product_details || null,
        complaint_type: formData.complaint_type,
        complaint_details: formData.complaint_details || null,
        employee_name: formData.employee_name || null,
        priority: formData.priority,
        action_taken: formData.action_taken || null,
        remarks: formData.remarks || null,
        follow_up_date: formData.follow_up_date || null,
        compliment: formData.compliment || null,
        call_status: formData.call_status,
        call_note: formData.call_note || null
      }]);

      if (error) throw error;

      setFeedback({ type: 'success', text: 'Ticket created successfully.' });
      setIsModalOpen(false);
      setFormData({
        ticket_datetime: new Date().toISOString().slice(0, 16),
        customer_name: '',
        mobile_number: '',
        invoice_no: '',
        product_details: '',
        complaint_type: 'Other',
        complaint_details: '',
        employee_name: '',
        priority: 'Medium',
        action_taken: '',
        remarks: '',
        follow_up_date: '',
        compliment: '',
        call_status: 'Not Called',
        call_note: ''
      });
      loadData();
    } catch (err: unknown) {
      setFeedback({ type: 'error', text: (err as Error).message || 'Failed to create ticket.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedTicketIds(new Set(filteredTickets.map(t => t.id)));
    } else {
      setSelectedTicketIds(new Set());
    }
  };

  const handleSelectTicket = (id: string) => {
    const newSet = new Set(selectedTicketIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedTicketIds(newSet);
  };

  const handleExportCSV = () => {
    const ticketsToExport = selectedTicketIds.size > 0 
      ? filteredTickets.filter(t => selectedTicketIds.has(t.id))
      : filteredTickets;

    if (ticketsToExport.length === 0) return;
    
    const headers = ['Complaint ID', 'Date', 'Customer Name', 'Phone', 'Type', 'Priority', 'Status', 'Call Status'];
    const csvData = ticketsToExport.map(t => [
      `"${t.complaint_id}"`,
      `"${new Date(t.ticket_datetime).toLocaleString()}"`,
      `"${t.customer_name}"`,
      `"${t.mobile_number}"`,
      `"${t.complaint_type}"`,
      `"${t.priority}"`,
      `"${t.status}"`,
      `"${t.call_status || 'Not Called'}"`
    ].join(','));
    
    const csvContent = [headers.join(','), ...csvData].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `branch_tickets_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleExportPDF = async () => {
    const ticketsToExport = selectedTicketIds.size > 0 
      ? filteredTickets.filter(t => selectedTicketIds.has(t.id))
      : filteredTickets;

    if (ticketsToExport.length === 0) return;
    
    setFeedback({ type: 'success', text: 'Generating PDF...' });
    
    const tableData = ticketsToExport.map(t => [
      t.complaint_id,
      new Date(t.ticket_datetime).toLocaleDateString(),
      t.customer_name,
      t.mobile_number,
      t.complaint_type || '',
      t.priority || '',
      t.status.toUpperCase(),
      t.call_status || 'Not Called'
    ]);

    try {
      const res = await fetch('/api/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportTitle: 'BRANCH TICKETS REPORT',
          reportSubtitle: 'Store Branch',
          metaRef: `TKT-${new Date().getFullYear()}`,
          metaBranch: 'Assigned Branch',
          metaPeriod: new Date().toLocaleDateString(),
          metaPreparedBy: 'Branch Manager',
          metaRecordsCount: ticketsToExport.length,
          columns: ['ID', 'Date', 'Customer', 'Phone', 'Type', 'Priority', 'Status', 'Call'],
          rows: tableData,
          filename: `branch_tickets_export_${new Date().toISOString().split('T')[0]}.pdf`
        })
      });

      if (!res.ok) throw new Error('Failed to generate PDF');

      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `branch_tickets_export_${new Date().toISOString().split('T')[0]}.pdf`;
      link.click();
      setFeedback(null);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Error generating PDF' });
    }
  };

  const filteredTickets = tickets.filter(t => {
    const matchSearch = (t.complaint_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.mobile_number || '').includes(searchTerm);
    
    const date = new Date(t.ticket_datetime);
    const matchMonth = filterMonth ? date.getMonth() + 1 === parseInt(filterMonth) : true;
    const matchYear = filterYear ? date.getFullYear() === parseInt(filterYear) : true;

    return matchSearch && matchMonth && matchYear;
  });

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
        <div className="flex gap-2">
          <Button
            variant="secondary"
            icon={<Download className="w-4 h-4" />}
            onClick={handleExportCSV}
            disabled={filteredTickets.length === 0}
            className="bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
          >
            CSV {selectedTicketIds.size > 0 && `(${selectedTicketIds.size})`}
          </Button>
          <Button
            variant="secondary"
            icon={<FileText className="w-4 h-4" />}
            onClick={handleExportPDF}
            disabled={filteredTickets.length === 0}
            className="bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
          >
            PDF {selectedTicketIds.size > 0 && `(${selectedTicketIds.size})`}
          </Button>
          <Button
            variant="primary"
            icon={<Plus className="w-4 h-4 text-white" />}
            onClick={() => setIsModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            Create Ticket
          </Button>
        </div>
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

      {/* Search and Filters */}
      <Card className="bg-white border-slate-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by Complaint ID, Customer Name or Phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:border-indigo-500 w-full md:w-32"
            >
              <option value="">All Months</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(0, i).toLocaleString('default', { month: 'short' })}
                </option>
              ))}
            </select>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:border-indigo-500 w-full md:w-32"
            >
              <option value="">All Years</option>
              {[2025, 2026, 2027, 2028].map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
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
                  <th className="px-4 py-4 w-12 text-center">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                      checked={filteredTickets.length > 0 && selectedTicketIds.size === filteredTickets.length}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th className="px-4 py-4">ID & Date</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Details</th>
                  <th className="px-6 py-4">Priority & Call</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredTickets.map(ticket => (
                  <tr key={ticket.id} className={`transition-colors ${selectedTicketIds.has(ticket.id) ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}>
                    <td className="px-4 py-4 text-center">
                      <input 
                        type="checkbox" 
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                        checked={selectedTicketIds.has(ticket.id)}
                        onChange={() => handleSelectTicket(ticket.id)}
                      />
                    </td>
                    <td className="px-4 py-4">
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
                      
                      <div className="mt-3">
                        <select 
                          value={ticket.call_status || 'Not Called'}
                          onChange={(e) => handleCallStatusChange(ticket.id, e.target.value)}
                          className="text-xs border border-slate-200 rounded-lg bg-white px-2 py-1 outline-none focus:border-indigo-500 font-normal w-full"
                        >
                          <option value="Not Called">📞 Not Called</option>
                          <option value="Received">✅ Received</option>
                          <option value="Not Answered">❌ Not Answered</option>
                          <option value="Unreachable">📵 Unreachable</option>
                        </select>
                        {ticket.call_note && (
                          <div className="text-[10px] text-slate-500 mt-1 font-normal break-words max-w-[150px]">
                            {ticket.call_note}
                          </div>
                        )}
                        {ticket.compliment && (
                          <div className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 mt-1 font-normal break-words max-w-[150px]">
                            {ticket.compliment}
                          </div>
                        )}
                      </div>
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

              <div className="grid grid-cols-2 gap-4">
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
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Follow-up Date</label>
                  <input
                    type="date"
                    value={formData.follow_up_date}
                    onChange={e => setFormData({...formData, follow_up_date: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Call Status</label>
                  <select
                    value={formData.call_status}
                    onChange={e => setFormData({...formData, call_status: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                  >
                    <option value="Not Called">Not Called</option>
                    <option value="Received">Received</option>
                    <option value="Not Answered">Not Answered</option>
                    <option value="Unreachable">Unreachable</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Call Note</label>
                  <input
                    type="text"
                    placeholder="e.g. Customer will come tomorrow"
                    value={formData.call_note}
                    onChange={e => setFormData({...formData, call_note: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Compliment</label>
                <input
                  type="text"
                  placeholder="Any compliment or positive feedback..."
                  value={formData.compliment}
                  onChange={e => setFormData({...formData, compliment: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Action Taken</label>
                <textarea
                  placeholder="What action was taken?"
                  value={formData.action_taken}
                  onChange={e => setFormData({...formData, action_taken: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors min-h-[60px]"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Remarks</label>
                <textarea
                  placeholder="Any additional remarks..."
                  value={formData.remarks}
                  onChange={e => setFormData({...formData, remarks: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors min-h-[60px]"
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
