'use client';

import { useMetricsData } from '@/hooks/useMetricsData';
import { GlobalFilterBar } from '@/components/layout/GlobalFilterBar';
import { DataTable } from '@/components/ui/DataTable';
import { Building2, Globe2, Layers } from 'lucide-react';

export default function OrgAndRegionalPage() {
  const { filters, setFilters, data, loading } = useMetricsData();

  const summary = data?.tokenCostSummary;
  const serviceLines = summary?.byServiceLine || [];
  const regions = summary?.byManagementRegion || [];
  const countries = summary?.byCountry || [];

  const serviceLineTableData = serviceLines.map((sl: any) => ({
    serviceLine: sl.serviceLine,
    tokens: sl.tokens.toLocaleString(),
    cost: `$${sl.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`,
    share: `${((sl.tokens / (summary?.totalTokenConsumption || 1)) * 100).toFixed(1)}%`,
  }));

  const regionTableData = regions.map((r: any) => ({
    region: r.region,
    tokens: r.tokens.toLocaleString(),
    cost: `$${r.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`,
    share: `${((r.tokens / (summary?.totalTokenConsumption || 1)) * 100).toFixed(1)}%`,
  }));

  const countryTableData = countries.map((c: any) => ({
    country: c.country,
    tokens: c.tokens.toLocaleString(),
    cost: `$${c.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`,
    share: `${((c.tokens / (summary?.totalTokenConsumption || 1)) * 100).toFixed(1)}%`,
  }));

  return (
    <div className="flex-1 flex flex-col">
      <GlobalFilterBar filters={filters} onFilterChange={setFilters} filterOptions={data?.filterOptions} />

      <main className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Header Title Block */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-ey-card/50 border border-ey-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-ey-yellow/15 border border-ey-yellow/30 rounded-xl text-ey-yellow shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-ey-light tracking-wide">
                Organizational &amp; Regional Analytics
              </h1>
              <p className="text-xs text-ey-muted mt-0.5">
                Unified view of token consumption and spend aggregated by Service Line, Region, and Country from <span className="font-mono text-ey-yellow">ai_usage_data.csv</span>.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-xs bg-ey-black/60 border border-ey-border rounded-lg px-3 py-2 text-ey-light shrink-0 self-start sm:self-center">
            <Layers className="w-4 h-4 text-ey-yellow shrink-0" />
            <span className="font-mono text-[11px] text-ey-muted">Metrics: <strong>Service Line</strong> · <strong>Region</strong> · <strong>Country</strong></span>
          </div>
        </div>

        {loading || !data ? (
          <div className="h-64 flex items-center justify-center text-ey-muted text-sm animate-pulse">Loading...</div>
        ) : (
          <>
            {/* Service Line Breakdown */}
            <DataTable
              title="Organizational Service Line Breakdown"
              data={serviceLineTableData}
              columns={[
                { header: 'Service Line', accessorKey: 'serviceLine' },
                { header: 'Token Consumption', accessorKey: 'tokens' },
                { header: 'Total Cost ($)', accessorKey: 'cost' },
                { header: 'Token Share', accessorKey: 'share' },
              ]}
            />

            {/* Regional & Country Breakdowns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <DataTable
                title="Management Region Breakdown (EMEA, APAC, Americas)"
                data={regionTableData}
                columns={[
                  { header: 'Management Region', accessorKey: 'region' },
                  { header: 'Token Consumption', accessorKey: 'tokens' },
                  { header: 'Total Cost ($)', accessorKey: 'cost' },
                  { header: 'Regional Share', accessorKey: 'share' },
                ]}
              />

              <DataTable
                title="Country-Level Breakdown"
                data={countryTableData}
                columns={[
                  { header: 'Country', accessorKey: 'country' },
                  { header: 'Token Consumption', accessorKey: 'tokens' },
                  { header: 'Total Cost ($)', accessorKey: 'cost' },
                  { header: 'Country Share', accessorKey: 'share' },
                ]}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
