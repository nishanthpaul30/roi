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

  // By AI Tool breakdown
  const byToolMap = groupBy(currentRows, r => r.aiTool);
  const byAiTool = Array.from(byToolMap.entries())
    .map(([tool, rows]) => ({
      tool,
      tokens: rows.reduce((s, r) => s + r.tokenConsumption, 0),
      cost: Number(rows.reduce((s, r) => s + r.cost, 0).toFixed(4)),
    }))
    .sort((a, b) => b.tokens - a.tokens);

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
    .map(([userMail, rows]) => ({
      userMail,
      displayName: rows[0].displayName,
      tokens: rows.reduce((s, r) => s + r.tokenConsumption, 0),
      cost: Number(rows.reduce((s, r) => s + r.cost, 0).toFixed(4)),
    }))
    .sort((a, b) => b.tokens - a.tokens);

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
    byManagementRegion,
    byCountry,
    byServiceLine,
    topUsers,
  };
}
