'use client';

import { useMemo } from 'react';
import type { TokenCostSummary } from '@/lib/metrics/types';
import { formatCompactCurrency as fmtCost, formatCompactNumber as fmtNum } from '@/lib/format';

type HoursSavedRow = NonNullable<TokenCostSummary['hoursSavedByEngagement']>[number];

interface HoursSavedExecutiveSummaryProps {
  rows: HoursSavedRow[];
}

/**
 * Portfolio-level rollup across every (Engagement, Tool) row -- the number
 * trail a C-suite reader actually wants: are we on track as a program (not
 * row by row), what does a saved hour cost us blended across the whole AI
 * investment, and how many engagements are falling behind, without having
 * to read all of them to find out. Sits above the detailed per-engagement
 * table, same screen, no drilldown required.
 */
export function HoursSavedExecutiveSummary({ rows }: HoursSavedExecutiveSummaryProps) {
  const stats = useMemo(() => {
    const totalApprovedHrs = rows.reduce((s, r) => s + r.approvedTotalHrs, 0);
    const totalHoursSaved = rows.reduce((s, r) => s + r.sumOfMonthlyHrs, 0);
    const totalPendingHrs = rows.reduce((s, r) => s + r.pendingApprovalHrs, 0);
    const totalCost = rows.reduce((s, r) => s + (r.cost ?? 0), 0);
    const overallRealizationPercent = totalApprovedHrs > 0 ? (totalHoursSaved / totalApprovedHrs) * 100 : 0;
    const blendedCostPerHourSaved = totalHoursSaved > 0 ? totalCost / totalHoursSaved : null;

    let onAbove = 0, onTrack = 0, behind = 0;
    for (const r of rows) {
      if (r.realizationPercent >= 100) onAbove++;
      else if (r.realizationPercent >= 75) onTrack++;
      else behind++;
    }

    return {
      totalApprovedHrs,
      totalHoursSaved,
      totalPendingHrs,
      totalCost,
      overallRealizationPercent,
      blendedCostPerHourSaved,
      onAbove,
      onTrack,
      behind,
      total: rows.length,
    };
  }, [rows]);

  const realizationColor =
    stats.overallRealizationPercent >= 100 ? 'text-emerald-300' : stats.overallRealizationPercent >= 75 ? 'text-ey-yellow' : 'text-rose-300';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-ey-black/60 border border-ey-border/80 rounded-xl p-4">
          <p className="text-[10px] text-ey-muted uppercase tracking-wider">Hours Saved vs. Approved</p>
          <p className="text-xl font-extrabold text-ey-light font-mono mt-1">
            {fmtNum(stats.totalHoursSaved)} <span className="text-sm text-ey-muted font-normal">/ {fmtNum(stats.totalApprovedHrs)}</span>
          </p>
          <p className={`text-[11px] font-semibold mt-0.5 ${realizationColor}`}>{stats.overallRealizationPercent.toFixed(1)}% realized, portfolio-wide</p>
        </div>

        <div className="bg-ey-black/60 border border-ey-border/80 rounded-xl p-4">
          <p className="text-[10px] text-ey-muted uppercase tracking-wider">Blended Cost / Hour Saved</p>
          <p className="text-xl font-extrabold text-ey-yellow font-mono mt-1">
            {stats.blendedCostPerHourSaved !== null ? fmtCost(stats.blendedCostPerHourSaved) : '—'}
          </p>
          <p className="text-[11px] text-ey-muted mt-0.5">{fmtCost(stats.totalCost)} total tool spend tracked</p>
        </div>

        <div className="bg-ey-black/60 border border-ey-border/80 rounded-xl p-4">
          <p className="text-[10px] text-ey-muted uppercase tracking-wider">Pending Approval (Pipeline)</p>
          <p className="text-xl font-extrabold text-ey-light font-mono mt-1">{fmtNum(stats.totalPendingHrs)} hrs</p>
          <p className="text-[11px] text-ey-muted mt-0.5">Submitted, not yet locked into target</p>
        </div>

        <div className="bg-ey-black/60 border border-ey-border/80 rounded-xl p-4">
          <p className="text-[10px] text-ey-muted uppercase tracking-wider">Engagements Tracked</p>
          <p className="text-xl font-extrabold text-ey-light font-mono mt-1">{stats.total}</p>
          <p className="text-[11px] text-ey-muted mt-0.5">Engagement &times; Tool pairs with Hours Saved data</p>
        </div>
      </div>

      {/* Health distribution -- where the portfolio's risk actually sits */}
      <div className="bg-ey-black/60 border border-ey-border/80 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] text-ey-muted uppercase tracking-wider">Realization Status, Across All {stats.total} Pairs</p>
          <p className="text-[11px] text-ey-muted font-mono">
            <span className="text-emerald-300 font-bold">{stats.onAbove}</span> above &middot;{' '}
            <span className="text-ey-yellow font-bold">{stats.onTrack}</span> on track &middot;{' '}
            <span className="text-rose-300 font-bold">{stats.behind}</span> behind
          </p>
        </div>
        <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-ey-card">
          {stats.onAbove > 0 && <div className="h-full bg-emerald-400" style={{ width: `${(stats.onAbove / stats.total) * 100}%` }} />}
          {stats.onTrack > 0 && <div className="h-full bg-ey-yellow" style={{ width: `${(stats.onTrack / stats.total) * 100}%` }} />}
          {stats.behind > 0 && <div className="h-full bg-rose-400" style={{ width: `${(stats.behind / stats.total) * 100}%` }} />}
        </div>
      </div>
    </div>
  );
}
