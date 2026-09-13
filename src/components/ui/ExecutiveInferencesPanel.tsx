'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  UserCheck,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Layers,
  ArrowUpRight,
  ShieldAlert,
  Wallet,
  Gauge,
} from 'lucide-react';
import { TokenCostSummary } from '@/lib/metrics/types';

interface ExecutiveInferencesPanelProps {
  summary?: TokenCostSummary;
  onSelectInference?: (inferenceId: string) => void;
}

const fmtCost = (v: number) => `$${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (v: number) => `${(Number.isFinite(v) ? v : 0).toFixed(1)}%`;

export function ExecutiveInferencesPanel({ summary, onSelectInference }: ExecutiveInferencesPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const router = useRouter();

  if (!summary) return null;

  const totalCost = summary.totalCost || 0;

  // 1. User Engagement Telemetry — active (>=1 token used) vs inactive (licensed,
  // 0 tokens used) seats within the current filter window.
  const activeUserCount = summary.activeUserCount;
  const inactiveUserCount = summary.inactiveUserCount;
  const rosterSeats = summary.totalRosterUserCount;
  const activeSeatPercent = rosterSeats > 0 ? (activeUserCount / rosterSeats) * 100 : 0;
  const avgLicenseCostPerSeat = activeUserCount > 0 ? summary.totalLicenseCost / activeUserCount : 0;
  const inactiveLeakageCost = Math.round(inactiveUserCount * avgLicenseCostPerSeat);

  // 3. Pareto Cost Concentration — top 10%/20% of active users by actual spend
  const usersSorted = [...summary.userCapacityBreakdown].sort((a, b) => b.actualCost - a.actualCost);
  const top10Count = Math.max(1, Math.round(usersSorted.length * 0.1));
  const top20Count = Math.max(1, Math.round(usersSorted.length * 0.2));
  const top10Spend = usersSorted.slice(0, top10Count).reduce((s, u) => s + u.actualCost, 0);
  const top20Spend = usersSorted.slice(0, top20Count).reduce((s, u) => s + u.actualCost, 0);
  const top10Percent = totalCost > 0 ? (top10Spend / totalCost) * 100 : 0;
  const top20Percent = totalCost > 0 ? (top20Spend / totalCost) * 100 : 0;

  // 4b. License Investment ROI Governance
  const licenseUnderutilizedCost = summary.licenseUnderutilizedCost || 0;
  const licenseRoiPercent = summary.licenseRoiPercent || 0;

  // 4c. Multi-Tool License Consolidation (dual-platform seat overlap)
  const overlap = summary.multiToolOverlap;

  // 5. Client Billability (real Billable/Non-Billable CSV flag)
  const nonBillablePercent = 100 - (summary.billableSpendPercent || 0);

  // 8. Habitual User Retention & Health (real per-user active-day cohorts)
  const cohorts = summary.userEngagementCohorts;
  const retainedPercent = cohorts ? 100 - cohorts.dropoutPercent : 0;

  const inferences = [
    {
      id: 'seat_utilization',
      title: 'Active / Inactive Users Telemetry (Seat Utilization)',
      tag: 'User Engagement Telemetry',
      tagColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      icon: UserCheck,
      stat: `${activeSeatPercent.toFixed(1)}% Active Utilization`,
      statSub: `${activeUserCount} Active vs ${inactiveUserCount} Inactive Seats (${fmtCost(inactiveLeakageCost)}/mo Leakage)`,
      finding:
        inactiveUserCount > 0
          ? `Out of ${rosterSeats} provisioned seats (full dataset roster), ${activeUserCount} users (${activeSeatPercent.toFixed(1)}%) recorded prompt activity in the selected window, while ${inactiveUserCount} seats remained inactive, implying ${fmtCost(inactiveLeakageCost)}/mo in unutilized average per-seat license cost.`
          : `All ${rosterSeats} seats in the dataset recorded active prompt consumption during this window, achieving ${activeSeatPercent.toFixed(1)}% active seat engagement with zero dormant license overhead.`,
      actionableInsight:
        inactiveUserCount > 0
          ? 'Automate a 30-day inactivity license reclamation workflow: reallocate dormant seats to waitlisted teams or convert low-activity seats to consumption-only API keys.'
          : 'Maintain active monitoring and expand license seat capacity proactively as new engineering cohorts onboard.',
    },
    {
      id: 'license_roi_governance',
      drilldownId: '__navigate_roi__',
      title: 'License Waste & Consolidation',
      tag: 'Financial Governance',
      tagColor: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
      icon: Wallet,
      stat: `${fmtPct(licenseRoiPercent)} License ROI`,
      statSub: `${fmtCost(licenseUnderutilizedCost)} unconsumed${overlap && overlap.dualToolUserCount > 0 ? ` + ${fmtCost(overlap.totalDualToolSpend)} dual-license` : ''}`,
      finding: `Only ${fmtPct(licenseRoiPercent)} of the ${fmtCost(summary.totalLicenseCost)} in real per-seat License Cost in USD was actually consumed as usage, leaving ${fmtCost(licenseUnderutilizedCost)} unconsumed.${overlap && overlap.dualToolUserCount > 0 ? ` On top of that, ${overlap.dualToolUserCount} users run two or more AI platforms concurrently, adding ${fmtCost(overlap.totalDualToolSpend)} in consolidatable dual-license spend.` : ''}`,
      actionableInsight: 'Open the Token & Spend ROI page to reclaim or downgrade underutilized licenses, and standardize dual-platform users onto a single primary AI tool.',
    },
    {
      id: 'capacity_waste_overage',
      drilldownId: '__navigate_roi__',
      title: 'Capacity Waste & Overage Risk',
      tag: 'Capacity Governance',
      tagColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      icon: Gauge,
      stat: `${fmtCost(summary.totalWasteCost)} Unconsumed Capacity`,
      statSub: `${fmtCost(summary.totalOverageCost)} overage · ${summary.ceilingRiskCount} users near 100K cap`,
      finding: `On average, only ${fmtPct(summary.licenseEfficiencyRate || 0)} of each user's per-tool free-token allowance is actually consumed, leaving ${fmtCost(summary.totalWasteCost)} in unconsumed capacity (Zone 1). Separately, ${fmtCost(summary.totalOverageCost)} was billed beyond those free limits (Zone 2), and ${summary.ceilingRiskCount} users have reached or exceeded 90% of the 100,000-token hard cap.`,
      actionableInsight: 'Open the Token & Spend ROI page to review the Zone 1 waste and Zone 2 overage breakdown, and flag users nearing the 100K token ceiling before they hit hard limits.',
    },
    {
      id: 'project_billability',
      title: 'Client Billability Telemetry (Billable / Non-Billable flag)',
      tag: 'Project ROI Governance',
      tagColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      icon: Layers,
      stat: `${fmtPct(summary.billableSpendPercent || 0)} Billable AI Spend`,
      statSub: `${fmtCost(summary.billableSpend)} Billable vs ${fmtCost(summary.nonBillableSpend)} Non-Billable`,
      finding: `${fmtPct(summary.billableSpendPercent || 0)} of total AI spend (${fmtCost(summary.billableSpend)}) is flagged Billable in the CSV. Non-billable internal overhead accounts for ${fmtCost(summary.nonBillableSpend)} (${fmtPct(nonBillablePercent)}).`,
      actionableInsight: 'Audit the largest non-billable cost centers to ensure internal AI investment yields reusable intellectual property or client delivery templates.',
    },
    {
      id: 'habitual_retention',
      title: 'Habitual User Retention & Health',
      tag: 'Adoption Health',
      tagColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      icon: Users,
      stat: cohorts ? `${fmtPct(retainedPercent)} Habitual Retention` : 'No engagement data',
      statSub: cohorts ? `${fmtPct(cohorts.embeddedPercent)} Embedded, ${fmtPct(cohorts.regularPercent)} Regular, ${fmtPct(cohorts.dropoutPercent)} Trial-only` : '-',
      finding: cohorts
        ? `Across ${cohorts.totalUsers} active users: ${fmtPct(cohorts.embeddedPercent)} are Embedded (16+ active days per active month), ${fmtPct(cohorts.regularPercent)} Regular (9-15 days), ${fmtPct(cohorts.occasionalPercent)} Occasional (4-8 days), and ${fmtPct(cohorts.dropoutPercent)} Trial-only (under 4 days).`
        : 'No user engagement data available for the selected filters.',
      actionableInsight:
        cohorts && cohorts.dropoutPercent > 20
          ? 'Investigate the Trial-only cohort for onboarding friction before expanding license seats further.'
          : 'AI tools show healthy habitual usage. Focus shift from basic onboarding to advanced competency training.',
    },
    {
      id: 'pareto_risk',
      title: 'Pareto Cost Concentration (80/20 Risk)',
      tag: 'Cost Risk Exposure',
      tagColor: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
      icon: ShieldAlert,
      stat: `${fmtPct(top20Percent)} Spend in Top 20%`,
      statSub: `${top20Count} power users drive majority cost`,
      finding: `Spend concentration: the top 10% of active users (${top10Count} people) account for ${fmtPct(top10Percent)} of total spend, and the top 20% (${top20Count} people) account for ${fmtPct(top20Percent)} of all expenditure (${fmtCost(top20Spend)}).`,
      actionableInsight: `Avoid broad, org-wide cuts. Conduct targeted usage reviews for the top ${top20Count} power users and negotiate tier-based volume plans.`,
    },
  ];

  const handleCardClick = (item: { id: string; drilldownId?: string }) => {
    const target = item.drilldownId || item.id;
    if (target === '__navigate_roi__') {
      router.push('/dashboard/roi');
      return;
    }
    if (onSelectInference) {
      onSelectInference(target);
    }
  };

  return (
    <div className="bg-ey-card border border-ey-border rounded-xl p-5 shadow-lg space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-ey-border/60 pb-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-ey-yellow/20 border border-ey-yellow/40 rounded-lg text-ey-yellow shrink-0 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-ey-light tracking-tight">
              Leadership Strategic Inferences &amp; Decision Intelligence
            </h2>
            <p className="text-xs text-ey-muted mt-0.5">
              C-Suite actionable insights for the current filters
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center space-x-1.5 text-xs font-semibold text-ey-yellow hover:text-ey-light bg-ey-black/60 border border-ey-border px-3 py-1.5 rounded-lg transition shrink-0 self-start sm:self-center cursor-pointer"
        >
          <span>{isExpanded ? 'Collapse Insights' : 'Expand Insights'}</span>
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Grid of Inferences */}
      {isExpanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
          {inferences.map((item) => {
            const IconComponent = item.icon;
            return (
              <div
                key={item.id}
                onClick={() => handleCardClick(item)}
                className="bg-ey-black/70 border border-ey-border/80 rounded-xl p-4 space-y-3 hover:border-ey-yellow hover:shadow-xl hover:shadow-yellow-500/5 hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between cursor-pointer group select-none"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCardClick(item);
                  }
                }}
              >
                <div className="space-y-2.5">
                  {/* Top Badge & Metric */}
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${item.tagColor}`}>
                      {item.tag}
                    </span>
                    <IconComponent className="w-4 h-4 text-ey-muted group-hover:text-ey-yellow transition-colors" />
                  </div>

                  <h3 className="text-xs font-bold text-ey-light leading-snug group-hover:text-ey-yellow transition-colors flex items-center justify-between">
                    <span>{item.title}</span>
                  </h3>

                  {/* Headline Metric Highlight */}
                  <div className="bg-ey-card/90 p-2.5 rounded-lg border border-ey-border/60 flex items-center justify-between group-hover:border-ey-yellow/40 transition-colors">
                    <div>
                      <div className="text-sm font-extrabold text-ey-yellow">{item.stat}</div>
                      <div className="text-[10px] text-ey-muted">{item.statSub}</div>
                    </div>
                    <div className="p-1 rounded-md bg-ey-yellow/10 text-ey-yellow group-hover:bg-ey-yellow group-hover:text-ey-black transition-colors">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  {/* Diagnostic Finding */}
                  <p className="text-[11px] text-ey-muted leading-relaxed line-clamp-3">
                    <span className="font-semibold text-ey-light">Finding: </span>
                    {item.finding}
                  </p>
                </div>

                {/* Executive Recommendation */}
                <div className="pt-2 border-t border-ey-border/60">
                  <div className="text-[11px] bg-ey-yellow/5 p-2 rounded-lg border border-ey-yellow/20 group-hover:border-ey-yellow/30 transition-colors">
                    <span className="font-bold text-ey-yellow block mb-0.5 text-[10px] uppercase tracking-wider">Strategic Action:</span>
                    <span className="text-ey-light text-[10px] leading-normal line-clamp-2">{item.actionableInsight}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
