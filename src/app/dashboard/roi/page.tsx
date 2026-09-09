'use client';

import { useMetricsData } from '@/hooks/useMetricsData';
import { GlobalFilterBar } from '@/components/layout/GlobalFilterBar';
import { KpiCard } from '@/components/ui/KpiCard';
import { MetricChart } from '@/components/ui/MetricChart';
import { DataTable } from '@/components/ui/DataTable';
import { Coins, Zap, ShieldCheck } from 'lucide-react';
import { TokenCostSummary } from '@/lib/metrics/types';

const TOOL_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT',
  copilot: 'GitHub Copilot',
  claude: 'Claude',
};

export default function RoiPage() {
  const { filters, setFilters, data, loading } = useMetricsData();

  const summary: TokenCostSummary | null = data?.tokenCostSummary ?? null;

  const makeDelta = (current: number, previous: number, isRateMetric = false) => ({
    current,
    previous,
    absoluteDelta: Number((current - previous).toFixed(4)),
    percentageDelta: previous > 0 ? Number((((current - previous) / previous) * 100).toFixed(2)) : 0,
    trend: (current >= previous ? 'up' : 'down') as 'up' | 'down',
    isRateMetric,
  });

  return (
    <div className="flex-1 flex flex-col">
      <GlobalFilterBar filters={filters} onFilterChange={setFilters} filterOptions={data?.filterOptions} />

      <main className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Header Title Block */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-ey-card/50 border border-ey-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-400 shrink-0">
              <Coins className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-ey-light tracking-wide">
                AI Cost &amp; Token Analysis
              </h1>
              <p className="text-xs text-ey-muted mt-0.5">
                Direct cost and token metrics from <span className="font-mono text-ey-yellow">ai_usage_data.csv</span> — no assumption-based estimates.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-xs bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2 text-emerald-300 shrink-0 self-start sm:self-center">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-mono text-[11px]">Columns: <strong>Token Consumption</strong> · <strong>Daily Billable Tokens</strong> · <strong>Cost in USD</strong></span>
          </div>
        </div>

        {loading || !summary ? (
          <div className="h-64 flex items-center justify-center text-ey-muted text-sm animate-pulse">
            Loading CSV data...
          </div>
        ) : (
          <>
            {/* Row 1: Core three CSV fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <KpiCard
                title="Total Token Consumption"
                delta={makeDelta(summary.totalTokenConsumption, summary.prevTotalTokenConsumption)}
                unit="tokens"
                description="Token Consumption column — total tokens per row summed"
                comparisonLabel="vs prev period"
              />
              <KpiCard
                title="Total Billable Tokens"
                delta={makeDelta(summary.totalBillableTokens, summary.prevTotalBillableTokens)}
                unit="tokens"
                description="Daily Billable Tokens column — billable quota usage"
                comparisonLabel="vs prev period"
              />
              <KpiCard
                title="Total API Cost"
                delta={makeDelta(summary.totalCost, summary.prevTotalCost)}
                formatType="currency"
                description="Cost in USD column — actual billed cost"
                comparisonLabel="vs prev period"
              />
            </div>

            {/* Row 2: Derived efficiency metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <KpiCard
                title="Avg Daily Cost"
                delta={data.metrics.avgDailyCost.summary}
                formatType="currency"
                description="Total cost ÷ unique activity days"
              />
              <KpiCard
                title="Cost per 1K Tokens"
                delta={data.metrics.costPer1kTokens.summary}
                formatType="currency"
                description="cost ÷ (billable_tokens / 1,000)"
              />
              <KpiCard
                title="Billable Utilization Rate"
                delta={data.metrics.billableUtilizationRate.summary}
                formatType="percentage"
                description="Daily Billable Tokens ÷ Token Consumption"
              />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <MetricChart
                title="Daily API Cost Over Time"
                subtitle="Cost in USD per day from ai_usage_data.csv"
                data={data.metrics.cost.series}
                chartType="area"
                series={[{ key: 'value', name: 'Daily Cost ($)', color: '#FFE600' }]}
              />
              <MetricChart
                title="Daily Token Consumption"
                subtitle="Token Consumption per day from ai_usage_data.csv"
                data={data.metrics.tokenConsumption.series}
                chartType="area"
                series={[{ key: 'value', name: 'Token Consumption', color: '#6366f1' }]}
              />
            </div>

            {/* Top Users Table */}
            {summary.topUsers?.length > 0 && (
              <DataTable
                title="Top Users by Token Consumption"
                data={summary.topUsers.map((u) => ({
                  displayName: u.displayName,
                  userMail: u.userMail,
                  tokens: u.tokens.toLocaleString(),
                  cost: `$${u.cost.toFixed(4)}`,
                }))}
                columns={[
                  { header: 'Name', accessorKey: 'displayName' },
                  { header: 'Email', accessorKey: 'userMail' },
                  { header: 'Token Consumption', accessorKey: 'tokens' },
                  { header: 'Cost (USD)', accessorKey: 'cost' },
                ]}
              />
            )}

            {/* AI Tool Breakdown */}
            {summary.byAiTool?.length > 0 && (
              <DataTable
                title="Cost & Token Breakdown by AI Tool"
                data={summary.byAiTool.map((t) => ({
                  tool: TOOL_LABELS[t.tool] || t.tool,
                  tokens: t.tokens.toLocaleString(),
                  cost: `$${t.cost.toFixed(4)}`,
                  share: `${((t.tokens / summary.totalTokenConsumption) * 100).toFixed(1)}%`,
                }))}
                columns={[
                  { header: 'AI Tool', accessorKey: 'tool' },
                  { header: 'Token Consumption', accessorKey: 'tokens' },
                  { header: 'Cost (USD)', accessorKey: 'cost' },
                  { header: 'Token Share', accessorKey: 'share' },
                ]}
              />
            )}

            {/* Summary breakdown panel */}
            <div className="bg-ey-card border border-ey-border rounded-xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-ey-light flex items-center gap-2 mb-4 border-b border-ey-border pb-3">
                <Zap className="w-4 h-4 text-ey-yellow" />
                Period Summary — From ai_usage_data.csv
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                {[
                  { label: 'Token Consumption (total)', value: summary.totalTokenConsumption.toLocaleString(), sub: 'tokens', color: 'text-ey-light' },
                  { label: 'Token Consumption (prev)', value: summary.prevTotalTokenConsumption.toLocaleString(), sub: 'tokens', color: 'text-ey-muted' },
                  { label: 'Daily Billable Tokens (total)', value: summary.totalBillableTokens.toLocaleString(), sub: 'tokens', color: 'text-ey-light' },
                  { label: 'Daily Billable Tokens (prev)', value: summary.prevTotalBillableTokens.toLocaleString(), sub: 'tokens', color: 'text-ey-muted' },
                  { label: 'Cost in USD (total)', value: `$${summary.totalCost.toLocaleString()}`, sub: 'USD', color: 'text-emerald-400' },
                  { label: 'Cost in USD (prev)', value: `$${summary.prevTotalCost.toLocaleString()}`, sub: 'USD', color: 'text-ey-muted' },
                  { label: 'Avg daily cost', value: `$${summary.avgDailyCost.toFixed(4)}`, sub: '/ active day', color: 'text-ey-light' },
                  { label: 'Cost per 1K tokens', value: `$${summary.costPer1kTokens.toFixed(6)}`, sub: '/ 1K tokens', color: 'text-ey-yellow' },
                  { label: 'Billable utilization', value: `${summary.billableUtilizationRate.toFixed(1)}%`, sub: 'of total tokens', color: 'text-emerald-400' },
                ].map((item) => (
                  <div key={item.label} className="bg-ey-black border border-ey-border rounded-lg p-3">
                    <p className="text-ey-muted text-[10px] mb-1 font-mono">{item.label}</p>
                    <p className={`text-base font-bold ${item.color}`}>{item.value}</p>
                    <p className="text-ey-muted text-[10px]">{item.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
