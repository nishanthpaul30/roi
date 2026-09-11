'use client';

import { useState } from 'react';
import { UserCapacityRow } from '@/lib/metrics/types';
import { TrendingDown, TrendingUp, AlertCircle, ShieldAlert, Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface RoiCapacityPanelProps {
  userCapacityBreakdown: UserCapacityRow[];
  totalWasteCost: number;
  totalOverageCost: number;
  licenseEfficiencyRate: number;
  ceilingRiskCount: number;
  pageSize?: number;
}

export function RoiCapacityPanel({
  userCapacityBreakdown,
  totalWasteCost,
  totalOverageCost,
  licenseEfficiencyRate,
  ceilingRiskCount,
  pageSize = 10,
}: RoiCapacityPanelProps) {
  const [activeTab, setActiveTab] = useState<'zone1' | 'zone2' | 'all'>('zone1');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const zone1List = userCapacityBreakdown.filter((u) => u.zone === 'zone1_under');
  const zone2List = userCapacityBreakdown.filter((u) => u.zone === 'zone2_over');

  const displayedList =
    activeTab === 'zone1' ? zone1List : activeTab === 'zone2' ? zone2List : userCapacityBreakdown;

  // Search filter logic
  const filteredList = displayedList.filter((row) =>
    row.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    row.userMail.toLowerCase().includes(searchTerm.toLowerCase()) ||
    row.aiTools.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Pagination calculations
  const totalPages = Math.ceil(filteredList.length / pageSize) || 1;
  const paginatedList = filteredList.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleTabChange = (tab: 'zone1' | 'zone2' | 'all') => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Strategic Capacity Summary Banner */}
      <div className="bg-ey-card border border-ey-border rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-ey-border pb-4">
          <div>
            <h2 className="text-base font-bold text-ey-light tracking-wide flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-ey-yellow" />
              <span>Financial Governance &amp; Capacity Optimization</span>
            </h2>
            <p className="text-xs text-ey-muted mt-0.5">
              Bifurcated analysis of unconsumed license quotas (Zone 1 Waste) vs usage limit breaches (Zone 2 Overage).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleTabChange('zone1')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                activeTab === 'zone1'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                  : 'bg-ey-black text-ey-muted border-ey-border hover:text-ey-light'
              }`}
            >
              Zone 1: Under-Utilized ({zone1List.length})
            </button>

            <button
              onClick={() => handleTabChange('zone2')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                activeTab === 'zone2'
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-sm'
                  : 'bg-ey-black text-ey-muted border-ey-border hover:text-ey-light'
              }`}
            >
              Zone 2: Over-Utilized ({zone2List.length})
            </button>

            <button
              onClick={() => handleTabChange('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                activeTab === 'all'
                  ? 'bg-ey-yellow/20 text-ey-yellow border-ey-yellow/40 shadow-sm'
                  : 'bg-ey-black text-ey-muted border-ey-border hover:text-ey-light'
              }`}
            >
              All Seats ({userCapacityBreakdown.length})
            </button>
          </div>
        </div>

        {/* Quick Insights Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 flex items-start space-x-3">
            <TrendingDown className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-300 font-bold">Zone 1 — Waste Recovery Opportunity</p>
              <p className="text-[11px] text-ey-muted mt-0.5">
                <strong className="text-amber-200">${totalWasteCost.toLocaleString()}</strong> of license quotas went unconsumed across {zone1List.length} users.
              </p>
            </div>
          </div>

          <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3.5 flex items-start space-x-3">
            <TrendingUp className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-purple-300 font-bold">Zone 2 — Overage Spend Exposure</p>
              <p className="text-[11px] text-ey-muted mt-0.5">
                <strong className="text-purple-200">${totalOverageCost.toLocaleString()}</strong> in additional usage billed beyond standard limits for {zone2List.length} users.
              </p>
            </div>
          </div>

          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3.5 flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-red-300 font-bold">100K Hard Token Cap Warning</p>
              <p className="text-[11px] text-ey-muted mt-0.5">
                <strong className="text-red-200">{ceilingRiskCount} users</strong> have reached or exceeded 90% of the platform hard token ceiling (100,000 tokens).
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* User Capacity Breakdown Table */}
      <div className="bg-ey-card border border-ey-border rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-ey-light flex items-center gap-2">
            {activeTab === 'zone1' ? (
              <span className="text-amber-400 font-semibold">Zone 1: Unconsumed AI License Waste (Limit - Actual Cost)</span>
            ) : activeTab === 'zone2' ? (
              <span className="text-purple-400 font-semibold">Zone 2: Budget Breach &amp; Overage Charges (Actual Cost - Limit)</span>
            ) : (
              <span>All User License &amp; Capacity Statuses</span>
            )}
          </h3>

          <div className="flex items-center space-x-3">
            <div className="relative w-56">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-ey-muted" />
              <input
                type="text"
                placeholder="Search user email or tool..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-ey-black border border-ey-border text-ey-light text-xs rounded-md pl-9 pr-3 py-1.5 focus:outline-none focus:border-ey-yellow"
              />
            </div>
            <span className="text-xs text-ey-muted font-mono">
              Total: {filteredList.length} users
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-ey-light">
            <thead className="bg-ey-black/80 text-[11px] uppercase font-semibold text-ey-muted border-b border-ey-border">
              <tr>
                <th className="px-4 py-3">User &amp; Email</th>
                <th className="px-4 py-3">AI Tools</th>
                <th className="px-4 py-3 text-right">Actual Cost ($)</th>
                <th className="px-4 py-3 text-right">Usage Limit ($)</th>
                <th className="px-4 py-3 text-right">Wasted Capacity</th>
                <th className="px-4 py-3 text-right">Overage Fee</th>
                <th className="px-4 py-3 text-center">100K Cap Proximity</th>
                <th className="px-4 py-3 text-center">Status Zone</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ey-border">
              {paginatedList.length > 0 ? (
                paginatedList.map((row, idx) => (
                  <tr key={idx} className="hover:bg-ey-card-hover/80 transition">
                    <td className="px-4 py-3 font-medium">
                      <div>{row.displayName}</div>
                      <div className="text-[10px] text-ey-muted font-mono">{row.userMail}</div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {row.aiTools.map((t) => (
                          <span
                            key={t}
                            className="px-1.5 py-0.5 text-[10px] font-mono border rounded bg-ey-black border-ey-border text-ey-light capitalize"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-right font-mono font-bold text-ey-light">
                      ${row.actualCost.toFixed(2)}
                    </td>

                    <td className="px-4 py-3 text-right font-mono text-ey-muted">
                      ${row.usageLimit.toFixed(2)}
                    </td>

                    <td className="px-4 py-3 text-right font-mono font-bold">
                      {row.wasteCost > 0 ? (
                        <span className="text-amber-400">+${row.wasteCost.toFixed(2)}</span>
                      ) : (
                        <span className="text-ey-muted">$0.00</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right font-mono font-bold">
                      {row.overageCost > 0 ? (
                        <span className="text-purple-400">+${row.overageCost.toFixed(2)}</span>
                      ) : (
                        <span className="text-ey-muted">$0.00</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center space-y-1">
                        <span
                          className={`text-[10px] font-mono font-bold ${
                            row.ceilingPercent >= 90
                              ? 'text-red-400'
                              : row.ceilingPercent >= 60
                              ? 'text-ey-yellow'
                              : 'text-emerald-400'
                          }`}
                        >
                          {row.tokenConsumption.toLocaleString()} tokens ({row.ceilingPercent}%)
                        </span>
                        <div className="w-24 bg-ey-black h-1.5 rounded-full overflow-hidden border border-ey-border">
                          <div
                            className={`h-full rounded-full ${
                              row.ceilingPercent >= 90
                                ? 'bg-red-500'
                                : row.ceilingPercent >= 60
                                ? 'bg-ey-yellow'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, row.ceilingPercent)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-center">
                      {row.zone === 'zone1_under' ? (
                        <span className="px-2 py-0.5 text-[10px] font-semibold border rounded-full bg-amber-500/15 text-amber-300 border-amber-500/30">
                          Zone 1: Under
                        </span>
                      ) : row.zone === 'zone2_over' ? (
                        <span className="px-2 py-0.5 text-[10px] font-semibold border rounded-full bg-purple-500/15 text-purple-300 border-purple-500/30">
                          Zone 2: Over
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-semibold border rounded-full bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
                          Balanced
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-ey-muted">
                    No matching users found for selected zone or search term.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer Controls */}
        <div className="flex items-center justify-between border-t border-ey-border pt-4 text-xs text-ey-muted">
          <div>
            Showing{' '}
            <strong className="text-ey-light font-mono">
              {filteredList.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}
            </strong>{' '}
            to{' '}
            <strong className="text-ey-light font-mono">
              {Math.min(currentPage * pageSize, filteredList.length)}
            </strong>{' '}
            of <strong className="text-ey-light font-mono">{filteredList.length}</strong> records
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-md border border-ey-border bg-ey-black text-ey-light disabled:opacity-40 disabled:cursor-not-allowed hover:border-ey-yellow transition"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-[11px] px-2 text-ey-light">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded-md border border-ey-border bg-ey-black text-ey-light disabled:opacity-40 disabled:cursor-not-allowed hover:border-ey-yellow transition"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

