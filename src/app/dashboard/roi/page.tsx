'use client';

import { useState } from 'react';
import { useMetricsData } from '@/hooks/useMetricsData';
import { GlobalFilterBar } from '@/components/layout/GlobalFilterBar';
import { KpiCard } from '@/components/ui/KpiCard';
import { MetricChart } from '@/components/ui/MetricChart';
import { DataTable } from '@/components/ui/DataTable';
import { RoiCapacityPanel } from '@/components/ui/RoiCapacityPanel';
import { ProjectBillabilityPanel } from '@/components/ui/ProjectBillabilityPanel';
import { RoiDrilldownView, RoiDrilldownTarget } from '@/components/ui/RoiDrilldownView';
import { ExecutivePrintTemplate } from '@/components/reports/ExecutivePrintTemplate';
import { Coins, ShieldCheck, Zap } from 'lucide-react';
import { TokenCostSummary } from '@/lib/metrics/types';

const TOOL_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT',
  copilot: 'GitHub Copilot',
  claude: 'Claude',
  replit: 'Replit',
  factoryai: 'Factory AI',
  cursor: 'Cursor AI',
};

export default function RoiPage() {
  const { filters, setFilters, data, loading } = useMetricsData();
  const [activeDrilldown, setActiveDrilldown] = useState<RoiDrilldownTarget | null>(null);

  const summary: TokenCostSummary | null = data?.tokenCostSummary ?? null;

  const openDrilldown = (target: RoiDrilldownTarget) => {
    setActiveDrilldown(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="flex-1 flex flex-col">
      <GlobalFilterBar filters={filters} onFilterChange={setFilters} filterOptions={data?.filterOptions} />

      <main className="p-6 space-y-6 max-w-7xl mx-auto w-full no-print">
        {activeDrilldown ? (
          <RoiDrilldownView
            target={activeDrilldown}
            summary={summary}
            onBack={() => setActiveDrilldown(null)}
            filters={filters}
          />
        ) : (
          <>
            {/* Header Title Block */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-ey-card/50 border border-ey-border rounded-xl p-4 shadow-sm">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-400 shrink-0">
                  <Coins className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-ey-light tracking-wide flex items-center gap-2.5">
                    <span>Financial Governance &amp; Capacity Waste ROI</span>
                  </h1>
                  <p className="text-xs text-ey-muted mt-0.5">
                    Bifurcated capacity waste, overage risk, and 100K token cap governance across your organization.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="hidden md:flex items-center space-x-2 text-xs bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 text-amber-300 shrink-0">
                  <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="font-mono text-[11px]">Free Limit: <strong>Per-Tool</strong> (Copilot $20 · ChatGPT $20 · Cursor AI $40 · Claude/Replit/Factory AI $0) · Ceiling: <strong>100,000 tokens</strong></span>
                </div>
              </div>
            </div>

        {loading || !summary ? (
          <div className="h-64 flex items-center justify-center text-ey-muted text-sm animate-pulse">
            Loading data &amp; calculating ROI metrics...
          </div>
        ) : (
          <>
            {/* Financial ROI Governance KPI Cards with Drilldown Handlers */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <KpiCard
                title="License Investment ROI"
                delta={{
                  current: summary.licenseRoiPercent,
                  previous: 100,
                  absoluteDelta: summary.licenseRoiPercent - 100,
                  percentageDelta: 0,
                  trend: summary.licenseRoiPercent >= 80 ? 'up' : 'down',
                  isRateMetric: true,
                }}
                unit="%"
                description={`Total actual usage cost ÷ total per-seat License Cost in USD ($${summary.totalLicenseCost.toLocaleString()}). Click to inspect per-seat license ROI.`}
                onClick={() =>
                  openDrilldown({
                    type: 'metric',
                    id: 'efficiency',
                    title: 'License Investment ROI Analysis',
                    subtitle: 'Actual telemetry spend vs real per-seat License Cost in USD.',
                    badge: 'License ROI',
                  })
                }
              />

              <KpiCard
                title="Wasted AI Capacity"
                delta={{
                  current: summary.totalWasteCost,
                  previous: 0,
                  absoluteDelta: summary.totalWasteCost,
                  percentageDelta: 0,
                  trend: 'down',
                }}
                formatType="currency"
                description="Zone 1: Unconsumed dollar limit across under-utilized seats (limit - actualCost). Click to drill down to raw usage logs."
                onClick={() =>
                  openDrilldown({
                    type: 'zone',
                    id: 'waste',
                    title: 'Zone 1: Unconsumed Capacity Waste',
                    subtitle: 'Under-utilized employee seats with unconsumed dollar allocations (per-tool free limit - actual cost).',
                    badge: 'Zone 1 Waste',
                  })
                }
              />

              <KpiCard
                title="Overage Spend Exposure"
                delta={{
                  current: summary.totalOverageCost,
                  previous: 0,
                  absoluteDelta: summary.totalOverageCost,
                  percentageDelta: 0,
                  trend: 'up',
                }}
                formatType="currency"
                description="Zone 2: Additional billed usage exceeding each tool's free limit (Copilot $20, ChatGPT $20, Cursor AI $40, Claude/Replit/Factory AI $0). Click to drill down to raw usage logs."
                onClick={() =>
                  openDrilldown({
                    type: 'zone',
                    id: 'overage',
                    title: 'Zone 2: Overage Spend Exposure',
                    subtitle: 'Excess usage and fees billed beyond each tool\'s free allocation.',
                    badge: 'Zone 2 Overage',
                  })
                }
              />

              <KpiCard
                title="Org Quota Efficiency"
                delta={{
                  current: summary.licenseEfficiencyRate,
                  previous: 100,
                  absoluteDelta: summary.licenseEfficiencyRate - 100,
                  percentageDelta: 0,
                  trend: summary.licenseEfficiencyRate >= 80 ? 'up' : 'down',
                  isRateMetric: true,
                }}
                unit="%"
                description="Total actual cost ÷ total allocated usage limit across active seats. Click to inspect all active rosters."
                onClick={() =>
                  openDrilldown({
                    type: 'metric',
                    id: 'efficiency',
                    title: 'Org Quota Efficiency Analysis',
                    subtitle: 'Actual telemetry spend vs total allocated limits across all active and inactive seats.',
                    badge: 'Quota Efficiency',
                  })
                }
              />

              <KpiCard
                title="100K Cap Risk Count"
                delta={{
                  current: summary.ceilingRiskCount,
                  previous: 0,
                  absoluteDelta: summary.ceilingRiskCount,
                  percentageDelta: 0,
                  trend: summary.ceilingRiskCount > 0 ? 'up' : 'neutral',
                }}
                unit="users"
                description="Users who have reached or exceeded 90% of the 100,000 token ceiling. Click to inspect power users."
                onClick={() =>
                  openDrilldown({
                    type: 'zone',
                    id: 'ceiling',
                    title: '100,000 Token Ceiling Risk Telemetry',
                    subtitle: 'High-volume power users who have reached or exceeded 90% (90,000+ tokens) of the 100K token cap.',
                    badge: 'Cap Risk Telemetry',
                  })
                }
              />
            </div>

            {/* Bifurcated User Capacity & Waste Panel */}
            <RoiCapacityPanel
              userCapacityBreakdown={summary.userCapacityBreakdown || []}
              totalWasteCost={summary.totalWasteCost}
              totalOverageCost={summary.totalOverageCost}
              licenseEfficiencyRate={summary.licenseEfficiencyRate}
              ceilingRiskCount={summary.ceilingRiskCount}
              totalLicenseCost={summary.totalLicenseCost}
              licenseRoiPercent={summary.licenseRoiPercent}
              licenseUnderutilizedCost={summary.licenseUnderutilizedCost}
              licenseOverutilizedValue={summary.licenseOverutilizedValue}
              filters={filters}
              onSelectUser={(u) =>
                openDrilldown({
                  type: 'user',
                  id: u.userMail,
                  title: `Employee Usage: ${u.displayName}`,
                  subtitle: `Full raw telemetry records, license limits, and activity logs for ${u.displayName} (${u.userMail}).`,
                  badge: u.zone === 'zone1_under' ? 'Zone 1: Under-Utilized' : 'Zone 2: Over-Utilized',
                  filterCriteria: { userEmail: u.userMail },
                })
              }
              onSelectZone={(zone) =>
                openDrilldown({
                  type: 'zone',
                  id: zone === 'zone1_under' ? 'waste' : zone === 'zone2_over' ? 'overage' : 'ceiling',
                  title:
                    zone === 'zone1_under'
                      ? 'Zone 1: Under-Utilized Capacity'
                      : zone === 'zone2_over'
                      ? 'Zone 2: Over-Utilized Seats'
                      : '100K Ceiling Risk',
                  subtitle: 'Detailed employee breakdown and live CSV log telemetry.',
                  badge: zone.toUpperCase(),
                })
              }
            />

            {/* Engagement Code Telemetry & Billability Panel */}
            <ProjectBillabilityPanel
              summary={summary}
              onSelectProject={(projectCode, billable) =>
                openDrilldown({
                  type: 'project',
                  id: projectCode,
                  title: `Project Telemetry: ${projectCode}`,
                  subtitle: `Row-level CSV usage records for project investment code ${projectCode} (${billable ? 'Billable' : 'Non-Billable'}).`,
                  badge: billable ? 'Billable' : 'Non-Billable',
                  filterCriteria: { projectCode },
                })
              }
              onSelectBillability={(bType) =>
                openDrilldown({
                  type: 'billability',
                  id: bType,
                  title:
                    bType === 'billable'
                      ? 'Billable Client Projects Telemetry'
                      : 'Non-Billable Internal Projects Telemetry',
                  subtitle: `Row-level records matching ${bType === 'billable' ? 'Billable' : 'Non-Billable'} criteria.`,
                  badge: bType === 'billable' ? 'Billable' : 'Non-Billable',
                })
              }
            />

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <MetricChart
                title="Daily API Cost Over Time"
                subtitle="Cost in USD per day"
                data={data.metrics.cost.series}
                chartType="area"
                series={[{ key: 'value', name: 'Daily Cost ($)', color: '#FFE600' }]}
              />
              <MetricChart
                title="Daily Token Consumption"
                subtitle="Token Consumption per day"
                data={data.metrics.tokenConsumption.series}
                chartType="area"
                series={[{ key: 'value', name: 'Token Consumption', color: '#6366f1' }]}
              />
            </div>

            {/* AI Tool Breakdown */}
            {summary.byAiTool?.length > 0 && (
              <DataTable
                title="Cost &amp; Token Efficiency by AI Tool"
                data={summary.byAiTool.map((t) => ({
                  rawTool: t.tool,
                  tool: TOOL_LABELS[t.tool] || t.tool,
                  tokens: t.tokens.toLocaleString(),
                  cost: `$${t.cost.toFixed(4)}`,
                  share: `${((t.tokens / summary.totalTokenConsumption) * 100).toFixed(1)}%`,
                  costPer1k: `$${t.costPer1kTokens.toFixed(6)}`,
                }))}
                columns={[
                  { header: 'AI Tool', accessorKey: 'tool' },
                  { header: 'Token Consumption', accessorKey: 'tokens' },
                  { header: 'Cost (USD)', accessorKey: 'cost' },
                  { header: 'Cost per 1K Tokens', accessorKey: 'costPer1k' },
                  { header: 'Token Share', accessorKey: 'share' },
                ]}
                onRowClick={(row: any) =>
                  openDrilldown({
                    type: 'tool',
                    id: row.rawTool,
                    title: `AI Platform Telemetry: ${row.tool}`,
                    subtitle: `Raw CSV telemetry records and unit economics for ${row.tool}.`,
                    badge: row.tool,
                    filterCriteria: { aiTool: row.rawTool },
                  })
                }
              />
            )}

            {/* Financial Summary panel */}
            <div className="bg-ey-card border border-ey-border rounded-xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-ey-light flex items-center gap-2 mb-4 border-b border-ey-border pb-3">
                <Zap className="w-4 h-4 text-ey-yellow" />
                Capacity &amp; Financial Governance Summary
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                {[
                  { label: 'Wasted Capacity (total)', value: `$${summary.totalWasteCost.toLocaleString()}`, sub: 'unconsumed dollar limit', color: 'text-amber-400' },
                  { label: 'Overage Spend (total)', value: `$${summary.totalOverageCost.toLocaleString()}`, sub: 'billed beyond per-tool free limit', color: 'text-purple-400' },
                  { label: 'Quota Efficiency Rate', value: `${summary.licenseEfficiencyRate}%`, sub: 'actual ÷ limit', color: 'text-emerald-400' },
                  { label: 'Total API Cost', value: `$${summary.totalCost.toLocaleString()}`, sub: 'actual billed USD', color: 'text-ey-light' },
                  { label: 'Cost per 1K tokens', value: `$${summary.costPer1kTokens.toFixed(6)}`, sub: '/ 1K tokens', color: 'text-ey-yellow' },
                  { label: 'Near 100K Cap Users', value: `${summary.ceilingRiskCount} users`, sub: '≥90K token usage', color: 'text-red-400' },
                  { label: 'Total License Cost', value: `$${summary.totalLicenseCost.toLocaleString()}`, sub: 'sum of per-seat License Cost in USD', color: 'text-sky-400' },
                  { label: 'License Investment ROI', value: `${summary.licenseRoiPercent}%`, sub: 'actual cost ÷ license cost', color: 'text-sky-400' },
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
          </>
        )}
      </main>

      {/* Clean PDF/Print Executive Report Template */}
      <ExecutivePrintTemplate data={data} filters={filters} />
    </div>
  );
}
