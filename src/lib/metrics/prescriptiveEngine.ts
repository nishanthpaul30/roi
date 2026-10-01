import { TokenCostSummary, UserCapacityRow } from '@/lib/metrics/types';
import type { CsvUsageRow } from '@/lib/data/csvTypes';
import { formatCompactCurrency as fmtCost, formatCompactNumber as fmtNum } from '@/lib/format';
import {
  DEFAULT_DEV_HOUR_RATE_USD,
  computeHoursSavedValueUsd,
  computeRoiPercent,
  computeRoiEligibleHours,
  computeDevCostUsd,
  computeTotalInvestmentUsd,
} from '@/lib/metrics/roiCalc';

export interface PrescriptiveInference {
  id: string;
  title: string;
  tag: string;
  tagColor: string;
  leverageScore: number; // Used for ranking: estimated annual dollar impact / risk
  stat: string;
  statSub: string;
  finding: string;
  actionableInsight: string; // Dynamic prescriptive action
  benefitOutcome: string;
}

const fmtPct = (v: number) => `${(Number.isFinite(v) ? v : 0).toFixed(1)}%`;

/**
 * Deterministic Prescriptive Decision Intelligence Engine
 * Computes dynamic financial leverage ranking and suggestive actions
 * for enterprise executive leadership.
 */
