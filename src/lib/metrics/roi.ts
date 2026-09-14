import { loadCsvData, dateStringToMonthId, CsvUsageRow } from '../data/csvLoader';
import { GlobalFilterState, TokenCostSummary, MonthlyTrendPoint } from './types';
import { getPreviousDateRange, hasPreviousPeriodData } from './engine';

function filterRows(rows: CsvUsageRow[], filters: GlobalFilterState, sDate: string, eDate: string): CsvUsageRow[] {
  const startMonthId = dateStringToMonthId(sDate);
  const endMonthId = dateStringToMonthId(eDate);
  return rows.filter((r) => {
    if (r.monthId < startMonthId || r.monthId > endMonthId) return false;
    if (filters.aiTool && filters.aiTool !== 'all' && r.aiTool !== filters.aiTool) return false;
    if (filters.managementRegion && filters.managementRegion !== 'all' && r.superRegion !== filters.managementRegion) return false;
    if (filters.serviceLine && filters.serviceLine !== 'all' && r.orgServiceLine !== filters.serviceLine) return false;
    if (filters.userMail && filters.userMail !== 'all' && r.userMail !== filters.userMail) return false;
    if (filters.country && filters.country !== 'all' && r.country !== filters.country) return false;
    return true;
  });
}

function groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(r);
  }
  return m;
}

/**
 * Per-tool free-dollar-limit, derived from real data rather than hardcoded.
 * Confirmed against a real example set: Credits is the free-tier dollar
 * amount actually applied that row, capped at a fixed per-tool ceiling —
 * below the cap, Credits = -CostUSD exactly (Cost (in $) nets to 0); at or
 * above the cap, Credits pins at that ceiling (e.g. -70 for GitHub Copilot in
 * one real sample) and Cost (in $) = CostUSD - ceiling is the overage billed.
 * So the ceiling itself is recoverable as max(|Credits|) across a tool's
 * Usage rows — the largest credit ever applied is the cap being hit.
 */
function computeToolFreeLimits(usageRows: CsvUsageRow[]): Map<string, number> {
  const limits = new Map<string, number>();
  for (const r of usageRows) {
    const credit = Math.abs(r.creditsLimit || 0);
    if (credit > (limits.get(r.aiTool) || 0)) {
      limits.set(r.aiTool, credit);
    }
  }
  return limits;
}

/**
 * Per-user capacity waste / overage / ceiling-risk / License ROI aggregates.
 * Shared by the current-period and previous-period computations in
 * calculateTokenCostSummary so both periods use identical logic.
 *
 * `rows` must be every row (License + Usage) for the period being aggregated,
 * already scoped to the users/filters in question — each user's Usage-type
 * rows drive actual cost/consumption, their License-type rows drive license
 * cost. `toolFreeLimits` is shared across current/previous-period calls (see
 * computeToolFreeLimits) so both periods measure against the same ceiling.
 *
 * Each tool's free limit resets every month (License rows recur monthly too),
 * so waste/overage is computed per Usage row against Cost USD (gross, before
 * the credit), then summed across the user's rows — a user can land in waste
 * some months and overage in others within the same reporting window.
 */
