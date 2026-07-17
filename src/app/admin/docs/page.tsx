import React from 'react';
import DocumentationViewer from '@/components/admin/DocumentationViewer';
import { BookOpen } from 'lucide-react';

export default function AdminDocsPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-[#1dbf73]" /> System Documentation
          </h1>
          <p className="text-slate-500 font-medium mt-1">Comprehensive guides and manuals for platform usage.</p>
        </div>
      </div>

      <DocumentationViewer />
    </div>
  );
}
