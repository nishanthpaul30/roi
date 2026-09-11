import { TrendingUp, TrendingDown, Minus, Info, ArrowUpRight } from 'lucide-react';
import { MetricDelta } from '@/lib/metrics/types';

interface KpiCardProps {
  title: string;
  delta: MetricDelta;
  unit?: string;
  formatType?: 'number' | 'percentage' | 'currency' | 'duration';
  description?: string;
  comparisonLabel?: string;
  onClick?: () => void;
}

export function KpiCard({
  title,
  delta,
  unit = '',
  formatType = 'number',
  description,
  comparisonLabel = 'vs prev period',
  onClick,
}: KpiCardProps) {
  if (!delta) return null;

  const { current, previous, absoluteDelta, percentageDelta, percentagePointDelta, trend, isRateMetric } = delta;

  const formatVal = (val: number) => {
    if (formatType === 'currency') return `$${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    if (formatType === 'percentage') return `${val.toFixed(1)}%`;
    if (formatType === 'duration') return `${val.toLocaleString()} hrs`;
    return val.toLocaleString();
  };

  const isPositiveTrend = trend === 'up';
  const isNegativeTrend = trend === 'down';

  return (
    <div
      onClick={onClick}
      className={`bg-ey-card border border-ey-border rounded-xl p-5 shadow-sm transition-all duration-200 flex flex-col justify-between group ${
        onClick ? 'cursor-pointer hover:border-ey-yellow/60 hover:shadow-lg hover:shadow-yellow-500/5 active:scale-[0.99]' : ''
      }`}
    >
      {/* Title & Info Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-ey-muted group-hover:text-ey-yellow transition-colors flex items-center gap-1.5">
          <span>{title}</span>
          {onClick && <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-ey-yellow" />}
        </span>

        {description && (
          <div className="group/info relative cursor-pointer" onClick={(e) => e.stopPropagation()}>
            <Info className="w-3.5 h-3.5 text-ey-muted hover:text-ey-light" />
            <div className="absolute right-0 top-6 hidden group-hover/info:block bg-ey-black text-ey-light text-[11px] p-2 rounded shadow-xl border border-ey-border w-48 z-50">
              {description}
            </div>
          </div>
        )}
      </div>

      {/* Main KPI Value */}
      <div className="my-1 flex items-baseline justify-between">
        <span className="text-2xl lg:text-3xl font-extrabold text-ey-light tracking-tight group-hover:text-white transition-colors">
          {formatVal(current)} {unit && <span className="text-sm font-normal text-ey-muted">{unit}</span>}
        </span>

        {/* Trend Arrow Badge */}
        <div
          className={`flex items-center space-x-1 text-xs font-bold px-2 py-0.5 rounded-full border ${
            isPositiveTrend
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : isNegativeTrend
              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              : 'bg-ey-black text-ey-muted border-ey-border'
          }`}
        >
          {isPositiveTrend ? (
            <TrendingUp className="w-3.5 h-3.5" />
          ) : isNegativeTrend ? (
            <TrendingDown className="w-3.5 h-3.5" />
          ) : (
            <Minus className="w-3.5 h-3.5" />
          )}
          <span>
            {percentagePointDelta !== undefined
              ? `${percentagePointDelta > 0 ? '+' : ''}${percentagePointDelta} pp`
              : `${percentageDelta > 0 ? '+' : ''}${percentageDelta}%`}
          </span>
        </div>
      </div>

      {/* Detailed Delta Breakdown Footer */}
      <div className="mt-3 pt-2 border-t border-ey-border/80 flex items-center justify-between text-[11px] text-ey-muted">
        <div>
          Prev: <span className="font-medium text-ey-light">{formatVal(previous)}</span>
        </div>
        <div className="flex items-center space-x-2">
          <span>
            Delta:{' '}
            <span className={`font-semibold ${absoluteDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {absoluteDelta > 0 ? `+${formatVal(absoluteDelta)}` : formatVal(absoluteDelta)}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
