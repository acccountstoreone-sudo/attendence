'use client';

import React, { useState, useMemo } from 'react';
import { Search, Book, ShieldAlert, FileText, ChevronRight, Menu, X } from 'lucide-react';
import { documentationData, DocSection } from '@/data/documentation';

// A simple parser for basic markdown elements
const renderContent = (content: string) => {
  return content.split('\n').map((line, idx) => {
    if (line.startsWith('### ')) {
      return <h3 key={idx} className="text-xl font-bold text-slate-800 mt-6 mb-3">{line.replace('### ', '')}</h3>;
    }
    if (line.startsWith('## ')) {
      return <h2 key={idx} className="text-2xl font-black text-slate-900 mt-8 mb-4 border-b pb-2">{line.replace('## ', '')}</h2>;
    }
    if (line.startsWith('- ')) {
      // Handle bold text in list
      const parts = line.replace('- ', '').split(/(\*\*.*?\*\*)/g);
      return (
        <li key={idx} className="text-slate-600 mb-2 ml-4 list-disc marker:text-[#1dbf73]">
          {parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={i} className="text-slate-800">{part.slice(2, -2)}</strong>;
            }
            return part;
          })}
        </li>
      );
    }
    if (line.match(/^\d+\.\s/)) { // Numbered list
      const parts = line.replace(/^\d+\.\s/, '').split(/(\*\*.*?\*\*)/g);
      return (
        <li key={idx} className="text-slate-600 mb-2 ml-4 list-decimal marker:text-slate-400 font-medium">
          {parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={i} className="text-slate-800">{part.slice(2, -2)}</strong>;
            }
            return part;
          })}
        </li>
      );
    }
    if (line.trim() === '') return <br key={idx} />;
    
    // Normal text with bold support
    const parts = line.split(/(\*\*.*?\*\*)/g);
    return (
      <p key={idx} className="text-slate-600 mb-4 font-medium leading-relaxed">
        {parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="text-slate-800">{part.slice(2, -2)}</strong>;
          }
          return part;
        })}
      </p>
    );
  });
};

export default function DocumentationViewer() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState<string>(documentationData[0].id);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Filter topics based on search
  const filteredDocs = useMemo(() => {
    if (!searchQuery.trim()) return documentationData;
    const query = searchQuery.toLowerCase();
    return documentationData.filter(doc => 
      doc.title.toLowerCase().includes(query) || 
      doc.tags.some(tag => tag.toLowerCase().includes(query)) ||
      doc.content.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const adminDocs = filteredDocs.filter(d => d.category === 'admin');
  const managerDocs = filteredDocs.filter(d => d.category === 'manager');

  const selectedDoc = documentationData.find(d => d.id === selectedTopicId);

  return (
    <div className="flex h-[calc(100vh-6rem)] bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      
      {/* Mobile Toggle Button */}
      <button 
        className="md:hidden absolute top-4 right-4 z-50 p-2 bg-white rounded-lg shadow-md border border-slate-200 text-slate-600"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      >
        {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Sidebar Navigation */}
      <div className={`${mobileMenuOpen ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-80 bg-slate-50 border-r border-slate-200 absolute md:relative z-40 h-full`}>
        <div className="p-4 border-b border-slate-200 bg-white">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
            <Book className="w-5 h-5 text-[#1dbf73]" />
            Documentation
          </h2>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search guides, tags..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1dbf73]/20 focus:border-[#1dbf73] transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {adminDocs.length > 0 && (
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" /> Admin Guide
              </h3>
              <ul className="space-y-1">
                {adminDocs.map(doc => (
                  <li key={doc.id}>
                    <button 
                      onClick={() => { setSelectedTopicId(doc.id); setMobileMenuOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-all ${selectedTopicId === doc.id ? 'bg-[#1dbf73]/10 text-[#1dbf73]' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                    >
                      {doc.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {managerDocs.length > 0 && (
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Manager Guide
              </h3>
              <ul className="space-y-1">
                {managerDocs.map(doc => (
                  <li key={doc.id}>
                    <button 
                      onClick={() => { setSelectedTopicId(doc.id); setMobileMenuOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-all ${selectedTopicId === doc.id ? 'bg-[#1dbf73]/10 text-[#1dbf73]' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                    >
                      {doc.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {filteredDocs.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-sm font-medium">
              No results found for &quot;{searchQuery}&quot;
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto bg-white p-6 md:p-12">
        {selectedDoc ? (
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#1dbf73] mb-2">
              {selectedDoc.category} Guide <ChevronRight className="w-3 h-3" />
            </div>
            <h1 className="text-4xl font-black text-slate-900 mb-2">{selectedDoc.title}</h1>
            <div className="flex gap-2 mb-8 flex-wrap">
              {selectedDoc.tags.map(tag => (
                <span key={tag} className="px-2 py-1 bg-slate-100 text-slate-500 rounded-md text-xs font-semibold">#{tag}</span>
              ))}
            </div>
            
            <div className="prose prose-slate max-w-none">
              {renderContent(selectedDoc.content)}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400 font-medium">
            Select a topic from the sidebar to view documentation.
          </div>
        )}
      </div>
    </div>
  );
}
