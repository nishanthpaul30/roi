'use client';

import { useMemo, useState } from 'react';
import { useMetricsData } from '@/hooks/useMetricsData';
import { GlobalFilterBar } from '@/components/layout/GlobalFilterBar';
import { DataTable, Column } from '@/components/ui/DataTable';
import type { CsvUsageRow } from '@/lib/data/csvTypes';
import { useRawRows } from '@/hooks/useRawRows';
import Link from 'next/link';
import { GitBranch, ChevronRight, RotateCcw, ArrowUpRight, TableProperties, Globe2, Briefcase } from 'lucide-react';
import { GeoHierarchyMap } from '@/components/ui/GeoHierarchyMap';
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

// The required application-wide hierarchy — always followed while drilling down:
// CT/Non-CT -> Country -> Service Line -> Sub-Service Line 1 -> Sub-Service Line 2 ->
// Users.
//
// Users keys on userMail, not displayName: 27 names in the current dataset are
// shared by more than one email address, and grouping by name would silently
// merge those people into one row.
const LEVELS: Level[] = [
  { id: 'ctNonCt', title: 'CT / Non-CT', fields: [{ key: 'ctNonCt', label: 'CT / Non-CT' }] },
  { id: 'country', title: 'Country', fields: [{ key: 'country', label: 'Country' }] },
  { id: 'serviceLine', title: 'Service Line', fields: [{ key: 'orgServiceLine', label: 'Service Line' }] },
  { id: 'subServiceLine1', title: 'Sub-Service Line 1', fields: [{ key: 'subServiceLine1', label: 'Sub-Service Line 1' }] },
  { id: 'subServiceLine2', title: 'Sub-Service Line 2', fields: [{ key: 'subServiceLine2', label: 'Sub-Service Line 2' }] },
  { id: 'user', title: 'Users', fields: [{ key: 'userMail', label: 'User' }] },
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
      userCount: new Set(groupRows.map((r) => r.userMail.toLowerCase())).size,
      tokens: Math.round(groupRows.reduce((s, r) => s + r.tokenConsumption, 0)),
      cost: Number(groupRows.reduce((s, r) => s + r.cost, 0).toFixed(2)),
    }))
    .sort((a, b) => b.cost - a.cost);
}

