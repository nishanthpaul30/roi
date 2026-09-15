'use client';

import { Suspense, useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMetricsData } from '@/hooks/useMetricsData';
import { GlobalFilterBar } from '@/components/layout/GlobalFilterBar';
import { DataTable, Column } from '@/components/ui/DataTable';
import type { CsvUsageRow } from '@/lib/data/csvTypes';
import { useRawRows } from '@/hooks/useRawRows';
import { Briefcase, ChevronRight, RotateCcw, ArrowUpRight, X, Search, Info } from 'lucide-react';
import { formatCompactCurrency as fmtCost, formatCompactNumber } from '@/lib/format';

interface LevelField {
  key: keyof CsvUsageRow;
  label: string;
}

interface Level {
  id: string;
  title: string;
  fields: LevelField[];
}

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

interface PathEntry {
  levelId: string;
  field: keyof CsvUsageRow;
  fieldLabel: string;
  value: string;
}

function summarize(rows: CsvUsageRow[], field: keyof CsvUsageRow) {
  const map = new Map<string, CsvUsageRow[]>();
  for (const r of rows) {
    const v = String(r[field] || 'Unknown').trim() || 'Unknown';
    if (!map.has(v)) map.set(v, []);
    map.get(v)!.push(r);
  }
  return Array.from(map.entries())
    .map(([value, groupRows]) => ({
      value,
      rowCount: groupRows.length,
      // Active = someone who actually used the tool. A License row records a
      // held seat, not activity, so it must not inflate this count.
      userCount: new Set(
        groupRows
          .filter((r) => r.calculationMethod === 'Usage' && r.tokenConsumption > 0)
          .map((r) => r.userMail.toLowerCase())
      ).size,
      tokens: Math.round(groupRows.reduce((s, r) => s + r.tokenConsumption, 0)),
      cost: Number(groupRows.reduce((s, r) => s + r.cost, 0).toFixed(2)),
    }))
    .sort((a, b) => b.cost - a.cost);
}

