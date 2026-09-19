import { TokenCostSummary, UserCapacityRow } from '@/lib/metrics/types';
import type { CsvUsageRow } from '@/lib/data/csvTypes';
import { formatCompactCurrency as fmtCost } from '@/lib/format';

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
  const activeUserCount = summary.activeUserCount || 0;
  const inactiveUserCount = summary.inactiveUserCount || 0;
  const rosterSeats = summary.totalRosterUserCount || (activeUserCount + inactiveUserCount) || 1;
  const activeSeatPercent = rosterSeats > 0 ? (activeUserCount / rosterSeats) * 100 : 0;
  const avgLicenseCostPerSeat = activeUserCount > 0 ? summary.totalLicenseCost / activeUserCount : 100;
  const inactiveLeakageCost = Math.round(inactiveUserCount * avgLicenseCostPerSeat);
  const annualizedInactiveLeakage = inactiveLeakageCost * 12;

  // Shared user capacity breakdown
  const capacityBreakdown: UserCapacityRow[] = summary.userCapacityBreakdown || [];
  const dormantSeats = capacityBreakdown.filter(
    (u) => u.licenseCost > 0 && u.tokenConsumption === 0
  );

  // ---------------------------------------------------------------------------
  // 1. SEAT UTILIZATION & TELEMETRY
  // ---------------------------------------------------------------------------
  // Aggregate dormant seats by Service Line
  const slDormantMap = new Map<string, { count: number; cost: number }>();
  if (allRows && allRows.length > 0) {
    const periodActive = new Set(
      allRows.filter((r) => r.calculationMethod === 'Usage' && r.tokenConsumption > 0)
        .map((r) => (r.userMail || '').toLowerCase().trim())
    );
    const seenDormant = new Set<string>();
    for (const r of allRows) {
      const email = (r.userMail || '').toLowerCase().trim();
      if (!email || periodActive.has(email) || seenDormant.has(email)) continue;
      seenDormant.add(email);
      const sl = r.orgServiceLine || 'General';
      const entry = slDormantMap.get(sl) || { count: 0, cost: 0 };
      entry.count += 1;
      entry.cost += avgLicenseCostPerSeat;
      slDormantMap.set(sl, entry);
    }
  }

  const topDormantSL = Array.from(slDormantMap.entries()).sort((a, b) => b[1].count - a[1].count)[0];
  const topDormantSLName = topDormantSL ? topDormantSL[0] : 'core service lines';
  const topDormantSLCount = topDormantSL ? topDormantSL[1].count : dormantSeats.length;

  const seatInference: PrescriptiveInference = {
    id: 'seat_utilization',
    title: 'Active / Inactive Users Telemetry (License Utilization)',
    tag: 'User Engagement Telemetry',
    tagColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    leverageScore: annualizedInactiveLeakage,
    stat: `${activeSeatPercent.toFixed(1)}% Active Utilization`,
    statSub: `${activeUserCount} Active vs ${inactiveUserCount} Inactive Licenses (${fmtCost(inactiveLeakageCost)}/mo Leakage)`,
    finding:
      inactiveUserCount > 0
        ? `Out of ${rosterSeats} provisioned enterprise licenses, ${activeUserCount} users (${activeSeatPercent.toFixed(1)}%) recorded prompt activity, while ${inactiveUserCount} licenses remained completely inactive, resulting in ${fmtCost(inactiveLeakageCost)}/mo in unutilized fixed software costs.`
        : `All ${rosterSeats} provisioned licenses recorded active prompt consumption, achieving 100% active engagement with zero idle license overhead.`,
    actionableInsight:
      inactiveUserCount > 0
        ? `Automate a 30-day inactivity reclamation policy focused on ${topDormantSLName} (${topDormantSLCount} dormant seats). Reallocate reclaimed seats to waitlisted teams rather than purchasing new licenses.`
        : 'Maintain active monitoring and expand license capacity only as verified new engineering cohorts onboard.',
    benefitOutcome:
      inactiveUserCount > 0
        ? `Recovers up to ${fmtCost(inactiveLeakageCost)}/mo (${fmtCost(annualizedInactiveLeakage)}/yr) in license spend. Frees ${inactiveUserCount} seats for waitlisted teams at $0 incremental budget.`
        : `Protects the full ${fmtCost(summary.totalLicenseCost)} license investment from idle-seat leakage.`,
  };

  // ---------------------------------------------------------------------------
  // 2. LICENSE RECLAMATION INTELLIGENCE
  // ---------------------------------------------------------------------------
  const reclamationDormantCount = dormantSeats.length;
  const totalRecoverableAmount = dormantSeats.reduce((s, u) => s + u.licenseCost, 0);
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
        ? `${reclamationDormantCount} seat${reclamationDormantCount === 1 ? '' : 's'} recorded 0 usage against paid license fees, totaling ${fmtCost(totalRecoverableAmount)}/mo in clear, recoverable savings. An additional ${usageWarningCount} active seat${usageWarningCount === 1 ? '' : 's'} consume below their included free allowance (${fmtCost(totalWarningWaste)} prepaid capacity unused).`
        : 'Zero dormant seats identified; all provisioned licenses generated legitimate token consumption.',
    actionableInsight:
      reclamationDormantCount > 0
        ? `Deprovision the ${reclamationDormantCount} zero-consumption seats immediately via IT manifest to capture ${fmtCost(totalRecoverableAmount)}/mo. Issue automated enablement nudges to the ${usageWarningCount} under-the-free-limit seats.`
        : 'No licenses require reclamation this period. Review capacity allocation quarterly.',
    benefitOutcome:
      reclamationDormantCount > 0
        ? `Captures ${fmtCost(totalRecoverableAmount)}/mo (${fmtCost(annualizedRecoverable)}/yr) in net expense reduction with zero operational friction, while safeguarding all active seats.`
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
    benefitOutcome: `Recovers estimated ${fmtCost(nonBillableSpend * 0.35)}/mo in billable client pass-through revenue. Solidifies audit defensibility and prevents AI spend from eroding internal practice margins.`,
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
    benefitOutcome: `Leverages the highest-impact cost lever: a 25% optimization on the top ${top20Count} users yields ${fmtCost(top20Spend * 0.25)}/mo (${fmtCost(potentialParetoVolumeSavings)}/yr) without disrupting 80% of staff.`,
  };

  // ---------------------------------------------------------------------------
  // 5. HABITUAL RETENTION & HEALTH
  // ---------------------------------------------------------------------------
  const cohorts = summary.userEngagementCohorts;
  const embeddedPct = cohorts ? cohorts.embeddedPercent : 50;
  const regularPct = cohorts ? cohorts.regularPercent : 30;
  const occasionalPct = cohorts ? cohorts.occasionalPercent : 15;
  const dropoutPct = cohorts ? cohorts.dropoutPercent : 5;
  const dropoutCount = cohorts ? cohorts.dropoutCount : 0;
  const occasionalCount = cohorts ? cohorts.occasionalCount : 0;
  const atRiskSeats = dropoutCount + occasionalCount;
  const atRiskLicenseCost = Math.round(atRiskSeats * avgLicenseCostPerSeat);
  const annualizedAtRisk = atRiskLicenseCost * 12;

  const retentionInference: PrescriptiveInference = {
    id: 'habitual_retention',
    title: 'Habitual User Retention & Health',
    tag: 'Adoption Health',
    tagColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    leverageScore: annualizedAtRisk * 0.5,
    stat: `${fmtPct(embeddedPct + regularPct)} Regular-or-Better Usage`,
    statSub: `${fmtPct(embeddedPct)} Embedded · ${fmtPct(regularPct)} Regular · ${fmtPct(occasionalPct)} Occasional`,
    finding: `Across active licenses: ${fmtPct(embeddedPct)} are Embedded (active in ≥90% of periods), ${fmtPct(regularPct)} Regular (≥60%), and ${fmtPct(occasionalPct)} Occasional (≥25%). However, ${dropoutCount} users (${fmtPct(dropoutPct)}) show signs of disengagement.`,
    actionableInsight:
      dropoutPct > 15
        ? `Investigate onboarding friction in the ${dropoutCount}-user Dropout cohort before expanding license commitments. Deploy targeted coaching to convert Occasional users to Regular.`
        : 'Active user cohorts demonstrate strong habitual retention. Transition focus from basic onboarding to specialized advanced prompt engineering.',
    benefitOutcome: `Protects up to ${fmtCost(atRiskLicenseCost)}/mo in license spend from customer churn, while compounding organizational productivity as users move from occasional to embedded workflows.`,
  };

  // ---------------------------------------------------------------------------
  // Compile inferences array with:
  // 1. Active / Inactive Users Telemetry (#1)
  // 2. License Reclamation Intelligence (#2)
  // Remaining strategic cards sorted dynamically by financial leverage score
  // ---------------------------------------------------------------------------
  const otherInferences = [
    billabilityInference,
    paretoInference,
    retentionInference,
  ].sort((a, b) => b.leverageScore - a.leverageScore);

  return [seatInference, reclamationInference, ...otherInferences];
}
