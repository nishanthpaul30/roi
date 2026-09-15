import { loadCsvData, getDatasetMonthIdBounds, dateStringToMonthId, CsvUsageRow } from '../data/csvLoader';
import { GlobalFilterState, MetricDelta, TimeSeriesPoint, MetricResult, ComparisonPeriod } from './types';
import {
  format,
  parseISO,
  subDays,
  differenceInDays,
  startOfMonth,
  endOfMonth,
  subMonths,
  differenceInCalendarMonths,
  isSameDay,
} from 'date-fns';

export function calculateDelta(
  current: number,
  previous: number,
  isRateMetric = false,
  previousDataAvailable = true
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
    previousDataAvailable,
  };
}

/**
 * The comparison window is the period immediately preceding the selected
 * range. The filter's startDate/endDate stay "YYYY-MM-DD" strings for API
 * compatibility with the existing month picker, but since the data source
 * itself is monthly-grained, every option the UI exposes (a single month, or
 * "All Months") is one or more whole calendar months — this snaps to the
 * same number of whole calendar months immediately before it. A genuinely
 * custom, non-month-aligned range falls back to an equal-length day shift.
 */
export function getPreviousDateRange(
  startDate: string,
  endDate: string,
  _comparisonPeriod: ComparisonPeriod
): { prevStartDate: string; prevEndDate: string } {
  const start = parseISO(startDate);
  const end = parseISO(endDate);

  const isWholeMonthRange = isSameDay(start, startOfMonth(start)) && isSameDay(end, endOfMonth(end));
  if (isWholeMonthRange) {
    const monthSpan = differenceInCalendarMonths(end, start) + 1;
    return {
      prevStartDate: format(startOfMonth(subMonths(start, monthSpan)), 'yyyy-MM-dd'),
      prevEndDate: format(endOfMonth(subMonths(end, monthSpan)), 'yyyy-MM-dd'),
    };
  }

  const diffDays = differenceInDays(end, start) + 1;
  return {
    prevStartDate: format(subDays(start, diffDays), 'yyyy-MM-dd'),
    prevEndDate: format(subDays(end, diffDays), 'yyyy-MM-dd'),
  };
}

/**
 * True only if the computed previous-period window overlaps the dataset's
 * real month coverage at all. A window that falls entirely before the
 * earliest (or after the latest) monthId has no genuine prior data to
 * compare against — as opposed to a covered month that simply has zero
 * matching rows for the current dimension filters, which is a real "$0" result.
 */
export function hasPreviousPeriodData(prevStartDate: string, prevEndDate: string): boolean {
  const bounds = getDatasetMonthIdBounds();
  if (!bounds) return false;
  const prevStartMonthId = dateStringToMonthId(prevStartDate);
  const prevEndMonthId = dateStringToMonthId(prevEndDate);
  return !(prevEndMonthId < bounds.minMonthId || prevStartMonthId > bounds.maxMonthId);
}

/**
 * Filter CSV rows by date range + CSV-native dimensions. The data source is
 * monthly-grained, so the date range compares monthId rather than a
 * day-level Activity Date.
 */
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

// Spend metrics answer "what did this cost us", so they count both cost pools:
// metered Usage rows and the License rows that carry the seat fees. Everything
// else stays usage-only — token counts have no licence equivalent, and
// COST_PER_1K_TOKENS is a unit rate for metered consumption, so folding in a
// fee with no token denominator would stop it being comparable to a vendor's
// metered price.
const SPEND_METRICS = new Set(['COST', 'AVG_DAILY_COST', 'AVG_MONTHLY_COST', 'COST_PER_ACTIVE_USER']);

/**
 * Calendar days covered by the given rows.
 *
 * The source is monthly — every row is dated the 1st — so there is no per-day
 * detail to count. Days are derived from the distinct months actually present,
 * which also keeps this correct for an arbitrary API date range: filtering
 * happens on monthId, so asking for 15-20 March still returns the whole month,
 * and dividing by the 6 requested days would overstate the daily rate sixfold.
 */
