'use client';

import { useMetricsData } from '@/hooks/useMetricsData';
import { GlobalFilterBar } from '@/components/layout/GlobalFilterBar';
import { KpiCard } from '@/components/ui/KpiCard';
import { ExecutiveInferencesPanel } from '@/components/ui/ExecutiveInferencesPanel';
import { Sparkles, ShieldCheck } from 'lucide-react';

export default function ExecutiveOverviewPage() {
  const { filters, setFilters, data, loading } = useMetricsData();

  const handleExportCsv = () => {
    window.location.href = `/api/metrics/export?type=daily&startDate=${filters.startDate}&endDate=${filters.endDate}`;
  };

  return (
    <div className="flex-1 flex flex-col">
      <GlobalFilterBar
        filters={filters}
        onFilterChange={setFilters}
        onExportCsv={handleExportCsv}
        filterOptions={data?.filterOptions}
      />

      <main className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Page Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-ey-border/60 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-ey-yellow/15 border border-ey-yellow/30 rounded-lg text-ey-yellow shrink-0 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-ey-light tracking-tight">
                Executive Overview
              </h1>
              <p className="text-xs text-ey-muted mt-0.5">
                Token consumption, billable tokens, and API cost — sourced from <span className="font-mono text-ey-yellow font-medium">ai_usage_data.csv</span>.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-xs bg-ey-card border border-ey-border rounded-lg px-3 py-1.5 text-ey-light shrink-0">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-mono text-[11px] text-ey-muted">
              Fields: <strong className="text-ey-light font-medium">token_consumption</strong> · <strong className="text-ey-light font-medium">daily_billable_tokens</strong> · <strong className="text-ey-light font-medium">cost</strong>
            </span>
          </div>
        </div>

        {loading || !data ? (
          <div className="h-64 flex items-center justify-center text-ey-muted text-sm animate-pulse">
            Loading data from ai_usage_data.csv...
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard title="Total Token Consumption" delta={data.metrics.tokenConsumption.summary} unit="tokens" description="Total tokens consumed (Token Consumption column)" comparisonLabel="vs prev period" />
              <KpiCard title="Total API Spend" delta={data.metrics.cost.summary} formatType="currency" description="Actual billed cost (Cost in USD column)" comparisonLabel="vs prev period" />
              <KpiCard title="Avg Daily API Cost" delta={data.metrics.avgDailyCost.summary} formatType="currency" description="Average cost per active day (Cost ÷ active days)" comparisonLabel="vs prev period" />
              <KpiCard title="Cost per 1K Tokens" delta={data.metrics.costPer1kTokens.summary} formatType="currency" description="Billing efficiency rate per 1k tokens" comparisonLabel="vs prev period" />
            </div>

            {/* Executive Strategic Leadership Inferences Panel */}
            <ExecutiveInferencesPanel />
          </>
        )}
      </main>
    </div>
  );
}
