'use client';

import { useState } from 'react';
import { useMetricsData } from '@/hooks/useMetricsData';
import { GlobalFilterBar } from '@/components/layout/GlobalFilterBar';
import { KpiCard } from '@/components/ui/KpiCard';
import { ExecutiveInferencesPanel } from '@/components/ui/ExecutiveInferencesPanel';
import { MultiToolComparisonPanel } from '@/components/ui/MultiToolComparisonPanel';
import { ExecutiveMetricDrilldownView } from '@/components/ui/ExecutiveMetricDrilldownView';
import { ExecutiveInferenceDrilldownView } from '@/components/ui/ExecutiveInferenceDrilldownView';
import { DrilldownMetricData } from '@/components/ui/MetricDrilldownModal';
import { ExecutivePrintTemplate } from '@/components/reports/ExecutivePrintTemplate';
import { Sparkles, ShieldCheck, Printer, MousePointerClick } from 'lucide-react';

export default function ExecutiveOverviewPage() {
  const { filters, setFilters, data, loading } = useMetricsData();
  const [activeDrilldown, setActiveDrilldown] = useState<DrilldownMetricData | null>(null);
  const [activeInferenceDrilldown, setActiveInferenceDrilldown] = useState<string | null>(null);
  const [inferenceInitialEntity, setInferenceInitialEntity] = useState<{
    type: 'user' | 'tool' | 'region' | 'country' | 'service_line' | 'project_code' | 'cohort' | 'month' | 'project_type';
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
          />
        ) : activeDrilldown ? (
          /* In-Page Deep Metric Drilldown Component View */
          <ExecutiveMetricDrilldownView
            data={activeDrilldown}
            onBack={() => setActiveDrilldown(null)}
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
                    <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-ey-yellow/10 border border-ey-yellow/30 text-ey-yellow">
                      <MousePointerClick className="w-3 h-3" />
                      Click any metric for in-page drilldown
                    </span>
                  </h1>
                  <p className="text-xs text-ey-muted mt-0.5">
                    Token consumption, billable tokens, and API cost — click any metric card to enter deep-dive telemetry.
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

                <div className="hidden md:flex items-center space-x-2 text-xs bg-ey-card border border-ey-border rounded-xl px-3 py-2 text-ey-light shrink-0">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-mono text-[11px] text-ey-muted">
                    Source: <strong className="text-ey-light font-medium">ai_usage_data.csv</strong>
                  </span>
                </div>
              </div>
            </div>

            {loading || !data ? (
              <div className="h-64 flex items-center justify-center text-ey-muted text-sm animate-pulse">
                Loading data from ai_usage_data.csv...
              </div>
            ) : (
              <>
                {/* Clickable Interactive KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <KpiCard
                    title="Total Token Consumption"
                    delta={data.metrics.tokenConsumption.summary}
                    unit="tokens"
                    description="Total raw tokens consumed. Click to enter in-page breakdown across AI tools & service lines."
                    comparisonLabel="vs prev period"
                    onClick={() =>
                      openDrilldown(
                        'token_consumption',
                        'Total Token Consumption',
                        'Comprehensive volume breakdown across tools, regions, and service lines',
                        `${(data.metrics.tokenConsumption.summary.current || 0).toLocaleString()} tokens`,
                        data.metrics.tokenConsumption.summary,
                        data.metrics.tokenConsumption.series
                      )
                    }
                  />

                  <KpiCard
                    title="Total AI Investment"
                    delta={data.metrics.cost.summary}
                    formatType="currency"
                    description="Actual billed expenditure. Click to enter in-page breakdown of billable vs non-billable and regional spend."
                    comparisonLabel="vs prev period"
                    onClick={() =>
                      openDrilldown(
                        'total_investment',
                        'Total AI Investment',
                        'Financial spend distribution across billable projects, external clients, and regions',
                        `$${(data.metrics.cost.summary.current || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                        data.metrics.cost.summary,
                        data.metrics.cost.series
                      )
                    }
                  />

                  <KpiCard
                    title="Avg Daily AI Cost"
                    delta={data.metrics.avgDailyCost.summary}
                    formatType="currency"
                    description="Average cost per active day. Click to inspect daily cost run-rate and peak usage days."
                    comparisonLabel="vs prev period"
                    onClick={() =>
                      openDrilldown(
                        'avg_daily_cost',
                        'Avg Daily AI Cost',
                        'Daily spending volatility and active calendar day run-rate analysis',
                        `$${(data.metrics.avgDailyCost.summary.current || 0).toFixed(2)} / day`,
                        data.metrics.avgDailyCost.summary,
                        data.metrics.avgDailyCost.series
                      )
                    }
                  />

                  <KpiCard
                    title="Cost per Active User"
                    delta={data.metrics.costPerActiveUser?.summary}
                    formatType="currency"
                    description="Average spend per active developer seat. Click to view top power user spend rankings."
                    comparisonLabel="vs prev period"
                    onClick={() =>
                      openDrilldown(
                        'cost_per_user',
                        'Cost per Active User',
                        'Per-user seat expenditure and developer adoption rankings',
                        `$${(data.metrics.costPerActiveUser?.summary?.current || 0).toFixed(2)} / user`,
                        data.metrics.costPerActiveUser?.summary,
                        data.metrics.cost.series
                      )
                    }
                  />
                </div>

                {/* Executive Strategic Leadership Inferences Panel */}
                <ExecutiveInferencesPanel
                  summary={data.tokenCostSummary}
                  onSelectInference={(infId) => {
                    setInferenceInitialEntity(null);
                    setActiveInferenceDrilldown(infId);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                />

                {/* Multi-Tool Spend & Efficiency Comparison (ChatGPT vs Copilot vs Claude) */}
                <MultiToolComparisonPanel
                  summary={data.tokenCostSummary}
                  onDrilldown={(tool, userMail) => {
                    if (userMail) {
                      setInferenceInitialEntity({ type: 'user', name: userMail, label: userMail });
                    } else if (tool) {
                      const toolLabel =
                        tool.toLowerCase() === 'chatgpt'
                          ? 'ChatGPT Enterprise'
                          : tool.toLowerCase() === 'copilot'
                          ? 'GitHub Copilot Enterprise'
                          : tool.toLowerCase() === 'claude'
                          ? 'Claude Enterprise'
                          : tool;
                      setInferenceInitialEntity({ type: 'tool', name: tool, label: toolLabel });
                    } else {
                      setInferenceInitialEntity(null);
                    }
                    setActiveInferenceDrilldown('multi_tool_comparison');
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


