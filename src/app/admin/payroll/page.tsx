'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function AdminPayrollDashboard() {
  const [monthYear, setMonthYear] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!monthYear) {
      setError('Please select a valid month.');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const res = await fetch('/api/payroll/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month_year: monthYear }),
      });

      const json = await res.json();
      if (json.success) {
        setResults(json.data);
      } else {
        setError(json.error || 'Failed to generate payroll.');
      }
    } catch (err) {
      setError('Network error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">
            Payroll Generation (Beta)
          </h1>
          <p className="text-muted-foreground mt-1">Compute monthly salary sheets based on attendance.</p>
        </div>
      </div>

      <Card className="border-indigo-100 shadow-md">
        <CardHeader className="bg-indigo-50/50 border-b border-indigo-100">
          <CardTitle>Run Payroll Calculation</CardTitle>
          <CardDescription>Select the target month. This will process all employees in your scope.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-end">
            <div className="space-y-2 flex-1 max-w-sm">
              <Label htmlFor="month">Month & Year (YYYY-MM)</Label>
              <Input 
                id="month" 
                type="month" 
                value={monthYear} 
                onChange={(e) => setMonthYear(e.target.value)} 
              />
            </div>
            <Button 
              onClick={handleGenerate} 
              disabled={loading || !monthYear}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {loading ? 'Computing...' : 'Generate Payroll'}
            </Button>
          </div>
          {error && <p className="text-sm text-red-600 mt-4 font-medium">{error}</p>}
        </CardContent>
      </Card>

      {results && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Generation Results</CardTitle>
            <CardDescription>Generated {results.length} records for {monthYear}.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Payable Days</TableHead>
                  <TableHead className="text-right">Gross Salary</TableHead>
                  <TableHead className="text-right">Deductions</TableHead>
                  <TableHead className="text-right text-emerald-600">Net Payable</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((res, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono text-xs">{res.user_id.split('-')[0]}...</TableCell>
                    <TableCell>
                      {res.status === 'success' ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                          Success
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800" title={res.reason}>
                          Error
                        </span>
                      )}
                    </TableCell>
                    {res.status === 'success' && res.data ? (
                      <>
                        <TableCell className="text-right">{res.data.total_payable_days}</TableCell>
                        <TableCell className="text-right">৳{res.data.gross_salary.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-red-500">-৳{res.data.deductions.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-bold text-emerald-600">৳{res.data.net_payable.toLocaleString()}</TableCell>
                      </>
                    ) : (
                      <TableCell colSpan={4} className="text-sm text-muted-foreground">{res.reason}</TableCell>
                    )}
                  </TableRow>
                ))}
                {results.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                      No employees found in your scope.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
