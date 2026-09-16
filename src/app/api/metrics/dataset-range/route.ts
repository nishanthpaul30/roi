import { NextResponse } from 'next/server';
import { getDatasetDateRange } from '@/lib/data/csvLoader';

export const dynamic = 'force-dynamic';

// Same short windows as the other metrics routes — see ../raw-rows/route.ts.
const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=30, s-maxage=300, stale-while-revalidate=600',
};

/**
 * The period the loaded dataset covers, and the months within it.
 *
 * Deliberately tiny and fetched before anything else: the client needs to know
 * the date range *before* it can ask for data, and it can no longer assume one
 * (the range comes from the CSV, not a hardcoded constant). Resolving it up
 * front means every other request goes out once with the correct dates, rather
 * than firing with empty dates and being re-issued — which left an aborted
 * multi-MB /raw-rows request on every page load.
 */
export async function GET() {
  try {
    return NextResponse.json(getDatasetDateRange(), { headers: CACHE_HEADERS });
  } catch (error: any) {
    console.error('Error resolving dataset range:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
