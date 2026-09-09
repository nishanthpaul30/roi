import { NextResponse } from 'next/server';
import { getMetric } from '@/lib/metrics/engine';
import { calculateTokenCostSummary } from '@/lib/metrics/roi';
import { getDistinctValues } from '@/lib/data/csvLoader';
import { GlobalFilterState } from '@/lib/metrics/types';

export const dynamic = 'force-dynamic';

// CSV data spans March–August 2026; use that as the default range
const DEFAULT_START = '2026-03-01';
const DEFAULT_END = '2026-08-31';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const filters: GlobalFilterState = {
    startDate: searchParams.get('startDate') || DEFAULT_START,
    endDate: searchParams.get('endDate') || DEFAULT_END,
    comparisonPeriod: (searchParams.get('comparisonPeriod') as any) || 'moM',
    // CSV-native filter dimensions
    aiTool: searchParams.get('aiTool') || 'all',
    managementRegion: searchParams.get('managementRegion') || 'all',
    serviceLine: searchParams.get('serviceLine') || 'all',
    userMail: searchParams.get('userMail') || 'all',
    country: searchParams.get('country') || 'all',
    // Legacy (unused in CSV path)
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
    const [
      tokenConsumption,
      dailyBillableTokens,
      cost,
      costPer1kTokens,
      billableUtilizationRate,
      avgDailyCost,
      tokenCostSummary,
    ] = await Promise.all([
      getMetric('TOKEN_CONSUMPTION', filters),
      getMetric('DAILY_BILLABLE_TOKENS', filters),
      getMetric('COST', filters),
      getMetric('COST_PER_1K_TOKENS', filters),
      getMetric('BILLABLE_UTILIZATION_RATE', filters),
      getMetric('AVG_DAILY_COST', filters),
      calculateTokenCostSummary(filters),
    ]);

    // Expose dimension options for dynamic filter dropdowns
    const filterOptions = {
      aiTools: getDistinctValues('aiTool'),
      managementRegions: getDistinctValues('managementRegion'),
      serviceLines: getDistinctValues('orgServiceLine'),
      countries: getDistinctValues('country'),
      users: getDistinctValues('userMail'),
    };

    return NextResponse.json({
      filters,
      filterOptions,
      metrics: {
        tokenConsumption,
        dailyBillableTokens,
        cost,
        costPer1kTokens,
        billableUtilizationRate,
        avgDailyCost,
      },
      tokenCostSummary,
    });
  } catch (error: any) {
    console.error('Error fetching overview metrics:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
