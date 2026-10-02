import type { CsvUsageRow } from '@/lib/data/csvTypes';
import type { TokenCostSummary } from './types';
import { DEFAULT_DEV_HOUR_RATE_USD, computeHoursSavedValueUsd, computeRoiEligibleHours } from './roiCalc';
import {
  SCORE_DIMENSIONS,
  SCORING_CONFIG,
  tierForPercent,
  type DimensionResult,
  type EngagementScore,
  type ScoreDimensionId,
} from './scoringConfig';

type HoursSavedRow = NonNullable<TokenCostSummary['hoursSavedByEngagement']>[number];

const maxPointsOf = (id: ScoreDimensionId) => SCORE_DIMENSIONS.find((d) => d.id === id)!.maxPoints;
const round1 = (n: number) => Number(n.toFixed(1));
const fmtMoney = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const fmtHrs = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 1 });

function blank(id: ScoreDimensionId, reason: string): DimensionResult {
  return { id, score: null, maxPoints: maxPointsOf(id), detail: reason };
}

/** Financial Value: benefit-to-cost ratio against a target, scaled linearly up to full points. */
function scoreFinancial(tracked: HoursSavedRow[]): DimensionResult {
  if (tracked.length === 0) return blank('financial', 'No Hours Saved data for this engagement.');

  const benefitUsd = tracked.reduce(
    (s, h) =>
      s + computeHoursSavedValueUsd(computeRoiEligibleHours(h.sumOfMonthlyHrs, h.approvedTotalHrs), DEFAULT_DEV_HOUR_RATE_USD),
    0
  );
  const costKnown = tracked.some((h) => h.cost !== null);
  const toolCost = tracked.reduce((s, h) => s + (h.cost ?? 0), 0);
  if (!costKnown || toolCost <= 0) return blank('financial', 'No tool cost to compare the benefit against.');

  const ratio = benefitUsd / toolCost;
  const target = SCORING_CONFIG.financial.targetBenefitCostRatio;
  const max = maxPointsOf('financial');
  return {
    id: 'financial',
    score: round1(max * Math.min(ratio / target, 1)),
    maxPoints: max,
    detail: `${ratio.toFixed(1)}x benefit-to-cost (${fmtMoney(benefitUsd)} value of approved hours saved vs ${fmtMoney(toolCost)} tool cost); full points at ${target}x.`,
  };
}

/** Productivity Gain: share of the approved hours target actually realized. */
function scoreProductivity(tracked: HoursSavedRow[]): DimensionResult {
  if (tracked.length === 0) return blank('productivity', 'No Hours Saved data for this engagement.');

  const approved = tracked.reduce((s, h) => s + h.approvedTotalHrs, 0);
  const saved = tracked.reduce((s, h) => s + h.sumOfMonthlyHrs, 0);
  if (approved <= 0) return blank('productivity', 'No approved hours target to measure against.');

  const realization = saved / approved;
  const max = maxPointsOf('productivity');
  return {
    id: 'productivity',
    score: round1(max * Math.min(realization, 1)),
    maxPoints: max,
    detail: `${fmtHrs(saved)} of ${fmtHrs(approved)} approved hours realized (${(realization * 100).toFixed(0)}%).`,
  };
}

/**
 * Adoption & Utilization: a seat is one (user, tool) license. Activation is the
 * share of licensed seats with any real usage; consistency is, per seat, the
 * share of its licensed months that had usage, averaged over all licensed seats.
 */
function scoreAdoption(rows: CsvUsageRow[]): DimensionResult {
  const licensedMonths = new Map<string, Set<number>>();
  const usedMonths = new Map<string, Set<number>>();
  for (const r of rows) {
    const seat = `${r.userMail.toLowerCase()}|${r.aiTool}`;
    if (r.calculationMethod === 'License') {
      if (!licensedMonths.has(seat)) licensedMonths.set(seat, new Set());
      licensedMonths.get(seat)!.add(r.monthId);
    } else if (r.calculationMethod === 'Usage' && r.tokenConsumption > 0) {
      if (!usedMonths.has(seat)) usedMonths.set(seat, new Set());
      usedMonths.get(seat)!.add(r.monthId);
    }
  }
  if (licensedMonths.size === 0) return blank('adoption', 'No license seats in the selected period.');

  let activeSeats = 0;
  let consistencySum = 0;
  for (const [seat, licensed] of licensedMonths) {
    const used = usedMonths.get(seat);
    let usedWithinLicensed = 0;
    if (used) for (const m of used) if (licensed.has(m)) usedWithinLicensed++;
    if (usedWithinLicensed > 0) activeSeats++;
    consistencySum += usedWithinLicensed / licensed.size;
  }

  const seats = licensedMonths.size;
  const activation = activeSeats / seats;
  const consistency = consistencySum / seats;
  const { activationWeight, consistencyWeight } = SCORING_CONFIG.adoption;
  const max = maxPointsOf('adoption');
  return {
    id: 'adoption',
    score: round1(max * (activationWeight * activation + consistencyWeight * consistency)),
    maxPoints: max,
    detail: `${activeSeats} of ${seats} licensed seat${seats === 1 ? '' : 's'} active (${(activation * 100).toFixed(0)}%); seats used in ${(consistency * 100).toFixed(0)}% of their licensed months on average.`,
  };
}

