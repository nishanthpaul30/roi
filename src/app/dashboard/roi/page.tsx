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
import { ExecutiveMetricDrilldownView } from '@/components/ui/ExecutiveMetricDrilldownView';
import { DrilldownMetricData } from '@/components/ui/MetricDrilldownModal';
import { ExecutivePrintTemplate } from '@/components/reports/ExecutivePrintTemplate';
import { Coins, Zap } from 'lucide-react';
import { TokenCostSummary } from '@/lib/metrics/types';
import { formatCompactCurrency as fmtCost, formatCompactNumber } from '@/lib/format';

const TOOL_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT',
  github: 'GitHub Copilot',
  claude: 'Claude',
  replit: 'Replit',
  factory: 'Factory AI',
  cursor: 'Cursor AI',
};

export default function RoiPage() {
  const { filters, setFilters, data, loading } = useMetricsData();
  const [activeDrilldown, setActiveDrilldown] = useState<RoiDrilldownTarget | null>(null);
  // Total Token Consumption drilldown -- relocated here from the Executive
  // Overview page (that KPI card was replaced with AI Adoption). Reuses the
  // same ExecutiveMetricDrilldownView component and calculations as before.
  const [tokenDrilldown, setTokenDrilldown] = useState<DrilldownMetricData | null>(null);

  const summary: TokenCostSummary | null = data?.tokenCostSummary ?? null;

  // Each KPI card below compares the current period against the same metric's
  // real previous-period value (not a fixed reference point), so the badge
  // and footer both reflect a genuine "vs last period" change.
  const previousDataAvailable = summary?.previousDataAvailable ?? false;
  const trendFor = (delta: number): 'up' | 'down' | 'neutral' =>
    !previousDataAvailable || Math.abs(delta) < 0.0001 ? 'neutral' : delta > 0 ? 'up' : 'down';
  const pctDeltaFor = (current: number, previous: number): number =>
    previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;

  const overallUtilizationDelta = Number(((summary?.overallUtilizationPercent || 0) - (summary?.prevOverallUtilizationPercent || 0)).toFixed(2));
  const wasteDelta = Number(((summary?.totalWasteCost || 0) - (summary?.prevTotalWasteCost || 0)).toFixed(2));
  const overageDelta = Number(((summary?.totalOverageCost || 0) - (summary?.prevTotalOverageCost || 0)).toFixed(2));
  const ceilingRiskDelta = (summary?.ceilingRiskCount || 0) - (summary?.prevCeilingRiskCount || 0);

  const openDrilldown = (target: RoiDrilldownTarget) => {
    setActiveDrilldown(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openTokenDrilldown = () => {
    if (!data) return;
    const tc = data.metrics.tokenConsumption.summary;
    setTokenDrilldown({
      id: 'token_consumption',
      title: 'Total Token Consumption',
      subtitle: 'Comprehensive volume breakdown across tools, regions, and service line',
      currentValue: `${formatCompactNumber(tc.current || 0)} tokens`,
      deltaText: tc?.percentageDelta ? `${tc.percentageDelta > 0 ? '+' : ''}${tc.percentageDelta}%` : '0%',
      trend: tc?.trend || 'neutral',
      series: data.metrics.tokenConsumption.series || [],
      summaryData: summary,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="flex-1 flex flex-col">
      <GlobalFilterBar filters={filters} onFilterChange={setFilters} filterOptions={data?.filterOptions} />

      <main className="p-6 space-y-6 max-w-7xl mx-auto w-full no-print">
        {tokenDrilldown ? (
          <ExecutiveMetricDrilldownView
            data={tokenDrilldown}
            onBack={() => setTokenDrilldown(null)}
            filters={filters}
            parentTitle="ROI Dashboard"
          />
        ) : activeDrilldown ? (
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
                    <span>Financial Governance &amp; Unused Capacity ROI</span>
                  </h1>
                  <p className="text-xs text-ey-muted mt-0.5">
                    Bifurcated unused capacity, overage risk, and hard dollar-ceiling governance across your organization.
                  </p>
                </div>
              </div>
            </div>

        {loading || !summary ? (
          <div className="h-64 flex items-center justify-center text-ey-muted text-sm animate-pulse">
            Loading data &amp; calculating ROI metrics...
          </div>
        ) : (
          <>
            {/* Financial ROI Governance KPI Cards with Drilldown Handlers -- Total Token
                Consumption relocated here from the Executive Overview page */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <KpiCard
                title="Total Token Consumption"
                delta={data.metrics.tokenConsumption.summary}
                unit="tokens"
                formatType="compact"
                description="SUM(GenAI Tool Consumption) across all Usage rows in the period."
                comparisonLabel="vs prev period"
                meta={`${summary.byAiTool?.length ?? 0} AI tools · $${summary.costPer1kTokens.toFixed(4)} per 1K tokens`}
                onClick={openTokenDrilldown}
              />
              <KpiCard
                title="Overall Utilization"
                delta={{
                  current: summary.overallUtilizationPercent,
                  previous: summary.prevOverallUtilizationPercent,
                  absoluteDelta: overallUtilizationDelta,
                  percentageDelta: 0,
                  percentagePointDelta: overallUtilizationDelta,
                  trend: trendFor(overallUtilizationDelta),
                  isRateMetric: true,
                  previousDataAvailable,
                }}
                unit="%"
                valueOverride={
                  <span className="flex flex-col">
                    <span>{fmtCost(summary.totalCost)}</span>
                    <span className="text-xs font-normal text-ey-muted mt-0.5">of {fmtCost(summary.totalLicenseCost)} license</span>
                  </span>
                }
                sideNote={`${summary.overallUtilizationPercent}%`}
                description={`You paid ${fmtCost(summary.totalLicenseCost)} in license fees, but only ${summary.overallUtilizationPercent}% of that shows up as actual usage (${fmtCost(summary.totalCost)}). A low percentage means many licensed seats aren't being used enough to justify the cost. Click to see the breakdown by license.`}
                meta={`${summary.totalRosterUserCount} users`}
                onClick={() =>
                  openDrilldown({
                    type: 'metric',
                    id: 'efficiency',
                    title: 'Overall Utilization Analysis',
                    subtitle: 'Actual telemetry spend vs real per-license Cost in $.',
                    badge: 'Overall Utilization',
                  })
                }
              />

              <KpiCard
                title="Unutilized AI Capacity"
                delta={{
                  current: summary.totalWasteCost,
                  previous: summary.prevTotalWasteCost,
                  absoluteDelta: wasteDelta,
                  percentageDelta: Number(pctDeltaFor(summary.totalWasteCost, summary.prevTotalWasteCost).toFixed(2)),
                  trend: trendFor(wasteDelta),
                  previousDataAvailable,
                }}
                formatType="currency"
                description="The free-dollar allowance that went unused across under-utilized licenses this month (limit minus gross cost). Click to drill down to raw usage logs."
                meta={`${(summary.userCapacityBreakdown || []).filter((u) => u.zone === 'zone1_under').length} users · Zone 1 Unused`}
                onClick={() =>
                  openDrilldown({
                    type: 'zone',
                    id: 'waste',
                    title: 'Zone 1: Unused Capacity',
                    subtitle: 'Under-utilized employee licenses with unconsumed free-dollar limit (per-tool free limit - gross usage cost).',
                    badge: 'Zone 1 Unused',
                  })
                }
              />

              <KpiCard
                title="Overage Spend Exposure"
                delta={{
                  current: summary.totalOverageCost,
                  previous: summary.prevTotalOverageCost,
                  absoluteDelta: overageDelta,
                  percentageDelta: Number(pctDeltaFor(summary.totalOverageCost, summary.prevTotalOverageCost).toFixed(2)),
                  trend: trendFor(overageDelta),
                  previousDataAvailable,
                }}
                formatType="currency"
                description="Usage that was billed because it went over each tool's free-dollar limit. Click to drill down to raw usage logs."
                meta={`${(summary.userCapacityBreakdown || []).filter((u) => u.zone === 'zone2_over').length} users · Zone 2 Overage`}
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
                title="Users at Usage Ceiling"
                delta={{
                  current: summary.ceilingRiskCount,
                  previous: summary.prevCeilingRiskCount,
                  absoluteDelta: ceilingRiskDelta,
                  percentageDelta: Number(pctDeltaFor(summary.ceilingRiskCount, summary.prevCeilingRiskCount).toFixed(2)),
                  trend: trendFor(ceilingRiskDelta),
                  previousDataAvailable,
                }}
                unit="users"
                description={`Users who have reached or exceeded 90% of the ${fmtCost(summary.hardCeiling)} spend ceiling. Click to inspect power users.`}
                meta={`${fmtCost(summary.hardCeiling)} hard ceiling · 90% threshold`}
                onClick={() =>
                  openDrilldown({
                    type: 'zone',
                    id: 'ceiling',
                    title: 'Dollar Ceiling Risk Telemetry',
                    subtitle: `High-volume power users who have reached or exceeded 90% (${fmtCost(summary.hardCeiling * 0.9)}+) of the spend cap.`,
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
              hardCeiling={summary.hardCeiling}
              totalLicenseCost={summary.totalLicenseCost}
              licenseRoiPercent={summary.licenseRoiPercent}
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
                      ? 'Zone 2: Over-Utilized Licenses'
                      : 'Dollar Ceiling Risk',
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

            {/* Financial Summary panel */}
            <div className="bg-ey-card border border-ey-border rounded-xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-ey-light flex items-center gap-2 mb-4 border-b border-ey-border pb-3">
                <Zap className="w-4 h-4 text-ey-yellow" />
                Capacity &amp; Financial Governance Summary
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                {[
                  { label: 'Unused Capacity (total)', value: fmtCost(summary.totalWasteCost), sub: 'unconsumed free-dollar limit', color: 'text-amber-400' },
                  { label: 'Overage Spend (total)', value: fmtCost(summary.totalOverageCost), sub: 'billed beyond per-tool free-dollar limit', color: 'text-purple-400' },
                  { label: 'Quota Efficiency Rate', value: `${summary.licenseEfficiencyRate}%`, sub: 'actual ÷ limit', color: 'text-emerald-400' },
                  { label: 'Total API Cost', value: fmtCost(summary.totalCost), sub: 'actual billed USD', color: 'text-ey-light' },
                  { label: 'Cost per 1K tokens', value: `$${summary.costPer1kTokens.toFixed(6)}`, sub: '/ 1K tokens', color: 'text-ey-yellow' },
                  { label: 'Near Dollar Cap Users', value: `${summary.ceilingRiskCount} users`, sub: `≥90% of ${fmtCost(summary.hardCeiling)}`, color: 'text-red-400' },
                  { label: 'Total License Cost', value: fmtCost(summary.totalLicenseCost), sub: 'sum of per-license Cost in USD', color: 'text-sky-400' },
                  { label: 'Usage vs License Cost', value: `${summary.licenseRoiPercent}%`, sub: 'usage cost ÷ license cost', color: 'text-sky-400' },
                ].map((item) => (
                  <div key={item.label} className="bg-ey-black border border-ey-border rounded-lg p-3">
                    <p className="text-ey-muted text-[10px] mb-1 font-mono">{item.label}</p>
                    <p className={`text-base font-bold ${item.color}`}>{item.value}</p>
                    <p className="text-ey-muted text-[10px]">{item.sub}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <MetricChart
                title="Monthly API Cost Over Time"
                subtitle="Cost in USD per month"
                data={data.metrics.cost.series}
                chartType="area"
                series={[{ key: 'value', name: 'Monthly Cost ($)', color: '#FFE600' }]}
              />
              <MetricChart
                title="Monthly Token Consumption"
                subtitle="Token Consumption per month"
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
                  tokens: formatCompactNumber(t.tokens),
                  cost: fmtCost(t.cost),
                  share: `${((t.tokens / summary.totalTokenConsumption) * 100).toFixed(4)}%`,
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
