'use client';

import { Clock3 } from 'lucide-react';
import type { TokenCostSummary } from '@/lib/metrics/types';
import { computeHoursSavedValueUsd, computeRoiPercent, computeDevCostUsd, computeTotalInvestmentUsd, computeRoiEligibleHours } from '@/lib/metrics/roiCalc';
import { formatCompactCurrency as fmtCost, formatCompactNumber as fmtNum } from '@/lib/format';
import { InfoTooltip } from '@/components/ui/InfoTooltip';

type HoursSavedRow = NonNullable<TokenCostSummary['hoursSavedByEngagement']>[number];

interface EngagementHoursSavedPanelProps {
  rows: HoursSavedRow[];
  engagementCode: string;
  devHourRate: number;
}

const TOOL_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT',
  github: 'GitHub Copilot',
  claude: 'Claude',
  replit: 'Replit',
  factory: 'Factory AI',
  cursor: 'Cursor AI',
};

function realizationStyle(pct: number) {
  if (pct >= 100) return { label: 'On/Above Target', bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/30' };
  if (pct >= 75) return { label: 'On Track', bg: 'bg-ey-yellow/15', text: 'text-ey-yellow', border: 'border-ey-yellow/30' };
  return { label: 'Behind Target', bg: 'bg-rose-500/15', text: 'text-rose-300', border: 'border-rose-500/30' };
}

// ROI = (value of hours saved at the chosen dev-hour rate - tool cost) / tool cost * 100.
function roiColor(pct: number): string {
  if (pct >= 100) return 'text-emerald-300';
  if (pct >= 0) return 'text-ey-yellow';
  return 'text-rose-300';
}

/**
 * Hours Saved is a separate, non-metered/approved-vs-actual data source
 * (actuals-planned-overall-*.csv) joined onto the usage telemetry by (Engagement Code,
 * AI Tool) -- see lib/metrics/hoursSaved.ts. Shown only once an Engagement
 * Code has been selected in the drilldown, since that's the data's own
 * grain; it has no Super Region / Service Line / Competency breakdown of
 * its own.
 */
export function EngagementHoursSavedPanel({ rows, engagementCode, devHourRate }: EngagementHoursSavedPanelProps) {
  if (rows.length === 0) return null;

  // Engagement-level totals, across every tool row for this engagement.
  // devHoursSpent is the same value on every row (dev hours aren't tracked
  // per tool), so it's read once rather than summed.
  const totalToolCost = rows.reduce((s, r) => s + (r.cost ?? 0), 0);
  const devHoursSpent = rows[0].devHoursSpent;
  // Capped per tool row (not on the engagement total) so one tool
  // overshooting its own approved target can't borrow "room" from another.
  const totalRoiEligibleHours = rows.reduce((s, r) => s + computeRoiEligibleHours(r.sumOfMonthlyHrs, r.approvedTotalHrs), 0);
  const totalHoursSavedValueUsd = computeHoursSavedValueUsd(totalRoiEligibleHours, devHourRate);
  const devCostUsd = computeDevCostUsd(devHoursSpent, devHourRate);
  const totalInvestmentUsd = computeTotalInvestmentUsd(totalToolCost, devCostUsd);
  const totalInvestmentRoiPercent = computeRoiPercent(totalHoursSavedValueUsd, totalInvestmentUsd);

  return (
    <div className="bg-ey-card border border-ey-border rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-ey-yellow/20 border border-ey-yellow/40 rounded-lg text-ey-yellow shrink-0">
          <Clock3 className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-ey-light tracking-tight">Hours Saved &amp; Cost Efficiency</h3>
          <p className="text-xs text-ey-muted mt-0.5">
            Approved vs. actual productivity hours for <span className="text-ey-light font-semibold">{engagementCode}</span>, and what each hour cost to deliver.
          </p>
        </div>
      </div>

      <div className="bg-ey-black/60 border border-ey-border/80 rounded-xl p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-[10px] text-ey-muted uppercase tracking-wider">Engagement Total Investment &amp; ROI</p>
          <InfoTooltip widthClassName="w-64">
            <span className="font-semibold text-ey-yellow block mb-1">How this is calculated</span>
            Dev Hours = hours clocked on {engagementCode} (mock timesheet data) = <span className="font-mono">{fmtNum(devHoursSpent)} hrs</span>, at ${devHourRate}/dev-hr = <span className="font-mono">{fmtCost(devCostUsd)}</span>.<br />
            Total Investment = AI Tool Cost + Dev Cost = <span className="font-mono">{fmtCost(totalToolCost)} + {fmtCost(devCostUsd)} = {fmtCost(totalInvestmentUsd)}</span>.<br />
            Value of Hours Saved uses Hours Saved capped at each tool&apos;s Approved Hrs &mdash; hours recorded beyond what&apos;s approved don&apos;t count yet.<br />
            ROI % = (Value of Hours Saved &minus; Total Investment) &divide; Total Investment &times; 100 = <span className="font-mono">({fmtCost(totalHoursSavedValueUsd)} &minus; {fmtCost(totalInvestmentUsd)}) &divide; {fmtCost(totalInvestmentUsd)} &times; 100 = {totalInvestmentRoiPercent !== null ? `${totalInvestmentRoiPercent >= 0 ? '+' : ''}${totalInvestmentRoiPercent}%` : '—'}</span>
          </InfoTooltip>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <p className="text-[10px] text-ey-muted uppercase tracking-wider">Dev Hours</p>
            <p className="font-bold text-ey-light">{fmtNum(devHoursSpent)} hrs</p>
            <p className="text-[10px] text-ey-muted">{fmtCost(devCostUsd)} at ${devHourRate}/hr</p>
          </div>
          <div>
            <p className="text-[10px] text-ey-muted uppercase tracking-wider">AI Tool Cost</p>
            <p className="font-bold text-ey-light">{fmtCost(totalToolCost)}</p>
          </div>
          <div>
            <p className="text-[10px] text-ey-muted uppercase tracking-wider">Total Investment</p>
            <p className="font-bold text-ey-light">{fmtCost(totalInvestmentUsd)}</p>
          </div>
          <div>
            <p className="text-[10px] text-ey-muted uppercase tracking-wider">ROI</p>
            <p className={`font-bold ${totalInvestmentRoiPercent !== null ? roiColor(totalInvestmentRoiPercent) : 'text-ey-muted'}`}>
              {totalInvestmentRoiPercent !== null ? `${totalInvestmentRoiPercent >= 0 ? '+' : ''}${totalInvestmentRoiPercent}%` : '—'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {rows.map((r) => {
          const status = realizationStyle(r.realizationPercent);
          const roiEligibleHours = computeRoiEligibleHours(r.sumOfMonthlyHrs, r.approvedTotalHrs);
          const hoursSavedValueUsd = computeHoursSavedValueUsd(roiEligibleHours, devHourRate);
          const roiPercent = computeRoiPercent(hoursSavedValueUsd, r.cost);
          // The source file spans the full fiscal year (Jul-Jun), with
          // future months sitting at 0 until they actually arrive -- showing
          // all 12 as columns would mostly be a wall of zeros/dashes, so
          // only months with either recorded hours or a cost match are shown.
          const monthLabels = Object.keys(r.monthlyHours).filter(
            (m) => r.monthlyHours[m] > 0 || r.monthlyCost[m] !== null
          );
          return (
            <div key={r.aiTool} className="bg-ey-black/60 border border-ey-border/80 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-ey-light">{TOOL_LABELS[r.aiTool] || r.assetName}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${status.bg} ${status.text} ${status.border}`}>
                  {status.label}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <p className="text-[10px] text-ey-muted uppercase tracking-wider">Hours Saved</p>
                  <p className="font-bold text-ey-light">
                    {r.sumOfMonthlyHrs} <span className="text-ey-muted font-normal">/ {r.approvedTotalHrs} approved</span>
                  </p>
                  <p className={`text-[10px] font-semibold ${status.text}`}>{r.realizationPercent}% realized</p>
                  {r.pendingApprovalHrs > 0 && (
                    <p className="text-[10px] text-amber-300 mt-0.5">+{r.pendingApprovalHrs} hrs pending approval</p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] text-ey-muted uppercase tracking-wider">Tool Cost</p>
                  <p className="font-bold text-ey-light">{r.cost !== null ? fmtCost(r.cost) : '—'}</p>
                  <p className="text-[10px] text-ey-muted">
                    {r.costPerHourSaved !== null ? `${fmtCost(r.costPerHourSaved)} / hour saved` : 'No hours saved yet'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-ey-muted uppercase tracking-wider">ROI</p>
                  <p className={`font-bold ${roiPercent !== null ? roiColor(roiPercent) : 'text-ey-muted'}`}>
                    {roiPercent !== null ? `${roiPercent >= 0 ? '+' : ''}${roiPercent}%` : '—'}
                  </p>
                  <p className="text-[10px] text-ey-muted">{fmtCost(hoursSavedValueUsd)} value saved</p>
                </div>
              </div>

              <div className="overflow-x-auto border-t border-ey-border/60 pt-2">
                <table className="w-full text-left text-[11px] font-mono">
                  <thead className="text-ey-muted uppercase tracking-wider">
                    <tr>
                      <th className="py-1 pr-3">Month</th>
                      {monthLabels.map((m) => (
                        <th key={m} className="py-1 px-2 text-right">{m}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ey-border/40">
                    <tr>
                      <td className="py-1 pr-3 text-ey-muted">Hours</td>
                      {monthLabels.map((m) => (
                        <td key={m} className="py-1 px-2 text-right text-ey-light">{r.monthlyHours[m]}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-1 pr-3 text-ey-muted">Cost</td>
                      {monthLabels.map((m) => {
                        const c = r.monthlyCost[m];
                        return (
                          <td key={m} className="py-1 px-2 text-right text-ey-light">
                            {c !== null ? fmtCost(c) : <span className="text-ey-muted">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                    <tr>
                      <td className="py-1 pr-3 text-ey-muted">$ / Hour</td>
                      {monthLabels.map((m) => {
                        const v = r.monthlyCostPerHourSaved[m];
                        return (
                          <td key={m} className="py-1 px-2 text-right font-bold text-ey-yellow">
                            {v !== null ? fmtCost(v) : <span className="text-ey-muted font-normal">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
