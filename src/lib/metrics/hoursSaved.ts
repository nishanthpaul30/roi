import 'server-only';

import { loadHoursSavedData } from '../data/hoursSavedLoader';
import { loadDevHoursData } from '../data/devHoursLoader';
import type { CsvUsageRow } from '../data/csvLoader';
import { DEFAULT_DEV_HOUR_RATE_USD, computeHoursSavedValueUsd, computeRoiPercent, computeRoiEligibleHours } from './roiCalc';

// The current fiscal year starts in July (FY calendar: Jul-Dec of this
// calendar year, then Jan-Jun of the next). actuals-planned-overall-*.csv's month
// columns ("Jul", "Aug", ...) carry no year of their own, so this is the one
// place that maps them onto real calendar months/monthIds to join against
// ai_usage_data.csv. Update this when the FY rolls over.
const FY_START_CALENDAR_YEAR = 2026;
const FY_MONTH_ORDER = ['jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar', 'apr', 'may', 'jun'];

/** "Jul" / "July" / "jul" -> 202607. Returns null for a label it doesn't recognize. */
function monthLabelToMonthId(label: string): number | null {
  const normalized = label.trim().toLowerCase().slice(0, 3);
  const idx = FY_MONTH_ORDER.indexOf(normalized);
  if (idx === -1) return null;
  const isFirstHalf = idx <= 5; // Jul-Dec
  const calendarMonth = isFirstHalf ? idx + 7 : idx - 5;
  const calendarYear = isFirstHalf ? FY_START_CALENDAR_YEAR : FY_START_CALENDAR_YEAR + 1;
  return calendarYear * 100 + calendarMonth;
}

export interface EngagementHoursSaved {
  projectCode: string;
  assetName: string;
  aiTool: string;
  approvedTotalHrs: number;
  pendingApprovalHrs: number;
  monthlyHours: Record<string, number>;
  sumOfMonthlyHrs: number;
  // AI tool cost for this exact (Engagement, Tool) pair -- not the whole
  // engagement's cost across every tool -- so it's directly comparable to
  // the hours this same tool saved on this same engagement.
  cost: number | null;
  tokens: number | null;
  userCount: number | null;
  // cost / sumOfMonthlyHrs -- null when there's no cost match or no hours saved yet.
  costPerHourSaved: number | null;
  // min(sumOfMonthlyHrs, approvedTotalHrs) * DEFAULT_DEV_HOUR_RATE_USD -- the
  // dollar value of hours saved SO FAR, capped at the approved target since
  // hours beyond what's approved aren't locked into the business case yet
  // (see computeRoiEligibleHours), at the default blended developer rate.
  // The UI recomputes this client-side (see lib/metrics/roiCalc.ts) when the
  // user picks a different rate, so this field is only the as-served
  // default, not necessarily what's on screen.
  hoursSavedValueUsd: number;
  // (hoursSavedValueUsd - cost) / cost * 100 at the default rate -- null when
  // there's no cost match (can't compute ROI against a cost of 0/unknown).
  // Same caveat as hoursSavedValueUsd: the UI may show a recomputed value.
  roiPercent: number | null;
  // Total dev hours clocked on this ENGAGEMENT (not per tool -- the
  // timesheet data has no per-tool breakdown), from the mock developer
  // timesheet (see data/devHoursLoader.ts). The same value is repeated on
  // every tool row of a multi-tool engagement -- sum it once per distinct
  // projectCode, not once per row, or it over-counts.
  devHoursSpent: number;
  // Per month label (e.g. "Jul"), the matching month's cost and $/hour --
  // null where the month falls outside the current dataset's date range
  // (e.g. Sep/Oct before that data has arrived) or the label doesn't map to
  // a recognized FY month.
  monthlyCost: Record<string, number | null>;
  monthlyCostPerHourSaved: Record<string, number | null>;
}

