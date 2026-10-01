'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { TokenCostSummary } from '@/lib/metrics/types';
import { formatCompactCurrency as fmtCost, formatCompactNumber as fmtNum } from '@/lib/format';
import { SortableTh } from '@/components/ui/SortableTh';
import type { SortDirection } from '@/lib/useTableSort';

type HoursSavedRow = NonNullable<TokenCostSummary['hoursSavedByEngagement']>[number];

interface HoursSavedMatrixPanelProps {
  rows: HoursSavedRow[];
  onSelectEngagement: (projectCode: string) => void;
}

const TOOL_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT',
  github: 'GitHub Copilot',
  claude: 'Claude',
  replit: 'Replit',
  factory: 'Factory AI',
  cursor: 'Cursor AI',
};

type Metric = 'costPerHourSaved' | 'sumOfMonthlyHrs' | 'realizationPercent' | 'cost';

const METRIC_CONFIG: Record<Metric, { label: string; format: (v: number) => string; lowerIsBetter: boolean; colorCode: boolean }> = {
  costPerHourSaved: { label: '$ / Hour Saved', format: (v) => fmtCost(v), lowerIsBetter: true, colorCode: true },
  sumOfMonthlyHrs: { label: 'Hours Saved', format: (v) => fmtNum(v), lowerIsBetter: false, colorCode: false },
  realizationPercent: { label: 'Realization %', format: (v) => `${v.toFixed(0)}%`, lowerIsBetter: false, colorCode: true },
  cost: { label: 'Tool Cost', format: (v) => fmtCost(v), lowerIsBetter: false, colorCode: false },
};

function cellColor(value: number, values: number[], lowerIsBetter: boolean): string {
  if (values.length < 2) return 'text-ey-light';
  const sorted = [...values].sort((a, b) => a - b);
  const rank = sorted.indexOf(value) / (sorted.length - 1); // 0 (lowest) .. 1 (highest)
  const goodness = lowerIsBetter ? 1 - rank : rank; // 0 = worst, 1 = best
  if (goodness >= 0.66) return 'text-emerald-300';
  if (goodness >= 0.33) return 'text-ey-yellow';
  return 'text-rose-300';
}

/**
 * Engagement x AI Tool pivot: one row per engagement, one column per tool,
 * a single chosen metric per cell. Trades the flat table's full detail for
 * a side-by-side shape -- good for spotting which tool is the efficient (or
 * expensive) choice on the SAME engagement, and which engagements carry the
 * most tool overlap, at a glance.
 */
const PAGE_SIZE = 10;

