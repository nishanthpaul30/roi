'use client';

import { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { LineChart as LineChartIcon, Table2 } from 'lucide-react';
import { formatCompactCurrency, formatCompactNumber } from '@/lib/format';

interface SeriesConfig {
  key: string;
  name: string;
  color: string;
  type?: 'area' | 'bar' | 'line';
}

interface MetricChartProps {
  title: string;
  subtitle?: string;
  data: any[];
  dataKeyX?: string;
  series: SeriesConfig[];
  chartType?: 'area' | 'bar' | 'line';
  stacked?: boolean;
  height?: number;
}

function formatCellValue(value: any, seriesName: string): string {
  const n = Number(value) || 0;
  return seriesName.includes('$') ? formatCompactCurrency(n) : formatCompactNumber(n);
}

// Axis ticks need to stay short regardless of magnitude — always whole-number
// compact, unlike the 2-decimal precision formatCellValue uses below 1,000.
function formatAxisTick(value: number, isCurrency: boolean): string {
  const n = Math.abs(value) >= 1000
    ? new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
    : value.toFixed(0);
  return isCurrency ? `$${n}` : n;
}

export function MetricChart({
  title,
  subtitle,
  data,
  dataKeyX = 'date',
  series,
  chartType = 'area',
  stacked = false,
  height = 320,
}: MetricChartProps) {
  const [view, setView] = useState<'chart' | 'table'>('chart');

  if (!data || data.length === 0) {
    return (
      <div className="bg-ey-card border border-ey-border rounded-xl p-5 flex flex-col justify-center items-center h-64 text-ey-muted">
        <p className="text-sm font-medium">No metric data available for selected filter range.</p>
      </div>
    );
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
            onClick={() => setView('chart')}
            title="Chart view"
            className={`p-1.5 rounded-md transition ${view === 'chart' ? 'bg-ey-yellow text-ey-black' : 'text-ey-muted hover:text-ey-light'}`}
          >
            <LineChartIcon className="w-3.5 h-3.5" />
          </button>
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
        <div className="overflow-auto rounded-lg border border-ey-border" style={{ maxHeight: height }}>
          <table className="w-full text-left text-xs text-ey-light">
            <thead className="bg-ey-black/80 text-[11px] uppercase font-semibold text-ey-muted border-b border-ey-border sticky top-0">
              <tr>
                <th className="px-4 py-2.5 capitalize">{dataKeyX}</th>
                {series.map((s) => (
                  <th key={s.key} className="px-4 py-2.5 text-right">{s.name}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ey-border">
              {data.map((row, idx) => (
                <tr key={idx} className="hover:bg-ey-card-hover/60 transition">
                  <td className="px-4 py-2.5 font-medium">{row[dataKeyX]}</td>
                  {series.map((s) => (
                    <td key={s.key} className="px-4 py-2.5 text-right font-mono">
                      {formatCellValue(row[s.key], s.name)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'area' ? (
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                {series.map((s) => (
                  <linearGradient key={s.key} id={`gradient-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={s.color} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={s.color} stopOpacity={0.0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--ey-border)" vertical={false} />
              <XAxis dataKey={dataKeyX} stroke="var(--ey-muted)" fontSize={11} tickLine={false} />
              <YAxis stroke="var(--ey-muted)" fontSize={11} tickLine={false} tickFormatter={(v) => formatAxisTick(Number(v) || 0, series[0]?.name.includes('$') || false)} />
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--ey-card)', borderColor: 'var(--ey-border)', borderRadius: '0.5rem', color: 'var(--ey-light)' }}
                itemStyle={{ fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              {series.map((s) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.name}
                  stroke={s.color}
                  fillOpacity={1}
                  fill={`url(#gradient-${s.key})`}
                  strokeWidth={2}
                  stackId={stacked ? '1' : undefined}
                />
              ))}
            </AreaChart>
          ) : chartType === 'bar' ? (
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--ey-border)" vertical={false} />
              <XAxis dataKey={dataKeyX} stroke="var(--ey-muted)" fontSize={11} tickLine={false} />
              <YAxis stroke="var(--ey-muted)" fontSize={11} tickLine={false} tickFormatter={(v) => formatAxisTick(Number(v) || 0, series[0]?.name.includes('$') || false)} />
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--ey-card)', borderColor: 'var(--ey-border)', borderRadius: '0.5rem', color: 'var(--ey-light)' }}
                itemStyle={{ fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              {series.map((s) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.name}
                  fill={s.color}
                  radius={[4, 4, 0, 0]}
                  stackId={stacked ? '1' : undefined}
                />
              ))}
            </BarChart>
          ) : (
            <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--ey-border)" vertical={false} />
              <XAxis dataKey={dataKeyX} stroke="var(--ey-muted)" fontSize={11} tickLine={false} />
              <YAxis stroke="var(--ey-muted)" fontSize={11} tickLine={false} tickFormatter={(v) => formatAxisTick(Number(v) || 0, series[0]?.name.includes('$') || false)} />
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--ey-card)', borderColor: 'var(--ey-border)', borderRadius: '0.5rem', color: 'var(--ey-light)' }}
                itemStyle={{ fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              {series.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.name}
                  stroke={s.color}
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
      )}
    </div>
  );
}
