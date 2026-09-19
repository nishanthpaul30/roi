import { ReactNode } from 'react';
import { Info } from 'lucide-react';

interface StatTileProps {
  label: string;
  value: ReactNode;
  valueClassName?: string;
  subtitle?: ReactNode;
  subtitleClassName?: string;
  tooltip?: ReactNode;
  borderClassName?: string;
}

/**
 * Shared "metric card" visual anatomy used across the app (see the AI
 * Adoption card on Executive Overview): uppercase label + optional info
 * tooltip top-right, a large bold value, then a divider line above a
 * right-aligned subtitle. Mirrors KpiCard's no-delta layout so every static
 * stat tile (drilldowns, action ledgers, etc.) looks the same as the
 * period-over-period KPI cards.
 */
export function StatTile({
  label,
  value,
  valueClassName = 'text-ey-light',
  subtitle,
  subtitleClassName = 'text-ey-muted',
  tooltip,
  borderClassName = 'border-ey-border',
}: StatTileProps) {
  return (
    <div className={`bg-ey-card border ${borderClassName} rounded-xl p-5 shadow-sm flex flex-col justify-between`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-ey-muted">{label}</span>
        {tooltip && (
          <div className="group/info relative cursor-pointer">
            <Info className="w-3.5 h-3.5 text-ey-muted hover:text-ey-light" />
            <div className="absolute right-0 top-6 hidden group-hover/info:block bg-ey-black text-ey-light text-[11px] p-2 rounded shadow-xl border border-ey-border w-52 z-50 font-sans normal-case">
              {tooltip}
            </div>
          </div>
        )}
      </div>

      <div className="my-1">
        <span className={`text-2xl lg:text-3xl font-extrabold tracking-tight ${valueClassName}`}>{value}</span>
      </div>

      {subtitle && (
        <div className="mt-3 pt-2 border-t border-ey-border/80">
          <div className={`text-[11px] text-right ${subtitleClassName}`}>{subtitle}</div>
        </div>
      )}
    </div>
  );
}
