'use client';

import { useMemo } from 'react';
import type { TokenCostSummary } from '@/lib/metrics/types';
import { computeHoursSavedValueUsd, computeRoiPercent, computeDevCostUsd, computeTotalInvestmentUsd, computeRoiEligibleHours } from '@/lib/metrics/roiCalc';
import { formatCompactCurrency as fmtCost, formatCompactNumber as fmtNum } from '@/lib/format';
import { InfoTooltip } from '@/components/ui/InfoTooltip';

type HoursSavedRow = NonNullable<TokenCostSummary['hoursSavedByEngagement']>[number];

interface HoursSavedExecutiveSummaryProps {
  rows: HoursSavedRow[];
  devHourRate: number;
}

/**
 * Portfolio-level rollup across every (Engagement, Tool) row -- the number
 * trail a C-suite reader actually wants: are we on track as a program (not
 * row by row), what does a saved hour cost us blended across the whole AI
 * investment, and how many engagements are falling behind, without having
 * to read all of them to find out. Sits above the detailed per-engagement
 * table, same screen, no drilldown required.
 */
export function HoursSavedExecutiveSummary({ rows, devHourRate }: HoursSavedExecutiveSummaryProps) {
  const stats = useMemo(() => {
    const totalApprovedHrs = rows.reduce((s, r) => s + r.approvedTotalHrs, 0);
    const totalHoursSaved = rows.reduce((s, r) => s + r.sumOfMonthlyHrs, 0);
    const totalPendingHrs = rows.reduce((s, r) => s + r.pendingApprovalHrs, 0);
    const totalCost = rows.reduce((s, r) => s + (r.cost ?? 0), 0);
    const blendedCostPerHourSaved = totalHoursSaved > 0 ? totalCost / totalHoursSaved : null;
    // Capped per row (not on the portfolio total) so one row overshooting
    // its own approved target can't borrow "room" from another that undershot.
    const totalRoiEligibleHours = rows.reduce((s, r) => s + computeRoiEligibleHours(r.sumOfMonthlyHrs, r.approvedTotalHrs), 0);
    const totalHoursSavedValueUsd = computeHoursSavedValueUsd(totalRoiEligibleHours, devHourRate);

    // devHoursSpent is engagement-level, duplicated on every tool row of a
    // multi-tool engagement -- dedupe by projectCode before summing, or a
    // 3-tool engagement would triple-count its dev hours.
    const devHoursByEngagement = new Map<string, number>();
    for (const r of rows) {
      if (!devHoursByEngagement.has(r.projectCode)) devHoursByEngagement.set(r.projectCode, r.devHoursSpent);
    }
    const totalDevHoursSpent = Array.from(devHoursByEngagement.values()).reduce((s, v) => s + v, 0);
    const totalDevCostUsd = computeDevCostUsd(totalDevHoursSpent, devHourRate);
    const totalInvestmentUsd = computeTotalInvestmentUsd(totalCost, totalDevCostUsd);
    const blendedRoiPercent = computeRoiPercent(totalHoursSavedValueUsd, totalInvestmentUsd);

    return {
      totalApprovedHrs,
      totalHoursSaved,
      totalPendingHrs,
      totalCost,
      blendedCostPerHourSaved,
      totalHoursSavedValueUsd,
      totalRoiEligibleHours,
      totalDevHoursSpent,
      totalDevCostUsd,
      totalInvestmentUsd,
      blendedRoiPercent,
    };
  }, [rows, devHourRate]);

  const fmtExact = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtHrs = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 1 });

  const roiColor =
    stats.blendedRoiPercent === null ? 'text-ey-muted' : stats.blendedRoiPercent >= 100 ? 'text-emerald-300' : stats.blendedRoiPercent >= 0 ? 'text-ey-yellow' : 'text-rose-300';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <div className="bg-ey-black/60 border border-ey-border/80 rounded-xl p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[10px] text-ey-muted uppercase tracking-wider">Hours Saved vs. Approved</p>
            <InfoTooltip>
              <span className="font-semibold text-ey-yellow block mb-1">How this is calculated</span>
              Hours Saved = sum of each tracked Engagement &times; Tool pair&apos;s actual hours saved so far = <span className="font-mono">{fmtHrs(stats.totalHoursSaved)} hrs</span>.<br />
              Approved = sum of each pair&apos;s approved target = <span className="font-mono">{fmtHrs(stats.totalApprovedHrs)} hrs</span>.
            </InfoTooltip>
          </div>
          <p className="text-xl font-extrabold text-ey-light font-mono mt-1">
            {fmtNum(stats.totalHoursSaved)} <span className="text-sm text-ey-muted font-normal">/ {fmtNum(stats.totalApprovedHrs)}</span>
          </p>
        </div>

        <div className="bg-ey-black/60 border border-ey-border/80 rounded-xl p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[10px] text-ey-muted uppercase tracking-wider">Blended Cost / Hour Saved</p>
            <InfoTooltip>
              <span className="font-semibold text-ey-yellow block mb-1">How this is calculated</span>
              Total Tool Cost &divide; Total Hours Saved, across every tracked pair.<br />
              <span className="font-mono">{fmtExact(stats.totalCost)} &divide; {fmtHrs(stats.totalHoursSaved)} hrs = {stats.blendedCostPerHourSaved !== null ? fmtExact(stats.blendedCostPerHourSaved) : '—'}/hr</span>
            </InfoTooltip>
          </div>
          <p className="text-xl font-extrabold text-ey-yellow font-mono mt-1">
            {stats.blendedCostPerHourSaved !== null ? fmtCost(stats.blendedCostPerHourSaved) : '—'}
          </p>
          <p className="text-[11px] text-ey-muted mt-0.5">{fmtCost(stats.totalCost)} total tool spend tracked</p>
        </div>

        <div className="bg-ey-black/60 border border-ey-border/80 rounded-xl p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[10px] text-ey-muted uppercase tracking-wider">Dev Hours Invested</p>
            <InfoTooltip>
              <span className="font-semibold text-ey-yellow block mb-1">How this is calculated</span>
              Sum of developer hours clocked per engagement (mock timesheet data, deduped so a multi-tool engagement&apos;s hours aren&apos;t counted once per tool) = <span className="font-mono">{fmtHrs(stats.totalDevHoursSpent)} hrs</span>.<br />
              Dev Cost = Dev Hours &times; $/dev-hr = <span className="font-mono">{fmtHrs(stats.totalDevHoursSpent)} &times; ${devHourRate} = {fmtExact(stats.totalDevCostUsd)}</span>
            </InfoTooltip>
          </div>
          <p className="text-xl font-extrabold text-ey-light font-mono mt-1">{fmtNum(stats.totalDevHoursSpent)} hrs</p>
          <p className="text-[11px] text-ey-muted mt-0.5">{fmtCost(stats.totalDevCostUsd)} at ${devHourRate}/dev-hr</p>
        </div>

        <div className="bg-ey-black/60 border border-ey-border/80 rounded-xl p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[10px] text-ey-muted uppercase tracking-wider">ROI (Hours Saved vs. Total Investment)</p>
            <InfoTooltip widthClassName="w-64">
              <span className="font-semibold text-ey-yellow block mb-1">How this is calculated</span>
              Value of Hours Saved = (Hours Saved capped at each row&apos;s Approved Hrs) &times; $/dev-hr &mdash; hours recorded beyond what&apos;s approved don&apos;t count toward value yet.<br />
              <span className="font-mono">{fmtHrs(stats.totalRoiEligibleHours)} hrs &times; ${devHourRate}/hr = {fmtExact(stats.totalHoursSavedValueUsd)}</span><br />
              Total Investment = AI Tool Cost + Dev Hours Cost.<br />
              <span className="font-mono">{fmtExact(stats.totalCost)} + {fmtExact(stats.totalDevCostUsd)} = {fmtExact(stats.totalInvestmentUsd)}</span><br />
              ROI % = (Value &minus; Total Investment) &divide; Total Investment &times; 100.<br />
              <span className="font-mono">
                ({fmtExact(stats.totalHoursSavedValueUsd)} &minus; {fmtExact(stats.totalInvestmentUsd)}) &divide; {fmtExact(stats.totalInvestmentUsd)} &times; 100 = {stats.blendedRoiPercent !== null ? `${stats.blendedRoiPercent >= 0 ? '+' : ''}${stats.blendedRoiPercent.toFixed(1)}%` : '—'}
              </span><br />
              The $/dev-hr rate is adjustable above &mdash; it&apos;s a blended assumption, not sourced from the data. Dev hours come from a mock timesheet generator, not a real system yet.
            </InfoTooltip>
          </div>
          <p className={`text-xl font-extrabold font-mono mt-1 ${roiColor}`}>
            {stats.blendedRoiPercent !== null ? `${stats.blendedRoiPercent >= 0 ? '+' : ''}${stats.blendedRoiPercent.toFixed(0)}%` : '—'}
          </p>
          <p className="text-[11px] text-ey-muted mt-0.5">{fmtCost(stats.totalHoursSavedValueUsd)} value vs. {fmtCost(stats.totalInvestmentUsd)} invested</p>
        </div>

        <div className="bg-ey-black/60 border border-ey-border/80 rounded-xl p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[10px] text-ey-muted uppercase tracking-wider">Pending Approval (Pipeline)</p>
            <InfoTooltip>
              <span className="font-semibold text-ey-yellow block mb-1">How this is calculated</span>
              Sum of &quot;Pending Approval (Submitted)&quot; hours across every tracked Engagement &times; Tool pair = <span className="font-mono">{fmtHrs(stats.totalPendingHrs)} hrs</span>.<br />
              Submitted for sign-off but not yet locked into the approved target, so it&apos;s not counted in Hours Saved or ROI.
            </InfoTooltip>
          </div>
          <p className="text-xl font-extrabold text-ey-light font-mono mt-1">{fmtNum(stats.totalPendingHrs)} hrs</p>
          <p className="text-[11px] text-ey-muted mt-0.5">Submitted, not yet locked into target</p>
        </div>
      </div>
    </div>
  );
}
