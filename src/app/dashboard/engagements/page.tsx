'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMetricsData } from '@/hooks/useMetricsData';
import { GlobalFilterBar } from '@/components/layout/GlobalFilterBar';
import { DataTable, Column } from '@/components/ui/DataTable';
import type { CsvUsageRow } from '@/lib/data/csvTypes';
import { useRawRows } from '@/hooks/useRawRows';
import { Briefcase, ChevronRight, RotateCcw, X } from 'lucide-react';
import { formatCompactCurrency as fmtCost, formatCompactNumber } from '@/lib/format';
import { summarize, type Level, type PathEntry } from '@/lib/hierarchyDrilldown';
import { EngagementCodeRankingsPanel } from '@/components/ui/EngagementCodeRankingsPanel';
import { StatTile } from '@/components/ui/StatTile';
import { GroupsTable } from '@/components/ui/GroupsTable';
import { EngagementHoursSavedPanel } from '@/components/ui/EngagementHoursSavedPanel';
import { HoursSavedOverviewPanel } from '@/components/ui/HoursSavedOverviewPanel';
import type { TokenCostSummary } from '@/lib/metrics/types';
import { DEFAULT_DEV_HOUR_RATE_USD } from '@/lib/metrics/roiCalc';

type EngagementHoursSavedRow = NonNullable<TokenCostSummary['hoursSavedByEngagement']>[number];

// The engagement-side hierarchy, picked up where the org hierarchy (CT/Non-CT ->
// Country -> Service Line -> Sub-Service Line 1 -> Sub-Service Line 2 -> Users)
// leaves off. A user row there links here, carrying ?user=<email>, so the chain
// reads end to end: who spent it, then which client engagement it went to.
const LEVELS: Level[] = [
  { id: 'engagementCode', title: 'Engagement Code', fields: [{ key: 'projectCode', label: 'Engagement Code' }] },
  { id: 'engagementSuperRegion', title: 'Engagement Super Region', fields: [{ key: 'engagementSuperRegion', label: 'Engagement Super Region' }] },
  { id: 'engagementServiceLine', title: 'Engagement Service Line', fields: [{ key: 'engagementServiceLine', label: 'Engagement Service Line' }] },
  { id: 'engagementSubServiceLine', title: 'Engagement Sub-Service Line', fields: [{ key: 'engagementSubServiceLine', label: 'Engagement Sub-Service Line' }] },
  { id: 'engagementCompetency', title: 'Engagement Competency', fields: [{ key: 'engagementCompetency', label: 'Engagement Competency' }] },
];

