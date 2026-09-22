'use client';

import { useState, useRef, useMemo } from 'react';
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
  // Only the metric id is kept in state -- the rest of the drilldown payload
  // (currentValue, delta, series, summaryData) is re-derived live from `data`
  // on every render below, so changing the month/tool/etc. filters while a
  // drilldown is open actually updates it instead of showing a stale
  // snapshot captured at the moment it was clicked open.
  const [activeDrilldownId, setActiveDrilldownId] = useState<DrilldownMetricData['id'] | null>(null);
  const [activeInferenceDrilldown, setActiveInferenceDrilldown] = useState<string | null>(null);
  const [inferenceInitialEntity, setInferenceInitialEntity] = useState<{
    type: 'user' | 'tool' | 'region' | 'country' | 'service_line' | 'project_code' | 'cohort' | 'month';
    name: string;
    label?: string;
  } | null>(null);

  // Save scroll position before entering drilldown so we can restore it on return
  const savedScrollY = useRef<number>(0);

  const isDrilldownActive = !!(activeInferenceDrilldown || activeDrilldownId);

  const handleBackToOverview = () => {
    setActiveInferenceDrilldown(null);
    setInferenceInitialEntity(null);
    setActiveDrilldownId(null);
    // Restore scroll in the next paint — the overview div is already mounted,
    // so it's available immediately, no layout recalculation needed.
    requestAnimationFrame(() => {
      window.scrollTo({ top: savedScrollY.current, behavior: 'instant' });
    });
  };

  const handleExportCsv = () => {
    window.location.href = `/api/metrics/export?type=daily&startDate=${filters.startDate}&endDate=${filters.endDate}`;
  };

  const openDrilldown = (id: DrilldownMetricData['id']) => {
    savedScrollY.current = window.scrollY;
    setActiveDrilldownId(id);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  // Total AI Investment drilldown subtitle: license seat adoption in plain
  // terms, matching the AI Adoption card's math -- "licenses" here means
  // distinct user-tool pairs (aiTools per user), not raw License CSV entries,
  // since a held tool recurs as a License entry every month. The dormant
  // count reuses summary.inactiveUserCount (the literal Calculation Method =
  // 'Usage' AND GenAI Tool Consumption = 0 rule) so this stays consistent
  // with the same figure shown in this card's own meta line and on the
  // License Reclamation Dormant Seats tile -- not a separately recomputed
  // aggregate that can drift from it.
  const licenseAdoptionSubtitle = (() => {
    const s = data?.tokenCostSummary;
    if (!s) return 'Financial spend distribution across billable projects, external clients, and regions';
    const breakdown: UserCapacityRow[] = s.userCapacityBreakdown || [];
    const totalLicenses = breakdown.reduce((sum: number, u: UserCapacityRow) => sum + (u.aiTools?.length || 0), 0);
    const activeBreakdown = breakdown.filter((u: UserCapacityRow) => u.tokenConsumption > 0);
    const usedLicenses = activeBreakdown.reduce((sum: number, u: UserCapacityRow) => sum + (u.aiTools?.length || 0), 0);
    const avgLicensesPerActiveUser = activeBreakdown.length > 0 ? usedLicenses / activeBreakdown.length : 0;
    return `Out of ${s.totalRosterUserCount} number of resources where ${totalLicenses} AI license of various sort are present, however only ${s.activeUserCount} members are actively using it each possess ${avgLicensesPerActiveUser.toFixed(1)} licenses and there are ${s.inactiveUserCount} dormant licenses.`;
  })();

  // Rebuilds the full drilldown payload from whatever `data` currently is,
  // keyed only by which card was clicked -- recomputed every render, so it
  // always reflects the current filters instead of the snapshot taken at
  // the moment the drilldown was opened.
  const activeDrilldown: DrilldownMetricData | null = useMemo(() => {
    if (!activeDrilldownId || !data) return null;
    const toDeltaText = (delta: any) =>
      delta?.percentageDelta ? `${delta.percentageDelta > 0 ? '+' : ''}${delta.percentageDelta}%` : '0%';
    const summaryData = data.tokenCostSummary;

    switch (activeDrilldownId) {
      case 'ai_adoption': {
        const delta = data.metrics.aiAdoptionRate.summary;
        return {
          id: 'ai_adoption',
          title: 'AI Adoption',
          subtitle: 'Active vs dormant licence adoption, and per-tool adoption share & wastage',
          currentValue: `${(delta.current || 0).toFixed(1)}%`,
          deltaText: toDeltaText(delta),
          trend: delta?.trend || 'neutral',
          series: data.metrics.aiAdoptionRate.series || [],
          summaryData,
        };
      }
      case 'total_investment': {
        const delta = data.metrics.cost.summary;
        return {
          id: 'total_investment',
          title: 'Total AI Investment',
          subtitle: licenseAdoptionSubtitle,
          currentValue: formatCompactCurrency(delta.current || 0),
          deltaText: toDeltaText(delta),
          trend: delta?.trend || 'neutral',
          series: data.metrics.cost.series || [],
          summaryData,
        };
      }
      case 'avg_monthly_cost': {
        const delta = data.metrics.avgMonthlyCost.summary;
        return {
          id: 'avg_monthly_cost',
          title: 'Avg Monthly AI Cost',
          subtitle: 'Monthly spending volatility and active calendar month run-rate analysis',
          currentValue: `${formatCompactCurrency(delta.current || 0)} / month`,
          deltaText: toDeltaText(delta),
          trend: delta?.trend || 'neutral',
          series: data.metrics.avgMonthlyCost.series || [],
          summaryData,
        };
      }
      case 'cost_per_user': {
        const delta = data.metrics.costPerActiveUser?.summary;
        return {
          id: 'cost_per_user',
          title: 'Cost per Active User',
          subtitle: 'Per-user license expenditure and developer adoption rankings',
          currentValue: `${formatCompactCurrency(delta?.current || 0)} / user`,
          deltaText: toDeltaText(delta),
          trend: delta?.trend || 'neutral',
          series: data.metrics.cost.series || [],
          summaryData,
        };
      }
      default:
        return null;
    }
  }, [activeDrilldownId, data, licenseAdoptionSubtitle]);

  return (
    <div className="flex-1 flex flex-col">
      <GlobalFilterBar
        filters={filters}
        onFilterChange={setFilters}
        onExportCsv={handleExportCsv}
        filterOptions={data?.filterOptions}
      />

      <main className="p-6 space-y-6 max-w-7xl mx-auto w-full no-print">

        {/* ── Inference drilldown ── rendered only when active ── */}
        {activeInferenceDrilldown && (
          <ExecutiveInferenceDrilldownView
            inferenceId={activeInferenceDrilldown}
            summary={data?.tokenCostSummary}
            initialEntity={inferenceInitialEntity}
            onBack={handleBackToOverview}
            filters={filters}
          />
        )}

        {/* ── Metric drilldown ── rendered only when active ── */}
        {activeDrilldown && (
          <ExecutiveMetricDrilldownView
            data={activeDrilldown}
            onBack={handleBackToOverview}
            filters={filters}
          />
        )}

        {/*
          ── Executive Overview ──
          Always mounted so ExecutiveInferencesPanel and its useRawRows hook
          are never torn down between drilldowns.  Hiding with CSS (not
          conditional rendering) means the data, state, and DOM are fully
          preserved — no remount, no empty-row flash, no card re-sort glitch.
        */}
        <div className={isDrilldownActive ? 'hidden' : undefined}>
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
            <div className="space-y-6 pt-6">
              {/* Clickable Interactive KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                  title="AI Adoption"
                  delta={data.metrics.aiAdoptionRate.summary}
                  formatType="percentage"
                  description="Active users ÷ total licensed roster × 100."
                  comparisonLabel="vs prev period"
                  meta={`${data.tokenCostSummary?.activeUserCount ?? 0} of ${data.tokenCostSummary?.totalRosterUserCount ?? 0} resources · ${data.tokenCostSummary?.byAiTool?.length ?? 0} tools`}
                  onClick={() => openDrilldown('ai_adoption')}
                />

                <KpiCard
                  title="Total AI Investment"
                  delta={data.metrics.cost.summary}
                  formatType="currency"
                  description="Usage Cost + License Cost, summed across all entries in the period."
                  comparisonLabel="vs prev period"
                  meta={`${data.tokenCostSummary?.activeUserCount ?? 0} active users · ${data.tokenCostSummary?.inactiveUserCount ?? 0} inactive users`}
                  onClick={() => openDrilldown('total_investment')}
                />

                <KpiCard
                  title="Avg Monthly AI Cost"
                  delta={data.metrics.avgMonthlyCost.summary}
                  formatType="currency"
                  description="Total spend per calendar month, averaged across months in the period."
                  comparisonLabel="vs prev period"
                  meta={`${data.tokenCostSummary?.monthlyTrend?.length ?? 0} months tracked · ${formatCompactCurrency(data.metrics.cost.summary.current || 0)} total AI cost`}
                  onClick={() => openDrilldown('avg_monthly_cost')}
                />

                <KpiCard
                  title="Cost per Active User"
                  delta={data.metrics.costPerActiveUser?.summary}
                  formatType="currency"
                  description="Total spend ÷ number of active users (users with usage > 0)."
                  comparisonLabel="vs prev period"
                  meta={`${data.tokenCostSummary?.activeUserCount ?? 0} active users · Across ${data.tokenCostSummary?.byServiceLine?.length ?? 0} service lines`}
                  onClick={() => openDrilldown('cost_per_user')}
                />
              </div>

              {/* Executive Strategic Leadership Inferences Panel */}
              <ExecutiveInferencesPanel
                summary={data.tokenCostSummary}
                filters={filters}
                onSelectInference={(infId) => {
                  savedScrollY.current = window.scrollY;
                  setInferenceInitialEntity(null);
                  setActiveInferenceDrilldown(infId);
                  window.scrollTo({ top: 0, behavior: 'instant' });
                }}
              />
            </div>
          )}
        </div>
      </main>

      {/* Clean PDF/Print Executive Report Template (Hidden on screen, active on print) */}
      <ExecutivePrintTemplate data={data} filters={filters} />
    </div>
  );
}
