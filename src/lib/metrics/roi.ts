import { loadCsvData, CsvUsageRow } from '../data/csvLoader';
import { GlobalFilterState, TokenCostSummary } from './types';
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
    }))
    .sort((a, b) => b.tokens - a.tokens);

  // By Country breakdown
  const byCountryMap = groupBy(currentRows, r => r.country);
  const byCountry = Array.from(byCountryMap.entries())
    .map(([country, rows]) => ({
      country,
      tokens: rows.reduce((s, r) => s + r.tokenConsumption, 0),
      cost: Number(rows.reduce((s, r) => s + r.cost, 0).toFixed(4)),
    }))
    .sort((a, b) => b.tokens - a.tokens);

  // By Service Line breakdown
  const bySlMap = groupBy(currentRows, r => r.orgServiceLine);
  const byServiceLine = Array.from(bySlMap.entries())
    .map(([serviceLine, rows]) => ({
      serviceLine,
      tokens: rows.reduce((s, r) => s + r.tokenConsumption, 0),
      cost: Number(rows.reduce((s, r) => s + r.cost, 0).toFixed(4)),
    }))
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
  const DEFAULT_USER_USAGE_LIMIT = 80.0; // Default $80 usage limit per license period
  const HARD_TOKEN_CEILING = 100000; // Hard cap per user

  let totalWasteCost = 0;
  let totalOverageCost = 0;
  let totalUsageLimitsSum = 0;
  let ceilingRiskCount = 0;

  const userCapacityBreakdown = Array.from(byUserMap.entries()).map(([userMail, rows]) => {
    const displayName = rows[0].displayName || userMail;
    const toolsSet = new Set(rows.map(r => r.aiTool).filter(Boolean));
    const aiTools = Array.from(toolsSet);
    const actualCost = Number(rows.reduce((s, r) => s + r.cost, 0).toFixed(4));
    const tokenConsumption = Math.round(rows.reduce((s, r) => s + r.tokenConsumption, 0));
    
    // Usage free token limit (reads directly from CSV row field or default allocation)
    const usageFreeTokenLimit = rows[0]?.usageFreeTokenLimit ? rows[0].usageFreeTokenLimit : (rows[0]?.usageLimit ? rows[0].usageLimit : DEFAULT_USER_USAGE_LIMIT);
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
    };
  }).sort((a, b) => b.wasteCost - a.wasteCost || b.actualCost - a.actualCost);

  const licenseEfficiencyRate = totalUsageLimitsSum > 0
    ? Number(((totalCost / totalUsageLimitsSum) * 100).toFixed(1))
    : 0;

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
    topUsers,
    totalWasteCost: Number(totalWasteCost.toFixed(2)),
    totalOverageCost: Number(totalOverageCost.toFixed(2)),
    licenseEfficiencyRate,
    ceilingRiskCount,
    userCapacityBreakdown,
  };
}