/**
 * Joins actuals-planned-overall-*.csv onto the base dataset by (Engagement Code, AI
 * Tool) -- not Engagement Code alone -- so a multi-tool engagement's cost
 * isn't double-counted against each tool's own hours saved. Monthly figures
 * use FY_START_CALENDAR_YEAR to resolve each month column to a real
 * calendar month (see monthLabelToMonthId).
 *
 * ai_usage_data.csv is treated as the MASTER list of valid Engagement Codes
 * (same principle as dev-hours-timesheet.csv generation, which only ever
 * mints codes seen there): a Hours Saved row whose Engagement Code doesn't
 * exist ANYWHERE in ai_usage_data.csv is dropped entirely, rather than
 * showing a row with real approved/hours-saved figures but no possible cost
 * match. `allSpendRows` should be the FULL, unfiltered roster (not the
 * current date-range-filtered `spendRows`), so validity doesn't flicker
 * on/off as the user changes the date filter -- a code is either real or
 * it isn't, independent of which months are currently in view.
 */
export function joinHoursSavedToEngagements(
  spendRows: CsvUsageRow[],
  allSpendRows: CsvUsageRow[]
): EngagementHoursSaved[] {
  const validEngagementCodes = new Set(allSpendRows.map((r) => r.projectCode));
  const hoursSavedRows = loadHoursSavedData().filter((h) => validEngagementCodes.has(h.engagementCode));
  const devHoursByEngagement = new Map<string, number>(
    loadDevHoursData().map((d) => [d.engagementCode, d.totalDevHours])
  );

  const consolidatedMap = new Map<string, { cost: number; tokens: number; users: Set<string> }>();
  const monthlyMap = new Map<string, { cost: number; tokens: number }>();

  for (const r of spendRows) {
    const key = `${r.projectCode}:::${r.aiTool}`;
    if (!consolidatedMap.has(key)) consolidatedMap.set(key, { cost: 0, tokens: 0, users: new Set() });
    const c = consolidatedMap.get(key)!;
    c.cost += r.cost;
    c.tokens += r.tokenConsumption;
    if (r.calculationMethod === 'Usage' && r.tokenConsumption > 0) c.users.add(r.userMail.toLowerCase());

    const monthKey = `${key}:::${r.monthId}`;
    if (!monthlyMap.has(monthKey)) monthlyMap.set(monthKey, { cost: 0, tokens: 0 });
    monthlyMap.get(monthKey)!.cost += r.cost;
  }

  return hoursSavedRows.map((h) => {
    const key = `${h.engagementCode}:::${h.aiTool}`;
    const consolidated = consolidatedMap.get(key);
    const cost = consolidated ? Number(consolidated.cost.toFixed(2)) : null;
    const tokens = consolidated ? Math.round(consolidated.tokens) : null;
    const userCount = consolidated ? consolidated.users.size : null;
    const costPerHourSaved = cost !== null && h.sumOfMonthlyHrs > 0 ? Number((cost / h.sumOfMonthlyHrs).toFixed(2)) : null;
    const roiEligibleHours = computeRoiEligibleHours(h.sumOfMonthlyHrs, h.approvedTotalHrs);
    const hoursSavedValueUsd = computeHoursSavedValueUsd(roiEligibleHours, DEFAULT_DEV_HOUR_RATE_USD);
    const roiPercent = computeRoiPercent(hoursSavedValueUsd, cost);

    const monthlyCost: Record<string, number | null> = {};
    const monthlyCostPerHourSaved: Record<string, number | null> = {};
    for (const [label, hrs] of Object.entries(h.monthlyHours)) {
      const monthId = monthLabelToMonthId(label);
      const monthData = monthId !== null ? monthlyMap.get(`${key}:::${monthId}`) : undefined;
      const mCost = monthData ? Number(monthData.cost.toFixed(2)) : null;
      monthlyCost[label] = mCost;
      monthlyCostPerHourSaved[label] = mCost !== null && hrs > 0 ? Number((mCost / hrs).toFixed(2)) : null;
    }

    return {
      projectCode: h.engagementCode,
      assetName: h.assetName,
      aiTool: h.aiTool,
      approvedTotalHrs: h.approvedTotalHrs,
      pendingApprovalHrs: h.pendingApprovalHrs,
      monthlyHours: h.monthlyHours,
      sumOfMonthlyHrs: h.sumOfMonthlyHrs,
      cost,
      tokens,
      userCount,
      costPerHourSaved,
      hoursSavedValueUsd,
      roiPercent,
      devHoursSpent: devHoursByEngagement.get(h.engagementCode) ?? 0,
      monthlyCost,
      monthlyCostPerHourSaved,
    };
  });
}
