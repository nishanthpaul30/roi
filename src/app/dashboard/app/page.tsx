'use client';

import { useMetricsData } from '@/hooks/useMetricsData';
import { GlobalFilterBar } from '@/components/layout/GlobalFilterBar';
import { KpiCard } from '@/components/ui/KpiCard';
import { MetricChart } from '@/components/ui/MetricChart';
import { Smartphone } from 'lucide-react';

export default function CopilotAppPage() {
  const { filters, setFilters, data, loading } = useMetricsData();

  return (
    <div className="flex-1 flex flex-col">
      <GlobalFilterBar filters={filters} onFilterChange={setFilters} filterOptions={data?.filterOptions} />

      <main className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        <div>
          <h1 className="text-xl font-bold text-ey-light flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-ey-yellow" />
            Copilot Application & Web Token Usage
          </h1>
          <p className="text-xs text-ey-muted mt-1">
            Metrics for Copilot desktop & web application usage from `ai_usage_data.csv`.
          </p>
        </div>

        {loading || !data ? (
          <div className="h-64 flex items-center justify-center text-ey-muted text-sm animate-pulse">Loading...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <KpiCard title="Total Token Consumption" delta={data.metrics.tokenConsumption.summary} unit="tokens" description="Tokens consumed across apps" />
              <KpiCard title="Billable Utilization Rate" delta={data.metrics.billableUtilizationRate.summary} formatType="percentage" description="Billable vs total token ratio" />
              <KpiCard title="Avg Daily Cost" delta={data.metrics.avgDailyCost.summary} formatType="currency" description="Average daily spend ($)" />
            </div>

            <MetricChart
              title="Daily Billable Tokens"
              subtitle="Daily Billable Tokens field from ai_usage_data.csv"
              data={data.metrics.dailyBillableTokens.series}
              chartType="line"
              series={[{ key: 'value', name: 'Billable Tokens', color: '#10b981' }]}
            />
          </>
        )}
      </main>
    </div>
  );
}