function computeCapacityAggregates(rows: CsvUsageRow[], hardCeiling: number, toolFreeLimits: Map<string, number>) {
  let totalWasteCost = 0;
  let totalOverageCost = 0;
  let totalUsageLimitsSum = 0;
  let ceilingRiskCount = 0;
  let totalLicenseCost = 0;
  let licenseUnderutilizedCost = 0;
  let licenseOverutilizedValue = 0;

  const byUserMap = groupBy(rows, r => r.userMail);

  const userCapacityBreakdown = Array.from(byUserMap.entries()).map(([userMail, userRows]) => {
    const displayName = userRows[0].displayName || userMail;
    const toolsSet = new Set(userRows.map(r => r.aiTool).filter(Boolean));
    const aiTools = Array.from(toolsSet);

    const usageRows = userRows.filter(r => r.calculationMethod === 'Usage');
    const licenseRows = userRows.filter(r => r.calculationMethod === 'License');

    const actualCost = Number(usageRows.reduce((s, r) => s + r.cost, 0).toFixed(4));
    const tokenConsumption = Math.round(usageRows.reduce((s, r) => s + r.tokenConsumption, 0));

    // The free limit resets monthly, so waste/overage is computed row by row
    // (against gross Cost USD, before the credit adjustment) and summed —
    // not derived from period totals, which would hide a user who was under
    // the cap some months and over it in others.
    let wasteCost = 0;
    let overageCost = 0;
    for (const r of usageRows) {
      const limit = toolFreeLimits.get(r.aiTool) || 0;
      if (r.costUsd < limit) wasteCost += limit - r.costUsd;
      else if (r.costUsd > limit) overageCost += r.costUsd - limit;
    }
    wasteCost = Number(wasteCost.toFixed(4));
    overageCost = Number(overageCost.toFixed(4));
    totalWasteCost += wasteCost;
    totalOverageCost += overageCost;
    const zone: 'zone1_under' | 'zone2_over' | 'zone_balanced' =
      wasteCost > overageCost ? 'zone1_under' : overageCost > wasteCost ? 'zone2_over' : 'zone_balanced';

    // usageLimit/usageFreeTokenLimit: this user's held tools' free limits,
    // summed once per distinct tool (a stable per-tool constant, unlike
    // Credits itself which varies row to row) — the monthly free-dollar
    // capacity this user's toolset provides.
    const usageFreeTokenLimit = Number(
      Array.from(toolsSet).reduce((s, t) => s + (toolFreeLimits.get(t) || 0), 0).toFixed(4)
    );
    const usageLimit = usageFreeTokenLimit;
    totalUsageLimitsSum += usageLimit;

    const ceilingPercent = hardCeiling > 0 ? Number(((actualCost / hardCeiling) * 100).toFixed(1)) : 0;
    if (hardCeiling > 0 && actualCost >= hardCeiling * 0.9) {
      ceilingRiskCount++;
    }

    // License Cost ROI: sum this user's actual License-type row costs per
    // distinct tool (replaces the old fixed-per-tool-constant lookup — the
    // new source carries real License line items instead).
    let licenseCost = 0;
    for (const tool of toolsSet) {
      licenseCost += licenseRows.filter(r => r.aiTool === tool).reduce((s, r) => s + r.cost, 0);
    }
    licenseCost = Number(licenseCost.toFixed(4));
    totalLicenseCost += licenseCost;
    const licenseRoiPercent = licenseCost > 0 ? Number(((actualCost / licenseCost) * 100).toFixed(1)) : 0;

    let licenseRoiZone: 'underutilized' | 'overutilized' | 'aligned' = 'aligned';
    if (licenseCost > 0 && actualCost < licenseCost) {
      licenseRoiZone = 'underutilized';
      licenseUnderutilizedCost += Number((licenseCost - actualCost).toFixed(4));
    } else if (licenseCost > 0 && actualCost > licenseCost) {
      licenseRoiZone = 'overutilized';
      licenseOverutilizedValue += Number((actualCost - licenseCost).toFixed(4));
    }

    return {
      userMail,
      displayName,
      aiTools,
      actualCost,
      usageFreeTokenLimit,
      usageLimit,
      wasteCost,
      overageCost,
      tokenConsumption,
      ceilingPercent,
      zone,
      licenseCost,
      licenseRoiPercent,
      licenseRoiZone,
    };
  }).sort((a, b) => b.wasteCost - a.wasteCost || b.actualCost - a.actualCost);

  return {
    totalWasteCost,
    totalOverageCost,
    totalUsageLimitsSum,
    ceilingRiskCount,
    totalLicenseCost,
    licenseUnderutilizedCost,
    licenseOverutilizedValue,
    userCapacityBreakdown,
  };
}

