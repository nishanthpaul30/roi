import { loadCsvData, CsvUsageRow } from '../data/csvLoader';
import { GlobalFilterState, MetricDelta, TimeSeriesPoint, MetricResult, ComparisonPeriod } from './types';
import { format, parseISO, subDays, differenceInDays } from 'date-fns';

export function calculateDelta(
  current: number,
  previous: number,
  isRateMetric = false
): MetricDelta {
  const absoluteDelta = current - previous;
  const percentageDelta =
    previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;

  let percentagePointDelta: number | undefined = undefined;
  if (isRateMetric) percentagePointDelta = current - previous;

  let trend: 'up' | 'down' | 'neutral' = 'neutral';
  if (absoluteDelta > 0.0001) trend = 'up';
  else if (absoluteDelta < -0.0001) trend = 'down';

  return {
    current: Number(current.toFixed(4)),
    previous: Number(previous.toFixed(4)),
    absoluteDelta: Number(absoluteDelta.toFixed(4)),
    percentageDelta: Number(percentageDelta.toFixed(2)),
    percentagePointDelta:
      percentagePointDelta !== undefined ? Number(percentagePointDelta.toFixed(2)) : undefined,
    trend,
    isRateMetric,
  };
}

export function getPreviousDateRange(
  startDate: string,
  endDate: string,
  comparisonPeriod: ComparisonPeriod
): { prevStartDate: string; prevEndDate: string } {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const diffDays = differenceInDays(end, start) + 1;

  if (comparisonPeriod === 'doD') {
    return {
      prevStartDate: format(subDays(start, 1), 'yyyy-MM-dd'),
      prevEndDate: format(subDays(end, 1), 'yyyy-MM-dd'),
    };
  } else if (comparisonPeriod === 'woW') {
    return {
      prevStartDate: format(subDays(start, 7), 'yyyy-MM-dd'),
      prevEndDate: format(subDays(end, 7), 'yyyy-MM-dd'),
    };
  } else if (comparisonPeriod === 'moM') {
    return {
      prevStartDate: format(subDays(start, 28), 'yyyy-MM-dd'),
      prevEndDate: format(subDays(end, 28), 'yyyy-MM-dd'),
    };
  } else {
    return {
      prevStartDate: format(subDays(start, diffDays), 'yyyy-MM-dd'),
      prevEndDate: format(subDays(end, diffDays), 'yyyy-MM-dd'),
    };
  }
}

/**
 * Filter CSV rows by date range + CSV-native dimensions
 */
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

/**
 * Primary Metric Engine — reads from ai_usage_data.csv.
 * Only metrics derivable from: Token Consumption, Daily Billable Tokens, Cost in USD
 */
