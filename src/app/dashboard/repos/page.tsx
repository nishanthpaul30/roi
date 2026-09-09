'use client';

import { useMetricsData } from '@/hooks/useMetricsData';
import { GlobalFilterBar } from '@/components/layout/GlobalFilterBar';
import { KpiCard } from '@/components/ui/KpiCard';
import { DataTable } from '@/components/ui/DataTable';
import { FolderGit2 } from 'lucide-react';

export default function ReposPage() {
  const { filters, setFilters, data, loading } = useMetricsData();

  const summary = data?.tokenCostSummary;
  const tools = summary?.byAiTool || [];

  const tableData = tools.map((t: any) => ({
    tool: t.tool,
    tokens: t.tokens.toLocaleString(),
    cost: `$${t.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`,
  }));

  return (
    <div className="flex-1 flex flex-col">
      <GlobalFilterBar filters={filters} onFilterChange={setFilters} filterOptions={data?.filterOptions} />

      <main className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        <div>
          <h1 className="text-xl font-bold text-ey-light flex items-center gap-2">
            <FolderGit2 className="w-5 h-5 text-ey-yellow" />
            AI Tool & Workspace Analytics
          </h1>
          <p className="text-xs text-ey-muted mt-1">
            Metrics aggregated by AI Tool Flag from `ai_usage_data.csv`.
          </p>
        </div>

        {loading || !data ? (
          <div className="h-64 flex items-center justify-center text-ey-muted text-sm animate-pulse">Loading...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <KpiCard title="Total Token Consumption" delta={data.metrics.tokenConsumption.summary} unit="tokens" />
              <KpiCard title="Total Billable Tokens" delta={data.metrics.dailyBillableTokens.summary} unit="tokens" />
              <KpiCard title="Total Cost ($)" delta={data.metrics.cost.summary} formatType="currency" />
            </div>

            <DataTable
              title="AI Tool Breakdown"
              data={tableData}
              columns={[
                { header: 'AI Tool', accessorKey: 'tool' },
                { header: 'Token Consumption', accessorKey: 'tokens' },
                { header: 'Total Cost ($)', accessorKey: 'cost' },
              ]}
            />
          </>
        )}
      </main>
    </div>
  );
}
