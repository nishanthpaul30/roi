import { CsvUsageRow, dateStringToMonthId } from '../data/csvLoader';
import { GlobalFilterState } from './types';

/**
 * Shared header-filter application, used by every component that loads raw
 * CSV rows directly instead of going through the metrics engine, so the
 * global date range / AI Tool / Region / Service Line / Country / User
 * filters apply consistently everywhere a drilldown reads ai_usage_data.csv.
 *
 * The data source is monthly-grained (no day-level Activity Date), so the
 * date-range filter compares each row's monthId against the filter's
 * start/end dates converted to the same monthId shape.
 */
export function filterRowsByGlobalFilters(rows: CsvUsageRow[], filters: GlobalFilterState): CsvUsageRow[] {
  const startMonthId = filters.startDate ? dateStringToMonthId(filters.startDate) : undefined;
  const endMonthId = filters.endDate ? dateStringToMonthId(filters.endDate) : undefined;
  return rows.filter((r) => {
    if (startMonthId !== undefined && r.monthId < startMonthId) return false;
    if (endMonthId !== undefined && r.monthId > endMonthId) return false;
    if (filters.aiTool && filters.aiTool !== 'all' && r.aiTool !== filters.aiTool) return false;
    if (filters.managementRegion && filters.managementRegion !== 'all' && r.superRegion !== filters.managementRegion) return false;
    if (filters.serviceLine && filters.serviceLine !== 'all' && r.orgServiceLine !== filters.serviceLine) return false;
    if (filters.userMail && filters.userMail !== 'all' && r.userMail !== filters.userMail) return false;
    if (filters.country && filters.country !== 'all' && r.country !== filters.country) return false;
    return true;
  });
}
