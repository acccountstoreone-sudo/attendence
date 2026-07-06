'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export default function EmployeeLeavePage() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [leaveType, setLeaveType] = useState('CASUAL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/leaves/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leave_type_code: leaveType,
          start_date: startDate,
          end_date: endDate,
          reason,
        }),
      });

      const json = await res.json();

      if (json.success) {
        setSuccess('Leave application submitted successfully. Pending manager approval.');
        setStartDate('');
        setEndDate('');
        setReason('');
      } else {
        setError(json.error || 'Failed to submit leave application.');
      }
    } catch (err) {
      setError('A network error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
        Leave Application
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-blue-50/50 border-blue-100">
          <CardHeader className="py-4">
            <CardTitle className="text-sm text-blue-600">Casual Leave (CASUAL)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">4 / 10</p>
            <p className="text-xs text-muted-foreground">Days remaining</p>
          </CardContent>
        </Card>
        <Card className="bg-red-50/50 border-red-100">
          <CardHeader className="py-4">
            <CardTitle className="text-sm text-red-600">Sick Leave (SICK)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">12 / 14</p>
            <p className="text-xs text-muted-foreground">Days remaining</p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50/50 border-emerald-100">
          <CardHeader className="py-4">
            <CardTitle className="text-sm text-emerald-600">Earned Leave (EARNED)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">15 / 15</p>
            <p className="text-xs text-muted-foreground">Days remaining</p>
          </CardContent>
        </Card>
      </div>

      <Card className="backdrop-blur-xl bg-white/60 border-white/40 shadow-xl">
        <CardHeader>
          <CardTitle>Submit New Request</CardTitle>
          <CardDescription>Fill out the form below to apply for a leave of absence.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm border border-red-200">
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 bg-emerald-100 text-emerald-700 rounded-md text-sm border border-emerald-200">
                {success}
              </div>
            )}

            <div className="space-y-2">
              <Label>Leave Type</Label>
              <Select value={leaveType} onValueChange={setLeaveType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASUAL">Casual Leave</SelectItem>
                  <SelectItem value="SICK">Sick Leave</SelectItem>
                  <SelectItem value="EARNED">Earned Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason / Comments</Label>
              <Textarea
                id="reason"
                placeholder="Please provide a brief reason for your leave..."
                rows={3}
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700">
              {loading ? 'Submitting...' : 'Submit Application'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
