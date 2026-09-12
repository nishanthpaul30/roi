'use client';

import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
} from 'recharts';
import { BarChart3, PieChart as PieChartIcon, Table2 } from 'lucide-react';

export const CHART_PALETTE = ['#FFE600', '#6366f1', '#10a37f', '#8957e5', '#d97706', '#ec4899', '#06b6d4', '#84cc16'];

interface ExplorerChartProps {
  title: string;
  subtitle?: string;
  rows: Record<string, any>[];
  colDim: string;
  columns: string[];
  metric: string;
  metricLabel: string;
  rowDimLabel?: string;
  /** Renders just the bar chart body, no card wrapper/header/view toggle — for embedding inside another card that already provides its own chrome and view switch. */
  embedded?: boolean;
}

function abbreviate(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}

function formatAxisValue(value: number, metric: string): string {
  const n = abbreviate(value);
  return metric === 'cost' ? `$${n}` : n;
}

function formatFullValue(value: number, metric: string): string {
  if (metric === 'cost') {
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return value.toLocaleString();
}

function truncateLabel(label: string, max = 20): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

function ChartTooltip({ active, payload, label, metric }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-ey-card border border-ey-border rounded-lg px-3 py-2 shadow-lg">
      <p className="text-ey-light text-xs font-bold mb-1.5">{label}</p>
      <div className="space-y-1">
        {payload.map((p: any, idx: number) => (
          <div key={idx} className="flex items-center gap-2 text-[11px]">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color || p.fill }} />
            <span className="text-ey-muted">{p.name}:</span>
            <span className="text-ey-light font-semibold font-mono">{formatFullValue(p.value, metric)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ExplorerChart({ title, subtitle, rows, colDim, columns, metric, metricLabel, rowDimLabel = 'Category', embedded = false }: ExplorerChartProps) {
  const [view, setView] = useState<'bar' | 'donut' | 'table'>('bar');

  // Donut only makes sense for a single un-split metric
  useEffect(() => {
    if (colDim !== 'none' && view === 'donut') setView('bar');
  }, [colDim, view]);

  if (!rows || rows.length === 0) {
    return (
      <div className="bg-ey-card border border-ey-border rounded-xl p-5 flex flex-col justify-center items-center h-64 text-ey-muted">
        <p className="text-sm font-medium">No data available for this combination.</p>
      </div>
    );
  }

  const barHeight = Math.max(280, rows.length * 38);
  const donutRows = rows.slice(0, 8);

  const barChartBody = (
    <div style={{ width: '100%', height: barHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 0, right: 36, left: 0, bottom: 0 }}
          barCategoryGap={colDim === 'none' ? '28%' : '32%'}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--ey-border)" horizontal={false} />
          <XAxis
            type="number"
            stroke="var(--ey-muted)"
            fontSize={11}
            tickLine={false}
            tickFormatter={(v) => formatAxisValue(v, metric)}
          />
          <YAxis
            type="category"
            dataKey="label"
            stroke="var(--ey-muted)"
            fontSize={11}
            tickLine={false}
            width={130}
            tickFormatter={(v: string) => truncateLabel(v, 18)}
          />
          <Tooltip content={<ChartTooltip metric={metric} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          {colDim !== 'none' && <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />}
          {colDim === 'none' ? (
            <Bar dataKey="value" name={metricLabel} radius={[0, 6, 6, 0]} maxBarSize={22}>
              {rows.map((_, idx) => (
                <Cell key={idx} fill={CHART_PALETTE[idx % CHART_PALETTE.length]} />
              ))}
              <LabelList
                dataKey="value"
                position="right"
                formatter={(v: any) => formatAxisValue(Number(v) || 0, metric)}
                style={{ fontSize: 10, fill: 'var(--ey-muted)' }}
              />
            </Bar>
          ) : (
            columns.map((c, idx) => (
              <Bar
                key={c}
                dataKey={c}
                name={c}
                stackId="stack"
                fill={CHART_PALETTE[idx % CHART_PALETTE.length]}
                radius={idx === columns.length - 1 ? [0, 6, 6, 0] : [0, 0, 0, 0]}
              />
            ))
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  if (embedded) {
    return barChartBody;
  }

  return (
    <div className="bg-ey-card border border-ey-border rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-sm font-bold text-ey-light tracking-wide">{title}</h3>
          {subtitle && <p className="text-xs text-ey-muted mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-1 bg-ey-black border border-ey-border rounded-lg p-1 shrink-0">
          <button
            onClick={() => setView('bar')}
            title="Bar chart"
            className={`p-1.5 rounded-md transition ${view === 'bar' ? 'bg-ey-yellow text-ey-black' : 'text-ey-muted hover:text-ey-light'}`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
          </button>
          {colDim === 'none' && (
            <button
              onClick={() => setView('donut')}
              title="Donut chart"
              className={`p-1.5 rounded-md transition ${view === 'donut' ? 'bg-ey-yellow text-ey-black' : 'text-ey-muted hover:text-ey-light'}`}
            >
              <PieChartIcon className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => setView('table')}
            title="Table view"
            className={`p-1.5 rounded-md transition ${view === 'table' ? 'bg-ey-yellow text-ey-black' : 'text-ey-muted hover:text-ey-light'}`}
          >
            <Table2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {view === 'table' ? (
        <div className="overflow-auto max-h-[400px] rounded-lg border border-ey-border">
          <table className="w-full text-left text-xs text-ey-light">
            <thead className="bg-ey-black/80 text-[11px] uppercase font-semibold text-ey-muted border-b border-ey-border sticky top-0">
              <tr>
                <th className="px-4 py-2.5">{rowDimLabel}</th>
                {colDim === 'none' ? (
                  <th className="px-4 py-2.5 text-right">{metricLabel}</th>
                ) : (
                  <>
                    {columns.map((c) => (
                      <th key={c} className="px-4 py-2.5 text-right">{c}</th>
                    ))}
                    <th className="px-4 py-2.5 text-right">Total</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-ey-border">
              {rows.map((r, idx) => (
                <tr key={idx} className="hover:bg-ey-card-hover/60 transition">
                  <td className="px-4 py-2.5 font-medium">{r.label}</td>
                  {colDim === 'none' ? (
                    <td className="px-4 py-2.5 text-right font-mono">{formatFullValue(r.value || 0, metric)}</td>
                  ) : (
                    <>
                      {columns.map((c) => (
                        <td key={c} className="px-4 py-2.5 text-right font-mono">{formatFullValue(r[c] || 0, metric)}</td>
                      ))}
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-ey-yellow">{formatFullValue(r.total || 0, metric)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : view === 'donut' && colDim === 'none' ? (
        <div style={{ width: '100%', height: 340 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={donutRows}
                dataKey="value"
                nameKey="label"
                innerRadius="52%"
                outerRadius="82%"
                paddingAngle={2}
                strokeWidth={0}
              >
                {donutRows.map((_, idx) => (
                  <Cell key={idx} fill={CHART_PALETTE[idx % CHART_PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip metric={metric} />} />
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                iconType="circle"
                wrapperStyle={{ fontSize: '11px', color: 'var(--ey-muted)' }}
                formatter={(value: string) => <span className="text-ey-light">{truncateLabel(value, 22)}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : (
        barChartBody
      )}
    </div>
  );
}