function EngagementAnalytics() {
  const { filters, setFilters, data } = useMetricsData();
  const { rows: baseRows, loading: rowsLoading } = useRawRows(filters);
  const router = useRouter();
  const searchParams = useSearchParams();

  const userParam = (searchParams.get('user') || '').toLowerCase().trim();
  const [path, setPath] = useState<PathEntry[]>([]);
  // Shared between the overview (Matrix/Table) and the per-engagement
  // drilldown, so adjusting it anywhere updates ROI consistently everywhere
  // Hours Saved is shown -- see lib/metrics/roiCalc.ts.
  const [devHourRate, setDevHourRate] = useState<number>(DEFAULT_DEV_HOUR_RATE_USD);

  // Arriving from a different user's row has to restart the drilldown — the
  // engagement path from the previous user rarely exists under the new one.
  useEffect(() => {
    setPath([]);
  }, [userParam]);

  // Costs here are Total AI Investment (Usage + License rows), matching the
  // Executive Overview and ROI pages. License rows carry an engagement code, so
  // seat fees attribute to a real engagement rather than being dropped.
  const usageRows = baseRows;

  const scopedRows = useMemo(
    () => (userParam ? usageRows.filter((r) => (r.userMail || '').toLowerCase() === userParam) : usageRows),
    [usageRows, userParam]
  );

  const scopedUserName = useMemo(() => {
    if (!userParam) return '';
    return scopedRows[0]?.displayName || userParam;
  }, [scopedRows, userParam]);

  const pathRows = useMemo(
    () => scopedRows.filter((r) => path.every((p) => String(r[p.field] || 'Unknown').trim() === p.value)),
    [scopedRows, path]
  );

  const currentLevel = LEVELS[path.length];
  const isComplete = !currentLevel;

  const selectValue = (levelId: string, field: keyof CsvUsageRow, fieldLabel: string, value: string) => {
    setPath((prev) => [...prev, { levelId, field, fieldLabel, value }]);
  };
  const jumpTo = (index: number) => setPath((prev) => prev.slice(0, index + 1));

  const clearUserScope = () => router.push('/dashboard/engagements');

  const totals = useMemo(
    () => ({
      rowCount: pathRows.length,
      users: new Set(
        pathRows.filter((r) => r.calculationMethod === 'Usage' && r.tokenConsumption > 0).map((r) => r.userMail.toLowerCase())
      ).size,
      engagements: new Set(pathRows.map((r) => r.projectCode)).size,
      tokens: Math.round(pathRows.reduce((s, r) => s + r.tokenConsumption, 0)),
      cost: Number(pathRows.reduce((s, r) => s + r.cost, 0).toFixed(2)),
      usageCost: Number(
        pathRows.filter((r) => r.calculationMethod === 'Usage').reduce((s, r) => s + r.cost, 0).toFixed(2)
      ),
      licenseCost: Number(
        pathRows.filter((r) => r.calculationMethod === 'License').reduce((s, r) => s + r.cost, 0).toFixed(2)
      ),
    }),
    [pathRows]
  );

  // Hours Saved (actuals-planned-overall-*.csv) is keyed by Engagement Code, not by the
  // Super Region / Service Line / Competency levels below it -- so it's
  // scoped to whichever Engagement Code was picked at Level 1, and stays
  // visible through every deeper level of that same engagement's path.
  const selectedEngagementCode = path[0]?.value;
  const allHoursSavedRows: EngagementHoursSavedRow[] = data?.tokenCostSummary?.hoursSavedByEngagement || [];
  const hoursSavedRows = useMemo(
    () => allHoursSavedRows.filter((r) => r.projectCode === selectedEngagementCode),
    [allHoursSavedRows, selectedEngagementCode]
  );

  const rawColumns: Column<CsvUsageRow>[] = [
    { header: 'Month', accessorKey: 'monthYear', cell: (r) => r.monthYear.replace(/_/g, ' ') },
    { header: 'User', accessorKey: 'displayName' },
    { header: 'AI Tool', accessorKey: 'aiTool' },
    { header: 'Engagement Code', accessorKey: 'projectCode' },
    { header: 'Billable', accessorKey: 'billableFlag', cell: (r) => (r.billableFlag === 'True' ? 'Yes' : 'No') },
    { header: 'Tokens', accessorKey: 'tokenConsumption', cell: (r) => formatCompactNumber(r.tokenConsumption) },
    { header: 'Cost ($)', accessorKey: 'cost', cell: (r) => fmtCost(r.cost) },
  ];

  return (
    <div className="flex-1 flex flex-col">
      <GlobalFilterBar filters={filters} onFilterChange={setFilters} filterOptions={data?.filterOptions} />

      <main className="flex-1 p-6 space-y-6 overflow-y-auto">
        <div>
          <h1 className="text-xl font-bold text-ey-light flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-ey-yellow" />
            Engagement Analytics
          </h1>
          <p className="text-xs text-ey-muted mt-1">
            Trace spend to the client engagement behind it &mdash; Engagement Code &rarr; Super Region &rarr; Service
            Line &rarr; Sub-Service Line &rarr; Competency.
          </p>
        </div>

        {/* Hours Saved & Cost Efficiency — shown on the main screen itself,
            before any drilldown, since it's a headline feature and
            shouldn't be hidden behind navigating into a specific engagement.
            Hidden once scoped to a single user, since Hours Saved isn't
            tracked at the user level. */}
        {path.length === 0 && !userParam && (
          <HoursSavedOverviewPanel
            rows={data?.tokenCostSummary?.hoursSavedByEngagement || []}
            onSelectEngagement={(code) => selectValue('engagementCode', 'projectCode', 'Engagement Code', code)}
            devHourRate={devHourRate}
            onDevHourRateChange={setDevHourRate}
          />
        )}

        {/* User scope chip — present when arriving from a user row */}
        {userParam && (
          <div className="flex items-center gap-2 bg-ey-yellow/10 border border-ey-yellow/40 rounded-xl px-4 py-2.5">
            <span className="text-[10px] uppercase font-semibold text-ey-muted">Scoped to user</span>
            <span className="text-xs font-bold text-ey-light">{scopedUserName}</span>
            <span className="text-[11px] text-ey-muted font-mono">{userParam}</span>
            <button
              onClick={clearUserScope}
              className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-ey-muted hover:text-ey-yellow transition"
            >
              <X className="w-3 h-3" />
              Clear, show all users
            </button>
          </div>
        )}

        {/* Breadcrumb */}
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <button
            onClick={() => jumpTo(-1)}
            className={`px-2.5 py-1 rounded-md font-semibold transition ${
              path.length === 0
                ? 'bg-ey-yellow/20 text-ey-yellow border border-ey-yellow/40'
                : 'text-ey-muted hover:text-ey-light'
            }`}
          >
            All Engagements
          </button>
          {path.map((p, idx) => (
            <span key={idx} className="flex items-center gap-1.5">
              <ChevronRight className="w-3 h-3 text-ey-muted" />
              <button
                onClick={() => jumpTo(idx)}
                title={p.fieldLabel}
                className={`px-2.5 py-1 rounded-md font-semibold transition ${
                  idx === path.length - 1
                    ? 'bg-ey-yellow/20 text-ey-yellow border border-ey-yellow/40'
                    : 'text-ey-muted hover:text-ey-light'
                }`}
              >
                {p.value}
              </button>
            </span>
          ))}
          {path.length > 0 && (
            <button
              onClick={() => jumpTo(-1)}
              className="flex items-center gap-1 text-[10px] font-semibold text-ey-muted hover:text-ey-yellow bg-ey-black border border-ey-border px-2.5 py-1.5 rounded-lg transition"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          )}
        </div>

        {/* Live totals for the current path */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile
            label="Engagement Codes"
            value={formatCompactNumber(totals.engagements)}
            subtitle="Unique client projects"
            loading={rowsLoading}
          />
          <StatTile
            label="Active Users"
            value={formatCompactNumber(totals.users)}
            subtitle="With metered activity"
            tooltip="Users with at least one metered Usage entry. Held licenses with no activity are excluded."
            loading={rowsLoading}
          />
          <StatTile
            label="Token Consumption"
            value={formatCompactNumber(totals.tokens)}
            subtitle={`${totals.tokens.toLocaleString()} tokens`}
            loading={rowsLoading}
          />
          <StatTile
            label="Total Cost"
            value={fmtCost(totals.cost)}
            subtitle={`${fmtCost(totals.usageCost)} usage · ${fmtCost(totals.licenseCost)} license`}
            tooltip={`Total AI Investment for this path: ${fmtCost(totals.usageCost)} metered usage + ${fmtCost(totals.licenseCost)} license fees.`}
            loading={rowsLoading}
          />
        </div>

        {selectedEngagementCode && (
          <EngagementHoursSavedPanel rows={hoursSavedRows} engagementCode={selectedEngagementCode} devHourRate={devHourRate} />
        )}

        {rowsLoading ? (
          <div className="h-64 flex items-center justify-center text-ey-muted text-sm animate-pulse">
            Loading telemetry rows...
          </div>
        ) : scopedRows.length === 0 ? (
          <div className="bg-ey-card border border-ey-border rounded-xl p-8 text-center">
            <p className="text-sm text-ey-light font-semibold mb-1">No engagement activity for this selection</p>
            <p className="text-xs text-ey-muted">
              {userParam
                ? 'This user has no usage rows in the current filter range. Try widening the filters or clearing the user scope.'
                : 'No usage rows match the current filters.'}
            </p>
          </div>
        ) : isComplete ? (
          <DataTable
            title={`Raw Telemetry Rows Matching Full Engagement Path (${pathRows.length} rows)`}
            data={pathRows}
            columns={rawColumns}
            pageSize={15}
          />
        ) : currentLevel.id === 'engagementCode' ? (
          /* Level 1: Engagement Code — replaced by the Engagement Code
             Telemetry & Spend Rankings panel (relocated from the ROI page).
             Selecting a row continues the same path-based drilldown as
             every other level below: it pushes the code into `path` via
             selectValue, advancing to Level 2 (Engagement Super Region). */
          <EngagementCodeRankingsPanel
            data={summarize(pathRows, 'projectCode').map((g) => ({
              projectCode: g.value,
              tokens: g.tokens,
              cost: g.cost,
              userCount: g.userCount,
            }))}
            levelLabel={`Level ${path.length + 1}: Engagement Code`}
            onSelectProject={(projectCode) =>
              selectValue('engagementCode', 'projectCode', 'Engagement Code', projectCode)
            }
          />
        ) : (
          <div className="space-y-6">
            {currentLevel.fields.map((f) => {
              const groups = summarize(pathRows, f.key);

              return (
                <div key={f.key} className="bg-ey-card border border-ey-border rounded-xl p-5 shadow-sm">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-ey-light mb-1">
                        Level {path.length + 1}: {f.label}
                      </h3>
                      <p className="text-xs text-ey-muted">
                        Click a value to continue drilling. {groups.length} distinct value{groups.length === 1 ? '' : 's'} at this step.
                      </p>
                    </div>
                  </div>

                  {groups.length === 0 ? (
                    <p className="text-xs text-ey-muted py-6 text-center">No data matches the current path.</p>
                  ) : (
                    <GroupsTable
                      groups={groups}
                      labelHeader={f.label}
                      onSelect={(value) => selectValue(currentLevel.id, f.key, f.label, value)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default function EngagementAnalyticsPage() {
  // useSearchParams needs a Suspense boundary during prerender.
  return (
    <Suspense fallback={<div className="flex-1 p-6 text-sm text-ey-muted animate-pulse">Loading…</div>}>
      <EngagementAnalytics />
    </Suspense>
  );
}