export function generatePrescriptiveInferences(
  summary?: TokenCostSummary,
  allRows?: CsvUsageRow[]
): PrescriptiveInference[] {
  if (!summary) return [];

  const totalCost = summary.totalCost || 0;

  // Whether the current filter selection resolves to exactly one calendar
  // month. Dollar figures below (license cost, spend, etc.) are sums over
  // every row in the selected range -- when that range spans multiple months
  // (e.g. "All Months"), the total is a period total, not a monthly rate, so
  // "/mo" wording and a x12 annualized projection would misrepresent it.
  const isSingleMonth = (summary.monthlyTrend?.length || 0) === 1;
  const moSuffix = isSingleMonth ? '/mo' : '';

  // Shared user capacity breakdown
  const capacityBreakdown: UserCapacityRow[] = summary.userCapacityBreakdown || [];

  // ---------------------------------------------------------------------------
  // 2. LICENSE RECLAMATION INTELLIGENCE
  // ---------------------------------------------------------------------------
  // Dormant Seats rule: literal per-row filter (Calculation Method = 'Usage'
  // AND GenAI Tool Consumption = 0), computed server-side in roi.ts and
  // reused here as-is so this card always matches the License Reclamation
  // drilldown -- not userCapacityBreakdown's aggregate Usage-token SUM = 0,
  // which also (incorrectly) catches users with no Usage row at all.
  const reclamationDormantCount = summary.dormantLicenseSeatCount ?? 0;
  const totalRecoverableAmount = summary.dormantLicenseRecoverableCost ?? 0;
  const annualizedRecoverable = totalRecoverableAmount * 12;
  const usageWarningUsers = capacityBreakdown.filter(
    (u) => u.tokenConsumption > 0 && u.zone === 'zone1_under'
  );
  const usageWarningCount = usageWarningUsers.length;
  const totalWarningWaste = usageWarningUsers.reduce((s, u) => s + (u.wasteCost || 0), 0);

  const reclamationInference: PrescriptiveInference = {
    id: 'license_reclamation',
    title: 'License Reclamation Intelligence',
    tag: 'Financial Governance',
    tagColor: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    leverageScore: annualizedRecoverable,
    stat: `${fmtCost(totalRecoverableAmount)} Recoverable`,
    statSub: `${reclamationDormantCount} Dormant Seats to Reclaim · ${usageWarningCount} Below Free Limit (Warning)`,
    finding:
      reclamationDormantCount > 0 || usageWarningCount > 0
        ? `${reclamationDormantCount} seat${reclamationDormantCount === 1 ? '' : 's'} recorded 0 usage against paid license fees, totaling ${fmtCost(totalRecoverableAmount)}${moSuffix} in clear, recoverable savings. An additional ${usageWarningCount} active seat${usageWarningCount === 1 ? '' : 's'} consume below their included free allowance (${fmtCost(totalWarningWaste)} prepaid capacity unused).`
        : 'Zero dormant seats identified; all provisioned licenses generated legitimate token consumption.',
    actionableInsight:
      reclamationDormantCount > 0
        ? `Deprovision the ${reclamationDormantCount} zero-consumption seats immediately via IT manifest to capture ${fmtCost(totalRecoverableAmount)}${moSuffix}. Issue automated enablement nudges to the ${usageWarningCount} under-the-free-limit seats.`
        : 'No licenses require reclamation this period. Review capacity allocation quarterly.',
    benefitOutcome:
      reclamationDormantCount > 0
        ? `Captures ${fmtCost(totalRecoverableAmount)}${moSuffix}${isSingleMonth ? ` (${fmtCost(annualizedRecoverable)}/yr)` : ''} in net expense reduction with zero operational friction, while safeguarding all active seats.`
        : 'License investment is operating at peak financial efficiency.',
  };

  // ---------------------------------------------------------------------------
  // 3. CLIENT BILLABILITY & PROJECT ALIGNMENT
  // ---------------------------------------------------------------------------
  const billableSpendPercent = summary.billableSpendPercent || 0;
  const nonBillableSpend = summary.nonBillableSpend || 0;
  const billableSpend = summary.billableSpend || 0;
  const nonBillablePct = 100 - billableSpendPercent;

  // Pinpoint the top non-billable Project Codes and Service Lines
  let topNonBillableSL = 'Consulting';
  let topNonBillableProject = 'I-INTERNAL-OVERHEAD';

  if (allRows && allRows.length > 0) {
    const slMap = new Map<string, number>();
    const projMap = new Map<string, number>();
    for (const r of allRows) {
      if (r.calculationMethod === 'Usage' && r.billableFlag === 'False' && r.cost > 0) {
        const sl = r.orgServiceLine || 'Internal CBS';
        slMap.set(sl, (slMap.get(sl) || 0) + r.cost);
        const p = r.projectCode || 'Unassigned Internal';
        projMap.set(p, (projMap.get(p) || 0) + r.cost);
      }
    }
    const sortedSL = Array.from(slMap.entries()).sort((a, b) => b[1] - a[1]);
    const sortedProj = Array.from(projMap.entries()).sort((a, b) => b[1] - a[1]);
    if (sortedSL[0]) {
      topNonBillableSL = sortedSL[0][0];
    }
    if (sortedProj[0]) {
      topNonBillableProject = sortedProj[0][0];
    }
  } else if (summary.byServiceLine && summary.byServiceLine.length > 0) {
    const sortedSL = [...summary.byServiceLine].sort((a, b) => b.cost - a.cost);
    topNonBillableSL = sortedSL[0]?.serviceLine || 'Consulting';
  }

  const billabilityInference: PrescriptiveInference = {
    id: 'project_billability',
    title: 'Client Billability & Project Telemetry Alignment',
    tag: 'Project ROI Governance',
    tagColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    leverageScore: nonBillableSpend * (nonBillablePct / 100) * 12,
    stat: `${fmtPct(billableSpendPercent)} Billable AI Spend`,
    statSub: `${fmtCost(billableSpend)} Billable vs ${fmtCost(nonBillableSpend)} Non-Billable (${fmtPct(nonBillablePct)})`,
    finding: `${fmtPct(billableSpendPercent)} of total AI spend (${fmtCost(billableSpend)}) is directly tied to revenue-generating client engagement codes (E-prefix). Non-billable internal overhead accounts for ${fmtCost(nonBillableSpend)} (${fmtPct(nonBillablePct)}).`,
    actionableInsight: `Conduct a targeted audit of ${topNonBillableSL} and engagement code ${topNonBillableProject}. Enforce client billing codes on IDE prompts to reclassify qualifying work and lift billable ratio to ≥75%.`,
    benefitOutcome: `Recovers estimated ${fmtCost(nonBillableSpend * 0.35)}${moSuffix} in billable client pass-through revenue. Solidifies audit defensibility and prevents AI spend from eroding internal practice margins.`,
  };

  // ---------------------------------------------------------------------------
  // 4. PARETO COST CONCENTRATION (80/20 EXPOSURE)
  // ---------------------------------------------------------------------------
  const usersSorted = [...capacityBreakdown].sort((a, b) => b.actualCost - a.actualCost);
  const top10Count = Math.max(1, Math.round(usersSorted.length * 0.1));
  const top20Count = Math.max(1, Math.round(usersSorted.length * 0.2));
  const top10Spend = usersSorted.slice(0, top10Count).reduce((s, u) => s + u.actualCost, 0);
  const top20Spend = usersSorted.slice(0, top20Count).reduce((s, u) => s + u.actualCost, 0);
  const top10Percent = totalCost > 0 ? (top10Spend / totalCost) * 100 : 0;
  const top20Percent = totalCost > 0 ? (top20Spend / totalCost) * 100 : 0;

  const topUser = usersSorted[0];
  const topUserName = topUser ? (topUser.displayName || topUser.userMail.split('@')[0]) : 'Top Power User';

  const potentialParetoVolumeSavings = Math.round(top20Spend * 0.25 * 12);

  const paretoInference: PrescriptiveInference = {
    id: 'pareto_risk',
    title: 'Pareto Cost Concentration (80/20 Risk)',
    tag: 'Cost Risk Exposure',
    tagColor: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    leverageScore: potentialParetoVolumeSavings,
    stat: `${fmtPct(top20Percent)} Spend in Top 20%`,
    statSub: `${top20Count} power users drive majority cost (${fmtCost(top20Spend)})`,
    finding: `Spend is highly concentrated: the top 10% of active users (${top10Count} people) drive ${fmtPct(top10Percent)} of spend (${fmtCost(top10Spend)}), and the top 20% (${top20Count} people) account for ${fmtPct(top20Percent)} of all consumption (${fmtCost(top20Spend)}).`,
    actionableInsight: `Avoid broad org-wide cuts that disrupt normal users. Implement prompt caching, batching reviews, and tiered volume commitments specifically for the top ${top20Count} power users led by ${topUserName}.`,
    benefitOutcome: `Leverages the highest-impact cost lever: a 25% optimization on the top ${top20Count} users yields ${fmtCost(top20Spend * 0.25)}${moSuffix}${isSingleMonth ? ` (${fmtCost(potentialParetoVolumeSavings)}/yr)` : ''} without disrupting 80% of staff.`,
  };

  // ---------------------------------------------------------------------------
  // 5. HOURS SAVED ROI — value of hours saved vs. total engagement investment
  // ---------------------------------------------------------------------------
  // Same math as the Engagement Analytics Hours Saved panel (see
  // lib/metrics/roiCalc.ts): Hours Saved is capped at each row's Approved
  // Hrs (hours recorded beyond the approved target aren't locked into the
  // business case yet), and Total Investment = AI tool cost + the dollar
  // value of developer hours clocked (mock timesheet data, deduped per
  // engagement so a multi-tool engagement's dev hours aren't counted once
  // per tool). Uses the default $/dev-hr rate -- this summary card has no
  // adjustable-rate control of its own.
  const hoursSavedRows = summary.hoursSavedByEngagement || [];
  const roiToolCost = hoursSavedRows.reduce((s, r) => s + (r.cost ?? 0), 0);
  const roiDevHoursByEngagement = new Map<string, number>();
  for (const r of hoursSavedRows) {
    if (!roiDevHoursByEngagement.has(r.projectCode)) roiDevHoursByEngagement.set(r.projectCode, r.devHoursSpent);
  }
  const roiTotalDevHours = Array.from(roiDevHoursByEngagement.values()).reduce((s, v) => s + v, 0);
  const roiEligibleHours = hoursSavedRows.reduce(
    (s, r) => s + computeRoiEligibleHours(r.sumOfMonthlyHrs, r.approvedTotalHrs),
    0
  );
  const roiHoursSavedValueUsd = computeHoursSavedValueUsd(roiEligibleHours, DEFAULT_DEV_HOUR_RATE_USD);
  const roiDevCostUsd = computeDevCostUsd(roiTotalDevHours, DEFAULT_DEV_HOUR_RATE_USD);
  const roiTotalInvestmentUsd = computeTotalInvestmentUsd(roiToolCost, roiDevCostUsd);
  const roiPercent = computeRoiPercent(roiHoursSavedValueUsd, roiTotalInvestmentUsd);
  const engagementCount = roiDevHoursByEngagement.size;
  const netImpact = roiHoursSavedValueUsd - roiTotalInvestmentUsd;

  const hoursSavedRoiInference: PrescriptiveInference = {
    id: 'hours_saved_roi',
    title: 'Hours Saved ROI',
    tag: 'AI Investment ROI',
    tagColor: netImpact >= 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    leverageScore: Math.abs(netImpact) * 12,
    stat: hoursSavedRows.length > 0 && roiPercent !== null ? `${roiPercent >= 0 ? '+' : ''}${roiPercent.toFixed(0)}% ROI` : 'No Hours Saved Data',
    statSub: hoursSavedRows.length > 0 ? `${fmtCost(roiHoursSavedValueUsd)} value vs ${fmtCost(roiTotalInvestmentUsd)} invested` : `${engagementCount} engagements tracked`,
    finding:
      hoursSavedRows.length > 0
        ? `Across ${engagementCount} tracked engagements, ${fmtNum(roiEligibleHours)} approved hours saved are worth ${fmtCost(roiHoursSavedValueUsd)} at the blended $${DEFAULT_DEV_HOUR_RATE_USD}/dev-hr rate, against a Total Investment of ${fmtCost(roiTotalInvestmentUsd)} (${fmtCost(roiToolCost)} AI tool cost + ${fmtCost(roiDevCostUsd)} dev hours cost).`
        : 'No Hours Saved data is currently tracked for the selected filters.',
    actionableInsight:
      hoursSavedRows.length > 0
        ? roiPercent !== null && roiPercent < 0
          ? `Open Engagement Analytics to see which engagements are furthest behind on realization, and whether tool spend or dev-hour investment is the larger driver before expanding adoption further.`
          : `Open Engagement Analytics to see which engagements and tools are delivering the strongest ROI, and prioritize expanding those patterns.`
        : 'Add Hours Saved tracking data to surface this inference.',
    benefitOutcome:
      hoursSavedRows.length > 0
        ? netImpact >= 0
          ? `Hours saved currently outweigh total investment by ${fmtCost(netImpact)}, a net positive return on the AI tooling + developer time invested.`
          : `Total investment currently exceeds the value of hours saved by ${fmtCost(Math.abs(netImpact))} -- a signal to review scope or realization before committing further spend.`
        : 'Tracking this once Hours Saved data is available will quantify AI adoption ROI directly.',
  };

  // ---------------------------------------------------------------------------
  // 6. TOOL OVERLAP COST — users paying for redundant capabilities
  // ---------------------------------------------------------------------------
  // Overlap user count = COUNT(DISTINCT User Email) WHERE user has Cost USD > 0
  // for 2+ Products in the SAME MONTH (concurrent redundant spend, not just
  // "used two tools at some point across the whole period").
  let overlapUserCount = 0;
  let overlapCost = 0;
  if (allRows && allRows.length > 0) {
    const userMonthTools = new Map<string, Set<string>>(); // `${email}|${monthId}` -> tools
    for (const r of allRows) {
      if (r.calculationMethod !== 'Usage' || !(r.cost > 0)) continue;
      const email = (r.userMail || '').toLowerCase().trim();
      if (!email) continue;
      const key = `${email}|${r.monthId}`;
      if (!userMonthTools.has(key)) userMonthTools.set(key, new Set());
      userMonthTools.get(key)!.add(r.aiTool);
    }
    const overlapEmails = new Set<string>();
    for (const [key, tools] of userMonthTools.entries()) {
      if (tools.size >= 2) overlapEmails.add(key.split('|')[0]);
    }
    overlapUserCount = overlapEmails.size;
    for (const r of allRows) {
      if (r.calculationMethod !== 'Usage') continue;
      const email = (r.userMail || '').toLowerCase().trim();
      if (overlapEmails.has(email)) overlapCost += r.cost;
    }
    overlapCost = Number(overlapCost.toFixed(2));
  } else {
    // No row-level data available yet — fall back to the period-wide overlap
    // already computed for the Multi-Tool Comparison page (users who used 2+
    // tools at any point in the period, not necessarily the same month).
    overlapUserCount = summary.multiToolOverlap?.dualToolUserCount || 0;
    overlapCost = summary.multiToolOverlap?.totalDualToolSpend || 0;
  }
  const annualizedOverlapCost = overlapCost * 12;

  const toolOverlapInference: PrescriptiveInference = {
    // Reuses the existing Multi-Tool Comparison drilldown (same page the
    // Multi-Tool Comparison tab's "Deep Dive" button opens) instead of a new
    // bespoke view, since it already shows exactly this: per-tool unit
    // economics, the overlap user count/spend, and a hierarchy drilldown
    // scoped to just the overlapping users.
    id: 'multi_tool_comparison',
    title: 'Tool Overlap Cost',
    tag: 'Redundant Capability Spend',
    tagColor: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20',
    leverageScore: annualizedOverlapCost,
    stat: `${overlapUserCount} Users Paying for Overlap`,
    statSub: `${fmtCost(overlapCost)}${moSuffix} across redundant tools`,
    finding:
      overlapUserCount > 0
        ? `${overlapUserCount} users incurred Cost USD > 0 on 2 or more AI products in the same month, together generating ${fmtCost(overlapCost)}${moSuffix}${isSingleMonth ? ` (${fmtCost(annualizedOverlapCost)} annualised)` : ''} in overlapping tool spend — capability that's effectively being paid for twice.`
        : 'No users currently show concurrent paid usage across two or more AI products in the same month.',
    actionableInsight:
      overlapUserCount > 0
        ? `Open the Multi-Tool Comparison view to see which tool pairs overlap most, then standardize each overlapping user onto a single primary tool that covers their workload.`
        : 'No tool consolidation opportunity identified this period.',
    benefitOutcome:
      overlapUserCount > 0
        ? `Eliminates up to ${fmtCost(overlapCost)}${moSuffix}${isSingleMonth ? ` (${fmtCost(annualizedOverlapCost)}/yr)` : ''} in redundant spend by consolidating overlapping users onto one tool. Also simplifies vendor management and reduces support overhead.`
        : 'Tool portfolio is already lean — no redundant concurrent spend to recover.',
  };

  // ---------------------------------------------------------------------------
  // 7. NON-BILLABLE COST OVERRUN — engagements burning margin with no revenue offset
  // ---------------------------------------------------------------------------
  // Engagement Code prefix is the app-wide billability signal (E- = billable/
  // External, I- = Internal/Non-Billable) — see isBillableCode elsewhere.
  const isBillableCode = (code: string) => code.startsWith('E-');
  let nonBillableEngagementCount = 0;
  let flaggedEngagementCount = 0;
  let totalExposure = 0;
  if (allRows && allRows.length > 0) {
    const engagementMap = new Map<string, { cost: number; users: Set<string> }>();
    for (const r of allRows) {
      if (r.calculationMethod !== 'Usage') continue;
      const code = (r.projectCode || 'Unassigned Internal').trim();
      if (isBillableCode(code)) continue;
      if (!engagementMap.has(code)) engagementMap.set(code, { cost: 0, users: new Set() });
      const entry = engagementMap.get(code)!;
      entry.cost += r.cost;
      const email = (r.userMail || '').toLowerCase().trim();
      if (email) entry.users.add(email);
    }
    nonBillableEngagementCount = engagementMap.size;
    for (const { cost, users } of engagementMap.values()) {
      const avgCostPerUser = users.size > 0 ? cost / users.size : 0;
      if (avgCostPerUser > 100) {
        flaggedEngagementCount++;
        totalExposure += cost;
      }
    }
  } else {
    // Fall back to the pre-aggregated per-Engagement-Code totals already on
    // the summary (mixes Usage + License cost, so slightly less precise, but
    // avoids requiring a raw-row fetch just for the headline card).
    const nonBillableCodes = (summary.byProjectCode || []).filter(
      (p) => !isBillableCode(p.projectCode) && p.userCount > 0
    );
    nonBillableEngagementCount = nonBillableCodes.length;
    const flagged = nonBillableCodes.filter((p) => p.cost / p.userCount > 100);
    flaggedEngagementCount = flagged.length;
    totalExposure = flagged.reduce((s, p) => s + p.cost, 0);
  }
  totalExposure = Number(totalExposure.toFixed(2));
  const percentNonBillableAtRisk = nonBillableEngagementCount > 0 ? (flaggedEngagementCount / nonBillableEngagementCount) * 100 : 0;
  const annualizedExposure = totalExposure * 12;

  const nonBillableOverrunInference: PrescriptiveInference = {
    id: 'non_billable_overrun',
    title: 'Non-Billable Cost Overrun',
    tag: 'Margin Risk',
    tagColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    leverageScore: annualizedExposure,
    stat: `${fmtPct(percentNonBillableAtRisk)} Non-Billable at Risk`,
    statSub: `${flaggedEngagementCount} of ${nonBillableEngagementCount} engagements · ${fmtCost(totalExposure)}${moSuffix} exposure`,
    finding:
      flaggedEngagementCount > 0
        ? `${fmtPct(percentNonBillableAtRisk)} of non-billable engagements (${flaggedEngagementCount} of ${nonBillableEngagementCount}) have an average cost per user above $100/month, together accounting for ${fmtCost(totalExposure)}${moSuffix}${isSingleMonth ? ` (${fmtCost(annualizedExposure)} annualised)` : ''} in unrecovered spend. This is pure margin drag — none of it is offset by client billing.`
        : `No non-billable engagements are currently running above the $100/user/month threshold.`,
    actionableInsight:
      flaggedEngagementCount > 0
        ? `Drill into each flagged engagement's CT/Non-CT → Country → Service Line → Sub-Service Line hierarchy to identify which teams and users are driving the overrun, then apply targeted remediation.`
        : 'No remediation required this period.',
    benefitOutcome:
      flaggedEngagementCount > 0
        ? `Recovers up to ${fmtCost(totalExposure)}${moSuffix}${isSingleMonth ? ` (${fmtCost(annualizedExposure)}/yr)` : ''} in unrecovered internal spend once root causes are addressed, protecting practice margin without cutting legitimate client-billable usage.`
        : 'Non-billable spend is currently within a healthy per-user range.',
  };

  // ---------------------------------------------------------------------------
  // Compile inferences array with License Reclamation Intelligence pinned
  // first (#1) and Hours Saved ROI pinned second (#2); the remaining
  // strategic cards are sorted dynamically by financial leverage score.
  // ---------------------------------------------------------------------------
  const otherInferences = [
    billabilityInference,
    paretoInference,
    toolOverlapInference,
    nonBillableOverrunInference,
  ].sort((a, b) => b.leverageScore - a.leverageScore);

  return [reclamationInference, hoursSavedRoiInference, ...otherInferences];
}
