'use client';

import { useState } from 'react';
import { FolderKanban, Search, ArrowUpRight } from 'lucide-react';
import { formatCompactCurrency as fmtCost, formatCompactNumber } from '@/lib/format';

export interface EngagementCodeRankingRow {
  projectCode: string;
  tokens: number;
  cost: number;
  userCount: number;
}

interface EngagementCodeRankingsPanelProps {
  data: EngagementCodeRankingRow[];
  onSelectProject?: (projectCode: string, billable: boolean) => void;
  levelLabel?: string;
}

// Relocated here from the ROI page's Engagement Code Telemetry & Billability
// panel — this is now Engagement Analytics' own Level 1 (Engagement Code)
// step, so selecting a row continues the same path-based drilldown that
// every other level uses (see onSelectProject callers).
export function EngagementCodeRankingsPanel({
  data,
  onSelectProject,
  levelLabel = 'Level 1: Engagement Code',
}: EngagementCodeRankingsPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'Billable' | 'Non-Billable'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Billability is derived from the Engagement Code prefix (E-XXXXXX = billable, I-XXXXXX = non-billable),
  // which is a 1:1 match with the CSV's Billable/Non-Billable flag.
  const isBillableCode = (projectCode: string) => projectCode.startsWith('E-');

  const filteredList = data.filter((p) => {
    const matchesSearch = p.projectCode.toLowerCase().includes(searchTerm.toLowerCase());
    const billable = isBillableCode(p.projectCode);
    const matchesType =
      filterType === 'all' || (filterType === 'Billable' ? billable : !billable);
    return matchesSearch && matchesType;
  });

  const totalPages = Math.ceil(filteredList.length / itemsPerPage) || 1;
  const paginatedList = filteredList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="bg-ey-card border border-ey-border rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-ey-light flex items-center space-x-2">
            <FolderKanban className="w-5 h-5 text-ey-yellow" />
            <span>Engagement Code Telemetry &amp; Spend Rankings</span>
          </h3>
          <p className="text-xs text-ey-muted mt-0.5">
            {levelLabel} — rankings of project codes by total AI token spend, billable vs non-billable. Click a row to continue drilling.
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

          {/* Billability Filter */}
          <select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value as any);
              setCurrentPage(1);
            }}
            className="bg-ey-black border border-ey-border text-ey-light text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-ey-yellow font-medium"
          >
            <option value="all">All Project Codes</option>
            <option value="Billable">Billable</option>
            <option value="Non-Billable">Non-Billable</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-ey-border rounded-xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-ey-black/60 text-ey-muted font-semibold uppercase tracking-wider border-b border-ey-border">
            <tr>
              <th className="px-4 py-3">Engagement Code</th>
              <th className="px-4 py-3">Billability</th>
              <th className="px-4 py-3 text-right">Active Users</th>
              <th className="px-4 py-3 text-right">Token Consumption</th>
              <th className="px-4 py-3 text-right">Total AI Investment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ey-border">
            {paginatedList.length > 0 ? (
              paginatedList.map((row, idx) => {
                const billable = isBillableCode(row.projectCode);
                return (
                  <tr
                    key={idx}
                    onClick={() => onSelectProject?.(row.projectCode, billable)}
                    className={`hover:bg-ey-card-hover/80 transition ${
                      onSelectProject ? 'cursor-pointer group' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-mono font-bold text-ey-light flex items-center space-x-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono border flex items-center gap-1 group-hover:border-ey-yellow/60 ${
                        billable
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
                        billable
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      }`}>
                        {billable ? 'Billable' : 'Non-Billable'}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right font-mono text-ey-muted">
                      {row.userCount} users
                    </td>

                    <td className="px-4 py-3 text-right font-mono text-ey-light">
                      {formatCompactNumber(row.tokens)} tokens
                    </td>

                    <td className="px-4 py-3 text-right font-mono font-bold text-ey-yellow">
                      {fmtCost(row.cost)}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ey-muted">
                  No engagement codes matching your filter criteria.
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
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredList.length)} of {filteredList.length} engagement codes
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
  );
}