function daysCoveredBy(rows: CsvUsageRow[]): number {
  const monthIds = new Set<number>();
  for (const r of rows) {
    if (r.monthYear && r.monthId > 0) monthIds.add(r.monthId);
  }
  let days = 0;
  for (const id of monthIds) {
    // Day 0 of the next month is the last day of this one.
    days += new Date(Date.UTC(Math.floor(id / 100), id % 100, 0)).getUTCDate();
  }
  return days;
}

/**
 * Primary Metric Engine — reads from ai_usage_data.csv.
 *
 * Two row pools: `currentRows` is usage-only (Calculation Method = 'Usage'),
 * `currentSpendRows` adds the License rows. See SPEND_METRICS above for which
 * metrics use which, and roi.ts for the separate License ROI calculation.
 */
export async function getMetric(
  metricId: string,
  filters: GlobalFilterState
): Promise<MetricResult> {
  const { startDate, endDate, comparisonPeriod } = filters;
  const { prevStartDate, prevEndDate } = getPreviousDateRange(startDate, endDate, comparisonPeriod);
  const previousDataAvailable = hasPreviousPeriodData(prevStartDate, prevEndDate);

  const allRows = loadCsvData();
  const currentSpendRows = filterRows(allRows, filters, startDate, endDate);
  const previousSpendRows = filterRows(allRows, filters, prevStartDate, prevEndDate);
  const currentRows = currentSpendRows.filter(r => r.calculationMethod === 'Usage');
  const previousRows = previousSpendRows.filter(r => r.calculationMethod === 'Usage');

  // The rows this particular metric sums over.
  const includesLicense = SPEND_METRICS.has(metricId);
  const currentCostRows = includesLicense ? currentSpendRows : currentRows;
  const previousCostRows = includesLicense ? previousSpendRows : previousRows;

  let currentVal = 0;
  let prevVal = 0;
  let isRate = false;

  switch (metricId) {
    case 'TOKEN_CONSUMPTION':
      currentVal = currentRows.reduce((s, r) => s + r.tokenConsumption, 0);
      prevVal = previousRows.reduce((s, r) => s + r.tokenConsumption, 0);
      break;

    case 'COST':
      // Total AI Investment — metered usage plus licence fees.
      currentVal = currentCostRows.reduce((s, r) => s + r.cost, 0);
      prevVal = previousCostRows.reduce((s, r) => s + r.cost, 0);
      break;

    case 'COST_PER_1K_TOKENS': {
      isRate = true;
      const cCost = currentRows.reduce((s, r) => s + r.cost, 0);
      const cTokens = currentRows.reduce((s, r) => s + r.tokenConsumption, 0);
      currentVal = cTokens > 0 ? cCost / (cTokens / 1000) : 0;

      const pCost = previousRows.reduce((s, r) => s + r.cost, 0);
      const pTokens = previousRows.reduce((s, r) => s + r.tokenConsumption, 0);
      prevVal = pTokens > 0 ? pCost / (pTokens / 1000) : 0;
      break;
    }

    case 'COST_PER_ACTIVE_USER': {
      // "Active" means the user recorded at least 1 unit of usage — a licensed
      // seat with 0 consumption/$0 usage cost must not inflate the denominator
      // here, or this "per active user" figure silently becomes a per-seat figure.
      isRate = true;
      // Total outlay (usage + licence) spread over the people who actually used
      // the tools. "Active" is still decided from Usage rows — a licence row
      // records a seat, not activity — but the numerator is the full spend, so
      // this reads as "what each active user costs us all-in".
      const cCost = currentCostRows.reduce((s, r) => s + r.cost, 0);
      const cUsers = new Set(currentRows.filter(r => r.tokenConsumption > 0).map(r => r.userMail)).size || 1;
      currentVal = cCost / cUsers;

      const pCost = previousCostRows.reduce((s, r) => s + r.cost, 0);
      const pUsers = new Set(previousRows.filter(r => r.tokenConsumption > 0).map(r => r.userMail)).size || 1;
      prevVal = pCost / pUsers;
      break;
    }

    case 'BILLABLE_UTILIZATION_RATE': {
      // No separate "billable tokens" field in the new source — billability is
      // a convention on the Engagement Code (E-XXXXXX billable, I-XXXXXX not),
      // so this is now: consumption on billable engagement codes / total consumption.
      isRate = true;
      const cTotal = currentRows.reduce((s, r) => s + r.tokenConsumption, 0);
      const cBillable = currentRows.filter(r => r.billableFlag === 'True').reduce((s, r) => s + r.tokenConsumption, 0);
      currentVal = cTotal > 0 ? (cBillable / cTotal) * 100 : 0;

      const pTotal = previousRows.reduce((s, r) => s + r.tokenConsumption, 0);
      const pBillable = previousRows.filter(r => r.billableFlag === 'True').reduce((s, r) => s + r.tokenConsumption, 0);
      prevVal = pTotal > 0 ? (pBillable / pTotal) * 100 : 0;
      break;
    }

    case 'AVG_MONTHLY_COST': {
      // Group by monthId first, then average — for a single-month selection
      // this equals the month's total spend; it only differs from Total AI
      // Investment when the selected range spans multiple months.
      const monthMap = new Map<number, number>();
      currentCostRows.forEach(r => {
        monthMap.set(r.monthId, (monthMap.get(r.monthId) || 0) + r.cost);
      });
      const monthMapPrev = new Map<number, number>();
      previousCostRows.forEach(r => {
        monthMapPrev.set(r.monthId, (monthMapPrev.get(r.monthId) || 0) + r.cost);
      });
      currentVal = monthMap.size > 0 ? Array.from(monthMap.values()).reduce((a, b) => a + b, 0) / monthMap.size : 0;
      prevVal = monthMapPrev.size > 0 ? Array.from(monthMapPrev.values()).reduce((a, b) => a + b, 0) / monthMapPrev.size : 0;
      break;
    }

    case 'AVG_DAILY_COST': {
      // This previously fell through to the default branch, which sums cost and
      // never divides — so "average daily cost" was reporting the period total.
      const cDays = daysCoveredBy(currentCostRows);
      const cTotal = currentCostRows.reduce((s, r) => s + r.cost, 0);
      currentVal = cDays > 0 ? cTotal / cDays : 0;

      const pDays = daysCoveredBy(previousCostRows);
      const pTotal = previousCostRows.reduce((s, r) => s + r.cost, 0);
      prevVal = pDays > 0 ? pTotal / pDays : 0;
      break;
    }

    default:
      currentVal = currentRows.reduce((s, r) => s + r.cost, 0);
      prevVal = previousRows.reduce((s, r) => s + r.cost, 0);
  }

  // Build the monthly time series — aggregate multiple rows per month, keyed
  // by monthId so it sorts chronologically, labeled with the monthYear string.
  // Built from the same pool the headline figure used, so the chart under a
  // card always sums to the number on it.
  const monthMap = new Map<number, { label: string; value: number }>();
  currentCostRows.forEach((r) => {
    let val = 0;
    if (metricId === 'TOKEN_CONSUMPTION') val = r.tokenConsumption;
    else if (metricId === 'COST' || metricId === 'AVG_MONTHLY_COST') val = r.cost;
    else if (metricId === 'COST_PER_1K_TOKENS') val = r.cost; // will recalc per month below
    else if (metricId === 'BILLABLE_UTILIZATION_RATE') val = r.tokenConsumption;
    else val = r.cost;
    const existing = monthMap.get(r.monthId);
    monthMap.set(r.monthId, { label: r.monthYear, value: (existing?.value || 0) + val });
  });

  const series: TimeSeriesPoint[] = Array.from(monthMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([monthId, { label, value }]) => {
      // Each point on a daily-average series is that month's spend spread over
      // that month's own length, so the line matches the headline figure.
      if (metricId === 'AVG_DAILY_COST') {
        const daysInMonth = new Date(Date.UTC(Math.floor(monthId / 100), monthId % 100, 0)).getUTCDate();
        return { date: label, value: Number((value / daysInMonth).toFixed(4)) };
      }
      return { date: label, value: Number(value.toFixed(4)) };
    });

  const summary = calculateDelta(currentVal, prevVal, isRate, previousDataAvailable);

  return { metricId, metricName: metricId.replace(/_/g, ' '), summary, series };
}
