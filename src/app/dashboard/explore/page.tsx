'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useMetricsData } from '@/hooks/useMetricsData';
import { GlobalFilterBar } from '@/components/layout/GlobalFilterBar';
import { ExplorerChart } from '@/components/ui/ExplorerChart';
import { DataTable, Column } from '@/components/ui/DataTable';
import { LayoutGrid, Sparkles } from 'lucide-react';

interface DimensionOption {
  key: string;
  label: string;
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

export default function DataExplorerPage() {
  const { filters, setFilters, data } = useMetricsData();

  const [dimensions, setDimensions] = useState<DimensionOption[]>([]);
  const [metrics, setMetrics] = useState<DimensionOption[]>([]);
  const [rowDim, setRowDim] = useState('aiTool');
  const [colDim, setColDim] = useState('none');
  const [metric, setMetric] = useState('cost');
  const [result, setResult] = useState<PivotResult | null>(null);
  const [loading, setLoading] = useState(true);

  const loadPivot = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: filters.startDate,
        endDate: filters.endDate,
        aiTool: filters.aiTool,
        managementRegion: filters.managementRegion,
        serviceLine: filters.serviceLine,
        userMail: filters.userMail,
        country: filters.country,
        rowDim,
        colDim,
        metric,
      });
      const res = await fetch(`/api/metrics/pivot?${params.toString()}`);
      const json = await res.json();
      setResult(json.result);
      setDimensions(json.dimensions || []);
      setMetrics(json.metrics || []);
    } catch (err) {
      console.error('Failed to load pivot data:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, rowDim, colDim, metric]);

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
      { header: 'Active Users', accessorKey: 'userCount', cell: (r) => r.userCount.toLocaleString() },
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

  return (
    <div className="flex-1 flex flex-col">
      <GlobalFilterBar filters={filters} onFilterChange={setFilters} filterOptions={data?.filterOptions} />

      <main className="p-6 space-y-6 max-w-7xl mx-auto w-full no-print">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-ey-card/50 border border-ey-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-500/15 border border-indigo-500/30 rounded-xl text-indigo-400 shrink-0">
              <LayoutGrid className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-ey-light tracking-wide flex items-center gap-2.5">
                <span>Data Explorer</span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">
                  <Sparkles className="w-3 h-3" />
                  Any dimension &times; any dimension &times; any metric
                </span>
              </h1>
              <p className="text-xs text-ey-muted mt-0.5">
                Cross-tabulate every field in <span className="font-mono text-ey-yellow">ai_usage_data.csv</span> on demand &mdash; including Region and Project Investment Code, which have no dedicated panel elsewhere.
              </p>
            </div>
          </div>
        </div>

        {/* Pivot Controls */}
        <div className="bg-ey-card border border-ey-border rounded-xl p-5 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-ey-muted uppercase mb-1.5">Rows (break down by)</label>
              <select
                value={rowDim}
                onChange={(e) => setRowDim(e.target.value)}
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
                onChange={(e) => setColDim(e.target.value)}
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

        {loading || !result ? (
          <div className="h-64 flex items-center justify-center text-ey-muted text-sm animate-pulse">
            Computing cross-tabulation from ai_usage_data.csv...
          </div>
        ) : (
          <>
            <ExplorerChart
              title={`${result.metricLabel} by ${result.rowDimLabel}${result.colDim !== 'none' ? ` × ${result.colDimLabel}` : ''}`}
              subtitle={`Top ${chartData.length} of ${result.rows.length} ${result.rowDimLabel.toLowerCase()} values, from ai_usage_data.csv`}
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
  if (metric === 'cost') return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return value.toLocaleString();
}
