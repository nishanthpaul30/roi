'use client';

import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Search, ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { TokenCostSummary } from '@/lib/metrics/types';
import { formatCompactCurrency as fmtCost, formatCompactNumber as fmtNum } from '@/lib/format';
import { useTableSort } from '@/lib/useTableSort';
import { computeHoursSavedValueUsd, computeRoiPercent, computeDevCostUsd, computeTotalInvestmentUsd, computeRoiEligibleHours } from '@/lib/metrics/roiCalc';
import { InfoTooltip } from '@/components/ui/InfoTooltip';

type HoursSavedRow = NonNullable<TokenCostSummary['hoursSavedByEngagement']>[number];

interface HoursSavedGroupedTableProps {
  rows: HoursSavedRow[];
  onSelectEngagement: (projectCode: string) => void;
  devHourRate: number;
}

const TOOL_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT',
  github: 'GitHub Copilot',
  claude: 'Claude',
  replit: 'Replit',
  factory: 'Factory AI',
  cursor: 'Cursor AI',
};


// ROI = (value of hours saved at the chosen dev-hour rate - tool cost) / tool cost * 100.
// Positive means the hours saved are worth more than the tool spend.
function roiColor(pct: number): string {
  if (pct >= 100) return 'text-emerald-300';
  if (pct >= 0) return 'text-ey-yellow';
  return 'text-rose-300';
}

interface ColumnDef {
  label: string;
  sortKey: string;
  align: 'left' | 'right';
  /** Which edge the info popup is pinned to; left-side columns open it rightward so it isn't clipped. */
  tooltipAlign: 'left' | 'right';
  info: ReactNode;
}

const COLUMNS: ColumnDef[] = [
  {
    label: 'Engagement Code / Tool',
    sortKey: 'engagementCode',
    align: 'left',
    tooltipAlign: 'left',
    info: 'The engagement, with how many tools it uses. Click the arrow to expand its tool rows, or click a row for the full breakdown.',
  },
  {
    label: 'Approved Hrs',
    sortKey: 'totalApprovedHrs',
    align: 'right',
    tooltipAlign: 'left',
    info: "The approved target from the Hours Saved file (Approved (Actual)), summed across the engagement's tools.",
  },
  {
    label: 'Hours Saved',
    sortKey: 'totalHoursSaved',
    align: 'right',
    tooltipAlign: 'left',
    info: 'All monthly hours recorded to date, added together. Future months stay at 0 until they arrive.',
  },
  {
    label: 'Tool Cost',
    sortKey: 'totalCost',
    align: 'right',
    tooltipAlign: 'right',
    info: "Usage + licence cost for the same engagement and tools in ai_usage_data.csv, for the selected period.",
  },
  {
    label: '$ / Hour Saved',
    sortKey: 'costPerHourSaved',
    align: 'right',
    tooltipAlign: 'right',
    info: 'Tool Cost ÷ Hours Saved. The engagement row adds up cost and hours first, then divides once.',
  },
  {
    label: 'Dev Hours',
    sortKey: 'devHoursSpent',
    align: 'right',
    tooltipAlign: 'right',
    info: 'Developer hours clocked on the engagement (mock timesheet), counted once per engagement. Tool rows show n/a because the timesheet has no per-tool split.',
  },
  {
    label: 'ROI %',
    sortKey: 'roiPercent',
    align: 'right',
    tooltipAlign: 'right',
    info: (
      <>
        <span className="font-semibold text-ey-yellow block mb-1">Total Investment ROI</span>
        At the engagement row: (Value of Hours Saved &minus; Total Investment) &divide; Total Investment &times; 100, where Total
        Investment = AI Tool Cost + (Dev Hours &times; $/dev-hr). Dev hours come from the mock timesheet data (see Dev Hours column)
        and apply per engagement, not per tool. Hours Saved here is capped at each tool&apos;s Approved Hrs &mdash; hours recorded
        beyond what&apos;s approved don&apos;t count toward value yet. Tool rows show ROI against tool cost only.
      </>
    ),
  },
];

function HeaderCell({
  col,
  activeKey,
  direction,
  onSort,
}: {
  col: ColumnDef;
  activeKey: string | null;
  direction: 'asc' | 'desc';
  onSort: (key: string) => void;
}) {
  const active = activeKey === col.sortKey;
  const right = col.align === 'right';
  return (
    <th className={`px-4 py-3 ${right ? 'text-right' : ''}`}>
      <div className={`flex items-center gap-1.5 ${right ? 'justify-end' : ''}`}>
        <button
          type="button"
          onClick={() => onSort(col.sortKey)}
          title={`Sort by ${col.label}`}
          className={`flex items-center gap-1 hover:text-ey-light transition ${right ? 'flex-row-reverse' : ''} ${active ? 'text-ey-yellow' : ''}`}
        >
          <span>{col.label}</span>
          {active ? (
            direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
          ) : (
            <ArrowUpDown className="w-3 h-3 opacity-50" />
          )}
        </button>
        <InfoTooltip widthClassName="w-60" align={col.tooltipAlign}>
          {col.info}
        </InfoTooltip>
      </div>
    </th>
  );
}

