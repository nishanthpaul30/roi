import 'server-only';

import { getDatasetDateRange } from '@/lib/data/csvLoader';

/**
 * Resolves the start/end date for a request, falling back to the period the
 * loaded dataset actually covers rather than a hardcoded window.
 *
 * Every API route used to define its own DEFAULT_START/DEFAULT_END pinned to
 * the demo file's March-August 2026 span. A CSV covering any other period then
 * parsed fine and was filtered away to nothing, which looked like the API
 * failing. Routing all six through here keeps them in step with the data.
 */
export function resolveDateRange(searchParams: URLSearchParams): { startDate: string; endDate: string } {
  const dataset = getDatasetDateRange();
  return {
    startDate: searchParams.get('startDate') || dataset.startDate,
    endDate: searchParams.get('endDate') || dataset.endDate,
  };
}
