'use client';

import { Clock3 } from 'lucide-react';
import type { TokenCostSummary } from '@/lib/metrics/types';
import { formatCompactCurrency as fmtCost } from '@/lib/format';

type HoursSavedRow = NonNullable<TokenCostSummary['hoursSavedByEngagement']>[number];

interface EngagementHoursSavedPanelProps {
  rows: HoursSavedRow[];
  engagementCode: string;
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

/**
 * Hours Saved is a separate, non-metered/approved-vs-actual data source
 * (actuals-planned-overall-*.csv) joined onto the usage telemetry by (Engagement Code,
 * AI Tool) -- see lib/metrics/hoursSaved.ts. Shown only once an Engagement
 * Code has been selected in the drilldown, since that's the data's own
 * grain; it has no Super Region / Service Line / Competency breakdown of
 * its own.
 */
export function EngagementHoursSavedPanel({ rows, engagementCode }: EngagementHoursSavedPanelProps) {
  if (rows.length === 0) return null;

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {rows.map((r) => {
          const status = realizationStyle(r.realizationPercent);
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

              <div className="grid grid-cols-2 gap-3 text-xs">
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
