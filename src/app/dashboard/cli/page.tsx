'use client';

import { useMetricsData } from '@/hooks/useMetricsData';
import { GlobalFilterBar } from '@/components/layout/GlobalFilterBar';
import { KpiCard } from '@/components/ui/KpiCard';
import { MetricChart } from '@/components/ui/MetricChart';
import { Terminal } from 'lucide-react';

export default function CliPage() {
  const { filters, setFilters, data, loading } = useMetricsData();

  return (
    <div className="flex-1 flex flex-col">
      <GlobalFilterBar filters={filters} onFilterChange={setFilters} filterOptions={data?.filterOptions} />

      <main className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        <div>
          <h1 className="text-xl font-bold text-ey-light flex items-center gap-2">
            <Terminal className="w-5 h-5 text-ey-yellow" />
            CLI & Terminal Token Analytics
          </h1>
          <p className="text-xs text-ey-muted mt-1">
            Token volume, billable usage, and cost intelligence for command-line AI tools from `ai_usage_data.csv`.
          </p>
        </div>

        {loading || !data ? (
          <div className="h-64 flex items-center justify-center text-ey-muted text-sm animate-pulse">Loading...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <KpiCard title="Total Token Consumption" delta={data.metrics.tokenConsumption.summary} unit="tokens" description="Token volume (Token Consumption field)" />
              <KpiCard title="Total Billable Tokens" delta={data.metrics.dailyBillableTokens.summary} unit="tokens" description="Billable token total" />
              <KpiCard title="Total Spend ($)" delta={data.metrics.cost.summary} formatType="currency" description="Monetary cost in USD" />
            </div>

            <MetricChart
              title="Daily Token Consumption"
              subtitle="Token consumption per day"
              data={data.metrics.tokenConsumption.series}
              chartType="area"
              series={[{ key: 'value', name: 'Tokens', color: '#FFE600' }]}
            />
          </>
        )}
      </main>
    </div>
  );
}
