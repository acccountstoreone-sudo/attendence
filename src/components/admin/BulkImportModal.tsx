'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Upload, FileText, CheckCircle2, XCircle, Download, X, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ImportResultRow {
  email: string;
  full_name: string;
  status: 'success' | 'error';
  reason?: string;
}

export function BulkImportModal({ isOpen, onClose, onSuccess }: BulkImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<{
    success_count: number;
    error_count: number;
    results: ImportResultRow[];
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    const csvContent = 'full_name,email,phone,employee_id,role\nRahim Uddin,rahim@company.com,01711111111,EMP-101,employee\nKarim Ahmed,karim@company.com,01822222222,EMP-102,employee\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'staff_bulk_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setErrorMsg(null);
    setResults(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;
      const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length < 2) {
        setErrorMsg('CSV file must have a header row and at least one employee row.');
        setParsedRows([]);
        return;
      }
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const rows: Record<string, string>[] = [];
      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        if (vals.length === 0 || !vals.some(v => v !== '')) continue;
        const rowObj: Record<string, string> = {};
        headers.forEach((h, idx) => {
          rowObj[h] = vals[idx] || '';
        });
        rows.push(rowObj);
      }
      setParsedRows(rows);
    };
    reader.readAsText(selectedFile);
  };

  const handleStartImport = async () => {
    if (parsedRows.length === 0) {
      setErrorMsg('No valid rows found to import.');
      return;
    }
    setUploading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/employees/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsedRows }),
      });
      const json = await res.json();
      if (json.success) {
        setResults(json.data);
        if (json.data.success_count > 0) {
          onSuccess();
        }
      } else {
        setErrorMsg(json.error?.message || 'Bulk import failed.');
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error occurred.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl bg-[#0F172A] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <Upload className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-white">Bulk Onboard Staff (CSV)</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-sm">
          {/* Step 1: Template download */}
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-medium text-white">Need a formatting template?</h3>
              <p className="text-xs text-slate-400 mt-0.5">Download our pre-formatted CSV template with standard headers.</p>
            </div>
            <Button variant="secondary" size="sm" icon={<Download className="w-4 h-4" />} onClick={handleDownloadTemplate}>
              CSV Template
            </Button>
          </div>

          {/* Step 2: File Upload */}
          {!results && (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl p-8 text-center cursor-pointer transition-colors bg-slate-900/40 hover:bg-slate-900/60"
              >
                <FileText className="w-10 h-10 text-indigo-400 mx-auto mb-3" />
                {file ? (
                  <div>
                    <p className="font-semibold text-white">{file.name}</p>
                    <p className="text-xs text-slate-400 mt-1">{parsedRows.length} employee row(s) ready for onboarding</p>
                  </div>
                ) : (
                  <div>
                    <p className="font-semibold text-white">Click to select a CSV file</p>
                    <p className="text-xs text-slate-400 mt-1">or drag and drop your staff roster (.csv) here</p>
                  </div>
                )}
              </div>

              {parsedRows.length > 0 && (
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3 text-xs text-indigo-300 flex items-center justify-between">
                  <span><strong>{parsedRows.length}</strong> row(s) parsed successfully from CSV.</span>
                  <button onClick={() => { setFile(null); setParsedRows([]); }} className="text-indigo-400 hover:underline font-medium">Remove</button>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 flex items-start gap-3 text-rose-300">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-xs">Import Error</p>
                <p className="text-xs mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Results Display */}
          {results && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-400">{results.success_count}</p>
                  <p className="text-xs text-slate-300 mt-0.5">Added Successfully</p>
                </div>
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-rose-400">{results.error_count}</p>
                  <p className="text-xs text-slate-300 mt-0.5">Failed to Add</p>
                </div>
              </div>

              <div className="border border-slate-800 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-slate-400 text-xs border-b border-slate-800">
                      <th className="p-3 font-medium">Name</th>
                      <th className="p-3 font-medium">Email</th>
                      <th className="p-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs">
                    {results.results.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="p-3 font-medium text-white">{row.full_name}</td>
                        <td className="p-3 text-slate-400">{row.email}</td>
                        <td className="p-3">
                          {row.status === 'success' ? (
                            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                              <CheckCircle2 className="w-4 h-4" /> Added
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-rose-400 font-medium" title={row.reason}>
                              <XCircle className="w-4 h-4" /> {row.reason || 'Failed'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/50 flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={uploading}>
            {results ? 'Done' : 'Cancel'}
          </Button>
          {!results && (
            <Button
              variant="primary"
              onClick={handleStartImport}
              disabled={parsedRows.length === 0 || uploading}
              className="bg-indigo-600 hover:bg-indigo-500 text-white border-0"
            >
              {uploading ? <Spinner className="w-4 h-4" /> : `Import ${parsedRows.length > 0 ? `${parsedRows.length} Staff` : ''}`}
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
