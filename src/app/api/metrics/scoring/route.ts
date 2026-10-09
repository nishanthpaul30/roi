import { NextResponse } from 'next/server';
import { loadCsvData } from '@/lib/data/csvLoader';
import { filterRowsByGlobalFilters } from '@/lib/metrics/filterRows';
import { joinHoursSavedToEngagements } from '@/lib/metrics/hoursSaved';
import { calculateEngagementScores } from '@/lib/metrics/scoring';
import type { ComparisonPeriod, GlobalFilterState } from '@/lib/metrics/types';
import { resolveDateRange } from '@/lib/metrics/resolveDateRange';

export const dynamic = 'force-dynamic';

// Same caching rationale (and the same caveat about `public` and
// authentication) as ../overview/route.ts -- keep the three in step.
const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=30, s-maxage=300, stale-while-revalidate=600',
};

/**
 * Per-engagement scores across the six scoring dimensions, scoped by the
 * global filter bar. Kept off the shared /api/metrics/overview payload since
 * it carries one entry per engagement and only the Engagement Scoring page
 * needs it.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const { startDate, endDate } = resolveDateRange(searchParams);

  const filters: GlobalFilterState = {
    startDate,
    endDate,
    comparisonPeriod: (searchParams.get('comparisonPeriod') as ComparisonPeriod | null) || 'moM',
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
    const allRows = loadCsvData();
    const rows = filterRowsByGlobalFilters(allRows, filters);
    // allRows (not the date-filtered rows) is the master Engagement Code list,
    // same as the Hours Saved panel, so a code's validity doesn't change with the date filter.
    const hoursSaved = joinHoursSavedToEngagements(rows, allRows);
    const scores = calculateEngagementScores(rows, hoursSaved);
    return NextResponse.json({ scores, engagementCount: scores.length }, { headers: CACHE_HEADERS });
  } catch (error) {
    console.error('Error calculating engagement scores:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
