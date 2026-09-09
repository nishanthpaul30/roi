'use client';

import { useMetricsData } from '@/hooks/useMetricsData';
import { GlobalFilterBar } from '@/components/layout/GlobalFilterBar';
import { KpiCard } from '@/components/ui/KpiCard';
import { MetricChart } from '@/components/ui/MetricChart';
import { TrendingUp } from 'lucide-react';

export default function EngineeringImpactPage() {
  const { filters, setFilters, data, loading } = useMetricsData();

  return (
    <div className="flex-1 flex flex-col">
      <GlobalFilterBar filters={filters} onFilterChange={setFilters} filterOptions={data?.filterOptions} />

      <main className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        <div>
          <h1 className="text-xl font-bold text-ey-light flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-ey-yellow" />
            Engineering Cost & Token Impact
          </h1>
          <p className="text-xs text-ey-muted mt-1">
            Quantifiable token consumption, spend efficiency, and utilization rates derived from `ai_usage_data.csv`.
          </p>
        </div>

        {loading || !data ? (
          <div className="h-64 flex items-center justify-center text-ey-muted text-sm animate-pulse">Loading...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard title="Total Token Consumption" delta={data.metrics.tokenConsumption.summary} unit="tokens" />
              <KpiCard title="Billable Utilization Rate" delta={data.metrics.billableUtilizationRate.summary} formatType="percentage" />
              <KpiCard title="Avg Daily Cost" delta={data.metrics.avgDailyCost.summary} formatType="currency" />
              <KpiCard title="Cost per 1K Tokens" delta={data.metrics.costPer1kTokens.summary} formatType="currency" />
            </div>

            <MetricChart
              title="Daily API Spend"
              subtitle="Cost in USD per day"
              data={data.metrics.cost.series}
              chartType="bar"
              series={[{ key: 'value', name: 'Cost ($)', color: '#FFE600' }]}
            />
          </>
        )}
      </main>
    </div>
  );
}
