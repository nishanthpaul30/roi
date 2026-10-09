/**
 * Engagement Scoring: dimension definitions, tunable thresholds, and the
 * shared result types. Lives outside scoring.ts so the page can render the
 * same labels/weights/rules the server scores against, without importing any
 * server-side code.
 *
 * Three dimensions, 100 points total (Financial 40, Productivity 30, Adoption 30). A dimension with no data behind it is
 * returned as `score: null` (shown blank) -- never as 0 -- and is left out of
 * both the total and the tier, which is based on the percentage of points
 * actually available to that engagement.
 */

export type ScoreDimensionId = 'financial' | 'productivity' | 'adoption';
export type ScoreTier = 'Leading' | 'Performing' | 'Developing' | 'At Risk';

export interface ScoreDimensionDef {
  id: ScoreDimensionId;
  label: string;
  maxPoints: number;
  /** What the dimension is meant to capture. */
  measures: string;
  /** How it is scored today. */
  rule: string;
  /** Set for dimensions that can't be scored yet: the data that would unlock them. */
  dataNeeded?: string;
}

export const SCORE_DIMENSIONS: ScoreDimensionDef[] = [
  {
    id: 'financial',
    label: 'Financial Value',
    maxPoints: 40,
    measures: 'Benefits compared with tool cost',
    rule: 'Benefit-to-cost ratio = value of hours saved (capped at approved hours, at the blended $/dev-hr rate) ÷ tool cost for the tracked tools. Full points at or above the target ratio, scaled linearly below it.',
  },
  {
    id: 'productivity',
    label: 'Productivity Gain',
    maxPoints: 30,
    measures: 'Time and effort improvement',
    rule: 'Hours saved ÷ approved hours, capped at 100%.',
  },
  {
    id: 'adoption',
    label: 'Adoption & Utilization',
    maxPoints: 30,
    measures: 'Actual usage of available licenses',
    rule: 'Half from seat activation (licensed seats with any usage ÷ licensed seats), half from consistency (average share of licensed months in which each seat was actually used).',
  },
];

export const SCORING_CONFIG = {
  financial: {
    /** Benefit-to-cost ratio that earns the full Financial Value points. */
    targetBenefitCostRatio: 3,
  },
  adoption: {
    /** Split of the Adoption points between seat activation and consistency. Must sum to 1. */
    activationWeight: 0.5,
    consistencyWeight: 0.5,
  },
  /** Minimum percentage of available points for each tier; below `developing` is At Risk. */
  tiers: { leading: 80, performing: 60, developing: 40 },
};

export const TIER_ORDER: ScoreTier[] = ['Leading', 'Performing', 'Developing', 'At Risk'];

export function tierForPercent(percent: number): ScoreTier {
  if (percent >= SCORING_CONFIG.tiers.leading) return 'Leading';
  if (percent >= SCORING_CONFIG.tiers.performing) return 'Performing';
  if (percent >= SCORING_CONFIG.tiers.developing) return 'Developing';
  return 'At Risk';
}

export interface DimensionResult {
  id: ScoreDimensionId;
  /** Points earned; null when the dimension can't be scored (rendered blank, not 0). */
  score: number | null;
  maxPoints: number;
  /** The basis for the score, or the reason it is blank. */
  detail: string;
}

export interface EngagementScore {
  projectCode: string;
  engagementServiceLine: string;
  engagementCompetency: string;
  aiTools: string[];
  /** Total cost (usage + license) for this engagement in the selected period. */
  totalCost: number;
  /** Always every dimension, in SCORE_DIMENSIONS order. */
  dimensions: DimensionResult[];
  scoredPoints: number;
  /** Sum of maxPoints over the dimensions that could be scored. */
  availablePoints: number;
  /** scoredPoints / availablePoints * 100, or null when nothing could be scored. */
  percent: number | null;
  scoredDimensionCount: number;
  tier: ScoreTier | null;
}
