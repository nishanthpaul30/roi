'use client';

import { useState } from 'react';
import { TokenCostSummary } from '@/lib/metrics/types';
import { FolderKanban, Building, Briefcase, Search, ArrowUpDown, ArrowUpRight } from 'lucide-react';

interface ProjectBillabilityPanelProps {
  summary: TokenCostSummary;
  onSelectProject?: (projectCode: string, projectType: string) => void;
  onSelectBillability?: (type: 'external' | 'internal') => void;
}

export function ProjectBillabilityPanel({
  summary,
  onSelectProject,
  onSelectBillability,
}: ProjectBillabilityPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'External' | 'Internal'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const projectList = summary?.byProjectCode || [];
  
  // Filter project list by search & type
  const filteredList = projectList.filter((p) => {
    const matchesSearch =
      p.projectCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.projectType.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || p.projectType === filterType;
    return matchesSearch && matchesType;
  });

  const totalPages = Math.ceil(filteredList.length / itemsPerPage) || 1;
  const paginatedList = filteredList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const externalPercent = summary.externalProjectPercent || 0;

  return (
    <div className="space-y-6">
      {/* 2 Summary KPI Cards — Billable and External are the same 1:1 classification, as are Non-Billable and Internal */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Billable / External Client Projects */}
        <div
          onClick={() => onSelectBillability?.('external')}
          className={`bg-ey-card border border-ey-border rounded-xl p-4 shadow-sm space-y-2 transition ${
            onSelectBillability ? 'cursor-pointer hover:border-blue-500/60 hover:shadow-md group' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ey-muted group-hover:text-blue-300 transition-colors flex items-center gap-1">
              <span>Billable Spend (External Projects)</span>
              {onSelectBillability && <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-blue-400" />}
            </span>
            <div className="p-1.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-lg">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-xl font-bold text-ey-light font-mono group-hover:text-blue-300 transition-colors">
              ${(summary.externalProjectSpend || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs font-semibold font-mono text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
              {externalPercent}% of Total
            </div>
          </div>
          <p className="text-xs text-ey-muted">Client engagements, billable to the client (Code prefix: E-XXXXXX)</p>
        </div>

        {/* Non-Billable / Internal R&D Projects */}
        <div
          onClick={() => onSelectBillability?.('internal')}
          className={`bg-ey-card border border-ey-border rounded-xl p-4 shadow-sm space-y-2 transition ${
            onSelectBillability ? 'cursor-pointer hover:border-purple-500/60 hover:shadow-md group' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ey-muted group-hover:text-purple-300 transition-colors flex items-center gap-1">
              <span>Non-Billable Overhead (Internal Projects)</span>
              {onSelectBillability && <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-purple-400" />}
            </span>
            <div className="p-1.5 bg-purple-500/10 border border-purple-500/30 text-purple-400 rounded-lg">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-xl font-bold text-ey-light font-mono group-hover:text-purple-300 transition-colors">
              ${(summary.internalProjectSpend || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs font-semibold font-mono text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full">
              {(100 - externalPercent).toFixed(1)}% of Total
            </div>
          </div>
          <p className="text-xs text-ey-muted">Internal tools &amp; R&amp;D, not billed to any client (Code prefix: I-XXXXXX)</p>
        </div>
      </div>

      {/* Engagement Codes Telemetry Table */}
      <div className="bg-ey-card border border-ey-border rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-ey-light flex items-center space-x-2">
              <FolderKanban className="w-5 h-5 text-ey-yellow" />
              <span>Engagement Code Telemetry &amp; Spend Rankings</span>
            </h3>
            <p className="text-xs text-ey-muted mt-0.5">
              Rankings of project codes (<span className="font-mono text-blue-400">E-XXXXXX</span> vs <span className="font-mono text-purple-400">I-XXXXXX</span>) by total AI token spend.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-ey-muted absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search project code..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-ey-black border border-ey-border text-ey-light text-xs rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:border-ey-yellow w-44"
              />
            </div>

            {/* Project Type Filter */}
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value as any);
                setCurrentPage(1);
              }}
              className="bg-ey-black border border-ey-border text-ey-light text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-ey-yellow font-medium"
            >
              <option value="all">All Project Types</option>
              <option value="External">External (E-XXXXXX)</option>
              <option value="Internal">Internal (I-XXXXXX)</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto border border-ey-border rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-ey-black/60 text-ey-muted font-semibold uppercase tracking-wider border-b border-ey-border">
              <tr>
                <th className="px-4 py-3">Engagement Code</th>
                <th className="px-4 py-3">Project Type</th>
                <th className="px-4 py-3 text-right">Active Users</th>
                <th className="px-4 py-3 text-right">Token Consumption</th>
                <th className="px-4 py-3 text-right">Total AI Investment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ey-border">
              {paginatedList.length > 0 ? (
                paginatedList.map((row, idx) => (
                  <tr
                    key={idx}
                    onClick={() => onSelectProject?.(row.projectCode, row.projectType)}
                    className={`hover:bg-ey-card-hover/80 transition ${
                      onSelectProject ? 'cursor-pointer group' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-mono font-bold text-ey-light flex items-center space-x-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono border flex items-center gap-1 group-hover:border-ey-yellow/60 ${
                        row.projectCode.startsWith('E-')
                          ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                          : 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                      }`}>
                        <span>{row.projectCode}</span>
                        {onSelectProject && (
                          <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-ey-yellow" />
                        )}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                        row.projectType === 'External'
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      }`}>
                        {row.projectType}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right font-mono text-ey-muted">
                      {row.userCount} users
                    </td>

                    <td className="px-4 py-3 text-right font-mono text-ey-light">
                      {row.tokens.toLocaleString()} tokens
                    </td>

                    <td className="px-4 py-3 text-right font-mono font-bold text-ey-yellow">
                      ${row.cost.toFixed(2)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-ey-muted">
                    No project codes matching your filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 text-xs text-ey-muted">
            <div>
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredList.length)} of {filteredList.length} projects
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 bg-ey-black border border-ey-border rounded-lg hover:bg-ey-card-hover disabled:opacity-40 font-medium"
              >
                Previous
              </button>
              <span className="font-mono">Page {currentPage} of {totalPages}</span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 bg-ey-black border border-ey-border rounded-lg hover:bg-ey-card-hover disabled:opacity-40 font-medium"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
