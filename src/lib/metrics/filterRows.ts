import { CsvUsageRow } from '../data/csvLoader';
import { GlobalFilterState } from './types';

/**
 * Shared header-filter application, used by every component that loads raw
 * CSV rows directly instead of going through the metrics engine, so the
 * global date range / AI Tool / Region / Service Line / Country / User
 * filters apply consistently everywhere a drilldown reads ai_usage_data.csv.
 */
export function filterRowsByGlobalFilters(rows: CsvUsageRow[], filters: GlobalFilterState): CsvUsageRow[] {
  return rows.filter((r) => {
    if (filters.startDate && r.activityDate < filters.startDate) return false;
    if (filters.endDate && r.activityDate > filters.endDate) return false;
    if (filters.aiTool && filters.aiTool !== 'all' && r.aiTool !== filters.aiTool) return false;
    if (filters.managementRegion && filters.managementRegion !== 'all' && r.managementRegion !== filters.managementRegion) return false;
    if (filters.serviceLine && filters.serviceLine !== 'all' && r.orgServiceLine !== filters.serviceLine) return false;
    if (filters.userMail && filters.userMail !== 'all' && r.userMail !== filters.userMail) return false;
    if (filters.country && filters.country !== 'all' && r.country !== filters.country) return false;
    return true;
  });
}