export function HoursSavedMatrixPanel({ rows, onSelectEngagement }: HoursSavedMatrixPanelProps) {
  const [metric, setMetric] = useState<Metric>('costPerHourSaved');
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  // Not useTableSort here deliberately: sorting by a tool column depends on
  // BOTH sortColumn and the currently selected metric, and useTableSort only
  // recomputes when its rows/sortKey/sortDir change -- switching metric
  // while sorted on a tool column would silently keep the stale order. This
  // local useMemo lists metric in its own deps, so it never goes stale.
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>('asc');

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDir('asc');
    }
    setCurrentPage(1);
  };

  const { engagementCodes, tools, cellMap } = useMemo(() => {
    const engagementSet = new Set<string>();
    const toolSet = new Set<string>();
    const map = new Map<string, HoursSavedRow>();
    for (const r of rows) {
      engagementSet.add(r.projectCode);
      toolSet.add(r.aiTool);
      map.set(`${r.projectCode}:::${r.aiTool}`, r);
    }
    return {
      engagementCodes: Array.from(engagementSet).sort(),
      tools: Array.from(toolSet).sort(),
      cellMap: map,
    };
  }, [rows]);

  // Matches an engagement by its own code, or by having a tracked row for a
  // tool whose label matches -- e.g. searching "factory" narrows to
  // engagements that actually use Factory AI, not just any engagement.
  const filteredEngagementCodes = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return engagementCodes;
    return engagementCodes.filter(
      (eng) =>
        eng.toLowerCase().includes(term) ||
        tools.some((t) => (TOOL_LABELS[t] || t).toLowerCase().includes(term) && cellMap.has(`${eng}:::${t}`))
    );
  }, [engagementCodes, tools, cellMap, search]);

  const sortedEngagementCodes = useMemo(() => {
    if (!sortColumn) return filteredEngagementCodes;
    const dir = sortDir === 'asc' ? 1 : -1;
    const getValue = (eng: string): string | number | null => {
      if (sortColumn === 'engagementCode') return eng;
      const row = cellMap.get(`${eng}:::${sortColumn}`);
      return row ? row[metric] : null;
    };
    return [...filteredEngagementCodes].sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);
      if (va === vb) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb), undefined, { numeric: true }) * dir;
    });
  }, [filteredEngagementCodes, cellMap, metric, sortColumn, sortDir]);

  // Paginated by engagement ROW -- the tool columns stay fixed (there are
  // only ever a handful of tools), so pagination only needs to limit how
  // many engagement rows render at once.
  const totalPages = Math.ceil(sortedEngagementCodes.length / PAGE_SIZE) || 1;
  const paginatedEngagementCodes = sortedEngagementCodes.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const config = METRIC_CONFIG[metric];
  const allValuesForMetric = useMemo(() => {
    const vals: number[] = [];
    for (const r of rows) {
      const v = r[metric];
      if (v !== null) vals.push(v as number);
    }
    return vals;
  }, [rows, metric]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-ey-muted font-semibold uppercase tracking-wider">Cell Metric:</span>
          {(Object.keys(METRIC_CONFIG) as Metric[]).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition ${
                metric === m
                  ? 'bg-ey-yellow/20 text-ey-yellow border-ey-yellow/40'
                  : 'bg-ey-black border-ey-border text-ey-muted hover:text-ey-light'
              }`}
            >
              {METRIC_CONFIG[m].label}
            </button>
          ))}
        </div>

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
      <p className="text-[10px] text-ey-muted -mt-1">
        Click Engagement Code to sort alphabetically, or a tool column to rank engagements by that tool&apos;s {config.label.toLowerCase()}.
      </p>

      <div className="overflow-x-auto border border-ey-border rounded-xl">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-ey-black/70 text-ey-muted uppercase tracking-wider border-b border-ey-border">
            <tr>
              <SortableTh
                label="Engagement Code"
                sortKey="engagementCode"
                activeKey={sortColumn}
                direction={sortDir}
                onSort={handleSort}
                className="px-4 py-3 sticky left-0 bg-ey-black/70"
              />
              {tools.map((t) => (
                <SortableTh
                  key={t}
                  label={TOOL_LABELS[t] || t}
                  sortKey={t}
                  activeKey={sortColumn}
                  direction={sortDir}
                  onSort={handleSort}
                  className="px-4 py-3 text-right whitespace-nowrap"
                  align="right"
                />
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ey-border">
            {paginatedEngagementCodes.length === 0 ? (
              <tr>
                <td colSpan={tools.length + 1} className="px-4 py-8 text-center text-ey-muted">
                  No matching engagements or tools.
                </td>
              </tr>
            ) : (
            paginatedEngagementCodes.map((eng) => (
              <tr key={eng} className="hover:bg-ey-card-hover/60 transition">
                <td
                  className="px-4 py-3 font-semibold text-ey-light cursor-pointer hover:text-ey-yellow sticky left-0 bg-ey-card"
                  onClick={() => onSelectEngagement(eng)}
                >
                  {eng}
                </td>
                {tools.map((t) => {
                  const row = cellMap.get(`${eng}:::${t}`);
                  const value = row ? row[metric] : null;
                  return (
                    <td
                      key={t}
                      className={`px-4 py-3 text-right ${row ? 'cursor-pointer' : ''}`}
                      onClick={() => row && onSelectEngagement(eng)}
                    >
                      {value !== null && value !== undefined ? (
                        <span className={`font-bold ${config.colorCode ? cellColor(value as number, allValuesForMetric, config.lowerIsBetter) : 'text-ey-light'}`}>
                          {config.format(value as number)}
                        </span>
                      ) : (
                        <span className="text-ey-muted/40">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))
            )}
          </tbody>
        </table>
      </div>

      {config.colorCode && (
        <p className="text-[10px] text-ey-muted">
          <span className="text-emerald-300 font-bold">Green</span> = best third &middot;{' '}
          <span className="text-ey-yellow font-bold">Amber</span> = middle third &middot;{' '}
          <span className="text-rose-300 font-bold">Red</span> = worst third, relative to every tracked pair.
        </p>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1 text-xs text-ey-muted">
          <div>
            Showing {sortedEngagementCodes.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(currentPage * PAGE_SIZE, sortedEngagementCodes.length)} of {sortedEngagementCodes.length} engagements
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
