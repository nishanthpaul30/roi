'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useMetricsData } from '@/hooks/useMetricsData';
import { GlobalFilterBar } from '@/components/layout/GlobalFilterBar';
import { ExplorerChart } from '@/components/ui/ExplorerChart';
import { DataTable, Column } from '@/components/ui/DataTable';
import { LayoutGrid, Sparkles, Download, SlidersHorizontal, RotateCcw, ChevronDown, ChevronUp, CalendarRange, AlertTriangle } from 'lucide-react';
import { formatCompactCurrency, formatCompactNumber } from '@/lib/format';

interface DimensionOption {
  key: string;
  label: string;
}

interface PeriodMonthOption {
  value: string;
  label: string;
  start: string;
  end: string;
}

interface PivotResult {
  rowDim: string;
  rowDimLabel: string;
  colDim: string;
  colDimLabel: string;
  metric: string;
  metricLabel: string;
  columns: string[];
  rows: Record<string, any>[];
}

interface DatasetInsights {
  totalRecords: number;
  usageRecords: number;
  licenseRecords: number;
  distinctUsers: number;
  activeUsers: number;
  dormantUsers: number;
  distinctTools: number;
  topTool: { name: string; cost: number } | null;
  distinctCountries: number;
  topCountry: { name: string; userCount: number } | null;
  distinctMonths: number;
  dateRangeLabel: string;
  totalCost: number;
  totalUsageCost: number;
  totalTokens: number;
  totalLicenseCost: number;
}