/** Strategic Importance: points looked up from the engagement's Invest Type. */
function scoreStrategic(investType: string): DimensionResult {
  if (!investType) return blank('strategic', 'No Invest Type recorded for this engagement.');
  const points = SCORING_CONFIG.strategic.investTypePoints[investType];
  if (points === undefined) return blank('strategic', `Invest Type "${investType}" has no strategic mapping.`);
  return {
    id: 'strategic',
    score: points,
    maxPoints: maxPointsOf('strategic'),
    detail: `Invest Type "${investType}" maps to ${points} of ${maxPointsOf('strategic')} points.`,
  };
}

function scoreEngagement(projectCode: string, rows: CsvUsageRow[], tracked: HoursSavedRow[]): EngagementScore {
  const investType = rows.find((r) => r.engagementInvestType)?.engagementInvestType ?? '';

  // Dimensions without a data source yet stay blank for every engagement.
  const dimensions: DimensionResult[] = SCORE_DIMENSIONS.map((def) => {
    switch (def.id) {
      case 'financial':
        return scoreFinancial(tracked);
      case 'productivity':
        return scoreProductivity(tracked);
      case 'adoption':
        return scoreAdoption(rows);
      case 'strategic':
        return scoreStrategic(investType);
      default:
        return blank(def.id, def.dataNeeded ?? 'No data source yet.');
    }
  });

  const scored = dimensions.filter((d) => d.score !== null);
  const scoredPoints = round1(scored.reduce((s, d) => s + (d.score as number), 0));
  const availablePoints = scored.reduce((s, d) => s + d.maxPoints, 0);
  const percent = availablePoints > 0 ? round1((scoredPoints / availablePoints) * 100) : null;

  return {
    projectCode,
    engagementServiceLine: rows[0]?.engagementServiceLine ?? '',
    engagementCompetency: rows[0]?.engagementCompetency ?? '',
    investType,
    aiTools: Array.from(new Set(rows.map((r) => r.aiTool).filter(Boolean))).sort(),
    totalCost: Number(rows.reduce((s, r) => s + r.cost, 0).toFixed(2)),
    dimensions,
    scoredPoints,
    availablePoints,
    percent,
    scoredDimensionCount: scored.length,
    tier: percent === null ? null : tierForPercent(percent),
  };
}

/**
 * Scores every engagement present in `rows` (already scoped by the global
 * filters). `hoursSavedRows` is the Hours Saved join for the same filters, so
 * Financial Value and Productivity only exist for the engagements it covers.
 */
export function calculateEngagementScores(rows: CsvUsageRow[], hoursSavedRows: HoursSavedRow[]): EngagementScore[] {
  const rowsByEngagement = new Map<string, CsvUsageRow[]>();
  for (const r of rows) {
    if (!r.projectCode) continue;
    if (!rowsByEngagement.has(r.projectCode)) rowsByEngagement.set(r.projectCode, []);
    rowsByEngagement.get(r.projectCode)!.push(r);
  }

  const trackedByEngagement = new Map<string, HoursSavedRow[]>();
  for (const h of hoursSavedRows) {
    if (!trackedByEngagement.has(h.projectCode)) trackedByEngagement.set(h.projectCode, []);
    trackedByEngagement.get(h.projectCode)!.push(h);
  }

  return Array.from(rowsByEngagement.entries())
    .map(([code, engRows]) => scoreEngagement(code, engRows, trackedByEngagement.get(code) ?? []))
    .sort((a, b) => a.projectCode.localeCompare(b.projectCode));
}
