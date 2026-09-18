'use client';

import { TokenCostSummary } from '@/lib/metrics/types';
import { Building, Briefcase, ArrowUpRight } from 'lucide-react';
import { formatCompactCurrency as fmtCost } from '@/lib/format';

interface ProjectBillabilityPanelProps {
  summary: TokenCostSummary;
  onSelectBillability?: (type: 'billable' | 'non_billable') => void;
}

// The Engagement Code Telemetry & Spend Rankings table that used to live
// below these two cards has moved to the Engagement Analytics page, where it
// now doubles as that page's Level 1 (Engagement Code) drilldown step. See
// EngagementCodeRankingsPanel.
export function ProjectBillabilityPanel({
  summary,
  onSelectBillability,
}: ProjectBillabilityPanelProps) {
  const billablePercent = summary.billableSpendPercent || 0;

  return (
    <div className="space-y-6">
      {/* Section Title */}
      <div>
        <h2 className="text-base font-bold text-ey-light tracking-wide flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-ey-yellow" />
          <span>Billable vs Non-Billable Spend</span>
        </h2>
        <p className="text-xs text-ey-muted mt-0.5">
          Client-billed engagement spend vs internal, non-billed overhead.
        </p>
      </div>

      {/* 2 Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Billable Spend */}
        <div
          onClick={() => onSelectBillability?.('billable')}
          className={`bg-ey-card border border-ey-border rounded-xl p-4 shadow-sm space-y-2 transition ${
            onSelectBillability ? 'cursor-pointer hover:border-blue-500/60 hover:shadow-md group' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ey-muted group-hover:text-blue-300 transition-colors flex items-center gap-1">
              <span>Billable Spend</span>
              {onSelectBillability && <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-blue-400" />}
            </span>
            <div className="p-1.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-lg">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-xl font-bold text-ey-light font-mono group-hover:text-blue-300 transition-colors">
              {fmtCost(summary.billableSpend || 0)}
            </div>
            <div className="text-xs font-semibold font-mono text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
              {billablePercent}% of Total
            </div>
          </div>
          <p className="text-xs text-ey-muted">Client engagements billed to the client</p>
        </div>

        {/* Non-Billable Overhead */}
        <div
          onClick={() => onSelectBillability?.('non_billable')}
          className={`bg-ey-card border border-ey-border rounded-xl p-4 shadow-sm space-y-2 transition ${
            onSelectBillability ? 'cursor-pointer hover:border-purple-500/60 hover:shadow-md group' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ey-muted group-hover:text-purple-300 transition-colors flex items-center gap-1">
              <span>Non-Billable Overhead</span>
              {onSelectBillability && <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-purple-400" />}
            </span>
            <div className="p-1.5 bg-purple-500/10 border border-purple-500/30 text-purple-400 rounded-lg">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-xl font-bold text-ey-light font-mono group-hover:text-purple-300 transition-colors">
              {fmtCost(summary.nonBillableSpend || 0)}
            </div>
            <div className="text-xs font-semibold font-mono text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full">
              {(100 - billablePercent).toFixed(1)}% of Total
            </div>
          </div>
          <p className="text-xs text-ey-muted">Internal tools &amp; R&amp;D, not billed to any client</p>
        </div>
      </div>
    </div>
  );
}
