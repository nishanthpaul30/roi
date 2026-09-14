import { loadCsvData, dateStringToMonthId, getDistinctValues, CsvUsageRow } from '../data/csvLoader';
import { GlobalFilterState } from './types';

// Extra dimensions the Data Playground exposes as standalone filters, beyond
// what the shared GlobalFilterBar already covers (aiTool, superRegion,
// serviceLine, country, date range). Field names match CsvUsageRow directly.
export const EXTRA_FILTER_DIMENSIONS: { key: ExtraFilterKey; label: string }[] = [
  { key: 'ctNonCt', label: 'CT / Non-CT' },
  { key: 'subServiceLine1', label: 'Sub-Service Line 1' },
  { key: 'subServiceLine2', label: 'Sub-Service Line 2' },
  { key: 'projectCode', label: 'Engagement Code' },
  { key: 'engagementSuperRegion', label: 'Engagement Super Region' },
  { key: 'engagementServiceLine', label: 'Engagement Service Line' },
  { key: 'engagementSubServiceLine', label: 'Engagement Sub Service Line' },
  { key: 'engagementCompetency', label: 'Engagement Competency' },
  { key: 'projectType', label: 'Project Type' },
  { key: 'billableFlag', label: 'Billable / Non-Billable' },
  { key: 'calculationMethod', label: 'Calculation Method' },
  { key: 'gdsLocation', label: 'GDS Location' },
  { key: 'costCenter', label: 'Cost Center' },
];

export type ExtraFilterKey =
  | 'ctNonCt'
  | 'subServiceLine1'
  | 'subServiceLine2'
  | 'projectCode'
  | 'engagementSuperRegion'
  | 'engagementServiceLine'
  | 'engagementSubServiceLine'
  | 'engagementCompetency'
  | 'projectType'
  | 'billableFlag'
  | 'calculationMethod'
  | 'gdsLocation'
  | 'costCenter';

export type ExtraFilters = Partial<Record<ExtraFilterKey, string>>;

/** Distinct values for every extra-filter dimension, for populating dropdowns. */
export function getExtraFilterOptions(): Record<ExtraFilterKey, string[]> {
  const options = {} as Record<ExtraFilterKey, string[]>;
  for (const { key } of EXTRA_FILTER_DIMENSIONS) {
    options[key] = getDistinctValues(key as keyof CsvUsageRow);
  }
  return options;
}

function filterRows(
  rows: CsvUsageRow[],
  filters: GlobalFilterState,
  sDate: string,
  eDate: string,
  extraFilters?: ExtraFilters
): CsvUsageRow[] {
  const startMonthId = dateStringToMonthId(sDate);
  const endMonthId = dateStringToMonthId(eDate);
  return rows.filter((r) => {
    if (r.monthId < startMonthId || r.monthId > endMonthId) return false;
    if (filters.aiTool && filters.aiTool !== 'all' && r.aiTool !== filters.aiTool) return false;
    if (filters.managementRegion && filters.managementRegion !== 'all' && r.superRegion !== filters.managementRegion) return false;
    if (filters.serviceLine && filters.serviceLine !== 'all' && r.orgServiceLine !== filters.serviceLine) return false;
    if (filters.userMail && filters.userMail !== 'all' && r.userMail !== filters.userMail) return false;
    if (filters.country && filters.country !== 'all' && r.country !== filters.country) return false;
    if (extraFilters) {
      for (const { key } of EXTRA_FILTER_DIMENSIONS) {
        const wanted = extraFilters[key];
        if (wanted && wanted !== 'all' && String(r[key as keyof CsvUsageRow] ?? '') !== wanted) return false;
      }
    }
    return true;
  });
}

/** Raw rows matching every current filter (global + Data Playground extras) — shared by the pivot and the "Export Excel" download so both reflect the exact same slice. */
export function getFilteredPlaygroundRows(filters: GlobalFilterState, extraFilters?: ExtraFilters): CsvUsageRow[] {
  const allRows = loadCsvData();
  return filterRows(allRows, filters, filters.startDate, filters.endDate, extraFilters);
}

export type DimensionKey =
  | 'aiTool'
  | 'superRegion'
  | 'country'
  | 'orgServiceLine'
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
  | 'costCenter'
  | 'calculationMethod';

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
  { key: 'superRegion', label: 'Super Region' },
  { key: 'projectType', label: 'Project Type' },
  { key: 'billableFlag', label: 'Billable / Non-Billable' },
  { key: 'calculationMethod', label: 'Calculation Method' },
  { key: 'gdsLocation', label: 'GDS Location' },
  { key: 'costCenter', label: 'Cost Center' },
  { key: 'monthLabel', label: 'Month' },
];

export type MetricKey = 'cost' | 'tokenConsumption';

export const METRICS: { key: MetricKey; label: string }[] = [
  { key: 'cost', label: 'Cost (USD)' },
  { key: 'tokenConsumption', label: 'GenAI Tool Consumption' },
];

function extractDim(row: CsvUsageRow, dim: DimensionKey): string {
  if (dim === 'monthLabel') return row.monthYear.replace(/_/g, ' ');
  const val = row[dim as keyof CsvUsageRow];
  return val ? String(val) : 'Unknown';
}

function extractMetric(row: CsvUsageRow, metric: MetricKey): number {
  if (metric === 'cost') return row.cost;
  return row.tokenConsumption;
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
  metric: MetricKey,
  extraFilters?: ExtraFilters
): PivotResult {
  const rows = getFilteredPlaygroundRows(filters, extraFilters);

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
