'use client';

import { useMetricsData } from '@/hooks/useMetricsData';
import { GlobalFilterBar } from '@/components/layout/GlobalFilterBar';
import { KpiCard } from '@/components/ui/KpiCard';
import { MetricChart } from '@/components/ui/MetricChart';
import { Sparkles } from 'lucide-react';

export default function CodeGenPage() {
  const { filters, setFilters, data, loading } = useMetricsData();

  return (
    <div className="flex-1 flex flex-col">
      <GlobalFilterBar filters={filters} onFilterChange={setFilters} filterOptions={data?.filterOptions} />
      <main className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        <div>
          <h1 className="text-xl font-bold text-ey-light flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-ey-yellow" />
            AI Token Volume &amp; Cost Intelligence
          </h1>
          <p className="text-xs text-ey-muted mt-1">
            Total and billable token volumes alongside API cost — from ai_usage_data.csv billing fields.
          </p>
        </div>

        {loading || !data ? (
          <div className="h-64 flex items-center justify-center text-ey-muted text-sm animate-pulse">Loading...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard title="Total Token Consumption" delta={data.metrics.tokenConsumption.summary} unit="tokens" description="Total tokens consumed (Token Consumption field)" />
              <KpiCard title="Total Billable Tokens" delta={data.metrics.dailyBillableTokens.summary} unit="tokens" description="Billable portion (Daily Billable Tokens field)" />
              <KpiCard title="Avg Daily API Cost" delta={data.metrics.avgDailyCost.summary} formatType="currency" description="Average daily spend from Cost in USD" />
              <KpiCard title="Cost per 1K Tokens" delta={data.metrics.costPer1kTokens.summary} formatType="currency" description="Billing efficiency rate" />
            </div>

            <MetricChart
              title="Daily Token Volume"
              subtitle="Token Consumption per day from ai_usage_data.csv"
              data={data.metrics.tokenConsumption.series}
              chartType="area"
              series={[{ key: 'value', name: 'Token Consumption', color: '#10b981' }]}
            />
          </>
        )}
      </main>
    </div>
  );
}
