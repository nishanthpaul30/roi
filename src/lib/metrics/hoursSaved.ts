import 'server-only';

import { loadHoursSavedData } from '../data/hoursSavedLoader';
import type { CsvUsageRow } from '../data/csvLoader';

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
  realizationPercent: number;
  // AI tool cost for this exact (Engagement, Tool) pair -- not the whole
  // engagement's cost across every tool -- so it's directly comparable to
  // the hours this same tool saved on this same engagement.
  cost: number | null;
  tokens: number | null;
  userCount: number | null;
  // cost / sumOfMonthlyHrs -- null when there's no cost match or no hours saved yet.
  costPerHourSaved: number | null;
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
 */
export function joinHoursSavedToEngagements(spendRows: CsvUsageRow[]): EngagementHoursSaved[] {
  const hoursSavedRows = loadHoursSavedData();

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
      realizationPercent: h.realizationPercent,
      cost,
      tokens,
      userCount,
      costPerHourSaved,
      monthlyCost,
      monthlyCostPerHourSaved,
    };
  });
}
