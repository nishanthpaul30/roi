'use client';

import { useMetricsData } from '@/hooks/useMetricsData';
import { GlobalFilterBar } from '@/components/layout/GlobalFilterBar';
import { DataTable } from '@/components/ui/DataTable';
import { Globe } from 'lucide-react';

export default function LanguagesPage() {
  const { filters, setFilters, data } = useMetricsData();

  const summary = data?.tokenCostSummary;
  const serviceLines = summary?.byServiceLine || [];

  const tableData = serviceLines.map((sl: any) => ({
    serviceLine: sl.serviceLine,
    tokens: sl.tokens.toLocaleString(),
    cost: `$${sl.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`,
  }));

  return (
    <div className="flex-1 flex flex-col">
      <GlobalFilterBar filters={filters} onFilterChange={setFilters} filterOptions={data?.filterOptions} />

      <main className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        <div>
          <h1 className="text-xl font-bold text-ey-light flex items-center gap-2">
            <Globe className="w-5 h-5 text-ey-yellow" />
            Service Line Token Distribution
          </h1>
          <p className="text-xs text-ey-muted mt-1">
            Distribution of token consumption and API spend across service lines from `ai_usage_data.csv`.
          </p>
        </div>

        <DataTable
          title="Service Line Usage Matrix"
          data={tableData}
          columns={[
            { header: 'Service Line', accessorKey: 'serviceLine' },
            { header: 'Token Consumption', accessorKey: 'tokens' },
            { header: 'Total Cost ($)', accessorKey: 'cost' },
          ]}
        />
      </main>
    </div>
  );
}
