'use client';

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
  if (!data || data.length === 0) {
    return (
      <div className="bg-ey-card border border-ey-border rounded-xl p-5 flex flex-col justify-center items-center h-64 text-ey-muted">
        <p className="text-sm font-medium">No metric data available for selected filter range.</p>
      </div>
    );
  }

  return (
    <div className="bg-ey-card border border-ey-border rounded-xl p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-ey-light tracking-wide">{title}</h3>
        {subtitle && <p className="text-xs text-ey-muted mt-0.5">{subtitle}</p>}
      </div>

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
              <CartesianGrid strokeDasharray="3 3" stroke="#2E2E3A" vertical={false} />
              <XAxis dataKey={dataKeyX} stroke="#A0A0B0" fontSize={11} tickLine={false} />
              <YAxis stroke="#A0A0B0" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#121217', borderColor: '#2E2E3A', borderRadius: '0.5rem', color: '#F4F4F6' }}
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
              <CartesianGrid strokeDasharray="3 3" stroke="#2E2E3A" vertical={false} />
              <XAxis dataKey={dataKeyX} stroke="#A0A0B0" fontSize={11} tickLine={false} />
              <YAxis stroke="#A0A0B0" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#121217', borderColor: '#2E2E3A', borderRadius: '0.5rem', color: '#F4F4F6' }}
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
              <CartesianGrid strokeDasharray="3 3" stroke="#2E2E3A" vertical={false} />
              <XAxis dataKey={dataKeyX} stroke="#A0A0B0" fontSize={11} tickLine={false} />
              <YAxis stroke="#A0A0B0" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#121217', borderColor: '#2E2E3A', borderRadius: '0.5rem', color: '#F4F4F6' }}
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
    </div>
  );
}
