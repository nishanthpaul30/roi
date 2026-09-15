import { NextResponse } from 'next/server';
import { loadCsvData } from '@/lib/data/csvLoader';
import { filterRowsByGlobalFilters } from '@/lib/metrics/filterRows';
import { GlobalFilterState } from '@/lib/metrics/types';

export const dynamic = 'force-dynamic';

// CSV data spans March–August 2026; use that as the default range
const DEFAULT_START = '2026-03-01';
const DEFAULT_END = '2026-08-31';

// The dataset is embedded at build time, so a given filter combination returns
// the same rows until the next deploy. Letting the CDN hold the response keeps
// the expensive part — parsing the CSV and serialising several MB of JSON on a
// cold Worker isolate — down to once per location, rather than once per visit.
// Query params are part of the cache key.
//
// The windows are deliberately short: Cloudflare does not purge its cache when
// a Worker is deployed, so these bound how long a redeploy carrying new CSV
// data can still be served the old numbers — 5 min fresh, then at most 10 more
// while the refresh happens in the background.
//
// `public` is only safe because these endpoints are currently unauthenticated
// and every visitor gets identical data. If per-user scoping or auth is ever
// added, this MUST become `private` (or drop s-maxage), or a shared cache could
// hand one user's response to another.
const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=30, s-maxage=300, stale-while-revalidate=600',
};

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
    return NextResponse.json({ rows, rowCount: rows.length }, { headers: CACHE_HEADERS });
  } catch (error: any) {
    console.error('Error loading raw rows:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
