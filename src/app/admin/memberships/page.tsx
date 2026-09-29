'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import {
  Users,
  Search,
  Plus,
  CheckCircle2,
  XCircle,
  X,
  Phone,
  Percent,
  CalendarDays,
  Edit2
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';

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
  created_at: string;
}

export default function AdminMembershipsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
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

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('memberships')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setMemberships(data as Membership[]);
    } else if (error) {
      // In case table is not created yet, show a user-friendly error
      setFeedback({ type: 'error', text: `Failed to load memberships. Ensure migrations are applied.` });
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      if (isEditing) {
        const { error } = await supabase
          .from('memberships')
          .update({
            customer_name: formData.customer_name,
            customer_phone: formData.customer_phone,
            discount_percentage: formData.discount_percentage,
            email: formData.email || null,
            date_of_birth: formData.date_of_birth || null,
            total_spent: formData.total_spent,
            reward_points: formData.reward_points,
            membership_tier: formData.membership_tier,
            status: formData.status,
            updated_at: new Date().toISOString()
          })
          .eq('id', formData.id);
        
        if (error) throw error;
        setFeedback({ type: 'success', text: 'Membership updated successfully.' });
      } else {
        const { error } = await supabase.from('memberships').insert([{
          customer_name: formData.customer_name,
          customer_phone: formData.customer_phone,
          discount_percentage: formData.discount_percentage,
          email: formData.email || null,
          date_of_birth: formData.date_of_birth || null,
          total_spent: formData.total_spent,
          reward_points: formData.reward_points,
          membership_tier: formData.membership_tier,
          status: formData.status,
          created_by: userData?.user?.id
        }]);
        
        if (error) throw error;
        setFeedback({ type: 'success', text: 'Membership created successfully.' });
      }

      setIsModalOpen(false);
      resetForm();
      loadData();
    } catch (err: unknown) {
      setFeedback({ type: 'error', text: (err as Error).message || 'Action failed.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({ 
      id: '', customer_name: '', customer_phone: '', discount_percentage: 10, 
      email: '', date_of_birth: '', total_spent: 0, reward_points: 0, membership_tier: 'Silver', status: true 
    });
    setIsEditing(false);
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (member: Membership) => {
    setFormData({
      id: member.id,
      customer_name: member.customer_name,
      customer_phone: member.customer_phone,
      discount_percentage: member.discount_percentage,
      email: member.email || '',
      date_of_birth: member.date_of_birth || '',
      total_spent: member.total_spent || 0,
      reward_points: member.reward_points || 0,
      membership_tier: member.membership_tier || 'Silver',
      status: member.status
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const filteredMemberships = memberships.filter(m => 
    m.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.customer_phone.includes(searchTerm)
  );

  return (
    <div className="space-y-8 pb-12 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-white via-indigo-950/10 to-slate-50 p-6 rounded-3xl border border-slate-200 shadow-xl">
        <div>
          <div className="flex items-center space-x-2 text-indigo-600 text-xs font-bold uppercase tracking-widest mb-1">
            <Users className="w-4 h-4" />
            <span>Customer Loyalty</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            Memberships & Discounts
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Manage VIP customers and their specific discount rates.
          </p>
        </div>
        <Button
          variant="primary"
          icon={<Plus className="w-4 h-4 text-white" />}
          onClick={openCreateModal}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          Add Member
        </Button>
      </div>

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

      <Card className="bg-white border-slate-200 p-4">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by Name or Phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" label="Loading Memberships..." />
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Phone</th>
                  <th className="px-6 py-4">Tier & Points</th>
                  <th className="px-6 py-4">Discount</th>
                  <th className="px-6 py-4">Joined Date</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredMemberships.map(member => (
                  <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900">
                      {member.customer_name}
                    </td>
                    <td className="px-6 py-4 text-slate-600 flex flex-col justify-center">
                      <div className="flex items-center">
                        <Phone className="w-3 h-3 mr-1.5 text-slate-400" />
                        {member.customer_phone}
                      </div>
                      {member.email && <span className="text-xs text-slate-400 mt-1">{member.email}</span>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className={`inline-flex items-center w-fit px-2 py-0.5 rounded text-xs font-bold ${
                          member.membership_tier === 'VIP' ? 'bg-purple-100 text-purple-700' :
                          member.membership_tier === 'Platinum' ? 'bg-slate-800 text-slate-200' :
                          member.membership_tier === 'Gold' ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {member.membership_tier}
                        </span>
                        <span className="text-xs text-indigo-600 font-semibold mt-1">{member.reward_points} pts</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-1 bg-emerald-50 text-emerald-700 font-bold rounded-lg border border-emerald-200">
                        {member.discount_percentage}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 flex items-center">
                      <CalendarDays className="w-4 h-4 mr-1.5 text-slate-400" />
                      {new Date(member.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        member.status ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'
                      }`}>
                        {member.status ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => openEditModal(member)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Edit Membership"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredMemberships.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p>No memberships found.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-900">{isEditing ? 'Edit Membership' : 'Add New Member'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
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

              {isEditing && (
                <div className="flex items-center space-x-2 pt-2">
                  <input
                    type="checkbox"
                    id="status"
                    checked={formData.status}
                    onChange={e => setFormData({...formData, status: e.target.checked})}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <label htmlFor="status" className="text-sm font-medium text-slate-700">
                    Active Membership
                  </label>
                </div>
              )}

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <Button variant="secondary" onClick={() => setIsModalOpen(false)} type="button">
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white border-none min-w-[120px]">
                  {isSubmitting ? <Spinner size="sm" /> : isEditing ? 'Save Changes' : 'Add Member'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
