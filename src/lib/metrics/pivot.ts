import { loadCsvData, CsvUsageRow } from '../data/csvLoader';
import { GlobalFilterState } from './types';

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

export type DimensionKey =
  | 'aiTool'
  | 'managementRegion'
  | 'region'
  | 'country'
  | 'orgServiceLine'
  | 'orgSubServiceLine'
  | 'projectType'
  | 'billableFlag'
  | 'projectCode'
  | 'monthLabel'
  | 'ctNonCt'
  | 'subServiceLine1'
  | 'subServiceLine2'
  | 'engagementSuperRegion'
  | 'engagementServiceLine'
  | 'engagementSubServiceLine'
  | 'engagementCompetency'
  | 'gdsLocation'
  | 'costCenter';

// Ordered per the required application-wide hierarchy:
// CT/Non-CT -> Country -> Service Line -> Sub-Service Line 1 -> Sub-Service Line 2 ->
// Engagement Code -> Engagement Super Region -> Engagement Service Line ->
// Engagement Sub Service Line -> Engagement Competency. Remaining dimensions follow.
export const DIMENSIONS: { key: DimensionKey; label: string }[] = [
  { key: 'ctNonCt', label: 'CT / Non-CT' },
  { key: 'country', label: 'Country' },
  { key: 'orgServiceLine', label: 'Service Line' },
  { key: 'subServiceLine1', label: 'Sub-Service Line 1' },
  { key: 'subServiceLine2', label: 'Sub-Service Line 2' },
  { key: 'projectCode', label: 'Engagement Code (billing)' },
  { key: 'engagementSuperRegion', label: 'Engagement Super Region' },
  { key: 'engagementServiceLine', label: 'Engagement Service Line' },
  { key: 'engagementSubServiceLine', label: 'Engagement Sub Service Line' },
  { key: 'engagementCompetency', label: 'Engagement Competency' },
  { key: 'aiTool', label: 'AI Tool' },
  { key: 'managementRegion', label: 'Management Region' },
  { key: 'region', label: 'Region' },
  { key: 'orgSubServiceLine', label: 'Org Sub-Service Line' },
  { key: 'projectType', label: 'Project Type' },
  { key: 'billableFlag', label: 'Billable / Non-Billable' },
  { key: 'gdsLocation', label: 'GDS Location' },
  { key: 'costCenter', label: 'Cost Center' },
  { key: 'monthLabel', label: 'Month' },
];

export type MetricKey = 'cost' | 'tokenConsumption' | 'dailyBillableTokens';

export const METRICS: { key: MetricKey; label: string }[] = [
  { key: 'cost', label: 'Cost (USD)' },
  { key: 'tokenConsumption', label: 'Token Consumption' },
  { key: 'dailyBillableTokens', label: 'Daily Billable Tokens' },
];

function extractDim(row: CsvUsageRow, dim: DimensionKey): string {
  if (dim === 'monthLabel') return row.monthYear.replace(/_/g, ' ');
  const val = row[dim as keyof CsvUsageRow];
  return val ? String(val) : 'Unknown';
}

function extractMetric(row: CsvUsageRow, metric: MetricKey): number {
  if (metric === 'cost') return row.cost;
  if (metric === 'tokenConsumption') return row.tokenConsumption;
  return row.dailyBillableTokens;
}

export interface PivotResult {
  rowDim: DimensionKey;
  rowDimLabel: string;
  colDim: DimensionKey | 'none';
  colDimLabel: string;
  metric: MetricKey;
  metricLabel: string;
  columns: string[];
  rows: Record<string, any>[];
}

/**
 * Cross-tabulates ai_usage_data.csv rows by any two CSV-native dimensions and any summable metric,
 * so any dimension x dimension x metric permutation can be explored without a dedicated fixed panel.
 */
export function calculatePivot(
  filters: GlobalFilterState,
  rowDim: DimensionKey,
  colDim: DimensionKey | 'none',
  metric: MetricKey
): PivotResult {
  const allRows = loadCsvData();
  const rows = filterRows(allRows, filters, filters.startDate, filters.endDate);

  const columns = colDim === 'none'
    ? []
    : Array.from(new Set(rows.map((r) => extractDim(r, colDim)))).sort();

  const rowMap = new Map<string, { cells: Map<string, number>; userSet: Set<string>; total: number }>();

  for (const r of rows) {
    const rowKey = extractDim(r, rowDim);
    const colKey = colDim === 'none' ? '__total__' : extractDim(r, colDim);
    const val = extractMetric(r, metric);

    if (!rowMap.has(rowKey)) {
      rowMap.set(rowKey, { cells: new Map(), userSet: new Set(), total: 0 });
    }
    const entry = rowMap.get(rowKey)!;
    entry.cells.set(colKey, (entry.cells.get(colKey) || 0) + val);
    entry.userSet.add(r.userMail.toLowerCase());
    entry.total += val;
  }

  const pivotRows = Array.from(rowMap.entries())
    .map(([label, entry]) => {
      const record: Record<string, any> = {
        label,
        userCount: entry.userSet.size,
        total: Number(entry.total.toFixed(4)),
      };
      if (colDim === 'none') {
        record.value = Number((entry.cells.get('__total__') || 0).toFixed(4));
      } else {
        for (const c of columns) {
          record[c] = Number((entry.cells.get(c) || 0).toFixed(4));
        }
      }
      return record;
    })
    .sort((a, b) => b.total - a.total);

  const rowMeta = DIMENSIONS.find((d) => d.key === rowDim);
  const colMeta = colDim === 'none' ? null : DIMENSIONS.find((d) => d.key === colDim);
  const metricMeta = METRICS.find((m) => m.key === metric)!;

  return {
    rowDim,
    rowDimLabel: rowMeta?.label || rowDim,
    colDim,
    colDimLabel: colMeta?.label || 'None',
    metric,
    metricLabel: metricMeta.label,
    columns,
    rows: pivotRows,
  };
}
