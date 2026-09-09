'use client';

import { useMetricsData } from '@/hooks/useMetricsData';
import { GlobalFilterBar } from '@/components/layout/GlobalFilterBar';
import { DataTable } from '@/components/ui/DataTable';
import { Cpu } from 'lucide-react';

export default function ModelsPage() {
  const { filters, setFilters, data, loading } = useMetricsData();

  const summary = data?.tokenCostSummary;
  const tools = summary?.byAiTool || [];

  const tableData = tools.map((t: any) => ({
    name: t.tool,
    type: t.tool.toLowerCase().includes('chat') ? 'Interactive Chat' : 'Code Assistant',
    tokens: t.tokens.toLocaleString(),
    cost: `$${t.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`,
  }));

  return (
    <div className="flex-1 flex flex-col">
      <GlobalFilterBar filters={filters} onFilterChange={setFilters} filterOptions={data?.filterOptions} />

      <main className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        <div>
          <h1 className="text-xl font-bold text-ey-light flex items-center gap-2">
            <Cpu className="w-5 h-5 text-ey-yellow" />
            AI Tool & Model Breakdown
          </h1>
          <p className="text-xs text-ey-muted mt-1">
            Breakdown of AI Tool Flag token usage and spend directly from `ai_usage_data.csv`.
          </p>
        </div>

        <DataTable
          title="AI Tool Usage Breakdown"
          data={tableData}
          columns={[
            { header: 'AI Tool', accessorKey: 'name' },
            { header: 'Feature Type', accessorKey: 'type' },
            { header: 'Token Consumption', accessorKey: 'tokens' },
            { header: 'Total Cost ($)', accessorKey: 'cost' },
          ]}
        />
      </main>
    </div>
  );
}
