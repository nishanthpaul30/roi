import { NextResponse } from 'next/server';
import { getFilteredPlaygroundRows, EXTRA_FILTER_DIMENSIONS, ExtraFilterKey, ExtraFilters } from '@/lib/metrics/pivot';
import { GlobalFilterState } from '@/lib/metrics/types';

export const dynamic = 'force-dynamic';

const DEFAULT_START = '2026-03-01';
const DEFAULT_END = '2026-08-31';

/**
 * Raw rows matching every filter currently applied on the Data Playground
 * (global filter bar + the page's own extra dimension filters) — the source
 * for its "Export Excel" download, kept in sync with the pivot table above it
 * since both call getFilteredPlaygroundRows with the same params.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

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
    const rows = getFilteredPlaygroundRows(filters, extraFilters);
    const data = rows.map((r) => ({
      Month: r.monthYear.replace(/_/g, ' '),
      'User Email': r.userMail,
      'User Name': r.displayName,
      Product: r.aiTool,
      'Calculation Method': r.calculationMethod,
      'GenAI Tool Consumption': r.tokenConsumption,
      Credits: r.creditsLimit,
      'Cost USD': r.costUsd,
      'Cost (in $)': r.cost,
      'CT/Non-CT': r.ctNonCt,
      Country: r.country,
      'Super Region': r.superRegion,
      'Service Line': r.orgServiceLine,
      'Sub-Service Line 1': r.subServiceLine1,
      'Sub-Service Line 2': r.subServiceLine2,
      'Engagement Code': r.projectCode,
      'Billable / Non-Billable': r.billableFlag,
      'Project Type': r.projectType,
      'Engagement Super Region': r.engagementSuperRegion,
      'Engagement Service Line': r.engagementServiceLine,
      'Engagement Sub-Service Line': r.engagementSubServiceLine,
      'Engagement Competency': r.engagementCompetency,
      'GDS Location': r.gdsLocation,
      'Cost Center': r.costCenter,
    }));
    return NextResponse.json({ rows: data, rowCount: data.length });
  } catch (error: any) {
    console.error('Error building playground export:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
