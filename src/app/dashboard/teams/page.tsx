'use client';

import { useState } from 'react';
import { useMetricsData } from '@/hooks/useMetricsData';
import { GlobalFilterBar } from '@/components/layout/GlobalFilterBar';
import { KpiCard } from '@/components/ui/KpiCard';
import { HierarchicalTable, HierGroup } from '@/components/ui/HierarchicalTable';
import { RoiDrilldownView, RoiDrilldownTarget } from '@/components/ui/RoiDrilldownView';
import { Building2, Layers } from 'lucide-react';
import { TokenCostSummary } from '@/lib/metrics/types';

const SERVICE_LINE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Consulting: { bg: 'bg-blue-500/15', text: 'text-blue-300', border: 'border-blue-500/30' },
  Tax: { bg: 'bg-amber-500/15', text: 'text-amber-300', border: 'border-amber-500/30' },
  Assurance: { bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  CBS: { bg: 'bg-purple-500/15', text: 'text-purple-300', border: 'border-purple-500/30' },
  'S&T': { bg: 'bg-cyan-500/15', text: 'text-cyan-300', border: 'border-cyan-500/30' },
};

export default function OrgAndRegionalPage() {
  const { filters, setFilters, data, loading } = useMetricsData();
  const [activeDrilldown, setActiveDrilldown] = useState<RoiDrilldownTarget | null>(null);

  const summary: TokenCostSummary | null = data?.tokenCostSummary ?? null;
  const serviceLines = summary?.byServiceLine || [];
  const subServiceLines = summary?.bySubServiceLine || [];
  const regions = summary?.byManagementRegion || [];

  const openDrilldown = (target: RoiDrilldownTarget) => {
    setActiveDrilldown(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const topServiceLine = serviceLines[0];
  const topRegion = regions[0];
  const topSubPractice = subServiceLines[0];

  // Every KPI card below compares its current value against that same
  // entity's own real previous-period value (e.g. this period's leading
  // Service Line vs. what that same Service Line spent last period) rather
  // than a fixed reference point.
  const previousDataAvailable = summary?.previousDataAvailable ?? false;
  const trendFor = (delta: number): 'up' | 'down' | 'neutral' =>
    !previousDataAvailable || Math.abs(delta) < 0.0001 ? 'neutral' : delta > 0 ? 'up' : 'down';
  const pctDeltaFor = (current: number, previous: number): number =>
    previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;

  const prevTotalCost = summary?.prevTotalCost || 0;
  const totalCostDelta = (summary?.totalCost || 0) - prevTotalCost;

  const prevTopServiceLineCost =
    summary?.prevByServiceLine?.find((s) => s.serviceLine === topServiceLine?.serviceLine)?.cost || 0;
  const topServiceLineDelta = (topServiceLine?.cost || 0) - prevTopServiceLineCost;

  const prevTopRegionCost =
    summary?.prevByManagementRegion?.find((r) => r.region === topRegion?.region)?.cost || 0;
  const topRegionDelta = (topRegion?.cost || 0) - prevTopRegionCost;

  const prevTopSubPracticeCost =
    summary?.prevBySubServiceLine?.find(
      (p) => p.serviceLine === topSubPractice?.serviceLine && p.subServiceLine === topSubPractice?.subServiceLine
    )?.cost || 0;
  const topSubPracticeDelta = (topSubPractice?.cost || 0) - prevTopSubPracticeCost;

  // Hierarchical breakdowns: Service Line -> its Sub-Service Line practices,
  // and Management Region -> its Countries, folded into one expandable table each
  // instead of two separate flat tables per relationship.
  const fmtCost = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtShare = (tokens: number) => `${((tokens / (summary?.totalTokenConsumption || 1)) * 100).toFixed(1)}%`;

  const serviceLineGroups: HierGroup[] = [...serviceLines]
    .sort((a: any, b: any) => b.tokens - a.tokens)
    .map((sl: any) => {
      const slStyle = SERVICE_LINE_COLORS[sl.serviceLine] || {
        bg: 'bg-ey-yellow/10',
        text: 'text-ey-yellow',
        border: 'border-ey-yellow/30',
      };
      const children = subServiceLines
        .filter((ssl: any) => ssl.serviceLine === sl.serviceLine)
        .sort((a: any, b: any) => b.tokens - a.tokens)
        .map((ssl: any) => ({
          id: ssl.subServiceLine,
          plainLabel: ssl.subServiceLine,
          users: `${ssl.userCount || '-'} active`,
          tokens: ssl.tokens.toLocaleString(),
          cost: fmtCost(ssl.cost),
          share: fmtShare(ssl.tokens),
        }));
      return {
        parent: {
          id: sl.serviceLine,
          badge: { label: sl.serviceLine, bg: slStyle.bg, textColor: slStyle.text, border: slStyle.border },
          users: `${sl.userCount || '-'} active`,
          tokens: sl.tokens.toLocaleString(),
          cost: fmtCost(sl.cost),
          share: fmtShare(sl.tokens),
        },
        children,
      };
    });

  // Stacked-chart equivalent of the hierarchical table above: parent as the bar,
  // its children as stacked segments, so the toggle can show composition without a separate section.
  const serviceLineChartRows = serviceLines.map((sl: any) => {
    const row: Record<string, any> = { label: sl.serviceLine, total: Number(sl.cost.toFixed(2)) };
    subServiceLines
      .filter((ssl: any) => ssl.serviceLine === sl.serviceLine)
      .forEach((ssl: any) => { row[ssl.subServiceLine] = Number(ssl.cost.toFixed(2)); });
    return row;
  });
  const serviceLineChartColumns = subServiceLines.map((ssl: any) => ssl.subServiceLine);

  return (
    <div className="flex-1 flex flex-col">
      <GlobalFilterBar filters={filters} onFilterChange={setFilters} filterOptions={data?.filterOptions} />

      <main className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        {activeDrilldown ? (
          <RoiDrilldownView
            target={activeDrilldown}
            summary={summary}
            onBack={() => setActiveDrilldown(null)}
            parentTitle="Service Line Analytics"
            filters={filters}
          />
        ) : (
          <>
            {/* Header Title Block */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-ey-card/50 border border-ey-border rounded-xl p-4 shadow-sm">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-ey-yellow/15 border border-ey-yellow/30 rounded-xl text-ey-yellow shrink-0">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-ey-light tracking-wide flex items-center gap-2.5">
                    <span>Service Line Analytics</span>
                  </h1>
                  <p className="text-xs text-ey-muted mt-0.5">
                    Unified view of token consumption and spend aggregated by Service Line and Sub-Practice. For a country-level breakdown, see Geo Pulse.
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2 text-xs bg-ey-black/60 border border-ey-border rounded-lg px-3 py-2 text-ey-light shrink-0 self-start sm:self-center">
                <Layers className="w-4 h-4 text-ey-yellow shrink-0" />
                <span className="font-mono text-[11px] text-ey-muted">
                  Dimensions: <strong>5 Service Lines</strong> · <strong>14 Practices</strong>
                </span>
              </div>
            </div>

            {loading || !summary ? (
              <div className="h-64 flex items-center justify-center text-ey-muted text-sm animate-pulse font-mono">
                Loading live organizational telemetry...
              </div>
            ) : (
              <>
                {/* Service Line Analytics KPI Cards with Direct Drilldown */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <KpiCard
                    title={topServiceLine ? `Top Spend: ${topServiceLine.serviceLine}` : 'Leading Service Line'}
                    delta={{
                      current: topServiceLine?.cost || 0,
                      previous: prevTopServiceLineCost,
                      absoluteDelta: topServiceLineDelta,
                      percentageDelta: Number(pctDeltaFor(topServiceLine?.cost || 0, prevTopServiceLineCost).toFixed(2)),
                      trend: trendFor(topServiceLineDelta),
                      previousDataAvailable,
                    }}
                    formatType="currency"
                    description={`Leading organizational expenditure (${((topServiceLine?.tokens / (summary.totalTokenConsumption || 1)) * 100).toFixed(1)}% of total). Click to drill down into raw usage logs.`}
                    onClick={() =>
                      topServiceLine &&
                      openDrilldown({
                        type: 'service_line',
                        id: topServiceLine.serviceLine,
                        title: `Service Line: ${topServiceLine.serviceLine}`,
                        subtitle: `Direct row-level records and workforce telemetry for ${topServiceLine.serviceLine}.`,
                        badge: 'Service Line',
                        filterCriteria: { serviceLine: topServiceLine.serviceLine },
                      })
                    }
                  />

                  <KpiCard
                    title={topRegion ? `Top Region: ${topRegion.region}` : 'Leading Region'}
                    delta={{
                      current: topRegion?.cost || 0,
                      previous: prevTopRegionCost,
                      absoluteDelta: topRegionDelta,
                      percentageDelta: Number(pctDeltaFor(topRegion?.cost || 0, prevTopRegionCost).toFixed(2)),
                      trend: trendFor(topRegionDelta),
                      previousDataAvailable,
                    }}
                    formatType="currency"
                    description={`Top management region (${((topRegion?.tokens / (summary.totalTokenConsumption || 1)) * 100).toFixed(1)}% regional share). Click to drill down into regional telemetry.`}
                    onClick={() =>
                      topRegion &&
                      openDrilldown({
                        type: 'region',
                        id: topRegion.region,
                        title: `Management Region: ${topRegion.region}`,
                        subtitle: `Direct row-level records and country distribution for ${topRegion.region}.`,
                        badge: 'Management Region',
                        filterCriteria: { region: topRegion.region },
                      })
                    }
                  />

                  <KpiCard
                    title={topSubPractice ? `Top Service Line: ${topSubPractice.subServiceLine}` : 'Leading Practice'}
                    delta={{
                      current: topSubPractice?.cost || 0,
                      previous: prevTopSubPracticeCost,
                      absoluteDelta: topSubPracticeDelta,
                      percentageDelta: Number(pctDeltaFor(topSubPractice?.cost || 0, prevTopSubPracticeCost).toFixed(2)),
                      trend: trendFor(topSubPracticeDelta),
                      previousDataAvailable,
                    }}
                    formatType="currency"
                    description={`Leading sub-practice by spend, within ${topSubPractice?.serviceLine || 'Consulting'} (${subServiceLines.length} practices active across ${serviceLines.length} service lines). Click to inspect this practice.`}
                    onClick={() =>
                      topSubPractice &&
                      openDrilldown({
                        type: 'sub_service_line',
                        id: topSubPractice.subServiceLine,
                        title: `Practice: ${topSubPractice.subServiceLine}`,
                        subtitle: `Practice-level telemetry records under ${topSubPractice.serviceLine}.`,
                        badge: topSubPractice.serviceLine,
                        filterCriteria: { subServiceLine: topSubPractice.subServiceLine },
                      })
                    }
                  />

                  <KpiCard
                    title="Total Org Token Spend"
                    delta={{
                      current: summary.totalCost,
                      previous: prevTotalCost,
                      absoluteDelta: totalCostDelta,
                      percentageDelta: Number(pctDeltaFor(summary.totalCost, prevTotalCost).toFixed(2)),
                      trend: trendFor(totalCostDelta),
                      previousDataAvailable,
                    }}
                    formatType="currency"
                    description="Total billed expenditure across all service lines, regions, and countries. Click to inspect entire live log stream."
                    onClick={() =>
                      openDrilldown({
                        type: 'metric',
                        id: 'efficiency',
                        title: 'Global Org Telemetry Stream',
                        subtitle: 'All active employee logs across all service lines and regions.',
                        badge: 'Global Overview',
                      })
                    }
                  />
                </div>

                {/* Service Line & Sub-Service Line Practices (consolidated, expandable) */}
                <HierarchicalTable
                  title="Service Line & Practice Breakdown"
                  subtitle="Every Service Line with its Sub-Service Line practices nested underneath — replaces two separate tables"
                  groups={serviceLineGroups}
                  parentColumnHeader="Service Line"
                  childColumnHeader="Practice"
                  chartRows={serviceLineChartRows}
                  chartColumns={serviceLineChartColumns}
                  chartMetric="cost"
                  chartMetricLabel="Total Cost ($)"
                  onParentClick={(id) => {
                    const sl = serviceLines.find((s: any) => s.serviceLine === id);
                    openDrilldown({
                      type: 'service_line',
                      id,
                      title: `Service Line: ${id}`,
                      subtitle: `Row-level usage events and workforce activity for ${id}.`,
                      badge: 'Service Line',
                      filterCriteria: { serviceLine: id },
                    });
                  }}
                  onChildClick={(parentId, id) =>
                    openDrilldown({
                      type: 'sub_service_line',
                      id,
                      title: `Practice: ${id}`,
                      subtitle: `Row-level records for ${id} practice (${parentId}).`,
                      badge: parentId,
                      filterCriteria: { subServiceLine: id },
                    })
                  }
                />
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