interface EngagementGroup {
  engagementCode: string;
  tools: HoursSavedRow[];
  totalApprovedHrs: number;
  totalHoursSaved: number;
  totalCost: number;
  costPerHourSaved: number | null;
  hoursSavedValueUsd: number;
  devHoursSpent: number;
  devCostUsd: number;
  totalInvestmentUsd: number;
  // Total-Investment ROI: (hoursSavedValueUsd - totalInvestmentUsd) / totalInvestmentUsd * 100,
  // where totalInvestmentUsd = tool cost + dev hours cost. Engagement-level only --
  // dev hours have no per-tool breakdown, see devHoursSpent on HoursSavedRow.
  roiPercent: number | null;
}

/**
 * Groups the flat Hours Saved rows by Engagement Code -- a parent row shows
 * that engagement's rollup across every tool it uses, expandable to reveal
 * the individual tool rows (same columns as the old flat table). Replaces
 * repeating the Engagement Code once per tool row with "see the engagement
 * total first, tool detail on demand."
 */
export function HoursSavedGroupedTable({ rows, onSelectEngagement, devHourRate }: HoursSavedGroupedTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const groups: EngagementGroup[] = useMemo(() => {
    const map = new Map<string, HoursSavedRow[]>();
    for (const r of rows) {
      if (!map.has(r.projectCode)) map.set(r.projectCode, []);
      map.get(r.projectCode)!.push(r);
    }
    return Array.from(map.entries())
      .map(([engagementCode, tools]) => {
        const totalApprovedHrs = tools.reduce((s, t) => s + t.approvedTotalHrs, 0);
        const totalHoursSaved = tools.reduce((s, t) => s + t.sumOfMonthlyHrs, 0);
        const totalCost = tools.reduce((s, t) => s + (t.cost ?? 0), 0);
        // Capped per tool (not on the engagement total) so one tool
        // overshooting its own approved target can't borrow "room" from
        // another tool that undershot its own.
        const totalRoiEligibleHours = tools.reduce((s, t) => s + computeRoiEligibleHours(t.sumOfMonthlyHrs, t.approvedTotalHrs), 0);
        const hoursSavedValueUsd = computeHoursSavedValueUsd(totalRoiEligibleHours, devHourRate);
        // devHoursSpent is engagement-level, duplicated on every tool row --
        // read it once (tools[0]), never sum across tools, or it over-counts
        // on a multi-tool engagement.
        const devHoursSpent = tools[0]?.devHoursSpent ?? 0;
        const devCostUsd = computeDevCostUsd(devHoursSpent, devHourRate);
        const totalInvestmentUsd = computeTotalInvestmentUsd(totalCost, devCostUsd);
        return {
          engagementCode,
          tools: [...tools].sort((a, b) => (TOOL_LABELS[a.aiTool] || a.assetName).localeCompare(TOOL_LABELS[b.aiTool] || b.assetName)),
          totalApprovedHrs,
          totalHoursSaved,
          totalCost,
          costPerHourSaved: totalHoursSaved > 0 ? Number((totalCost / totalHoursSaved).toFixed(2)) : null,
          hoursSavedValueUsd,
          devHoursSpent,
          devCostUsd,
          totalInvestmentUsd,
          roiPercent: computeRoiPercent(hoursSavedValueUsd, totalInvestmentUsd),
        };
      })
      .sort((a, b) => b.totalCost - a.totalCost);
  }, [rows, devHourRate]);

  const filteredGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return groups;
    return groups
      .map((g) => {
        if (g.engagementCode.toLowerCase().includes(term)) return g;
        const matchingTools = g.tools.filter((t) => (TOOL_LABELS[t.aiTool] || t.assetName).toLowerCase().includes(term));
        return matchingTools.length > 0 ? { ...g, tools: matchingTools } : null;
      })
      .filter((g): g is EngagementGroup => g !== null);
  }, [groups, search]);

  const { sortKey, sortDir, sortedRows: sortedGroups, handleSort } = useTableSort(filteredGroups, {
    engagementCode: (g) => g.engagementCode,
    totalApprovedHrs: (g) => g.totalApprovedHrs,
    totalHoursSaved: (g) => g.totalHoursSaved,
    totalCost: (g) => g.totalCost,
    costPerHourSaved: (g) => g.costPerHourSaved,
    devHoursSpent: (g) => g.devHoursSpent,
    roiPercent: (g) => g.roiPercent,
  });

  // Paginated by ENGAGEMENT GROUP, not flattened tool rows -- expanding a
  // group adds rows to the current page without shifting page boundaries.
  const totalPages = Math.ceil(sortedGroups.length / pageSize) || 1;
  const paginatedGroups = sortedGroups.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSortAndResetPage = (key: string) => {
    handleSort(key);
    setCurrentPage(1);
  };

  const toggle = (code: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <div className="relative max-w-xs w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ey-muted pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search engagement or tool..."
            className="w-full pl-8 pr-3 py-2 text-xs bg-ey-black border border-ey-border rounded-lg text-ey-light placeholder-ey-muted focus:outline-none focus:border-ey-yellow/50 transition"
          />
        </div>
      </div>

      <div className="overflow-x-auto border border-ey-border rounded-xl">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-ey-black/70 text-ey-muted uppercase tracking-wider border-b border-ey-border">
            <tr>
              {COLUMNS.map((col) => (
                <HeaderCell
                  key={col.sortKey}
                  col={col}
                  activeKey={sortKey}
                  direction={sortDir}
                  onSort={handleSortAndResetPage}
                />
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ey-border">
            {paginatedGroups.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-ey-muted">No matching engagements or tools.</td>
              </tr>
            ) : (
              paginatedGroups.map((g) => {
                const isOpen = expanded.has(g.engagementCode) || !!search.trim();
                return (
                  <Fragment key={g.engagementCode}>
                    <tr
                      onClick={() => onSelectEngagement(g.engagementCode)}
                      className="hover:bg-ey-card-hover/80 transition cursor-pointer bg-ey-black/20"
                    >
                      <td className="px-4 py-3 font-bold text-ey-light">
                        <span
                          className="inline-flex items-center gap-1.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggle(g.engagementCode);
                          }}
                        >
                          {isOpen ? (
                            <ChevronDown className="w-3.5 h-3.5 text-ey-muted hover:text-ey-yellow" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-ey-muted hover:text-ey-yellow" />
                          )}
                        </span>{' '}
                        {g.engagementCode}
                        <span className="ml-2 text-[10px] text-ey-muted font-normal">({g.tools.length} tool{g.tools.length === 1 ? '' : 's'})</span>
                      </td>
                      <td className="px-4 py-3 text-right">{fmtNum(g.totalApprovedHrs)}</td>
                      <td className="px-4 py-3 text-right font-bold">{fmtNum(g.totalHoursSaved)}</td>
                      <td className="px-4 py-3 text-right font-bold">{fmtCost(g.totalCost)}</td>
                      <td className="px-4 py-3 text-right font-bold text-ey-yellow">
                        {g.costPerHourSaved !== null ? fmtCost(g.costPerHourSaved) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-ey-muted">
                        {g.devHoursSpent > 0 ? `${fmtNum(g.devHoursSpent)} hrs` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-bold">
                        {g.roiPercent !== null ? <span className={roiColor(g.roiPercent)}>{g.roiPercent >= 0 ? '+' : ''}{g.roiPercent}%</span> : <span className="text-ey-muted">—</span>}
                      </td>
                    </tr>

                    {isOpen &&
                      g.tools.map((t, toolIdx) => {
                        const tRoiEligibleHours = computeRoiEligibleHours(t.sumOfMonthlyHrs, t.approvedTotalHrs);
                        const tHoursSavedValueUsd = computeHoursSavedValueUsd(tRoiEligibleHours, devHourRate);
                        const tRoiPercent = computeRoiPercent(tHoursSavedValueUsd, t.cost);
                        return (
                          <tr
                            key={`${g.engagementCode}:::${t.assetName}:::${toolIdx}`}
                            onClick={() => onSelectEngagement(g.engagementCode)}
                            className="hover:bg-ey-card-hover/60 transition cursor-pointer"
                          >
                            <td className="px-4 py-2.5 pl-10 text-ey-light">
                              <span className="text-ey-border mr-1.5">&#8627;</span>
                              {TOOL_LABELS[t.aiTool] || t.assetName}
                            </td>
                            <td className="px-4 py-2.5 text-right text-ey-muted">{t.approvedTotalHrs}</td>
                            <td className="px-4 py-2.5 text-right text-ey-muted">{t.sumOfMonthlyHrs}</td>
                            <td className="px-4 py-2.5 text-right text-ey-muted">{t.cost !== null ? fmtCost(t.cost) : '—'}</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-ey-yellow">
                              {t.costPerHourSaved !== null ? fmtCost(t.costPerHourSaved) : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-right text-ey-muted/50" title="Dev hours are tracked per engagement, not per tool">n/a</td>
                            <td className="px-4 py-2.5 text-right font-semibold">
                              {tRoiPercent !== null ? <span className={roiColor(tRoiPercent)}>{tRoiPercent >= 0 ? '+' : ''}{tRoiPercent}%</span> : <span className="text-ey-muted">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1 text-xs text-ey-muted">
          <div>
            Showing {sortedGroups.length ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, sortedGroups.length)} of {sortedGroups.length} engagements
          </div>
          <div className="flex items-center space-x-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="px-3 py-1 bg-ey-black border border-ey-border rounded-lg hover:bg-ey-card-hover disabled:opacity-40 disabled:cursor-not-allowed font-medium"
            >
              Previous
            </button>
            <span className="font-mono">Page {currentPage} of {totalPages}</span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="px-3 py-1 bg-ey-black border border-ey-border rounded-lg hover:bg-ey-card-hover disabled:opacity-40 disabled:cursor-not-allowed font-medium"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
