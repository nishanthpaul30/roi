import { NextResponse } from 'next/server';
import { calculateTokenCostSummary } from '@/lib/metrics/roi';
import { GlobalFilterState } from '@/lib/metrics/types';
import { subDays, format } from 'date-fns';

export const dynamic = 'force-dynamic';

const DEFAULT_START = '2026-03-01';
const DEFAULT_END = '2026-08-31';

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
    organization: searchParams.get('organization') || 'all',
    team: searchParams.get('team') || 'all',
    user: searchParams.get('user') || 'all',
    repository: searchParams.get('repository') || 'all',
    feature: searchParams.get('feature') || 'all',
    model: searchParams.get('model') || 'all',
    language: searchParams.get('language') || 'all',
    ide: searchParams.get('ide') || 'all',
    agent: searchParams.get('agent') || 'all',
  };

  try {
    const summary = await calculateTokenCostSummary(filters);
    return NextResponse.json(summary);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