function EngagementAnalytics() {
  const { filters, setFilters, data } = useMetricsData();
  const { rows: baseRows, loading: rowsLoading } = useRawRows(filters);
  const router = useRouter();
  const searchParams = useSearchParams();

  const userParam = (searchParams.get('user') || '').toLowerCase().trim();
  const [path, setPath] = useState<PathEntry[]>([]);
  // Finds a specific engagement in the level-1 list. There are ~400 codes, so
  // scrolling for a known one is the slow path.
  const [codeQuery, setCodeQuery] = useState('');

  // Arriving from a different user's row has to restart the drilldown — the
  // engagement path from the previous user rarely exists under the new one.
  useEffect(() => {
    setPath([]);
    setCodeQuery('');
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
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'Rows Matching Path', value: formatCompactNumber(totals.rowCount), info: '' },
            { label: 'Engagement Codes', value: formatCompactNumber(totals.engagements), info: '' },
            { label: 'Active Users', value: formatCompactNumber(totals.users), info: 'Users with at least one metered Usage row. Held licenses with no activity are excluded.' },
            { label: 'Token Consumption', value: formatCompactNumber(totals.tokens), info: '' },
            {
              label: 'Total Cost',
              value: fmtCost(totals.cost),
              info: `Total AI Investment for this path: ${fmtCost(totals.usageCost)} metered usage + ${fmtCost(totals.licenseCost)} license fees.`,
            },
          ].map((tile) => (
            <div key={tile.label} className="bg-ey-card border border-ey-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-[10px] uppercase font-semibold text-ey-muted">{tile.label}</p>
                {tile.info && (
                  <div className="group/info relative cursor-pointer shrink-0">
                    <Info className="w-3.5 h-3.5 text-ey-muted hover:text-ey-light" />
                    <div className="absolute right-0 top-5 hidden group-hover/info:block bg-ey-black text-ey-light text-[11px] p-2 rounded shadow-xl border border-ey-border w-52 z-50">
                      {tile.info}
                    </div>
                  </div>
                )}
              </div>
              <p className={`text-lg font-bold text-ey-light ${rowsLoading ? 'opacity-40 animate-pulse' : ''}`}>
                {rowsLoading ? '—' : tile.value}
              </p>
            </div>
          ))}
        </div>

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
        ) : (
          <div className="space-y-6">
            {currentLevel.fields.map((f) => {
              const allGroups = summarize(pathRows, f.key);
              // Search applies to the engagement-code step only — that's the id
              // people arrive knowing; the levels below it are short lists.
              const isCodeLevel = currentLevel.id === 'engagementCode';
              const q = codeQuery.trim().toLowerCase();
              const groups = isCodeLevel && q
                ? allGroups.filter((g) => g.value.toLowerCase().includes(q))
                : allGroups;

              // Enter on a query that narrows to exactly one code drills straight in.
              const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
                if (e.key === 'Enter' && groups.length === 1) {
                  selectValue(currentLevel.id, f.key, f.label, groups[0].value);
                }
              };

              return (
                <div key={f.key} className="bg-ey-card border border-ey-border rounded-xl p-5 shadow-sm">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-ey-light mb-1">
                        Level {path.length + 1}: {f.label}
                      </h3>
                      <p className="text-xs text-ey-muted">
                        Click a value to continue drilling.{' '}
                        {isCodeLevel && q
                          ? `${groups.length} of ${allGroups.length} engagement codes match "${codeQuery.trim()}".`
                          : `${allGroups.length} distinct value${allGroups.length === 1 ? '' : 's'} at this step.`}
                      </p>
                    </div>

                    {isCodeLevel && (
                      <div className="relative shrink-0">
                        <Search className="w-3.5 h-3.5 text-ey-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          id="engagement-code-search"
                          type="text"
                          value={codeQuery}
                          onChange={(e) => setCodeQuery(e.target.value)}
                          onKeyDown={onSearchKeyDown}
                          placeholder="Search engagement code…"
                          aria-label="Search engagement code"
                          className="h-9 w-60 bg-ey-black border border-ey-border text-ey-light text-xs rounded-lg pl-8 pr-8 focus:outline-none focus:border-ey-yellow"
                        />
                        {codeQuery && (
                          <button
                            onClick={() => setCodeQuery('')}
                            aria-label="Clear engagement code search"
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-ey-muted hover:text-ey-yellow transition"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {groups.length === 0 ? (
                    <p className="text-xs text-ey-muted py-6 text-center">
                      {isCodeLevel && q
                        ? `No engagement code matches "${codeQuery.trim()}".`
                        : 'No data matches the current path.'}
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-ey-light">
                        <thead className="bg-ey-black/80 text-[11px] uppercase font-semibold text-ey-muted border-b border-ey-border">
                          <tr>
                            <th className="px-4 py-2.5">{f.label}</th>
                            <th className="px-4 py-2.5 text-right">Active Users</th>
                            <th className="px-4 py-2.5 text-right">Token Consumption</th>
                            <th className="px-4 py-2.5 text-right">Total Cost ($)</th>
                            <th className="px-4 py-2.5"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-ey-border">
                          {groups.map((g) => (
                            <tr
                              key={g.value}
                              onClick={() => selectValue(currentLevel.id, f.key, f.label, g.value)}
                              className="hover:bg-ey-card-hover/80 transition cursor-pointer group"
                            >
                              <td className="px-4 py-2.5 font-semibold group-hover:text-ey-yellow flex items-center gap-1.5">
                                {g.value}
                                <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 text-ey-yellow transition-opacity" />
                              </td>
                              <td className="px-4 py-2.5 text-right">{g.userCount}</td>
                              <td className="px-4 py-2.5 text-right font-mono">{formatCompactNumber(g.tokens)}</td>
                              <td className="px-4 py-2.5 text-right font-mono font-bold">{fmtCost(g.cost)}</td>
                              <td className="px-4 py-2.5 text-right text-ey-muted">Drill Down</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
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
