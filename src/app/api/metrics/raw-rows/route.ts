import { NextResponse } from 'next/server';
import { loadCsvData } from '@/lib/data/csvLoader';
import { filterRowsByGlobalFilters } from '@/lib/metrics/filterRows';
import { GlobalFilterState } from '@/lib/metrics/types';

export const dynamic = 'force-dynamic';

// CSV data spans March–August 2026; use that as the default range
const DEFAULT_START = '2026-03-01';
const DEFAULT_END = '2026-08-31';

/**
 * Raw, row-level CSV records scoped by the global filter bar — for the
 * drilldown views that need individual rows (hierarchy navigation down to a
 * named user, per-record log tables) rather than the pre-aggregated figures
 * /api/metrics/overview already returns.
 *
 * These consumers are all Client Components; without this route they'd call
 * loadCsvData() in the browser, which falls back to the embedded CSV string
 * and drags the whole dataset into the client bundle to be parsed on the main
 * thread. Any narrower scoping (a selected hierarchy path, entity, or facet)
 * stays client-side, since it's driven by live UI state.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const filters: GlobalFilterState = {
    startDate: searchParams.get('startDate') || DEFAULT_START,
    endDate: searchParams.get('endDate') || DEFAULT_END,
    comparisonPeriod: (searchParams.get('comparisonPeriod') as any) || 'moM',
    aiTool: searchParams.get('aiTool') || 'all',
    managementRegion: searchParams.get('managementRegion') || 'all',
    serviceLine: searchParams.get('serviceLine') || 'all',
    userMail: searchParams.get('userMail') || 'all',
    country: searchParams.get('country') || 'all',
    // Legacy (unused in CSV path)
    organization: 'all',
    team: 'all',
    user: 'all',
    repository: 'all',
    feature: 'all',
    model: 'all',
    language: 'all',
    ide: 'all',
    agent: 'all',
  };

  try {
    const rows = filterRowsByGlobalFilters(loadCsvData(), filters);
    return NextResponse.json({ rows, rowCount: rows.length });
  } catch (error: any) {
    console.error('Error loading raw rows:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
