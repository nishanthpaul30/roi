import { ReactNode } from 'react';
import { Info } from 'lucide-react';

interface InfoTooltipProps {
  children: ReactNode;
  widthClassName?: string;
  /** Which edge of the icon the popup is pinned to: 'right' opens leftward (default), 'left' opens rightward -- use 'left' when the icon sits near the left edge of the page. */
  align?: 'left' | 'right';
}

/**
 * Standalone version of the hover-info-icon pattern already duplicated in
 * StatTile and KpiCard -- for places that need the same "hover for an
 * explanation" affordance but don't use either of those card shells (e.g. a
 * custom KPI layout like HoursSavedExecutiveSummary).
 */
export function InfoTooltip({ children, widthClassName = 'w-56', align = 'right' }: InfoTooltipProps) {
  return (
    <div className="group/info relative cursor-pointer shrink-0">
      <Info className="w-3.5 h-3.5 text-ey-muted hover:text-ey-light" />
      <div className={`absolute ${align === 'left' ? 'left-0' : 'right-0'} top-6 hidden group-hover/info:block bg-ey-black text-ey-light text-[11px] p-2.5 rounded shadow-xl border border-ey-border ${widthClassName} max-w-[85vw] z-50 font-sans normal-case leading-relaxed`}>
        {children}
      </div>
    </div>
  );
}