export default function DataExplorerPage() {
  const { filters, setFilters, data } = useMetricsData();

  const [dimensions, setDimensions] = useState<DimensionOption[]>([]);
  const [metrics, setMetrics] = useState<DimensionOption[]>([]);
  const [rowDim, setRowDim] = useState('ctNonCt');
  const [colDim, setColDim] = useState('none');
  const [metric, setMetric] = useState('cost');
  const [result, setResult] = useState<PivotResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [insights, setInsights] = useState<DatasetInsights | null>(null);

  useEffect(() => {
    fetch('/api/metrics/dataset-insights')
      .then((res) => res.json())
      .then(setInsights)
      .catch((err) => console.error('Failed to load dataset insights:', err));
  }, []);

  // Start/End Period — this page's own date filter, entirely independent of
  // the shared GlobalFilterBar (which is disabled here; see the header). Both
  // are optional and, when set, are inclusive of the whole selected month.
  const periodMonths: PeriodMonthOption[] = data?.filterOptions?.months ?? [];
  const [startPeriod, setStartPeriod] = useState('');
  const [endPeriod, setEndPeriod] = useState('');

  const startPeriodMonth = periodMonths.find((m) => m.value === startPeriod);
  const endPeriodMonth = periodMonths.find((m) => m.value === endPeriod);

  // "YYYY-MM" values sort chronologically as plain strings.
  const periodError =
    startPeriod && endPeriod && endPeriod < startPeriod
      ? 'End Period must be the same as or later than Start Period.'
      : null;

  // Only feed a valid, resolved period into the query — an unset side leaves
  // that end open (falls back to the full dataset range server-side), and an
  // invalid combination is ignored entirely until corrected.
  const periodDateRange = periodError
    ? { start: undefined, end: undefined }
    : { start: startPeriodMonth?.start, end: endPeriodMonth?.end };

  // Extra filters this page exposes beyond the shared GlobalFilterBar — every
  // dimension with no dedicated panel elsewhere (Engagement chain, GDS
  // Location, Cost Center, Calculation Method, Billable flag, etc.).
  const [extraFilterDimensions, setExtraFilterDimensions] = useState<DimensionOption[]>([]);
  const [extraFilterOptions, setExtraFilterOptions] = useState<Record<string, string[]>>({});
  const [extraFilters, setExtraFilters] = useState<Record<string, string>>({});
  const [showExtraFilters, setShowExtraFilters] = useState(false);

  // A dimension already chosen as Rows or Columns has its own filter hidden —
  // filtering to one value of the exact field you're breaking down by just
  // duplicates the breakdown and adds clutter.
  const visibleExtraFilterDimensions = useMemo(
    () => extraFilterDimensions.filter((d) => d.key !== rowDim && d.key !== colDim),
    [extraFilterDimensions, rowDim, colDim]
  );
  const activeExtraFilterCount = visibleExtraFilterDimensions.filter(
    (d) => extraFilters[d.key] && extraFilters[d.key] !== 'all'
  ).length;

  const handleRowDimChange = (value: string) => {
    setRowDim(value);
    // Same field can't stay both a breakdown axis and a hidden active filter.
    setExtraFilters((prev) => (prev[value] && prev[value] !== 'all' ? { ...prev, [value]: 'all' } : prev));
    if (value === colDim) setColDim('none');
  };

  const handleColDimChange = (value: string) => {
    setColDim(value);
    setExtraFilters((prev) => (prev[value] && prev[value] !== 'all' ? { ...prev, [value]: 'all' } : prev));
  };

  const loadPivot = useCallback(async () => {
    // An invalid Start/End Period combination blocks the query entirely
    // rather than silently falling back to the full dataset.
    if (periodError) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ rowDim, colDim, metric });
      // Deliberately not sourced from the (disabled) GlobalFilterBar — this
      // page's own Start/End Period pickers and Additional Filters are the
      // only things allowed to scope what it shows.
      if (periodDateRange.start) params.set('startDate', periodDateRange.start);
      if (periodDateRange.end) params.set('endDate', periodDateRange.end);
      for (const [key, value] of Object.entries(extraFilters)) {
        if (value && value !== 'all') params.set(key, value);
      }
      const res = await fetch(`/api/metrics/pivot?${params.toString()}`);
      const json = await res.json();
      setResult(json.result);
      setDimensions(json.dimensions || []);
      setMetrics(json.metrics || []);
      setExtraFilterDimensions(json.extraFilterDimensions || []);
      setExtraFilterOptions(json.extraFilterOptions || {});
    } catch (err) {
      console.error('Failed to load pivot data:', err);
    } finally {
      setLoading(false);
    }
  }, [rowDim, colDim, metric, extraFilters, periodError, periodDateRange.start, periodDateRange.end]);

  useEffect(() => {
    loadPivot();
  }, [loadPivot]);

  // Column dimension options exclude whatever is already selected as the row dimension
  const colDimOptions = useMemo(
    () => dimensions.filter((d) => d.key !== rowDim),
    [dimensions, rowDim]
  );

  const columns: Column<Record<string, any>>[] = useMemo(() => {
    if (!result) return [];
    const base: Column<Record<string, any>>[] = [
      { header: result.rowDimLabel, accessorKey: 'label' },
      { header: 'Active Users', accessorKey: 'userCount', cell: (r) => formatCompactNumber(r.userCount) },
    ];
    if (result.colDim === 'none') {
      base.push({
        header: result.metricLabel,
        accessorKey: 'value',
        cell: (r) => formatMetricValue(r.value, result.metric),
      });
    } else {
      result.columns.forEach((c) => {
        base.push({ header: c, accessorKey: c, cell: (r) => formatMetricValue(r[c] || 0, result.metric) });
      });
      base.push({
        header: 'Total',
        accessorKey: 'total',
        cell: (r) => <span className="font-bold text-ey-yellow">{formatMetricValue(r.total, result.metric)}</span>,
      });
    }
    return base;
  }, [result]);

  const chartData = useMemo(() => (result ? result.rows.slice(0, 15) : []), [result]);

  const handleExtraFilterChange = (key: string, value: string) => {
    setExtraFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetExtraFilters = () => setExtraFilters({});

  const handleDownloadRawCsv = async () => {
    try {
      const res = await fetch('/ai_usage_data.csv', { cache: 'no-store' });
      const csvContent = await res.text();
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', 'ai_usage_data.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to download raw dataset:', err);
    }
  };

  const handleExportCsv = async () => {
    if (!result) return;
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (periodDateRange.start) params.set('startDate', periodDateRange.start);
      if (periodDateRange.end) params.set('endDate', periodDateRange.end);
      for (const [key, value] of Object.entries(extraFilters)) {
        if (value && value !== 'all') params.set(key, value);
      }
      const res = await fetch(`/api/metrics/playground-export?${params.toString()}`);
      const json = await res.json();
      const rawRows: Record<string, any>[] = json.rows || [];

      if (rawRows.length > 0) {
        const headers = Object.keys(rawRows[0]);
        const csvRows = rawRows.map((r) => headers.map((h) => escapeCsvValue(r[h])));
        const csvContent = [headers.join(','), ...csvRows.map((e) => e.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `data_playground_export_${startPeriod || 'all'}_to_${endPeriod || 'all'}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }

      setExportNotice(
        json.truncated
          ? `Export capped at ${rawRows.length.toLocaleString()} of ${(json.totalMatched || 0).toLocaleString()} matching rows. Narrow the filters to export the rest.`
          : null
      );
    } catch (err) {
      console.error('Failed to export Data Playground data:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <GlobalFilterBar
        filters={filters}
        onFilterChange={setFilters}
        filterOptions={data?.filterOptions}
        disabled
        disabledMessage="These shared filters don't apply to Data Playground — use the Start/End Period and Additional Filters below instead."
      />

      <main className="p-6 space-y-6 max-w-7xl mx-auto w-full no-print">
        {/* Header */}
        <div className="bg-ey-card/50 border border-ey-border rounded-xl p-4 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-indigo-500/15 border border-indigo-500/30 rounded-xl text-indigo-400 shrink-0">
                <LayoutGrid className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-ey-light tracking-wide flex items-center gap-2.5">
                  <span>Data Playground</span>
                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">
                    <Sparkles className="w-3 h-3" />
                    Any dimension &times; Any dimension &times; Cost/Token Consumption
                  </span>
                </h1>
                <p className="text-xs text-ey-muted mt-0.5">
                  Cross-tabulate every field on demand &mdash; including the Engagement chain, GDS Location, and Cost Center, which sit outside the CT/Non-CT &rarr; Country &rarr; Service Line &rarr; Sub-Service Line &rarr; Users drilldown and have no dedicated panel elsewhere.
                </p>
              </div>
            </div>

            <button
              onClick={handleDownloadRawCsv}
              className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 bg-ey-yellow text-ey-black rounded-lg hover:bg-yellow-400 transition-colors shrink-0"
              title="Download the full raw dataset as CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download CSV</span>
            </button>
          </div>

          {/* Data Source Insights — unfiltered facts about the active dataset itself */}
          {insights && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 border-t border-ey-border pt-4">
              <div className="bg-ey-black/40 border border-ey-border/70 rounded-lg px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-ey-muted">Total Records</p>
                <p className="text-sm font-bold text-ey-light font-mono">{formatCompactNumber(insights.totalRecords)}</p>
                <p className="text-[10px] text-ey-muted">{formatCompactNumber(insights.usageRecords)} usage · {formatCompactNumber(insights.licenseRecords)} license</p>
              </div>
              <div className="bg-ey-black/40 border border-ey-border/70 rounded-lg px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-ey-muted">Users</p>
                <p className="text-sm font-bold text-ey-light font-mono">{formatCompactNumber(insights.distinctUsers)}</p>
                <p className="text-[10px] text-ey-muted">{formatCompactNumber(insights.activeUsers)} active · {formatCompactNumber(insights.dormantUsers)} dormant</p>
              </div>
              <div className="bg-ey-black/40 border border-ey-border/70 rounded-lg px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-ey-muted">AI Tools</p>
                <p className="text-sm font-bold text-ey-light font-mono">{insights.distinctTools}</p>
                {insights.topTool && (
                  <p className="text-[10px] text-ey-muted">top: {insights.topTool.name} ({formatCompactCurrency(insights.topTool.cost)})</p>
                )}
              </div>
              <div className="bg-ey-black/40 border border-ey-border/70 rounded-lg px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-ey-muted">Countries</p>
                <p className="text-sm font-bold text-ey-light font-mono">{insights.distinctCountries}</p>
                {insights.topCountry && (
                  <p className="text-[10px] text-ey-muted">top: {insights.topCountry.name} ({insights.topCountry.userCount} users)</p>
                )}
              </div>
              <div className="bg-ey-black/40 border border-ey-border/70 rounded-lg px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-ey-muted">Date Range</p>
                <p className="text-sm font-bold text-ey-light">{insights.dateRangeLabel}</p>
                <p className="text-[10px] text-ey-muted">{insights.distinctMonths} months</p>
              </div>
              <div className="bg-ey-black/40 border border-ey-border/70 rounded-lg px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-ey-muted">Total AI Investment</p>
                <p className="text-sm font-bold text-ey-light font-mono">{formatCompactCurrency(insights.totalCost)}</p>
                <p className="text-[10px] text-ey-muted">
                  {formatCompactCurrency(insights.totalUsageCost)} usage · {formatCompactCurrency(insights.totalLicenseCost)} license
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Pivot Controls */}
        <div className="bg-ey-card border border-ey-border rounded-xl p-5 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-ey-muted uppercase mb-1.5">Rows (break down by)</label>
              <select
                value={rowDim}
                onChange={(e) => handleRowDimChange(e.target.value)}
                className="w-full bg-ey-black border border-ey-border text-ey-light text-xs rounded-md px-3 py-2 focus:outline-none focus:border-ey-yellow"
              >
                {dimensions.map((d) => (
                  <option key={d.key} value={d.key}>{d.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-ey-muted uppercase mb-1.5">Columns (split by, optional)</label>
              <select
                value={colDim}
                onChange={(e) => handleColDimChange(e.target.value)}
                className="w-full bg-ey-black border border-ey-border text-ey-light text-xs rounded-md px-3 py-2 focus:outline-none focus:border-ey-yellow"
              >
                <option value="none">None (single total column)</option>
                {colDimOptions.map((d) => (
                  <option key={d.key} value={d.key}>{d.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-ey-muted uppercase mb-1.5">Metric</label>
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
                className="w-full bg-ey-black border border-ey-border text-ey-light text-xs rounded-md px-3 py-2 focus:outline-none focus:border-ey-yellow"
              >
                {metrics.map((m) => (
                  <option key={m.key} value={m.key}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Start/End Period — this page's own date filter, independent of the
            (disabled) shared filter bar above. Optional on both sides. */}
        <div className="bg-ey-card border border-ey-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <CalendarRange className="w-4 h-4 text-ey-yellow" />
            <h2 className="text-xs font-bold text-ey-light uppercase tracking-wider">Period Filter</h2>
            <span className="text-[10px] text-ey-muted font-normal normal-case">(optional — inclusive of both ends)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-ey-muted uppercase mb-1.5">Start Period</label>
              <select
                value={startPeriod}
                onChange={(e) => setStartPeriod(e.target.value)}
                className="w-full bg-ey-black border border-ey-border text-ey-light text-xs rounded-md px-3 py-2 focus:outline-none focus:border-ey-yellow"
              >
                <option value="">Any</option>
                {periodMonths.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-ey-muted uppercase mb-1.5">End Period</label>
              <select
                value={endPeriod}
                onChange={(e) => setEndPeriod(e.target.value)}
                className="w-full bg-ey-black border border-ey-border text-ey-light text-xs rounded-md px-3 py-2 focus:outline-none focus:border-ey-yellow"
              >
                <option value="">Any</option>
                {periodMonths.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>
          {periodError && (
            <p className="flex items-center gap-1.5 text-[11px] text-red-400 font-semibold mt-3">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {periodError}
            </p>
          )}
        </div>

        {/* Additional Filters — every dimension without a dedicated panel elsewhere; collapsed by default */}
        <div className="bg-ey-card border border-ey-border rounded-xl p-5 shadow-sm">
          <button
            onClick={() => setShowExtraFilters((prev) => !prev)}
            className="w-full flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
              <h2 className="text-xs font-bold text-ey-light uppercase tracking-wider">
                Additional Filters
              </h2>
              {activeExtraFilterCount > 0 && (
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300">
                  {activeExtraFilterCount} active
                </span>
              )}
            </div>
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-ey-muted">
              {showExtraFilters ? 'Collapse' : 'Expand'}
              {showExtraFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </span>
          </button>

          {showExtraFilters && (
            <>
              <div className="flex items-center justify-between gap-3 mt-3 mb-4">
                <p className="text-[10.5px] text-ey-muted">
                  Whatever's picked for Rows or Columns above is hidden here — filtering a field to one value while breaking down by that same field just duplicates it.
                </p>
                {activeExtraFilterCount > 0 && (
                  <button
                    onClick={handleResetExtraFilters}
                    className="flex items-center gap-1.5 text-[11px] font-semibold text-ey-muted hover:text-ey-yellow bg-ey-black border border-ey-border px-2.5 py-1.5 rounded-lg transition shrink-0"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {visibleExtraFilterDimensions.map((d) => (
                  <div key={d.key}>
                    <label className="block text-[10px] font-semibold text-ey-muted uppercase mb-1">{d.label}</label>
                    <select
                      value={extraFilters[d.key] || 'all'}
                      onChange={(e) => handleExtraFilterChange(d.key, e.target.value)}
                      className="w-full bg-ey-black border border-ey-border text-ey-light text-xs rounded-md px-2.5 py-1.5 focus:outline-none focus:border-ey-yellow"
                    >
                      <option value="all">All</option>
                      {(extraFilterOptions[d.key] || []).map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {periodError ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-red-400 text-sm text-center px-6">
            <AlertTriangle className="w-6 h-6" />
            <p>{periodError}</p>
            <p className="text-ey-muted text-xs">Fix the Period Filter above to see results.</p>
          </div>
        ) : loading || !result ? (
          <div className="h-64 flex items-center justify-center text-ey-muted text-sm animate-pulse">
            Computing cross-tabulation...
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-ey-muted">
                {exportNotice ? (
                  <span className="text-amber-300">{exportNotice}</span>
                ) : (
                  `Reflects the Rows, Columns, Metric, and Additional Filters selected above${
                    startPeriod || endPeriod ? ', scoped to the selected Period Filter' : ''
                  }.`
                )}
              </p>
              <button
                onClick={handleExportCsv}
                disabled={exporting}
                className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 bg-ey-yellow text-ey-black rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                title="Export the filtered raw data to CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{exporting ? 'Exporting…' : 'Export CSV'}</span>
              </button>
            </div>

            <ExplorerChart
              title={`${result.metricLabel} by ${result.rowDimLabel}${result.colDim !== 'none' ? ` × ${result.colDimLabel}` : ''}`}
              subtitle={`Top ${chartData.length} of ${result.rows.length} ${result.rowDimLabel.toLowerCase()} values`}
              rows={chartData}
              colDim={result.colDim}
              columns={result.columns}
              rowDimLabel={result.rowDimLabel}
              metric={result.metric}
              metricLabel={result.metricLabel}
            />

            <DataTable
              title={`${result.rowDimLabel} × ${result.colDim === 'none' ? result.metricLabel : result.colDimLabel} Cross-Tabulation (${result.rows.length} rows)`}
              data={result.rows}
              columns={columns}
              pageSize={15}
            />
          </>
        )}
      </main>
    </div>
  );
}

function formatMetricValue(value: number, metric: string): string {
  return metric === 'cost' ? formatCompactCurrency(value) : formatCompactNumber(value);
}

function escapeCsvValue(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