export default function HierarchyDrilldownPage() {
  const { filters, setFilters, data } = useMetricsData();
  const [path, setPath] = useState<PathEntry[]>([]);
  const [viewMode, setViewMode] = useState<'table' | 'map'>('map');
  const [combinedSegment, setCombinedSegment] = useState<string | null>(null);

  // The server already applies the global filters, so these rows arrive scoped.
  const { rows: baseRows, loading: rowsLoading } = useRawRows(filters);

  // Every held tool gets a 'License' row every month regardless of activity
  // (flat seat fee, tokenConsumption always 0). Cost/token totals throughout
  // this hierarchy must sum only genuine Usage rows, or seat fees silently
  // blend into what's presented as usage spend (e.g. total cost far exceeding
  // summary.totalCost elsewhere in the app).
  const usageRows = useMemo(
    () => baseRows.filter((r) => r.calculationMethod === 'Usage' && r.tokenConsumption > 0),
    [baseRows]
  );

  const pathRows = useMemo(
    () => usageRows.filter((r) => path.every((p) => String(r[p.field] || '').trim() === p.value)),
    [usageRows, path]
  );

  const currentLevel = LEVELS[path.length];
  const isComplete = !currentLevel;

  const overallTotals = useMemo(() => {
    const tokens = Math.round(pathRows.reduce((s, r) => s + r.tokenConsumption, 0));
    const cost = Number(pathRows.reduce((s, r) => s + r.cost, 0).toFixed(2));
    const users = new Set(pathRows.map((r) => r.userMail.toLowerCase())).size;
    return { tokens, cost, users, rowCount: pathRows.length };
  }, [pathRows]);

  const selectValue = (levelId: string, field: keyof CsvUsageRow, fieldLabel: string, value: string) => {
    setPath((prev) => [...prev, { levelId, field, fieldLabel, value }]);
  };

  // Combined Level 1+2 landing screen: a CT/Non-CT lens over the same country map,
  // so the very first thing shown is the map rather than a plain CT/Non-CT table.
  const ctNonCtGroups = useMemo(() => summarize(usageRows, 'ctNonCt'), [usageRows]);
  const effectiveSegment = combinedSegment ?? ctNonCtGroups[0]?.value ?? null;
  const combinedCountryGroups = useMemo(
    () => (effectiveSegment ? summarize(usageRows.filter((r) => r.ctNonCt === effectiveSegment), 'country') : []),
    [usageRows, effectiveSegment]
  );
  const selectCombined = (country: string) => {
    if (!effectiveSegment) return;
    selectValue('ctNonCt', 'ctNonCt', 'CT / Non-CT', effectiveSegment);
    selectValue('country', 'country', 'Country', country);
  };

  const jumpTo = (index: number) => {
    // index = -1 resets to root; otherwise keep entries [0, index]
    setPath((prev) => prev.slice(0, index + 1));
  };

  const rawColumns: Column<CsvUsageRow>[] = [
    { header: 'Month', accessorKey: 'monthYear', cell: (r) => r.monthYear.replace(/_/g, ' ') },
    { header: 'User', accessorKey: 'displayName' },
    { header: 'AI Tool', accessorKey: 'aiTool' },
    { header: 'Tokens', accessorKey: 'tokenConsumption', cell: (r) => formatCompactNumber(r.tokenConsumption) },
    { header: 'Cost ($)', accessorKey: 'cost', cell: (r) => fmtCost(r.cost) },
    { header: 'Engagement Competency', accessorKey: 'engagementCompetency' },
  ];

  return (
    <div className="flex-1 flex flex-col">
      <GlobalFilterBar filters={filters} onFilterChange={setFilters} filterOptions={data?.filterOptions} />

      <main className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-ey-card/50 border border-ey-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-purple-500/15 border border-purple-500/30 rounded-xl text-purple-400 shrink-0">
              <GitBranch className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-ey-light tracking-wide">Geo Pulse</h1>
              <p className="text-xs text-ey-muted mt-0.5">
                Explore spend by geography and organization, one level at a time — individual names only appear once you reach the final step.
              </p>
            </div>
          </div>
          {path.length > 0 && (
            <button
              onClick={() => jumpTo(-1)}
              className="flex items-center gap-1.5 text-xs font-semibold text-ey-muted hover:text-ey-yellow bg-ey-black border border-ey-border px-3 py-1.5 rounded-lg transition shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Path
            </button>
          )}
        </div>

        {/* Breadcrumb */}
        <div className="bg-ey-card border border-ey-border rounded-xl p-4 flex flex-wrap items-center gap-2 text-xs">
          <button
            onClick={() => jumpTo(-1)}
            className={`px-2.5 py-1 rounded-md font-semibold transition ${
              path.length === 0 ? 'bg-ey-yellow/20 text-ey-yellow border border-ey-yellow/40' : 'text-ey-muted hover:text-ey-light'
            }`}
          >
            All Data
          </button>
          {path.map((p, idx) => (
            <span key={idx} className="flex items-center gap-2">
              <ChevronRight className="w-3.5 h-3.5 text-ey-muted" />
              <button
                onClick={() => jumpTo(idx)}
                className={`px-2.5 py-1 rounded-md font-semibold transition ${
                  idx === path.length - 1 ? 'bg-ey-yellow/20 text-ey-yellow border border-ey-yellow/40' : 'text-ey-muted hover:text-ey-light'
                }`}
                title={p.fieldLabel}
              >
                {p.value}
              </button>
            </span>
          ))}
        </div>

        {/* Live totals for current path */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Rows Matching Path', value: formatCompactNumber(overallTotals.rowCount) },
            { label: 'Active Users', value: formatCompactNumber(overallTotals.users) },
            { label: 'Token Consumption', value: formatCompactNumber(overallTotals.tokens) },
            { label: 'Total Cost', value: fmtCost(overallTotals.cost) },
          ].map((tile) => (
            <div key={tile.label} className="bg-ey-card border border-ey-border rounded-xl p-4">
              <p className="text-[10px] uppercase font-semibold text-ey-muted mb-1">{tile.label}</p>
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
        ) : isComplete ? (
          <DataTable
            title={`Raw Telemetry Rows Matching Full Hierarchy Path (${pathRows.length} rows)`}
            data={pathRows}
            columns={rawColumns}
            pageSize={15}
          />
        ) : path.length === 0 ? (
          <div className="bg-ey-card border border-ey-border rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-ey-light mb-1">
                  Level 1 &amp; 2: CT / Non-CT &rarr; Country
                </h3>
                <p className="text-xs text-ey-muted">
                  Pick a lens below, then click a country to jump straight to Level 3.
                </p>
              </div>

              {combinedCountryGroups.length > 0 && (
                <div className="flex items-center bg-ey-black/60 border border-ey-border rounded-lg p-0.5 shrink-0">
                  <button
                    onClick={() => setViewMode('table')}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition ${
                      viewMode === 'table' ? 'bg-ey-yellow text-ey-black shadow-sm' : 'text-ey-muted hover:text-ey-light'
                    }`}
                  >
                    <TableProperties className="w-3.5 h-3.5" />
                    Table
                  </button>
                  <button
                    onClick={() => setViewMode('map')}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition ${
                      viewMode === 'map' ? 'bg-ey-yellow text-ey-black shadow-sm' : 'text-ey-muted hover:text-ey-light'
                    }`}
                  >
                    <Globe2 className="w-3.5 h-3.5" />
                    Map
                  </button>
                </div>
              )}
            </div>

            {/* CT / Non-CT lens selector — filters which countries the map/table below shows */}
            <div className="flex flex-wrap items-center gap-2">
              {ctNonCtGroups.map((g) => (
                <button
                  key={g.value}
                  onClick={() => setCombinedSegment(g.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                    effectiveSegment === g.value
                      ? 'bg-ey-yellow text-ey-black border-ey-yellow'
                      : 'bg-ey-black/60 text-ey-muted border-ey-border hover:text-ey-light'
                  }`}
                >
                  {g.value} <span className="opacity-70 font-normal">({g.userCount} users &middot; {fmtCost(g.cost)})</span>
                </button>
              ))}
            </div>

            {combinedCountryGroups.length === 0 ? (
              <p className="text-xs text-ey-muted py-6 text-center">No data for this lens.</p>
            ) : viewMode === 'map' ? (
              <GeoHierarchyMap groups={combinedCountryGroups} onSelect={selectCombined} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-ey-light">
                  <thead className="bg-ey-black/80 text-[11px] uppercase font-semibold text-ey-muted border-b border-ey-border">
                    <tr>
                      <th className="px-4 py-2.5">Country</th>
                      <th className="px-4 py-2.5 text-right">Active Users</th>
                      <th className="px-4 py-2.5 text-right">Token Consumption</th>
                      <th className="px-4 py-2.5 text-right">Total Cost ($)</th>
                      <th className="px-4 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ey-border">
                    {combinedCountryGroups.map((g) => (
                      <tr
                        key={g.value}
                        onClick={() => selectCombined(g.value)}
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
        ) : (
          <div className="space-y-6">
            {currentLevel.fields.map((f) => {
              const groups = summarize(pathRows, f.key);
              const isGeoField = f.key === 'country';
              return (
                <div key={f.key} className="bg-ey-card border border-ey-border rounded-xl p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
                    <div>
                      <h3 className="text-sm font-bold text-ey-light mb-1">
                        Level {path.length + 1}: {f.label}
                      </h3>
                      <p className="text-xs text-ey-muted">
                        Click a value to continue drilling. {groups.length} distinct value{groups.length === 1 ? '' : 's'} at this step.
                      </p>
                    </div>

                    {isGeoField && groups.length > 0 && (
                      <div className="flex items-center bg-ey-black/60 border border-ey-border rounded-lg p-0.5 shrink-0">
                        <button
                          onClick={() => setViewMode('table')}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition ${
                            viewMode === 'table' ? 'bg-ey-yellow text-ey-black shadow-sm' : 'text-ey-muted hover:text-ey-light'
                          }`}
                        >
                          <TableProperties className="w-3.5 h-3.5" />
                          Table
                        </button>
                        <button
                          onClick={() => setViewMode('map')}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition ${
                            viewMode === 'map' ? 'bg-ey-yellow text-ey-black shadow-sm' : 'text-ey-muted hover:text-ey-light'
                          }`}
                        >
                          <Globe2 className="w-3.5 h-3.5" />
                          Map
                        </button>
                      </div>
                    )}
                  </div>

                  {groups.length === 0 ? (
                    <p className="text-xs text-ey-muted py-6 text-center">No data matches the current path.</p>
                  ) : isGeoField && viewMode === 'map' ? (
                    <GeoHierarchyMap
                      groups={groups}
                      onSelect={(value) => selectValue(currentLevel.id, f.key, f.label, value)}
                    />
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
                              <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                {currentLevel.id === 'user' ? (
                                  // The org hierarchy ends at the user; this hands off to the
                                  // engagement-side chain for that same person.
                                  <Link
                                    href={`/dashboard/engagements?user=${encodeURIComponent(g.value)}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1 text-ey-yellow hover:underline font-semibold"
                                  >
                                    <Briefcase className="w-3 h-3" />
                                    Engagements
                                  </Link>
                                ) : (
                                  <span className="text-ey-muted">Drill Down</span>
                                )}
                              </td>
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
