/**
 * Shared Hours Saved ROI math -- lives outside hoursSaved.ts (server-only)
 * so client components can recompute ROI locally when the user adjusts the
 * dev-hour rate, without a round trip to the server.
 */

// Default blended developer-hour rate, used until the user picks their own
// in the UI. A business assumption (not sourced from the data), pending real
// per-region/role rate guidance.
export const DEFAULT_DEV_HOUR_RATE_USD = 30;

/** Dollar value of hours saved at the given rate. */
export function computeHoursSavedValueUsd(hoursSaved: number, rate: number): number {
  return Number((hoursSaved * rate).toFixed(2));
}

/**
 * Hours actually recorded (sumOfMonthlyHrs) aren't locked into the business
 * case until they're approved -- only approvedTotalHrs is. Caps the hours
 * counted toward ROI's dollar value at the approved target, so hours beyond
 * what's been approved don't inflate ROI before they're actually signed off.
 * (approvedTotalHrs = 0 means nothing is approved yet, so nothing counts.)
 */
export function computeRoiEligibleHours(actualHours: number, approvedHours: number): number {
  return Math.min(actualHours, approvedHours);
}

/**
 * (value of hours saved - cost) / cost * 100. Null when there's no cost to
 * compare against (can't compute ROI against a cost of 0/unknown). Used both
 * for tool-cost-only ROI (per tool row) and total-investment ROI (per
 * engagement, passing computeTotalInvestmentUsd's result as `cost`).
 */
export function computeRoiPercent(hoursSavedValueUsd: number, cost: number | null): number | null {
  return cost !== null && cost > 0 ? Number((((hoursSavedValueUsd - cost) / cost) * 100).toFixed(1)) : null;
}

/** Dollar value of developer hours spent (from the mock timesheet data), at the given rate. */
export function computeDevCostUsd(devHoursSpent: number, rate: number): number {
  return Number((devHoursSpent * rate).toFixed(2));
}

/**
 * Total Investment = AI tool cost + the dollar value of developer hours spent
 * on the engagement. The fuller cost base for ROI, vs. tool cost alone --
 * dev hours are engagement-level (not per tool), so this only makes sense at
 * the engagement rollup, not per individual tool row.
 */
export function computeTotalInvestmentUsd(toolCost: number, devCostUsd: number): number {
  return Number((toolCost + devCostUsd).toFixed(2));
}
