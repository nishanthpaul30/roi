'use client';

import { useMetricsData } from '@/hooks/useMetricsData';
import { GlobalFilterBar } from '@/components/layout/GlobalFilterBar';
import { KpiCard } from '@/components/ui/KpiCard';
import { MetricChart } from '@/components/ui/MetricChart';
import { DataTable } from '@/components/ui/DataTable';
import { ExecutiveInferencesPanel } from '@/components/ui/ExecutiveInferencesPanel';
import { Sparkles, Coins, Zap, ShieldCheck } from 'lucide-react';

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

            {/* Charts + Intelligence Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <MetricChart
                  title="Daily API Cost Trend"
                  subtitle="Cost in USD per day from ai_usage_data.csv"
                  data={data.metrics.cost.series}
                  chartType="area"
                  series={[{ key: 'value', name: 'Daily Cost ($)', color: '#FFE600' }]}
                />
              </div>

              <div className="bg-ey-card border border-ey-border rounded-xl p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-ey-light flex items-center gap-1.5">
                      <Coins className="w-4 h-4 text-emerald-400" />
                      Token &amp; Cost Summary
                    </h3>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-medium">
                      CSV-direct
                    </span>
                  </div>

                  <div className="space-y-2.5 text-xs text-ey-light">
                    {[
                      { label: 'Total Token Consumption', value: `${(data.tokenCostSummary.totalTokenConsumption / 1_000_000).toFixed(2)}M`, color: 'text-ey-light' },
                      { label: 'Total Billable Tokens', value: `${(data.tokenCostSummary.totalBillableTokens / 1_000_000).toFixed(2)}M`, color: 'text-ey-light' },
                      { label: 'Billable Utilization', value: `${data.tokenCostSummary.billableUtilizationRate.toFixed(1)}%`, color: 'text-emerald-400' },
                      { label: 'Total API Cost', value: `$${data.tokenCostSummary.totalCost.toLocaleString()}`, color: 'text-ey-light' },
                      { label: 'Avg Daily Cost', value: `$${data.tokenCostSummary.avgDailyCost.toFixed(2)}`, color: 'text-ey-light' },
                      { label: 'Cost per 1K Tokens', value: `$${data.tokenCostSummary.costPer1kTokens.toFixed(4)}`, color: 'text-ey-yellow' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="flex justify-between py-1.5 border-b border-ey-border last:border-0">
                        <span className="text-ey-muted">{label}:</span>
                        <span className={`font-bold ${color}`}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-ey-border text-[11px] text-ey-muted italic flex items-center gap-1">
                  <Zap className="w-3 h-3 shrink-0 text-ey-yellow" />
                  <span>Note: In <code className="font-mono text-ey-yellow">ai_usage_data.csv</code>, Token Consumption &amp; Daily Billable Tokens are 100% aligned (100.0% utilization rate).</span>
                </div>
              </div>
            </div>

          </>
        )}
      </main>
    </div>
  );
}
