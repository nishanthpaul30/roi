'use client';

import { useState } from 'react';
import { useMetricsData } from '@/hooks/useMetricsData';
import { GlobalFilterBar } from '@/components/layout/GlobalFilterBar';
import { KpiCard } from '@/components/ui/KpiCard';
import { ExecutiveInferencesPanel } from '@/components/ui/ExecutiveInferencesPanel';
import { ExecutiveMetricDrilldownView } from '@/components/ui/ExecutiveMetricDrilldownView';
import { ExecutiveInferenceDrilldownView } from '@/components/ui/ExecutiveInferenceDrilldownView';
import { DrilldownMetricData } from '@/components/ui/MetricDrilldownModal';
import { ExecutivePrintTemplate } from '@/components/reports/ExecutivePrintTemplate';
import { Sparkles, Printer } from 'lucide-react';
import { formatCompactCurrency, formatCompactNumber } from '@/lib/format';
import { UserCapacityRow } from '@/lib/metrics/types';

export default function ExecutiveOverviewPage() {
  const { filters, setFilters, data, loading } = useMetricsData();
  const [activeDrilldown, setActiveDrilldown] = useState<DrilldownMetricData | null>(null);
  const [activeInferenceDrilldown, setActiveInferenceDrilldown] = useState<string | null>(null);
  const [inferenceInitialEntity, setInferenceInitialEntity] = useState<{
    type: 'user' | 'tool' | 'region' | 'country' | 'service_line' | 'project_code' | 'cohort' | 'month';
    name: string;
    label?: string;
  } | null>(null);

  const handleExportCsv = () => {
    window.location.href = `/api/metrics/export?type=daily&startDate=${filters.startDate}&endDate=${filters.endDate}`;
  };

  const openDrilldown = (
    id: DrilldownMetricData['id'],
    title: string,
    subtitle: string,
    currentValue: string,
    delta: any,
    series: { date: string; value: number }[]
  ) => {
    setActiveDrilldown({
      id,
      title,
      subtitle,
      currentValue,
      deltaText: delta?.percentageDelta ? `${delta.percentageDelta > 0 ? '+' : ''}${delta.percentageDelta}%` : '0%',
      trend: delta?.trend || 'neutral',
      series: series || [],
      summaryData: data?.tokenCostSummary,
    });

    // Smooth scroll to top of content area on drilldown
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Total AI Investment drilldown subtitle: license seat adoption in plain
  // terms, matching the AI Adoption card's math -- "licenses" here means
  // distinct user-tool pairs (aiTools per user), not raw License CSV rows,
  // since a held tool recurs as a License row every month.
  const licenseAdoptionSubtitle = (() => {
    const s = data?.tokenCostSummary;
    if (!s) return 'Financial spend distribution across billable projects, external clients, and regions';
    const breakdown: UserCapacityRow[] = s.userCapacityBreakdown || [];
    const totalLicenses = breakdown.reduce((sum: number, u: UserCapacityRow) => sum + (u.aiTools?.length || 0), 0);
    const activeBreakdown = breakdown.filter((u: UserCapacityRow) => u.tokenConsumption > 0);
    const usedLicenses = activeBreakdown.reduce((sum: number, u: UserCapacityRow) => sum + (u.aiTools?.length || 0), 0);
    const dormantLicenses = totalLicenses - usedLicenses;
    const avgLicensesPerActiveUser = activeBreakdown.length > 0 ? usedLicenses / activeBreakdown.length : 0;
    return `Out of ${s.totalRosterUserCount} number of resources where ${totalLicenses} AI license of various sort are present, however only ${s.activeUserCount} members are actively using it each possess ${avgLicensesPerActiveUser.toFixed(1)} licenses and there are ${dormantLicenses} dormant licenses.`;
  })();

  return (
    <div className="flex-1 flex flex-col">
      <GlobalFilterBar
        filters={filters}
        onFilterChange={setFilters}
        onExportCsv={handleExportCsv}
        filterOptions={data?.filterOptions}
      />

      <main className="p-6 space-y-6 max-w-7xl mx-auto w-full no-print">
        {activeInferenceDrilldown ? (
          /* In-Page Deep Strategic Inference Drilldown Component View */
          <ExecutiveInferenceDrilldownView
            inferenceId={activeInferenceDrilldown}
            summary={data?.tokenCostSummary}
            initialEntity={inferenceInitialEntity}
            onBack={() => {
              setActiveInferenceDrilldown(null);
              setInferenceInitialEntity(null);
            }}
            filters={filters}
          />
        ) : activeDrilldown ? (
          /* In-Page Deep Metric Drilldown Component View */
          <ExecutiveMetricDrilldownView
            data={activeDrilldown}
            onBack={() => setActiveDrilldown(null)}
            filters={filters}
          />
        ) : (
          /* Normal Executive Overview View */
          <>
            {/* Page Header Title & Executive PDF Action */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-ey-border/60 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-ey-yellow/15 border border-ey-yellow/30 rounded-xl text-ey-yellow shrink-0 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-ey-light tracking-tight flex items-center gap-3">
                    <span>Executive Overview</span>
                  </h1>
                  <p className="text-xs text-ey-muted mt-0.5">
                    Token consumption, billable tokens, and API cost across your organization.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => window.print()}
                  className="flex items-center space-x-2 px-4 py-2 bg-ey-yellow text-ey-black font-bold text-xs rounded-xl shadow-lg shadow-yellow-500/10 hover:bg-yellow-400 transition-all duration-150 shrink-0"
                  title="Open System Print Window to Print or Save as PDF"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print / Save as PDF</span>
                </button>
              </div>
            </div>

            {loading || !data ? (
              <div className="h-64 flex items-center justify-center text-ey-muted text-sm animate-pulse">
                Loading data...
              </div>
            ) : (
              <>
                {/* Clickable Interactive KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <KpiCard
                    title="AI Adoption"
                    delta={data.metrics.aiAdoptionRate.summary}
                    formatType="percentage"
                    description="Active users ÷ total licensed roster × 100."
                    comparisonLabel="vs prev period"
                    meta={`${data.tokenCostSummary?.activeUserCount ?? 0} of ${data.tokenCostSummary?.totalRosterUserCount ?? 0} resources · ${data.tokenCostSummary?.byAiTool?.length ?? 0} tools`}
                    onClick={() =>
                      openDrilldown(
                        'ai_adoption',
                        'AI Adoption',
                        'Active vs dormant licence adoption, and per-tool adoption share & wastage',
                        `${(data.metrics.aiAdoptionRate.summary.current || 0).toFixed(1)}%`,
                        data.metrics.aiAdoptionRate.summary,
                        data.metrics.aiAdoptionRate.series
                      )
                    }
                  />

                  <KpiCard
                    title="Total AI Investment"
                    delta={data.metrics.cost.summary}
                    formatType="currency"
                    description="Usage Cost + License Cost, summed across all rows in the period."
                    comparisonLabel="vs prev period"
                    meta={`${data.tokenCostSummary?.activeUserCount ?? 0} active users · ${data.tokenCostSummary?.inactiveUserCount ?? 0} inactive users`}
                    onClick={() =>
                      openDrilldown(
                        'total_investment',
                        'Total AI Investment',
                        licenseAdoptionSubtitle,
                        formatCompactCurrency(data.metrics.cost.summary.current || 0),
                        data.metrics.cost.summary,
                        data.metrics.cost.series
                      )
                    }
                  />

                  <KpiCard
                    title="Avg Monthly AI Cost"
                    delta={data.metrics.avgMonthlyCost.summary}
                    formatType="currency"
                    description="Total spend per calendar month, averaged across months in the period."
                    comparisonLabel="vs prev period"
                    meta={`${data.tokenCostSummary?.monthlyTrend?.length ?? 0} months tracked · ${formatCompactCurrency(data.metrics.cost.summary.current || 0)} total AI cost`}
                    onClick={() =>
                      openDrilldown(
                        'avg_monthly_cost',
                        'Avg Monthly AI Cost',
                        'Monthly spending volatility and active calendar month run-rate analysis',
                        `${formatCompactCurrency(data.metrics.avgMonthlyCost.summary.current || 0)} / month`,
                        data.metrics.avgMonthlyCost.summary,
                        data.metrics.avgMonthlyCost.series
                      )
                    }
                  />

                  <KpiCard
                    title="Cost per Active User"
                    delta={data.metrics.costPerActiveUser?.summary}
                    formatType="currency"
                    description="Total spend ÷ number of active users (users with usage > 0)."
                    comparisonLabel="vs prev period"
                    meta={`${data.tokenCostSummary?.activeUserCount ?? 0} active users · Across ${data.tokenCostSummary?.byServiceLine?.length ?? 0} service lines`}
                    onClick={() =>
                      openDrilldown(
                        'cost_per_user',
                        'Cost per Active User',
                        'Per-user license expenditure and developer adoption rankings',
                        `${formatCompactCurrency(data.metrics.costPerActiveUser?.summary?.current || 0)} / user`,
                        data.metrics.costPerActiveUser?.summary,
                        data.metrics.cost.series
                      )
                    }
                  />
                </div>

                {/* Executive Strategic Leadership Inferences Panel */}
                <ExecutiveInferencesPanel
                  summary={data.tokenCostSummary}
                  filters={filters}
                  onSelectInference={(infId) => {
                    setInferenceInitialEntity(null);
                    setActiveInferenceDrilldown(infId);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                />
              </>
            )}
          </>
        )}
      </main>

      {/* Clean PDF/Print Executive Report Template (Hidden on screen, active on print) */}
      <ExecutivePrintTemplate data={data} filters={filters} />
    </div>
  );
}


