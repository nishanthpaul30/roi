'use client';

import { useMetricsData } from '@/hooks/useMetricsData';
import { GlobalFilterBar } from '@/components/layout/GlobalFilterBar';
import { DataTable } from '@/components/ui/DataTable';
import { Monitor } from 'lucide-react';

export default function IdePage() {
  const { filters, setFilters, data } = useMetricsData();

  const summary = data?.tokenCostSummary;
  const regions = summary?.byManagementRegion || [];

  const tableData = regions.map((r: any) => ({
    region: r.region,
    tokens: r.tokens.toLocaleString(),
    cost: `$${r.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`,
  }));

  return (
    <div className="flex-1 flex flex-col">
      <GlobalFilterBar filters={filters} onFilterChange={setFilters} filterOptions={data?.filterOptions} />

      <main className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        <div>
          <h1 className="text-xl font-bold text-ey-light flex items-center gap-2">
            <Monitor className="w-5 h-5 text-ey-yellow" />
            Regional Usage Analytics
          </h1>
          <p className="text-xs text-ey-muted mt-1">
            Token consumption and spend metrics broken down by Management Region from `ai_usage_data.csv`.
          </p>
        </div>

        <DataTable
          title="Management Region Breakdown"
          data={tableData}
          columns={[
            { header: 'Management Region', accessorKey: 'region' },
            { header: 'Token Consumption', accessorKey: 'tokens' },
            { header: 'Total Cost ($)', accessorKey: 'cost' },
          ]}
        />
      </main>
    </div>
  );
}
