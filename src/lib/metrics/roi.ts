import { loadCsvData, CsvUsageRow } from '../data/csvLoader';
import { GlobalFilterState, TokenCostSummary, MonthlyTrendPoint } from './types';
import { getPreviousDateRange } from './engine';

function filterRows(rows: CsvUsageRow[], filters: GlobalFilterState, sDate: string, eDate: string): CsvUsageRow[] {
  return rows.filter((r) => {
    if (r.activityDate < sDate || r.activityDate > eDate) return false;
    if (filters.aiTool && filters.aiTool !== 'all' && r.aiTool !== filters.aiTool) return false;
    if (filters.managementRegion && filters.managementRegion !== 'all' && r.managementRegion !== filters.managementRegion) return false;
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
 * Calculate token/cost summary from ai_usage_data.csv.
 * All three fields (Token Consumption, Daily Billable Tokens, Cost in USD) are read directly.
 * Includes breakdown dimensions from CSV columns.
 */
export async function calculateTokenCostSummary(
  filters: GlobalFilterState
): Promise<TokenCostSummary> {
  const { startDate, endDate, comparisonPeriod } = filters;
  const { prevStartDate, prevEndDate } = getPreviousDateRange(startDate, endDate, comparisonPeriod);

  const allRows = loadCsvData();
  const currentRows = filterRows(allRows, filters, startDate, endDate);
  const previousRows = filterRows(allRows, filters, prevStartDate, prevEndDate);

  // Core aggregates
  const totalTokenConsumption = currentRows.reduce((s, r) => s + r.tokenConsumption, 0);
  const totalBillableTokens = currentRows.reduce((s, r) => s + r.dailyBillableTokens, 0);
  const totalCost = currentRows.reduce((s, r) => s + r.cost, 0);

  const prevTotalTokenConsumption = previousRows.reduce((s, r) => s + r.tokenConsumption, 0);
  const prevTotalBillableTokens = previousRows.reduce((s, r) => s + r.dailyBillableTokens, 0);
  const prevTotalCost = previousRows.reduce((s, r) => s + r.cost, 0);

  // Unique activity days for avg daily cost
  const uniqueDays = new Set(currentRows.map(r => r.activityDate)).size || 1;
  const avgDailyCost = totalCost / uniqueDays;
  const costPer1kTokens = totalBillableTokens > 0 ? (totalCost / (totalBillableTokens / 1000)) : 0;
  const billableUtilizationRate = totalTokenConsumption > 0 ? (totalBillableTokens / totalTokenConsumption) * 100 : 0;

  // By AI Tool breakdown with Unit Economics
  const byToolMap = groupBy(currentRows, r => r.aiTool);
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
  for (const r of currentRows) {
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

  // By Management Region breakdown
  const byRegionMap = groupBy(currentRows, r => r.managementRegion);
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
  const byCountryMap = groupBy(currentRows, r => r.country);
  const byCountry = Array.from(byCountryMap.entries())
    .map(([country, rows]) => ({
      country,
      region: rows[0]?.region || 'N/A',
      managementRegion: rows[0]?.managementRegion || 'N/A',
      tokens: rows.reduce((s, r) => s + r.tokenConsumption, 0),
      cost: Number(rows.reduce((s, r) => s + r.cost, 0).toFixed(4)),
      userCount: new Set(rows.map(r => r.userMail.toLowerCase())).size,
    }))
    .sort((a, b) => b.tokens - a.tokens);

  // By Service Line breakdown
  const bySlMap = groupBy(currentRows, r => r.orgServiceLine);
  const byServiceLine = Array.from(bySlMap.entries())
    .map(([serviceLine, rows]) => ({
      serviceLine,
      tokens: rows.reduce((s, r) => s + r.tokenConsumption, 0),
      cost: Number(rows.reduce((s, r) => s + r.cost, 0).toFixed(4)),
      userCount: new Set(rows.map(r => r.userMail.toLowerCase())).size,
      subServiceLines: Array.from(new Set(rows.map(r => r.orgSubServiceLine).filter(Boolean))),
    }))
    .sort((a, b) => b.tokens - a.tokens);

  // By Sub-Service Line breakdown
  const bySubSlMap = groupBy(currentRows, r => `${r.orgServiceLine}:::${r.orgSubServiceLine || 'General'}`);
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

  // Users breakdown by token consumption
  const byUserMap = groupBy(currentRows, r => r.userMail);
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
    .sort((a, b) => b.tokens - a.tokens);

  // Users capacity & waste breakdown
  const HARD_TOKEN_CEILING = 100000; // Hard cap per user

  let totalWasteCost = 0;
  let totalOverageCost = 0;
  let totalUsageLimitsSum = 0;
  let ceilingRiskCount = 0;
  let totalLicenseCost = 0;
  let licenseUnderutilizedCost = 0;
  let licenseOverutilizedValue = 0;

  const userCapacityBreakdown = Array.from(byUserMap.entries()).map(([userMail, rows]) => {
    const displayName = rows[0].displayName || userMail;
    const toolsSet = new Set(rows.map(r => r.aiTool).filter(Boolean));
    const aiTools = Array.from(toolsSet);
    const actualCost = Number(rows.reduce((s, r) => s + r.cost, 0).toFixed(4));
    const tokenConsumption = Math.round(rows.reduce((s, r) => s + r.tokenConsumption, 0));
    
    // Per-tool licensing: License Cost in USD / Usage Free Token Limit are set per
    // AI Tool in the CSV (Copilot: $35 license / $20 free limit; ChatGPT: usage-based
    // with a $20 free limit; Claude: fully usage-based, no license or free limit).
    // A user's overall allowance is the sum of each DISTINCT tool they actually use,
    // taken once per tool (not once per row) so repeated days on the same tool don't
    // double-count that tool's flat license/limit.
    let usageFreeTokenLimit = 0;
    for (const tool of toolsSet) {
      const toolRow = rows.find((r) => r.aiTool === tool);
      usageFreeTokenLimit += toolRow?.usageFreeTokenLimit || 0;
    }
    const usageLimit = usageFreeTokenLimit;
    totalUsageLimitsSum += usageLimit;

    let wasteCost = 0;
    let overageCost = 0;
    let zone: 'zone1_under' | 'zone2_over' | 'zone_balanced' = 'zone_balanced';

    if (actualCost < usageLimit) {
      wasteCost = Number((usageLimit - actualCost).toFixed(4));
      zone = 'zone1_under';
      totalWasteCost += wasteCost;
    } else if (actualCost > usageLimit) {
      overageCost = Number((actualCost - usageLimit).toFixed(4));
      zone = 'zone2_over';
      totalOverageCost += overageCost;
    }

    const ceilingPercent = Number(((tokenConsumption / HARD_TOKEN_CEILING) * 100).toFixed(1));
    if (tokenConsumption >= 90000) {
      ceilingRiskCount++;
    }

    // License Cost ROI: sum each distinct tool's own flat License Cost in USD
    // (independent of the $ free-token limit above) — e.g. Copilot's $35 seat fee.
    // Usage-based tools (ChatGPT, Claude) contribute $0 here.
    let licenseCost = 0;
    for (const tool of toolsSet) {
      const toolRow = rows.find((r) => r.aiTool === tool);
      licenseCost += toolRow?.licenseCost || 0;
    }
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

  const licenseEfficiencyRate = totalUsageLimitsSum > 0
    ? Number(((totalCost / totalUsageLimitsSum) * 100).toFixed(1))
    : 0;

  const licenseRoiPercent = totalLicenseCost > 0
    ? Number(((totalCost / totalLicenseCost) * 100).toFixed(1))
    : 0;

  // Billable vs Non-Billable Insights
  const billableRows = currentRows.filter(r => r.billableFlag === 'True' || r.billableFlag === 'true' || r.billableFlag === '1');
  const nonBillableRows = currentRows.filter(r => r.billableFlag === 'False' || r.billableFlag === 'false' || r.billableFlag === '0');
  const billableSpend = Number(billableRows.reduce((s, r) => s + r.cost, 0).toFixed(2));
  const nonBillableSpend = Number(nonBillableRows.reduce((s, r) => s + r.cost, 0).toFixed(2));
  const billableSpendPercent = totalCost > 0 ? Number(((billableSpend / totalCost) * 100).toFixed(1)) : 0;

  // By ProjectCode breakdown
  const byProjectCodeMap = groupBy(currentRows, r => r.projectCode || 'Unassigned');
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

  // Monthly Trend breakdown (Month_Year / Month Id columns) with per-AI-tool cost split
  const byMonthMap = groupBy(currentRows, r => String(r.monthId));
  const monthlyTrend = Array.from(byMonthMap.entries())
    .map(([, rows]) => {
      const monthId = rows[0].monthId;
      const monthLabel = rows[0].monthYear.replace(/_/g, ' ');
      const tokens = Math.round(rows.reduce((s, r) => s + r.tokenConsumption, 0));
      const billableTokens = Math.round(rows.reduce((s, r) => s + r.dailyBillableTokens, 0));
      const cost = Number(rows.reduce((s, r) => s + r.cost, 0).toFixed(4));
      const userCount = new Set(rows.map(r => r.userMail.toLowerCase())).size;
      const costPer1kTokens = tokens > 0 ? Number((cost / (tokens / 1000)).toFixed(6)) : 0;

      const point: Record<string, number | string> = {
        monthId,
        monthLabel,
        tokens,
        cost,
        billableTokens,
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

  // User Engagement Cohorts: classify each active user by their average distinct
  // active-days per active month, so retention/adoption health is measurable from
  // the raw CSV instead of asserted.
  const byUserDaysMap = groupBy(currentRows, r => r.userMail.toLowerCase());
  let embeddedCount = 0, regularCount = 0, occasionalCount = 0, dropoutCount = 0;
  for (const [, rows] of byUserDaysMap.entries()) {
    const activeDays = new Set(rows.map(r => r.activityDate)).size;
    const activeMonths = new Set(rows.map(r => r.monthId)).size || 1;
    const avgDaysPerActiveMonth = activeDays / activeMonths;
    if (avgDaysPerActiveMonth >= 16) embeddedCount++;
    else if (avgDaysPerActiveMonth >= 9) regularCount++;
    else if (avgDaysPerActiveMonth >= 4) occasionalCount++;
    else dropoutCount++;
  }
  const engagementTotalUsers = byUserDaysMap.size;
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
    totalBillableTokens: Math.round(totalBillableTokens),
    totalCost: Number(totalCost.toFixed(4)),
    avgDailyCost: Number(avgDailyCost.toFixed(4)),
    costPer1kTokens: Number(costPer1kTokens.toFixed(6)),
    billableUtilizationRate: Number(billableUtilizationRate.toFixed(2)),
    prevTotalCost: Number(prevTotalCost.toFixed(4)),
    prevTotalTokenConsumption: Math.round(prevTotalTokenConsumption),
    prevTotalBillableTokens: Math.round(prevTotalBillableTokens),
    byAiTool,
    multiToolOverlap,
    byManagementRegion,
    byCountry,
    byServiceLine,
    bySubServiceLine,
    topUsers,
    totalWasteCost: Number(totalWasteCost.toFixed(2)),
    totalOverageCost: Number(totalOverageCost.toFixed(2)),
    licenseEfficiencyRate,
    ceilingRiskCount,
    userCapacityBreakdown,
    totalLicenseCost: Number(totalLicenseCost.toFixed(2)),
    licenseRoiPercent,
    licenseUnderutilizedCost: Number(licenseUnderutilizedCost.toFixed(2)),
    licenseOverutilizedValue: Number(licenseOverutilizedValue.toFixed(2)),
    billableSpend,
    nonBillableSpend,
    billableSpendPercent,
    byProjectCode,
    monthlyTrend,
    userEngagementCohorts,
  };
}
