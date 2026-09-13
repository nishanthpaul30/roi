'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft,
  Zap,
  DollarSign,
  Users,
  Coins,
  Building2,
  Globe2,
  Layers,
  FolderKanban,
  CheckCircle2,
  AlertCircle,
  Search,
  ChevronRight,
  Filter,
  FileSpreadsheet,
  ArrowUpRight,
  Database,
  Calendar,
  X,
} from 'lucide-react';
import { MetricChart } from '@/components/ui/MetricChart';
import { DrilldownMetricData } from '@/components/ui/MetricDrilldownModal';
import { loadCsvData, CsvUsageRow } from '@/lib/data/csvLoader';
import { HierarchyDrilldownPanel, PathEntry } from './HierarchyDrilldownPanel';

interface SubDrilldownState {
  type: 'tool' | 'service_line' | 'region' | 'project_code' | 'user';
  id: string;
  name: string;
  subtitle?: string;
}

interface ExecutiveMetricDrilldownViewProps {
  data: DrilldownMetricData;
  onBack: () => void;
}

const fmtMoney = (v: number) => `$${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtTokens = (v: number) => new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(v || 0);

// The CT/Non-CT tiles sit on every KPI's Level 1 view — the headline figure on
// each tile should match whatever that specific metric measures (a day-rate,
// a per-user rate, a token count, or a raw spend total), not just always repeat
// the segment's total spend regardless of which metric is being viewed.
function ctNonCtSegmentDisplay(metricId: string, segment: { cost: number; tokens: number; userCount?: number; uniqueDays?: number; uniqueMonths?: number }, totalCost?: number) {
  const pct = totalCost ? ((segment.cost / totalCost) * 100).toFixed(1) : '0.0';

  if (metricId === 'avg_daily_cost') {
    const days = segment.uniqueDays || 0;
    const perDay = days > 0 ? segment.cost / days : 0;
    return {
      primary: `$${perDay.toFixed(2)} / day`,
      footnote: `${fmtMoney(segment.cost)} total across ${days} active day${days === 1 ? '' : 's'}`,
    };
  }
  if (metricId === 'avg_monthly_cost') {
    const months = segment.uniqueMonths || 0;
    const perMonth = months > 0 ? segment.cost / months : 0;
    return {
      primary: `$${perMonth.toFixed(2)} / month`,
      footnote: `${fmtMoney(segment.cost)} total across ${months} active month${months === 1 ? '' : 's'}`,
    };
  }
  if (metricId === 'cost_per_user') {
    const users = segment.userCount || 0;
    const perUser = users > 0 ? segment.cost / users : 0;
    return {
      primary: `$${perUser.toFixed(2)} / user`,
      footnote: `${fmtMoney(segment.cost)} across ${users} user${users === 1 ? '' : 's'}`,
    };
  }
  if (metricId === 'token_consumption') {
    return {
      primary: `${fmtTokens(segment.tokens)} tokens`,
      footnote: `${fmtMoney(segment.cost)} spend (${pct}% of total)`,
    };
  }
  // total_investment (default)
  return {
    primary: fmtMoney(segment.cost),
    footnote: `${pct}% of total · ${fmtTokens(segment.tokens)} tokens`,
  };
}

export function ExecutiveMetricDrilldownView({ data, onBack }: ExecutiveMetricDrilldownViewProps) {
  const { id, title, subtitle, currentValue, deltaText, trend, series, summaryData } = data;

  // Level 3 Deep-Dive Sub-Drilldown State
  const [subDrilldown, setSubDrilldown] = useState<SubDrilldownState | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [inspectingRow, setInspectingRow] = useState<CsvUsageRow | null>(null);

  // Pre-hierarchy facet selection: clicking a tool/service line/region/engagement code
  // narrows to that facet's rows, then hands off to the mandated hierarchy navigator
  // instead of jumping straight to a list of named users.
  const [pendingFacet, setPendingFacet] = useState<{ field: keyof CsvUsageRow; value: string; label: string } | null>(null);

  // Tracks how far the mandated hierarchy panel below has been drilled (Country,
  // Service Line, ...) so the trend chart above it can be re-scoped to match,
  // instead of always showing the org-wide/unfiltered daily series.
  const [hierarchyPath, setHierarchyPath] = useState<PathEntry[]>([]);

  const chooseFacet = (facet: { field: keyof CsvUsageRow; value: string; label: string }) => {
    setPendingFacet(facet);
    setHierarchyPath([]);
  };
  const clearFacet = () => {
    setPendingFacet(null);
    setHierarchyPath([]);
  };

  // Listen for Escape key to go back intuitively
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (inspectingRow) {
          setInspectingRow(null);
        } else if (subDrilldown) {
          setSubDrilldown(null);
          setSearchTerm('');
          setCurrentPage(1);
        } else if (pendingFacet) {
          clearFacet();
        } else {
          onBack();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inspectingRow, subDrilldown, pendingFacet, onBack]);

  // Load all CSV rows synchronously from memory for Level 3 filtering
  const allRows = useMemo(() => {
    try {
      return loadCsvData();
    } catch (_err) {
      return [];
    }
  }, []);

  // Filter raw rows for Level 3 Granular Record View
  const granularRows = useMemo(() => {
    if (!subDrilldown) return [];
    const { type, name } = subDrilldown;
    const lowerName = name.toLowerCase();

    return allRows.filter((r) => {
      if (type === 'tool') return r.aiTool.toLowerCase() === lowerName;
      if (type === 'service_line') return r.orgServiceLine.toLowerCase() === lowerName;
      if (type === 'region') return r.managementRegion.toLowerCase() === lowerName;
      if (type === 'project_code') return (r.projectCode || '').toLowerCase() === lowerName;
      if (type === 'user') return r.userMail.toLowerCase() === lowerName || r.displayName.toLowerCase() === lowerName;
      return true;
    });
  }, [allRows, subDrilldown]);

  // Level 3 Granular Search & Pagination
  const filteredGranularRows = useMemo(() => {
    if (!searchTerm.trim()) return granularRows;
    const s = searchTerm.toLowerCase();
    return granularRows.filter(
      (r) =>
        r.displayName.toLowerCase().includes(s) ||
        r.userMail.toLowerCase().includes(s) ||
        r.aiTool.toLowerCase().includes(s) ||
        (r.projectCode || '').toLowerCase().includes(s) ||
        r.orgServiceLine.toLowerCase().includes(s) ||
        r.activityDate.includes(s)
    );
  }, [granularRows, searchTerm]);

  const totalPages = Math.ceil(filteredGranularRows.length / itemsPerPage) || 1;
  const paginatedGranularRows = filteredGranularRows.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Level 3 Granular Aggregates
  const level3TotalCost = useMemo(() => granularRows.reduce((acc, r) => acc + r.cost, 0), [granularRows]);
  const level3TotalTokens = useMemo(() => granularRows.reduce((acc, r) => acc + r.tokenConsumption, 0), [granularRows]);
  const level3BillableRows = useMemo(
    () => granularRows.filter((r) => r.billableFlag === 'True' || r.billableFlag === 'true').length,
    [granularRows]
  );

  const byTool = summaryData?.byAiTool || [];
  const byCtNonCt = summaryData?.byCtNonCt || [];
  const byRegion = summaryData?.byManagementRegion || [];
  const byServiceLine = summaryData?.byServiceLine || [];
  const topUsers = summaryData?.topUsers || [];
  const byProjectCode = summaryData?.byProjectCode || [];

  // Rows currently in scope for the trend chart: the org-wide filtered set, narrowed
  // by whatever facet (CT/Non-CT, tool, region, ...) and hierarchy levels have been
  // drilled into below it — so the chart never silently shows a bigger population
  // than the tiles/table the viewer is actually looking at.
  const scopedRows = useMemo(() => {
    if (!pendingFacet && hierarchyPath.length === 0) return null;
    let rows = pendingFacet
      ? allRows.filter((r) => String(r[pendingFacet.field] || '').toLowerCase() === pendingFacet.value.toLowerCase())
      : allRows;
    for (const p of hierarchyPath) {
      rows = rows.filter((r) => String(r[p.field] || '').trim() === p.value);
    }
    return rows;
  }, [allRows, pendingFacet, hierarchyPath]);

  const chartTitleSuffix = (() => {
    // When the facet IS the ctNonCt level, HierarchyDrilldownPanel's initialPath
    // already reports that same value as hierarchyPath[0] — skip re-adding it
    // here or the label would read "Non-CT › Non-CT".
    const parts: string[] = [];
    if (pendingFacet && pendingFacet.field !== 'ctNonCt') parts.push(pendingFacet.value);
    parts.push(...hierarchyPath.map((p) => p.value));
    return parts.length > 0 ? ` — ${parts.join(' › ')}` : '';
  })();

  const chartSeries = useMemo(() => {
    if (!scopedRows) return series;
    const dayMap = new Map<string, number>();
    for (const r of scopedRows) {
      const val = id === 'token_consumption' ? r.tokenConsumption : r.cost;
      dayMap.set(r.activityDate, (dayMap.get(r.activityDate) || 0) + val);
    }
    return Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ date, value: Number(value.toFixed(4)) }));
  }, [scopedRows, series, id]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ========================================================================= */}
      {/* BREADCRUMB CONTEXT HEADER                                                 */}
      {/* ========================================================================= */}
      <div className="bg-ey-card border border-ey-border rounded-2xl px-4 py-3 shadow-sm flex flex-wrap items-center justify-between gap-3 animate-fade-in">
        {/* Breadcrumb Trail */}
        <nav className="flex items-center flex-wrap gap-1.5 text-xs font-mono">
          <button
            onClick={onBack}
            className="text-ey-muted hover:text-ey-yellow transition-colors font-semibold flex items-center gap-1 cursor-pointer"
          >
            <span>Overview</span>
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-ey-border shrink-0" />

          <button
            onClick={() => {
              if (subDrilldown) {
                setSubDrilldown(null);
                setSearchTerm('');
                setCurrentPage(1);
              }
              if (pendingFacet) {
                clearFacet();
              }
            }}
            className={`${
              subDrilldown || pendingFacet ? 'text-ey-muted hover:text-ey-yellow cursor-pointer' : 'text-ey-yellow font-bold'
            } transition-colors flex items-center gap-1`}
          >
            <span>Level 1: {title}</span>
          </button>

          {subDrilldown && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-ey-border shrink-0" />
              <span className="text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded flex items-center gap-1">
                <span>{subDrilldown.name}</span>
                <span className="text-[10px] text-emerald-300/80 font-normal">
                  ({subDrilldown.type.replace('_', ' ')})
                </span>
              </span>
            </>
          )}
        </nav>
      </div>

      {/* Metric Context Card */}
      <div className="bg-ey-card border border-ey-border rounded-2xl p-5 shadow-sm space-y-3">

        {/* Title & Highlight */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-ey-border/40">
          <div>
            <h1 className="text-xl font-bold text-ey-light tracking-tight flex items-center gap-3">
              <span>{subDrilldown ? `End-Level Telemetry: ${subDrilldown.name}` : title}</span>
              <span className="text-xl font-extrabold text-ey-yellow font-mono">
                {subDrilldown ? `$${level3TotalCost.toFixed(2)}` : currentValue}
              </span>
            </h1>
            <p className="text-xs text-ey-muted mt-0.5">
              {subDrilldown
                ? `Inspecting ${granularRows.length} raw usage log entries for ${subDrilldown.name}`
                : subtitle}
            </p>
          </div>

          <div className="flex items-center space-x-2 text-xs font-mono bg-ey-black/60 border border-ey-border px-3 py-1.5 rounded-xl shrink-0">
            <span className="text-ey-muted">Status:</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              {subDrilldown ? `${granularRows.length} Log Entries` : 'Level 1 Telemetry Active'}
            </span>
          </div>
        </div>

        {/* CT / Non-CT Spend Segregation — prominent, clickable drill-down tiles, shown for every metric */}
        {!subDrilldown && !pendingFacet && byCtNonCt.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {byCtNonCt.map((c: any) => {
              const seg = ctNonCtSegmentDisplay(id, c, summaryData?.totalCost);
              return (
                <button
                  key={c.ctNonCt}
                  onClick={() => chooseFacet({ field: 'ctNonCt', value: c.ctNonCt, label: 'CT / Non-CT Spend Segregation' })}
                  title={`Click to drill down into ${c.ctNonCt} hierarchy`}
                  className="w-full flex items-center justify-between gap-3 bg-cyan-500/10 hover:bg-cyan-500/20 border-2 border-cyan-500/40 hover:border-cyan-400 px-4 py-3.5 rounded-2xl transition-all cursor-pointer group text-left shadow-sm hover:shadow-lg hover:shadow-cyan-500/10"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-cyan-300 font-extrabold text-xs uppercase tracking-wider">{c.ctNonCt}</span>
                      <span className="text-[9px] text-cyan-400 font-bold uppercase tracking-wider bg-cyan-500/15 px-1.5 py-0.5 rounded border border-cyan-500/30 opacity-0 group-hover:opacity-100 transition-opacity">
                        Click to drill down
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-extrabold text-ey-light font-mono group-hover:text-cyan-200 transition-colors">
                        {seg.primary}
                      </span>
                    </div>
                    <p className="text-[11px] text-ey-muted mt-0.5">{seg.footnote}</p>
                  </div>
                  <div className="p-2 bg-cyan-500/15 border border-cyan-500/40 rounded-xl text-cyan-300 group-hover:bg-cyan-500/25 group-hover:scale-110 transition-all shrink-0">
                    <ArrowUpRight className="w-5 h-5" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* LEVEL 3: END-LEVEL GRANULAR USAGE LOGS VIEW (When an entity is selected)  */}
      {/* ========================================================================= */}
      {subDrilldown ? (
        <div className="space-y-6">
          {/* Level 3 KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
            <div className="bg-ey-card border border-ey-border p-4 rounded-xl space-y-1">
              <span className="text-ey-muted text-[10px] uppercase font-bold">Total Billed Spend</span>
              <p className="text-xl font-bold text-ey-yellow">${level3TotalCost.toFixed(4)}</p>
              <p className="text-[10px] text-ey-muted">{granularRows.length} usage events</p>
            </div>

            <div className="bg-ey-card border border-ey-border p-4 rounded-xl space-y-1">
              <span className="text-ey-muted text-[10px] uppercase font-bold">Total Token Volume</span>
              <p className="text-xl font-bold text-ey-light">{level3TotalTokens.toLocaleString()}</p>
              <p className="text-[10px] text-ey-muted">Prompt + Completion</p>
            </div>

            <div className="bg-ey-card border border-ey-border p-4 rounded-xl space-y-1">
              <span className="text-ey-muted text-[10px] uppercase font-bold">Billable Log Entries</span>
              <p className="text-xl font-bold text-emerald-400">{level3BillableRows} / {granularRows.length}</p>
              <p className="text-[10px] text-emerald-300">
                {granularRows.length > 0 ? ((level3BillableRows / granularRows.length) * 100).toFixed(1) : 0}% Billable
              </p>
            </div>

            <div className="bg-ey-card border border-ey-border p-4 rounded-xl space-y-1">
              <span className="text-ey-muted text-[10px] uppercase font-bold">Entity Type</span>
              <p className="text-xl font-bold text-cyan-300 capitalize">{subDrilldown.type.replace('_', ' ')}</p>
              <p className="text-[10px] text-ey-muted truncate">{subDrilldown.name}</p>
            </div>
          </div>

          {/* Granular Usage Log Entries Table */}
          <div className="bg-ey-card border border-ey-border rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-ey-light flex items-center space-x-2">
                  <FileSpreadsheet className="w-5 h-5 text-ey-yellow" />
                  <span>End-Level Usage Log Telemetry Records</span>
                </h3>
                <p className="text-xs text-ey-muted mt-0.5">
                  Raw row-level CSV usage records matching <strong className="text-ey-light">{subDrilldown.name}</strong>.
                </p>
              </div>

              {/* Search input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-ey-muted absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter records..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-ey-black border border-ey-border text-ey-light text-xs rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:border-ey-yellow w-56"
                />
              </div>
            </div>

            {/* Granular Table */}
            <div className="overflow-x-auto border border-ey-border rounded-xl">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-ey-black/60 text-ey-muted uppercase tracking-wider border-b border-ey-border">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">User &amp; Email</th>
                    <th className="px-4 py-3">AI Tool</th>
                    <th className="px-4 py-3">Engagement Code</th>
                    <th className="px-4 py-3">Service Line</th>
                    <th className="px-4 py-3 text-center">Billable</th>
                    <th className="px-4 py-3 text-right">Tokens</th>
                    <th className="px-4 py-3 text-right">Cost (USD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ey-border">
                  {paginatedGranularRows.length > 0 ? (
                    paginatedGranularRows.map((r, idx) => (
                      <tr key={idx} className="hover:bg-ey-card-hover/80 transition">
                        <td className="px-4 py-3 text-ey-muted whitespace-nowrap">{r.activityDate}</td>
                        <td className="px-4 py-3 font-medium text-ey-light">
                          <div>{r.displayName}</div>
                          <div className="text-[10px] text-ey-muted">{r.userMail}</div>
                        </td>
                        <td className="px-4 py-3 capitalize text-ey-yellow">{r.aiTool}</td>
                        <td className="px-4 py-3">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] border ${
                            (r.projectCode || '').startsWith('E-') ? 'bg-blue-500/10 text-blue-300 border-blue-500/30' : 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                          }`}>
                            {r.projectCode || 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-ey-muted">{r.orgServiceLine}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.billableFlag === 'True' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          }`}>
                            {r.billableFlag}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-ey-light">{r.tokenConsumption.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-bold text-ey-yellow">${r.cost.toFixed(4)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-ey-muted">
                        No usage records found for {subDrilldown.name}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2 text-xs text-ey-muted font-mono">
                <div>
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredGranularRows.length)} of {filteredGranularRows.length} records
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 bg-ey-black border border-ey-border rounded-lg hover:bg-ey-card-hover disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span>Page {currentPage} of {totalPages}</span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 bg-ey-black border border-ey-border rounded-lg hover:bg-ey-card-hover disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* LEVEL 2: MIDDLE TELEMETRY BREAKDOWN VIEW (Click any card/row to Level 3)  */
        /* ========================================================================= */
        <div className="space-y-6">
          {pendingFacet ? (
            <>
              <button
                onClick={() => clearFacet()}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-ey-muted hover:text-ey-yellow bg-ey-black border border-ey-border px-3 py-1.5 rounded-lg transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to {pendingFacet.label}
              </button>
              <HierarchyDrilldownPanel
                rows={allRows.filter((r) => String(r[pendingFacet.field] || '').toLowerCase() === pendingFacet.value.toLowerCase())}
                title={`Level 3: ${pendingFacet.value} Hierarchy`}
                initialPath={
                  pendingFacet.field === 'ctNonCt'
                    ? [{ levelId: 'ctNonCt', field: 'ctNonCt', fieldLabel: 'CT / Non-CT', value: pendingFacet.value }]
                    : undefined
                }
                onPathChange={setHierarchyPath}
                onSelectUser={(email, label) =>
                  setSubDrilldown({ type: 'user', id: email, name: email, subtitle: `Raw usage records for ${label}` })
                }
              />
            </>
          ) : (
          <>
          {/* Metric Specific Deep-Dive Panels with Level 3 Click Triggers */}
          {id === 'token_consumption' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Tool Token Volume Shares -> Level 3 Trigger */}
              <div className="bg-ey-card border border-ey-border rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-ey-border pb-3">
                  <h3 className="text-sm font-bold text-ey-light uppercase tracking-wider flex items-center gap-2">
                    <Layers className="w-4 h-4 text-ey-yellow" />
                    <span>Token Share by AI Tool</span>
                  </h3>
                  <span className="text-[10px] font-mono text-ey-yellow">Click tool for log records 🔍</span>
                </div>
                <div className="space-y-3 text-xs font-mono">
                  {byTool.map((t: any) => {
                    const pct = summaryData?.totalTokenConsumption ? ((t.tokens / summaryData.totalTokenConsumption) * 100).toFixed(1) : 0;
                    return (
                      <div
                        key={t.tool}
                        onClick={() => chooseFacet({ field: 'aiTool', value: t.tool, label: 'Token Share by AI Tool' })}
                        className="space-y-1.5 bg-ey-black/40 border border-ey-border/60 hover:border-ey-yellow/60 p-3 rounded-xl cursor-pointer transition group"
                      >
                        <div className="flex justify-between items-center text-ey-light group-hover:text-ey-yellow">
                          <span className="capitalize font-bold text-sm flex items-center gap-1.5">
                            <span>{t.tool}</span>
                            <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </span>
                          <span>{t.tokens.toLocaleString()} tokens ({pct}%)</span>
                        </div>
                        <div className="w-full bg-ey-black rounded-full h-2 overflow-hidden border border-ey-border">
                          <div className="bg-ey-yellow h-full transition-all duration-300" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Service Line Token Volume -> Level 3 Trigger */}
              <div className="bg-ey-card border border-ey-border rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-ey-border pb-3">
                  <h3 className="text-sm font-bold text-ey-light uppercase tracking-wider flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-cyan-400" />
                    <span>Service Line Token Allocation</span>
                  </h3>
                  <span className="text-[10px] font-mono text-cyan-400">Click unit for log records 🔍</span>
                </div>
                <div className="space-y-3 text-xs font-mono">
                  {byServiceLine.map((s: any) => (
                    <div
                      key={s.serviceLine}
                      onClick={() => chooseFacet({ field: 'orgServiceLine', value: s.serviceLine, label: 'Service Line Token Allocation' })}
                      className="flex items-center justify-between p-3 bg-ey-black/40 border border-ey-border/60 hover:border-cyan-400/60 rounded-xl cursor-pointer transition group"
                    >
                      <span className="text-ey-light font-bold text-sm group-hover:text-cyan-300 flex items-center gap-1.5">
                        <span>{s.serviceLine}</span>
                        <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </span>
                      <span className="text-cyan-300 font-bold">{s.tokens.toLocaleString()} tokens</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {id === 'total_investment' && (
            <div className="space-y-6">
              {/* Billability KPI Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                <div
                  onClick={() => chooseFacet({ field: 'billableFlag', value: 'True', label: 'Billable Client Spend' })}
                  className="bg-ey-card border border-emerald-500/30 hover:border-emerald-400/80 p-4 rounded-2xl space-y-1 shadow-sm cursor-pointer transition group"
                >
                  <div className="flex items-center justify-between text-ey-muted">
                    <span className="flex items-center gap-1.5">
                      <span>Billable Client Spend</span>
                      <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-emerald-400" />
                    </span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <p className="text-2xl font-extrabold text-emerald-400">${(summaryData?.billableSpend || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  <p className="text-xs text-emerald-300">{summaryData?.billableSpendPercent}% of total AI investment</p>
                </div>

                <div
                  onClick={() => chooseFacet({ field: 'billableFlag', value: 'False', label: 'Non-Billable Overhead' })}
                  className="bg-ey-card border border-amber-500/30 hover:border-amber-400/80 p-4 rounded-2xl space-y-1 shadow-sm cursor-pointer transition group"
                >
                  <div className="flex items-center justify-between text-ey-muted">
                    <span className="flex items-center gap-1.5">
                      <span>Non-Billable Overhead</span>
                      <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-amber-400" />
                    </span>
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="text-2xl font-extrabold text-amber-400">${(summaryData?.nonBillableSpend || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  <p className="text-xs text-amber-300">{(100 - (summaryData?.billableSpendPercent || 0)).toFixed(1)}% operational cost</p>
                </div>
              </div>

              {/* Regional Spend Grid -> Level 3 Trigger */}
              <div className="bg-ey-card border border-ey-border rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-ey-border pb-3">
                  <h3 className="text-sm font-bold text-ey-light uppercase tracking-wider flex items-center gap-2">
                    <Globe2 className="w-4 h-4 text-ey-yellow" />
                    <span>Regional Spend Breakdown</span>
                  </h3>
                  <span className="text-[10px] font-mono text-ey-yellow">Click region for log records 🔍</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
                  {byRegion.map((r: any) => (
                    <div
                      key={r.region}
                      onClick={() => chooseFacet({ field: 'managementRegion', value: r.region, label: 'Regional Spend Breakdown' })}
                      className="bg-ey-black/60 border border-ey-border hover:border-ey-yellow/60 p-4 rounded-xl space-y-1 cursor-pointer transition group"
                    >
                      <span className="text-ey-muted text-[10px] uppercase font-bold group-hover:text-ey-yellow flex items-center justify-between">
                        <span>{r.region} Region</span>
                        <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-ey-yellow" />
                      </span>
                      <p className="text-xl font-bold text-ey-yellow">${r.cost.toFixed(2)}</p>
                      <p className="text-ey-muted text-[11px]">{r.tokens.toLocaleString()} tokens</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {id === 'cost_per_user' && (
            <HierarchyDrilldownPanel
              rows={allRows}
              title="Level 3: Developer Seat & Active User Hierarchy"
              onPathChange={setHierarchyPath}
              onSelectUser={(email, label) =>
                setSubDrilldown({ type: 'user', id: email, name: email, subtitle: `Raw usage records for ${label}` })
              }
            />
          )}

          {/* Top Engagement Codes Telemetry Grid -> Level 3 Trigger */}
          {byProjectCode.length > 0 && (
            <div className="bg-ey-card border border-ey-border rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-ey-border pb-3">
                <h3 className="text-sm font-bold text-ey-light uppercase tracking-wider flex items-center gap-2">
                  <FolderKanban className="w-4 h-4 text-blue-400" />
                  <span>Top Associated Engagement Codes</span>
                </h3>
                <span className="text-[10px] font-mono text-blue-400">Click project code for log records 🔍</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
                {byProjectCode.slice(0, 8).map((p: any) => (
                  <div
                    key={p.projectCode}
                    onClick={() =>
                      chooseFacet({ field: 'projectCode', value: p.projectCode, label: 'Top Associated Engagement Codes' })
                    }
                    className="p-3 bg-ey-black/60 border border-ey-border hover:border-blue-400/60 rounded-xl flex items-center justify-between cursor-pointer transition group"
                  >
                    <div>
                      <p className="font-bold text-ey-light group-hover:text-blue-300 flex items-center gap-1">
                        <span>{p.projectCode}</span>
                        <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-blue-300" />
                      </p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-purple-500/15 text-purple-300">
                        {p.userCount} users
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-ey-yellow">${p.cost.toFixed(2)}</p>
                      <p className="text-[10px] text-ey-muted">{p.tokens.toLocaleString()} tok</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          </>
          )}

          {/* Main Time Series Trend Chart */}
          <div className="bg-ey-card border border-ey-border rounded-2xl p-6 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-ey-border/60 pb-3">
              <h3 className="text-base font-bold text-ey-light flex items-center gap-2">
                <Zap className="w-5 h-5 text-ey-yellow" />
                <span>Daily Telemetry Movement &amp; Run-Rate</span>
              </h3>
            </div>

            <MetricChart
              title={`${title} Trend Over Filtered Range${chartTitleSuffix}`}
              subtitle={
                scopedRows
                  ? `Daily aggregated telemetry data points, scoped to the current drill-down`
                  : 'Daily aggregated telemetry data points'
              }
              data={chartSeries}
              chartType="area"
              series={[{ key: 'value', name: title, color: '#FFE600' }]}
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* FLOATING QUICK-RETURN BUTTON (PERSISTENT ON SCREEN)                       */}
      {/* ========================================================================= */}
      <div className="fixed bottom-6 right-6 z-40 flex items-center space-x-2 animate-fade-in shadow-2xl">
        <button
          onClick={() => {
            if (subDrilldown) {
              setSubDrilldown(null);
              setSearchTerm('');
              setCurrentPage(1);
            } else if (pendingFacet) {
              clearFacet();
            } else {
              onBack();
            }
          }}
          className="flex items-center space-x-2 px-4 py-2.5 bg-ey-yellow hover:bg-yellow-400 text-ey-black font-extrabold text-xs rounded-full shadow-2xl border-2 border-ey-black transition-all transform hover:scale-105 cursor-pointer"
          title="Return to previous screen (Esc)"
        >
          <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
          <span>{subDrilldown || pendingFacet ? `Back to ${title}` : 'Back to Overview'}</span>
          <kbd className="text-[10px] bg-black/20 text-ey-black px-1.5 py-0.5 rounded font-mono font-bold">Esc</kbd>
        </button>

        {(subDrilldown || pendingFacet) && (
          <button
            onClick={onBack}
            className="p-2.5 bg-ey-black hover:bg-ey-card text-ey-light hover:text-ey-yellow border border-ey-border hover:border-ey-yellow rounded-full shadow-2xl transition cursor-pointer"
            title="Exit Drilldown to Overview"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

