'use client';

import { useMetricsData } from '@/hooks/useMetricsData';
import { GlobalFilterBar } from '@/components/layout/GlobalFilterBar';
import { KpiCard } from '@/components/ui/KpiCard';
import { MetricChart } from '@/components/ui/MetricChart';
import { MessageSquare } from 'lucide-react';

export default function ChatPage() {
  const { filters, setFilters, data, loading } = useMetricsData();

  return (
    <div className="flex-1 flex flex-col">
      <GlobalFilterBar filters={filters} onFilterChange={setFilters} filterOptions={data?.filterOptions} />
      <main className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        <div>
          <h1 className="text-xl font-bold text-ey-light flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-ey-yellow" />
            AI Chat Token &amp; Cost Insights
          </h1>
          <p className="text-xs text-ey-muted mt-1">
            Token consumption, billable tokens, and actual cost from ai_usage_data.csv.
          </p>
        </div>

        {loading || !data ? (
          <div className="h-64 flex items-center justify-center text-ey-muted text-sm animate-pulse">Loading...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <KpiCard title="Total Token Consumption" delta={data.metrics.tokenConsumption.summary} unit="tokens" description="Tokens consumed across all AI interactions" />
              <KpiCard title="Total Billable Tokens" delta={data.metrics.dailyBillableTokens.summary} unit="tokens" description="Billable tokens from the Daily Billable Tokens field" />
              <KpiCard title="Total API Cost" delta={data.metrics.cost.summary} formatType="currency" description="Actual cost from the Cost in USD field" />
            </div>

            <MetricChart
              title="Daily Cost Trend"
              subtitle="Cost in USD per day from ai_usage_data.csv"
              data={data.metrics.cost.series}
              chartType="line"
              series={[{ key: 'value', name: 'Daily Cost ($)', color: '#FFE600' }]}
            />
          </>
        )}
      </main>
    </div>
  );
}