export async function getMetric(
  metricId: string,
  filters: GlobalFilterState
): Promise<MetricResult> {
  const { startDate, endDate, comparisonPeriod } = filters;
  const { prevStartDate, prevEndDate } = getPreviousDateRange(startDate, endDate, comparisonPeriod);

  const allRows = loadCsvData();
  const currentRows = filterRows(allRows, filters, startDate, endDate);
  const previousRows = filterRows(allRows, filters, prevStartDate, prevEndDate);

  let currentVal = 0;
  let prevVal = 0;
  let isRate = false;

  switch (metricId) {
    case 'TOKEN_CONSUMPTION':
      currentVal = currentRows.reduce((s, r) => s + r.tokenConsumption, 0);
      prevVal = previousRows.reduce((s, r) => s + r.tokenConsumption, 0);
      break;

    case 'DAILY_BILLABLE_TOKENS':
      currentVal = currentRows.reduce((s, r) => s + r.dailyBillableTokens, 0);
      prevVal = previousRows.reduce((s, r) => s + r.dailyBillableTokens, 0);
      break;

    case 'COST':
      currentVal = currentRows.reduce((s, r) => s + r.cost, 0);
      prevVal = previousRows.reduce((s, r) => s + r.cost, 0);
      break;

    case 'COST_PER_1K_TOKENS': {
      isRate = true;
      const cCost = currentRows.reduce((s, r) => s + r.cost, 0);
      const cBill = currentRows.reduce((s, r) => s + r.dailyBillableTokens, 0);
      currentVal = cBill > 0 ? cCost / (cBill / 1000) : 0;

      const pCost = previousRows.reduce((s, r) => s + r.cost, 0);
      const pBill = previousRows.reduce((s, r) => s + r.dailyBillableTokens, 0);
      prevVal = pBill > 0 ? pCost / (pBill / 1000) : 0;
      break;
    }

    case 'COST_PER_ACTIVE_USER': {
      // "Active" means the user recorded at least 1 token of usage — a licensed
      // seat with 0 tokens/$0 cost (see roi.ts's usageRows) must not inflate the
      // denominator here, or this "per active user" figure silently becomes a
      // per-seat figure instead.
      isRate = true;
      const cActiveRows = currentRows.filter(r => r.tokenConsumption > 0);
      const cCost = cActiveRows.reduce((s, r) => s + r.cost, 0);
      const cUsers = new Set(cActiveRows.map(r => r.userMail)).size || 1;
      currentVal = cCost / cUsers;

      const pActiveRows = previousRows.filter(r => r.tokenConsumption > 0);
      const pCost = pActiveRows.reduce((s, r) => s + r.cost, 0);
      const pUsers = new Set(pActiveRows.map(r => r.userMail)).size || 1;
      prevVal = pCost / pUsers;
      break;
    }

    case 'BILLABLE_UTILIZATION_RATE': {
      isRate = true;
      const cTotal = currentRows.reduce((s, r) => s + r.tokenConsumption, 0);
      const cBillable = currentRows.reduce((s, r) => s + r.dailyBillableTokens, 0);
      currentVal = cTotal > 0 ? (cBillable / cTotal) * 100 : 0;

      const pTotal = previousRows.reduce((s, r) => s + r.tokenConsumption, 0);
      const pBillable = previousRows.reduce((s, r) => s + r.dailyBillableTokens, 0);
      prevVal = pTotal > 0 ? (pBillable / pTotal) * 100 : 0;
      break;
    }

    case 'AVG_DAILY_COST': {
      // Group by activityDate first, then average
      const dayMap = new Map<string, number>();
      currentRows.forEach(r => {
        dayMap.set(r.activityDate, (dayMap.get(r.activityDate) || 0) + r.cost);
      });
      const dayMapPrev = new Map<string, number>();
      previousRows.forEach(r => {
        dayMapPrev.set(r.activityDate, (dayMapPrev.get(r.activityDate) || 0) + r.cost);
      });
      currentVal = dayMap.size > 0 ? Array.from(dayMap.values()).reduce((a, b) => a + b, 0) / dayMap.size : 0;
      prevVal = dayMapPrev.size > 0 ? Array.from(dayMapPrev.values()).reduce((a, b) => a + b, 0) / dayMapPrev.size : 0;
      break;
    }

    default:
      currentVal = currentRows.reduce((s, r) => s + r.cost, 0);
      prevVal = previousRows.reduce((s, r) => s + r.cost, 0);
  }

  // Build daily time series — aggregate multiple rows per date
  const dayMap = new Map<string, number>();
  currentRows.forEach((r) => {
    let val = 0;
    if (metricId === 'TOKEN_CONSUMPTION') val = r.tokenConsumption;
    else if (metricId === 'DAILY_BILLABLE_TOKENS') val = r.dailyBillableTokens;
    else if (metricId === 'COST' || metricId === 'AVG_DAILY_COST') val = r.cost;
    else if (metricId === 'COST_PER_1K_TOKENS') val = r.cost; // will recalc per day below
    else if (metricId === 'BILLABLE_UTILIZATION_RATE') val = r.tokenConsumption;
    else val = r.cost;
    dayMap.set(r.activityDate, (dayMap.get(r.activityDate) || 0) + val);
  });

  const series: TimeSeriesPoint[] = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value: Number(value.toFixed(4)) }));

  const summary = calculateDelta(currentVal, prevVal, isRate);

  return { metricId, metricName: metricId.replace(/_/g, ' '), summary, series };
}
