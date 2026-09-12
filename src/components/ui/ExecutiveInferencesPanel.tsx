'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  TrendingDown,
  Building2,
  Users,
  UserCheck,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Layers,
  ArrowUpRight,
  ShieldAlert,
  FolderKanban,
  BarChart3,
  Wallet,
} from 'lucide-react';
import { TokenCostSummary } from '@/lib/metrics/types';

interface ExecutiveInferencesPanelProps {
  summary?: TokenCostSummary;
  /** Total distinct users across the whole dataset (unfiltered) — used as the seat roster baseline. */
  totalRosterSeats?: number;
  onSelectInference?: (inferenceId: string) => void;
}

const fmtCost = (v: number) => `$${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (v: number) => `${(Number.isFinite(v) ? v : 0).toFixed(1)}%`;

export function ExecutiveInferencesPanel({ summary, totalRosterSeats, onSelectInference }: ExecutiveInferencesPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const router = useRouter();

  if (!summary) return null;

  const totalCost = summary.totalCost || 0;

  // 1. User Engagement Telemetry — active seats (this filtered window) vs the full unfiltered roster
  const activeUserCount = summary.userCapacityBreakdown.length;
  const rosterSeats = totalRosterSeats && totalRosterSeats > 0 ? totalRosterSeats : activeUserCount;
  const inactiveUserCount = Math.max(0, rosterSeats - activeUserCount);
  const activeSeatPercent = rosterSeats > 0 ? (activeUserCount / rosterSeats) * 100 : 0;
  const avgLicenseCostPerSeat = activeUserCount > 0 ? summary.totalLicenseCost / activeUserCount : 0;
  const inactiveLeakageCost = Math.round(inactiveUserCount * avgLicenseCostPerSeat);

  // 2. Financial Run-Rate & Volatility — derived from the monthly trend
  const months = summary.monthlyTrend || [];
  let volatility: { stat: string; statSub: string; finding: string; actionableInsight: string };
  if (months.length >= 2) {
    const momChanges = months.slice(1).map((m, i) => {
      const prev = months[i];
      const pct = prev.cost > 0 ? ((m.cost - prev.cost) / prev.cost) * 100 : 0;
      return { label: m.monthLabel, pct };
    });
    const last = months[months.length - 1];
    const lastChange = momChanges[momChanges.length - 1];
    const peak = months.reduce((a, b) => (b.cost > a.cost ? b : a));
    const trough = months.reduce((a, b) => (b.cost < a.cost ? b : a));
    const maxSwing = Math.max(...momChanges.map((c) => c.pct));
    const minSwing = Math.min(...momChanges.map((c) => c.pct));
    volatility = {
      stat: `${lastChange.pct >= 0 ? '+' : ''}${lastChange.pct.toFixed(1)}% MoM ${lastChange.pct >= 0 ? 'Surge' : 'Drop'}`,
      statSub: `${last.monthLabel} at ${fmtCost(last.cost)}`,
      finding: `Spend moved from ${fmtCost(trough.cost)} in ${trough.monthLabel} to ${fmtCost(peak.cost)} in ${peak.monthLabel}, with month-over-month swings ranging ${minSwing.toFixed(1)}% to +${maxSwing.toFixed(1)}% across the ${months.length} months in the selected range.`,
      actionableInsight: 'Re-forecast mid-cycle budgets and establish monthly automated budget thresholds to smooth run-rate volatility.',
    };
  } else {
    volatility = {
      stat: months.length === 1 ? fmtCost(months[0].cost) : fmtCost(0),
      statSub: 'Single month in range — no MoM trend available',
      finding: 'The selected date range spans fewer than two calendar months, so month-over-month volatility cannot be computed. Widen the date filter to see a trend.',
      actionableInsight: 'Expand the date range filter to compare spend across multiple months.',
    };
  }

  // 3. Pareto Cost Concentration — top 10%/20% of active users by actual spend
  const usersSorted = [...summary.userCapacityBreakdown].sort((a, b) => b.actualCost - a.actualCost);
  const top10Count = Math.max(1, Math.round(usersSorted.length * 0.1));
  const top20Count = Math.max(1, Math.round(usersSorted.length * 0.2));
  const top10Spend = usersSorted.slice(0, top10Count).reduce((s, u) => s + u.actualCost, 0);
  const top20Spend = usersSorted.slice(0, top20Count).reduce((s, u) => s + u.actualCost, 0);
  const top10Percent = totalCost > 0 ? (top10Spend / totalCost) * 100 : 0;
  const top20Percent = totalCost > 0 ? (top20Spend / totalCost) * 100 : 0;

  // 4. Geographic Asymmetry (region + country only — service line has its own dedicated card below)
  const regionsSorted = [...summary.byManagementRegion].sort((a, b) => b.cost - a.cost);
  const topRegion = regionsSorted[0];
  const bottomRegion = regionsSorted[regionsSorted.length - 1];
  const topRegionPercent = topRegion && totalCost > 0 ? (topRegion.cost / totalCost) * 100 : 0;
  const regionMultiple = topRegion && bottomRegion && bottomRegion.cost > 0 ? topRegion.cost / bottomRegion.cost : 0;
  const countriesSorted = [...summary.byCountry].sort((a, b) => b.cost - a.cost);
  const topCountry = countriesSorted[0];
  const topCountryPercent = topCountry && totalCost > 0 ? (topCountry.cost / totalCost) * 100 : 0;

  // 4b. License Investment ROI Governance
  const licenseUnderutilizedCost = summary.licenseUnderutilizedCost || 0;
  const licenseRoiPercent = summary.licenseRoiPercent || 0;

  // 4c. Multi-Tool License Consolidation (dual-platform seat overlap)
  const overlap = summary.multiToolOverlap;

  // 5. Client Billability (real Billable/Non-Billable CSV flag, not project codes)
  const nonBillablePercent = 100 - (summary.billableSpendPercent || 0);

  // 6. External vs Internal Projects (E-XXXXXX / I-XXXXXX project codes)
  const externalCount = (summary.byProjectCode || []).filter((p) => p.projectType === 'External').length;
  const internalCount = (summary.byProjectCode || []).filter((p) => p.projectType === 'Internal').length;
  const internalProjectPercent = 100 - (summary.externalProjectPercent || 0);

  // 7. Service Line Usage & Cost Efficiency Comparison
  const slWithMetrics = summary.byServiceLine.map((sl) => ({
    ...sl,
    perUser: sl.userCount ? sl.cost / sl.userCount : 0,
    unitCostPer1k: sl.tokens > 0 ? sl.cost / (sl.tokens / 1000) : 0,
  }));
  const topByCost = [...slWithMetrics].sort((a, b) => b.cost - a.cost)[0];
  const highestIntensity = [...slWithMetrics].sort((a, b) => b.perUser - a.perUser)[0];
  const lowestUnitCost = [...slWithMetrics].filter((x) => x.unitCostPer1k > 0).sort((a, b) => a.unitCostPer1k - b.unitCostPer1k)[0];
  const highestUnitCost = [...slWithMetrics].sort((a, b) => b.unitCostPer1k - a.unitCostPer1k)[0];
  const topByCostPercent = topByCost && totalCost > 0 ? (topByCost.cost / totalCost) * 100 : 0;

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
      id: 'financial_volatility',
      title: 'Financial Run-Rate & Volatility Alert',
      tag: 'Financial Governance',
      tagColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      icon: volatility.stat.startsWith('-') ? TrendingDown : TrendingUp,
      stat: volatility.stat,
      statSub: volatility.statSub,
      finding: volatility.finding,
      actionableInsight: volatility.actionableInsight,
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
    {
      id: 'geo_asymmetry',
      title: 'Geographic Spend Asymmetry',
      tag: 'Organizational Skew',
      tagColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
      icon: Building2,
      stat: topRegion ? `${fmtPct(topRegionPercent)} Spend in ${topRegion.region}` : 'No regional data',
      statSub: topCountry ? `${topCountry.country} alone drives ${fmtPct(topCountryPercent)} of total spend` : '-',
      finding:
        topRegion && bottomRegion
          ? `${topRegion.region} accounts for ${fmtCost(topRegion.cost)} (${fmtPct(topRegionPercent)} of spend)${regionMultiple >= 1.5 ? ` — ${regionMultiple.toFixed(1)}x ${bottomRegion.region} (${fmtCost(bottomRegion.cost)})` : ''}.${topCountry ? ` ${topCountry.country} alone drives ${fmtPct(topCountryPercent)} of total company spend.` : ''}`
          : 'Not enough regional data in the selected filters to compute asymmetry.',
      actionableInsight: 'Rebalance regional AI budget allocations and validate whether the leading region/country reflects genuine client delivery intensity or unmanaged growth.',
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
      id: 'external_vs_internal',
      title: 'External Projects vs. Internal Projects',
      tag: 'Portfolio Capitalization Governance',
      tagColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      icon: FolderKanban,
      stat: `${fmtPct(summary.externalProjectPercent || 0)} External vs ${fmtPct(internalProjectPercent)} Internal`,
      statSub: `${fmtCost(summary.externalProjectSpend)} (${externalCount} PRJs) vs ${fmtCost(summary.internalProjectSpend)} (${internalCount} PRJs)`,
      finding: `Out of ${fmtCost(totalCost)} in total AI consumption, ${fmtCost(summary.externalProjectSpend)} (${fmtPct(summary.externalProjectPercent || 0)} across ${externalCount} project codes) was deployed on external client delivery engagements (E-codes), while ${fmtCost(summary.internalProjectSpend)} (${fmtPct(internalProjectPercent)}) was absorbed by ${internalCount} internal R&D codes (I-codes).`,
      actionableInsight: 'Institute capitalization milestone reviews for internal projects with material cumulative AI spend to verify IP conversion, while ensuring external client AI charges are systematically billed back.',
    },
    {
      id: 'service_line_comparison',
      title: 'Service Line Usage & Cost Efficiency Comparison',
      tag: 'Practice Cost Benchmarking',
      tagColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      icon: BarChart3,
      stat: topByCost ? `${topByCost.serviceLine} ${fmtPct(topByCostPercent)} Spend` : 'No service line data',
      statSub: highestIntensity ? `${highestIntensity.serviceLine} highest at ${fmtCost(highestIntensity.perUser)}/user` : '-',
      finding:
        topByCost && lowestUnitCost && highestUnitCost
          ? `Consumption diverges across service lines: ${topByCost.serviceLine} leads in overall spend at ${fmtCost(topByCost.cost)} (${fmtPct(topByCostPercent)}). ${highestIntensity.serviceLine} shows the highest per-user intensity at ${fmtCost(highestIntensity.perUser)}/user. Unit cost ranges from ${fmtCost(lowestUnitCost.unitCostPer1k)}/1K tokens (${lowestUnitCost.serviceLine}, most efficient) to ${fmtCost(highestUnitCost.unitCostPer1k)}/1K tokens (${highestUnitCost.serviceLine}).`
          : 'Not enough service line data in the selected filters to compare.',
      actionableInsight: `Cross-pollinate ${lowestUnitCost?.serviceLine || 'the most efficient practice'}'s prompt patterns to higher-unit-cost service lines to curb spend.`,
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
              C-Suite actionable insights derived directly from <span className="font-mono text-ey-yellow font-medium">ai_usage_data.csv</span> for the current filters
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