/**
 * Calculate token/cost summary from ai_usage_data.csv.
 * The source is monthly-grained with a Calculation Method flag splitting
 * each (user, tool, month) into a 'License' row (flat seat fee, present
 * whether or not the seat was used) and/or a 'Usage' row (metered
 * consumption/cost, present only for active months). All usage-based
 * aggregates below read Usage rows only; License rows feed License ROI.
 */
export async function calculateTokenCostSummary(
  filters: GlobalFilterState
): Promise<TokenCostSummary> {
  const { startDate, endDate, comparisonPeriod } = filters;
  const { prevStartDate, prevEndDate } = getPreviousDateRange(startDate, endDate, comparisonPeriod);
  const previousDataAvailable = hasPreviousPeriodData(prevStartDate, prevEndDate);

  const allRows = loadCsvData();
  const currentRows = filterRows(allRows, filters, startDate, endDate);
  const previousRows = filterRows(allRows, filters, prevStartDate, prevEndDate);

  // Seat Utilization: every user with a held license has a 'License' row every
  // month regardless of whether they used the tool, so the full roster is
  // every distinct user across ALL currentRows (License + Usage); "active"
  // means they have at least one Usage row with real consumption this period.
  const totalRosterUserCount = new Set(currentRows.map(r => r.userMail.toLowerCase())).size;
  const usageRows = currentRows.filter(r => r.calculationMethod === 'Usage' && r.tokenConsumption > 0);
  const activeUserCount = new Set(usageRows.map(r => r.userMail.toLowerCase())).size;
  const inactiveUserCount = totalRosterUserCount - activeUserCount;

  // Core aggregates
  const totalTokenConsumption = usageRows.reduce((s, r) => s + r.tokenConsumption, 0);
  const totalCost = usageRows.reduce((s, r) => s + r.cost, 0);

  const previousUsageRows = previousRows.filter(r => r.calculationMethod === 'Usage' && r.tokenConsumption > 0);
  const prevTotalTokenConsumption = previousUsageRows.reduce((s, r) => s + r.tokenConsumption, 0);
  const prevTotalCost = previousUsageRows.reduce((s, r) => s + r.cost, 0);

  const costPer1kTokens = totalTokenConsumption > 0 ? (totalCost / (totalTokenConsumption / 1000)) : 0;

  // Billability is a convention on the Engagement Code (E-XXXXXX billable,
  // I-XXXXXX not) rather than a separate source column — there's no distinct
  // "billable tokens" field in the new schema, so this is the share of
  // consumption on billable engagement codes instead.
  const billableConsumption = usageRows.filter(r => r.billableFlag === 'True').reduce((s, r) => s + r.tokenConsumption, 0);
  const billableUtilizationRate = totalTokenConsumption > 0 ? (billableConsumption / totalTokenConsumption) * 100 : 0;

  // By AI Tool breakdown with Unit Economics
  const byToolMap = groupBy(usageRows, r => r.aiTool);
  const byAiTool = Array.from(byToolMap.entries())
    .map(([tool, rows]) => {
      const tokens = rows.reduce((s, r) => s + r.tokenConsumption, 0);
      const cost = Number(rows.reduce((s, r) => s + r.cost, 0).toFixed(4));
      const userSet = new Set(rows.map(r => r.userMail.toLowerCase()));
      const userCount = userSet.size;
      const avgCostPerUser = userCount > 0 ? Number((cost / userCount).toFixed(2)) : 0;
      const toolCostPer1k = tokens > 0 ? Number((cost / (tokens / 1000)).toFixed(6)) : 0;
      const spendSharePercent = totalCost > 0 ? Number(((cost / totalCost) * 100).toFixed(1)) : 0;
      const tokenSharePercent = totalTokenConsumption > 0 ? Number(((tokens / totalTokenConsumption) * 100).toFixed(1)) : 0;

      return {
        tool,
        tokens,
        cost,
        userCount,
        avgCostPerUser,
        costPer1kTokens: toolCostPer1k,
        spendSharePercent,
        tokenSharePercent,
      };
    })
    .sort((a, b) => b.cost - a.cost);

  // Multi-Tool User Overlap Detection
  const userToolsMap = new Map<string, { displayName: string; tools: Set<string>; spend: number; tokens: number }>();
  for (const r of usageRows) {
    const email = r.userMail.toLowerCase();
    if (!userToolsMap.has(email)) {
      userToolsMap.set(email, {
        displayName: r.displayName || r.userMail,
        tools: new Set(),
        spend: 0,
        tokens: 0,
      });
    }
    const item = userToolsMap.get(email)!;
    item.tools.add(r.aiTool);
    item.spend += r.cost;
    item.tokens += r.tokenConsumption;
  }

  let dualToolUserCount = 0;
  let totalDualToolSpend = 0;
  const multiToolUserList: {
    userMail: string;
    displayName?: string;
    tools: string[];
    totalCost: number;
    totalTokens: number;
  }[] = [];

  for (const [email, data] of userToolsMap.entries()) {
    if (data.tools.size > 1) {
      dualToolUserCount++;
      totalDualToolSpend += data.spend;
      multiToolUserList.push({
        userMail: email,
        displayName: data.displayName,
        tools: Array.from(data.tools),
        totalCost: Number(data.spend.toFixed(2)),
        totalTokens: Math.round(data.tokens),
      });
    }
  }

  const multiToolOverlap = {
    dualToolUserCount,
    totalDualToolSpend: Number(totalDualToolSpend.toFixed(2)),
    multiToolUserList: multiToolUserList.sort((a, b) => b.totalCost - a.totalCost),
  };

  // By CT / Non-CT breakdown — the hierarchy's own top-level split (Client-Tagged
  // vs Non-Client-Tagged engagements).
  const byCtNonCtMap = groupBy(usageRows, r => r.ctNonCt || 'Unclassified');
  const byCtNonCt = Array.from(byCtNonCtMap.entries())
    .map(([ctNonCt, rows]) => ({
      ctNonCt,
      tokens: rows.reduce((s, r) => s + r.tokenConsumption, 0),
      cost: Number(rows.reduce((s, r) => s + r.cost, 0).toFixed(4)),
      userCount: new Set(rows.map(r => r.userMail.toLowerCase())).size,
      uniqueMonths: new Set(rows.map(r => r.monthId)).size,
    }))
    .sort((a, b) => b.cost - a.cost);

  // By Super Region breakdown (replaces the old Region / Management Region pair)
  const byRegionMap = groupBy(usageRows, r => r.superRegion);
  const byManagementRegion = Array.from(byRegionMap.entries())
    .map(([region, rows]) => ({
      region,
      tokens: rows.reduce((s, r) => s + r.tokenConsumption, 0),
      cost: Number(rows.reduce((s, r) => s + r.cost, 0).toFixed(4)),
      userCount: new Set(rows.map(r => r.userMail.toLowerCase())).size,
      countries: Array.from(new Set(rows.map(r => r.country).filter(Boolean))),
    }))
    .sort((a, b) => b.tokens - a.tokens);

  // By Country breakdown
  const byCountryMap = groupBy(usageRows, r => r.country);
  const byCountry = Array.from(byCountryMap.entries())
    .map(([country, rows]) => ({
      country,
      superRegion: rows[0]?.superRegion || 'N/A',
      tokens: rows.reduce((s, r) => s + r.tokenConsumption, 0),
      cost: Number(rows.reduce((s, r) => s + r.cost, 0).toFixed(4)),
      userCount: new Set(rows.map(r => r.userMail.toLowerCase())).size,
    }))
    .sort((a, b) => b.tokens - a.tokens);

  // By Service Line breakdown
  const bySlMap = groupBy(usageRows, r => r.orgServiceLine);
  const byServiceLine = Array.from(bySlMap.entries())
    .map(([serviceLine, rows]) => ({
      serviceLine,
      tokens: rows.reduce((s, r) => s + r.tokenConsumption, 0),
      cost: Number(rows.reduce((s, r) => s + r.cost, 0).toFixed(4)),
      userCount: new Set(rows.map(r => r.userMail.toLowerCase())).size,
      subServiceLines: Array.from(new Set(rows.map(r => r.subServiceLine1).filter(Boolean))),
    }))
    .sort((a, b) => b.tokens - a.tokens);

  // By Sub-Service Line breakdown
  const bySubSlMap = groupBy(usageRows, r => `${r.orgServiceLine}:::${r.subServiceLine1 || 'General'}`);
  const bySubServiceLine = Array.from(bySubSlMap.entries())
    .map(([key, rows]) => {
      const [serviceLine, subServiceLine] = key.split(':::');
      return {
        serviceLine,
        subServiceLine,
        tokens: rows.reduce((s, r) => s + r.tokenConsumption, 0),
        cost: Number(rows.reduce((s, r) => s + r.cost, 0).toFixed(4)),
        userCount: new Set(rows.map(r => r.userMail.toLowerCase())).size,
      };
    })
    .sort((a, b) => b.tokens - a.tokens);

  // Users breakdown by spend — every consumer (Top Power Spenders, Top Active Users
  // by Spend) ranks by dollar cost, not token volume, so sort accordingly here.
  const byUserMap = groupBy(usageRows, r => r.userMail);
  const topUsers = Array.from(byUserMap.entries())
    .map(([userMail, rows]) => {
      const toolsSet = new Set(rows.map(r => r.aiTool).filter(Boolean));
      return {
        userMail,
        displayName: rows[0].displayName,
        tokens: rows.reduce((s, r) => s + r.tokenConsumption, 0),
        cost: Number(rows.reduce((s, r) => s + r.cost, 0).toFixed(4)),
        aiTools: Array.from(toolsSet),
      };
    })
    .sort((a, b) => b.cost - a.cost);

  // Users capacity & waste breakdown — current period, plus the same
  // computation over the previous period so waste/overage/cap-risk/license
  // ROI KPI cards can show a real "vs last period" comparison instead of a
  // fixed reference baseline. Per-tool free limits are derived once from the
  // current period's Usage rows and shared across both period computations
  // (see computeToolFreeLimits) so current and previous periods are measured
  // against the same ceiling.
  const toolFreeLimits = computeToolFreeLimits(usageRows);

  // Hard ceiling: the old schema had a fixed, dataset-calibrated 100,000
  // Token hard cap. This derives a scale-appropriate replacement instead of
  // reusing that stale absolute number — 3x the average per-user free-dollar
  // limit (sum of each user's held tools' free limits) in the current period.
  // Flagged here since it's a placeholder assumption pending real data
  // guidance on an actual dollar cap.
  const allCurrentUsers = groupBy(currentRows, r => r.userMail);
  const avgFreeLimitPerUser = allCurrentUsers.size > 0
    ? Array.from(allCurrentUsers.values()).reduce((sum, userRows) => {
        const toolsSet = new Set(userRows.map(r => r.aiTool).filter(Boolean));
        const userLimit = Array.from(toolsSet).reduce((s, t) => s + (toolFreeLimits.get(t) || 0), 0);
        return sum + userLimit;
      }, 0) / allCurrentUsers.size
    : 0;
  const hardCeiling = avgFreeLimitPerUser * 3;

  const {
    totalWasteCost,
    totalOverageCost,
    totalUsageLimitsSum,
    ceilingRiskCount,
    totalLicenseCost,
    licenseUnderutilizedCost,
    licenseOverutilizedValue,
    userCapacityBreakdown,
  } = computeCapacityAggregates(currentRows, hardCeiling, toolFreeLimits);

  const prevCapacity = computeCapacityAggregates(previousRows, hardCeiling, toolFreeLimits);
  const prevTotalCostForCapacity = previousUsageRows.reduce((s, r) => s + r.cost, 0);

  const licenseEfficiencyRate = totalUsageLimitsSum > 0
    ? Number(((totalCost / totalUsageLimitsSum) * 100).toFixed(1))
    : 0;

  const licenseRoiPercent = totalLicenseCost > 0
    ? Number(((totalCost / totalLicenseCost) * 100).toFixed(1))
    : 0;

  const prevLicenseRoiPercent = prevCapacity.totalLicenseCost > 0
    ? Number(((prevTotalCostForCapacity / prevCapacity.totalLicenseCost) * 100).toFixed(1))
    : 0;

  // Previous-period cost by Service Line / Super Region / Sub-Service Line,
  // and previous distinct sub-practice count — so the Service Line Analytics
  // KPI cards can compare against this same entity's own real prior-period
  // value instead of a fixed $0 baseline.
  const prevByServiceLineMap = groupBy(previousUsageRows, r => r.orgServiceLine);
  const prevByServiceLine = Array.from(prevByServiceLineMap.entries()).map(([serviceLine, rows]) => ({
    serviceLine,
    cost: Number(rows.reduce((s, r) => s + r.cost, 0).toFixed(4)),
  }));

  const prevByRegionMap = groupBy(previousUsageRows, r => r.superRegion);
  const prevByManagementRegion = Array.from(prevByRegionMap.entries()).map(([region, rows]) => ({
    region,
    cost: Number(rows.reduce((s, r) => s + r.cost, 0).toFixed(4)),
  }));

  const prevBySubSlMap = groupBy(previousUsageRows, r => `${r.orgServiceLine}:::${r.subServiceLine1 || 'General'}`);
  const prevBySubServiceLine = Array.from(prevBySubSlMap.entries()).map(([key, rows]) => {
    const [serviceLine, subServiceLine] = key.split(':::');
    return {
      serviceLine,
      subServiceLine,
      cost: Number(rows.reduce((s, r) => s + r.cost, 0).toFixed(4)),
    };
  });

  const prevSubServiceLineCount = new Set(
    previousUsageRows.map(r => `${r.orgServiceLine}:::${r.subServiceLine1 || 'General'}`)
  ).size;

  // Billable vs Non-Billable Insights
  const billableRows = usageRows.filter(r => r.billableFlag === 'True');
  const nonBillableRows = usageRows.filter(r => r.billableFlag === 'False');
  const billableSpend = Number(billableRows.reduce((s, r) => s + r.cost, 0).toFixed(2));
  const nonBillableSpend = Number(nonBillableRows.reduce((s, r) => s + r.cost, 0).toFixed(2));
  const billableSpendPercent = totalCost > 0 ? Number(((billableSpend / totalCost) * 100).toFixed(1)) : 0;

  // By ProjectCode breakdown
  const byProjectCodeMap = groupBy(usageRows, r => r.projectCode || 'Unassigned');
  const byProjectCode = Array.from(byProjectCodeMap.entries()).map(([pCode, rows]) => {
    const tokens = Math.round(rows.reduce((s, r) => s + r.tokenConsumption, 0));
    const cost = Number(rows.reduce((s, r) => s + r.cost, 0).toFixed(2));
    const userCount = new Set(rows.map(r => r.userMail)).size;
    return {
      projectCode: pCode,
      tokens,
      cost,
      userCount,
    };
  }).sort((a, b) => b.cost - a.cost);

  // Monthly Trend breakdown (Year / Month columns) with per-AI-tool cost split
  const byMonthMap = groupBy(usageRows, r => String(r.monthId));
  const monthlyTrend = Array.from(byMonthMap.entries())
    .map(([, rows]) => {
      const monthId = rows[0].monthId;
      const monthLabel = rows[0].monthYear.replace(/_/g, ' ');
      const tokens = Math.round(rows.reduce((s, r) => s + r.tokenConsumption, 0));
      const cost = Number(rows.reduce((s, r) => s + r.cost, 0).toFixed(4));
      const userCount = new Set(rows.map(r => r.userMail.toLowerCase())).size;
      const costPer1kTokens = tokens > 0 ? Number((cost / (tokens / 1000)).toFixed(6)) : 0;

      const point: Record<string, number | string> = {
        monthId,
        monthLabel,
        tokens,
        cost,
        userCount,
        costPer1kTokens,
      };
      const toolCostMap = groupBy(rows, r => r.aiTool);
      for (const [tool, toolRows] of toolCostMap.entries()) {
        point[tool] = Number(toolRows.reduce((s, r) => s + r.cost, 0).toFixed(4));
      }
      return point as unknown as MonthlyTrendPoint;
    })
    .sort((a, b) => a.monthId - b.monthId);

  // User Engagement Cohorts: with no day-level Activity Date, "habitual" is
  // redefined from active-days-per-active-month to active-months-out-of-the-
  // selected-window — the closest monthly-grained analog of the same idea
  // (thresholds re-picked accordingly: 90%+/60%+/25%+ of the window's months).
  const totalMonthsInWindow = new Set(currentRows.map(r => r.monthId)).size || 1;
  const byUserMonthsMap = groupBy(usageRows, r => r.userMail.toLowerCase());
  let embeddedCount = 0, regularCount = 0, occasionalCount = 0, dropoutCount = 0;
  for (const [, rows] of byUserMonthsMap.entries()) {
    const activeMonths = new Set(rows.map(r => r.monthId)).size;
    const activeMonthRatio = activeMonths / totalMonthsInWindow;
    if (activeMonthRatio >= 0.9) embeddedCount++;
    else if (activeMonthRatio >= 0.6) regularCount++;
    else if (activeMonthRatio >= 0.25) occasionalCount++;
    else dropoutCount++;
  }
  const engagementTotalUsers = byUserMonthsMap.size;
  const pct = (n: number) => (engagementTotalUsers > 0 ? Number(((n / engagementTotalUsers) * 100).toFixed(1)) : 0);
  const userEngagementCohorts = {
    embeddedCount,
    regularCount,
    occasionalCount,
    dropoutCount,
    totalUsers: engagementTotalUsers,
    embeddedPercent: pct(embeddedCount),
    regularPercent: pct(regularCount),
    occasionalPercent: pct(occasionalCount),
    dropoutPercent: pct(dropoutCount),
  };

  return {
    totalTokenConsumption: Math.round(totalTokenConsumption),
    totalCost: Number(totalCost.toFixed(4)),
    costPer1kTokens: Number(costPer1kTokens.toFixed(6)),
    billableUtilizationRate: Number(billableUtilizationRate.toFixed(2)),
    prevTotalCost: Number(prevTotalCost.toFixed(4)),
    prevTotalTokenConsumption: Math.round(prevTotalTokenConsumption),
    previousDataAvailable,
    byAiTool,
    multiToolOverlap,
    byCtNonCt,
    byManagementRegion,
    byCountry,
    byServiceLine,
    bySubServiceLine,
    topUsers,
    totalWasteCost: Number(totalWasteCost.toFixed(2)),
    totalOverageCost: Number(totalOverageCost.toFixed(2)),
    licenseEfficiencyRate,
    ceilingRiskCount,
    hardCeiling: Number(hardCeiling.toFixed(2)),
    userCapacityBreakdown,
    totalLicenseCost: Number(totalLicenseCost.toFixed(2)),
    licenseRoiPercent,
    licenseUnderutilizedCost: Number(licenseUnderutilizedCost.toFixed(2)),
    licenseOverutilizedValue: Number(licenseOverutilizedValue.toFixed(2)),
    prevTotalWasteCost: Number(prevCapacity.totalWasteCost.toFixed(2)),
    prevTotalOverageCost: Number(prevCapacity.totalOverageCost.toFixed(2)),
    prevCeilingRiskCount: prevCapacity.ceilingRiskCount,
    prevLicenseRoiPercent,
    prevByServiceLine,
    prevByManagementRegion,
    prevBySubServiceLine,
    prevSubServiceLineCount,
    billableSpend,
    nonBillableSpend,
    billableSpendPercent,
    byProjectCode,
    monthlyTrend,
    userEngagementCohorts,
    totalRosterUserCount,
    activeUserCount,
    inactiveUserCount,
  };
}
