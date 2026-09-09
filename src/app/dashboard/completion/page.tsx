'use client';

import { useMetricsData } from '@/hooks/useMetricsData';
import { GlobalFilterBar } from '@/components/layout/GlobalFilterBar';
import { KpiCard } from '@/components/ui/KpiCard';
import { MetricChart } from '@/components/ui/MetricChart';
import { Code2 } from 'lucide-react';

export default function CompletionPage() {
  const { filters, setFilters, data, loading } = useMetricsData();

  return (
    <div className="flex-1 flex flex-col">
      <GlobalFilterBar filters={filters} onFilterChange={setFilters} filterOptions={data?.filterOptions} />
      <main className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        <div>
          <h1 className="text-xl font-bold text-ey-light flex items-center gap-2">
            <Code2 className="w-5 h-5 text-ey-yellow" />
            Token Efficiency &amp; Cost Analytics
          </h1>
          <p className="text-xs text-ey-muted mt-1">
            Token consumption efficiency, billing cost, and cost-per-token rates from ai_usage_data.csv.
          </p>
        </div>

        {loading || !data ? (
          <div className="h-64 flex items-center justify-center text-ey-muted text-sm animate-pulse">Loading...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <KpiCard title="Total Token Consumption" delta={data.metrics.tokenConsumption.summary} unit="tokens" description="All tokens consumed (prompt + completion)" />
              <KpiCard title="Billable Utilization Rate" delta={data.metrics.billableUtilizationRate.summary} formatType="percentage" description="Ratio of billable to total tokens" />
              <KpiCard title="Cost per 1K Tokens" delta={data.metrics.costPer1kTokens.summary} formatType="currency" description="Billing efficiency rate" />
            </div>

            <MetricChart
              title="Daily Cost Trend"
              subtitle="Cost in USD per day from ai_usage_data.csv"
              data={data.metrics.cost.series}
              chartType="bar"
              series={[{ key: 'value', name: 'Daily Cost ($)', color: '#FFE600' }]}
            />
          </>
        )}
      </main>
    </div>
  );
}
