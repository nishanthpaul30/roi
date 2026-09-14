import { NextResponse } from 'next/server';
import {
  calculatePivot,
  DimensionKey,
  MetricKey,
  DIMENSIONS,
  METRICS,
  EXTRA_FILTER_DIMENSIONS,
  ExtraFilterKey,
  ExtraFilters,
  getExtraFilterOptions,
} from '@/lib/metrics/pivot';
import { GlobalFilterState } from '@/lib/metrics/types';

export const dynamic = 'force-dynamic';

// CSV data spans March–August 2026; use that as the default range
const DEFAULT_START = '2026-03-01';
const DEFAULT_END = '2026-08-31';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const rowDim = (searchParams.get('rowDim') as DimensionKey) || 'aiTool';
  const colDim = (searchParams.get('colDim') as DimensionKey | 'none') || 'none';
  const metric = (searchParams.get('metric') as MetricKey) || 'cost';

  const filters: GlobalFilterState = {
    startDate: searchParams.get('startDate') || DEFAULT_START,
    endDate: searchParams.get('endDate') || DEFAULT_END,
    comparisonPeriod: 'moM',
    aiTool: searchParams.get('aiTool') || 'all',
    managementRegion: searchParams.get('managementRegion') || 'all',
    serviceLine: searchParams.get('serviceLine') || 'all',
    userMail: searchParams.get('userMail') || 'all',
    country: searchParams.get('country') || 'all',
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

  const extraFilters: ExtraFilters = {};
  for (const { key } of EXTRA_FILTER_DIMENSIONS) {
    const value = searchParams.get(key as ExtraFilterKey);
    if (value) extraFilters[key] = value;
  }

  try {
    const result = calculatePivot(filters, rowDim, colDim, metric, extraFilters);
    return NextResponse.json({
      result,
      dimensions: DIMENSIONS,
      metrics: METRICS,
      extraFilterDimensions: EXTRA_FILTER_DIMENSIONS,
      extraFilterOptions: getExtraFilterOptions(),
    });
  } catch (error: any) {
    console.error('Error computing pivot:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
