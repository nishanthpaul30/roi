'use client';

import { useEffect, useMemo, useState } from 'react';
import { CsvUsageRow } from '@/lib/data/csvLoader';
import { ChevronRight, RotateCcw, ArrowUpRight, GitBranch } from 'lucide-react';

interface LevelField {
  key: keyof CsvUsageRow;
  label: string;
}

interface Level {
  id: string;
  fields: LevelField[];
}

// The required application-wide hierarchy — always followed before any user-level
// detail is shown: CT/Non-CT -> Country -> Service Line -> Sub-Service Line 1 ->
// Sub-Service Line 2 -> Engagement Code -> Engagement Super Region -> Engagement
// Service Line -> Engagement Sub Service Line -> Engagement Competency -> User.
const LEVELS: Level[] = [
  { id: 'ctNonCt', fields: [{ key: 'ctNonCt', label: 'CT / Non-CT' }] },
  { id: 'country', fields: [{ key: 'country', label: 'Country' }] },
  { id: 'serviceLine', fields: [{ key: 'orgServiceLine', label: 'Service Line' }] },
  { id: 'subServiceLine1', fields: [{ key: 'subServiceLine1', label: 'Sub-Service Line 1' }] },
  { id: 'subServiceLine2', fields: [{ key: 'subServiceLine2', label: 'Sub-Service Line 2' }] },
  { id: 'engagementCode', fields: [{ key: 'projectCode', label: 'Engagement Code' }] },
  { id: 'engagementSuperRegion', fields: [{ key: 'engagementSuperRegion', label: 'Engagement Super Region' }] },
  { id: 'engagementServiceLine', fields: [{ key: 'engagementServiceLine', label: 'Engagement Service Line' }] },
  { id: 'engagementSubServiceLine', fields: [{ key: 'engagementSubServiceLine', label: 'Engagement Sub Service Line' }] },
  { id: 'engagementCompetency', fields: [{ key: 'engagementCompetency', label: 'Engagement Competency' }] },
];

export interface PathEntry {
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
      userCount: new Set(groupRows.map((r) => r.userMail.toLowerCase())).size,
      tokens: Math.round(groupRows.reduce((s, r) => s + r.tokenConsumption, 0)),
      cost: Number(groupRows.reduce((s, r) => s + r.cost, 0).toFixed(2)),
    }))
    .sort((a, b) => b.cost - a.cost);
}

const fmtCost = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface HierarchyDrilldownPanelProps {
  rows: CsvUsageRow[];
  onSelectUser: (email: string, displayName: string) => void;
  title?: string;
  subtitle?: string;
  /**
   * Pre-seed the path when a level has already been chosen outside this panel
   * (e.g. a "CT" / "Non-CT" card the caller already filtered `rows` by) — the
   * navigator starts one level past this instead of re-asking a question with
   * only one possible answer.
   */
  initialPath?: PathEntry[];
  /** Notified with the full current path every time it changes, so a caller
   * that shows other context (e.g. a trend chart) alongside this panel can
   * re-scope itself to match how deep the user has drilled. */
  onPathChange?: (path: PathEntry[]) => void;
}

/**
 * Embeddable version of the mandated hierarchy navigator: click through
 * CT/Non-CT -> Country -> Service Line -> ... -> Engagement Competency before
 * any individual user is ever named. Used by every Executive Overview
 * inference drilldown so user-level detail only ever appears at the last level.
 */
export function HierarchyDrilldownPanel({ rows, onSelectUser, title, subtitle, initialPath, onPathChange }: HierarchyDrilldownPanelProps) {
  const basePath = useMemo(() => initialPath || [], [initialPath]);
  const [path, setPath] = useState<PathEntry[]>(basePath);

  useEffect(() => {
    onPathChange?.(path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  const pathRows = useMemo(
    () => rows.filter((r) => path.every((p) => String(r[p.field] || '').trim() === p.value)),
    [rows, path]
  );

  const currentLevel = LEVELS[path.length];
  const isComplete = !currentLevel;

  const selectValue = (levelId: string, field: keyof CsvUsageRow, fieldLabel: string, value: string) => {
    setPath((prev) => [...prev, { levelId, field, fieldLabel, value }]);
  };
  const jumpTo = (index: number) => {
    if (index < 0) {
      setPath(basePath);
      return;
    }
    setPath((prev) => prev.slice(0, index + 1));
  };

  const userRows = useMemo(() => {
    if (!isComplete) return [];
    const map = new Map<string, { email: string; name: string; tokens: number; cost: number; rowCount: number }>();
    for (const r of pathRows) {
      const email = (r.userMail || '').toLowerCase().trim();
      if (!email) continue;
      if (!map.has(email)) map.set(email, { email, name: r.displayName || email, tokens: 0, cost: 0, rowCount: 0 });
      const u = map.get(email)!;
      u.tokens += r.tokenConsumption;
      u.cost += r.cost;
      u.rowCount += 1;
    }
    return Array.from(map.values()).sort((a, b) => b.cost - a.cost);
  }, [isComplete, pathRows]);

  return (
    <div className="bg-ey-card border border-ey-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="border-b border-ey-border/60 pb-3 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-bold text-ey-light uppercase tracking-wider flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-purple-400" />
            <span>{title || 'Hierarchy Drilldown'}</span>
          </h3>
          <p className="text-xs text-ey-muted mt-0.5">
            {subtitle || 'Drill down step by step through the org structure — individual user identity is only revealed at the final level.'}
          </p>
        </div>
        {path.length > basePath.length && (
          <button
            onClick={() => jumpTo(-1)}
            className="flex items-center gap-1.5 text-[10px] font-semibold text-ey-muted hover:text-ey-yellow bg-ey-black border border-ey-border px-2.5 py-1.5 rounded-lg transition shrink-0"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        )}
      </div>

      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <button
          onClick={() => jumpTo(-1)}
          className={`px-2 py-1 rounded-md font-semibold transition ${
            path.length === basePath.length ? 'bg-ey-yellow/20 text-ey-yellow border border-ey-yellow/40' : 'text-ey-muted hover:text-ey-light'
          }`}
        >
          All
        </button>
        {path.map((p, idx) => (
          <span key={idx} className="flex items-center gap-1.5">
            <ChevronRight className="w-3 h-3 text-ey-muted" />
            <button
              onClick={() => jumpTo(idx)}
              title={p.fieldLabel}
              className={`px-2 py-1 rounded-md font-semibold transition ${
                idx === path.length - 1 ? 'bg-ey-yellow/20 text-ey-yellow border border-ey-yellow/40' : 'text-ey-muted hover:text-ey-light'
              }`}
            >
              {p.value}
            </button>
          </span>
        ))}
      </div>

      {isComplete ? (
        <div className="overflow-x-auto border border-ey-border rounded-xl">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-ey-black/70 text-ey-muted uppercase tracking-wider border-b border-ey-border">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3 text-right">Tokens</th>
                <th className="px-4 py-3 text-right">Cost ($)</th>
                <th className="px-4 py-3 text-center">Records</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ey-border">
              {userRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-ey-muted">No users match this path.</td>
                </tr>
              ) : (
                userRows.map((u, i) => (
                  <tr
                    key={i}
                    onClick={() => onSelectUser(u.email, u.name)}
                    className="hover:bg-ey-yellow/5 cursor-pointer transition group"
                  >
                    <td className="px-4 py-3 font-medium text-ey-light">
                      <div className="group-hover:text-ey-yellow transition-colors font-semibold">{u.name}</div>
                      <div className="text-[10px] text-ey-muted">{u.email}</div>
                    </td>
                    <td className="px-4 py-3 text-right">{u.tokens.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-bold text-ey-yellow">{fmtCost(u.cost)}</td>
                    <td className="px-4 py-3 text-center text-ey-muted">{u.rowCount}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 text-[10px] text-ey-yellow font-bold group-hover:underline">
                        <span>Drill to Logs</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-4">
          {currentLevel.fields.map((f) => {
            const groups = summarize(pathRows, f.key);
            const combinedCost = groups.reduce((s, g) => s + g.cost, 0);
            const combinedTokens = groups.reduce((s, g) => s + g.tokens, 0);
            const combinedUsers = new Set(pathRows.map((r) => r.userMail.toLowerCase())).size;
            return (
              <div key={f.key}>
                <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                  <p className="text-[11px] font-bold text-ey-light">
                    Level {path.length + 1}: {f.label}{' '}
                    <span className="text-ey-muted font-normal">({groups.length} value{groups.length === 1 ? '' : 's'})</span>
                  </p>
                  {groups.length > 1 && (
                    <p className="text-xs font-semibold text-ey-light font-mono text-right">
                      Total: <span className="font-extrabold text-sm">{fmtCost(combinedCost)}</span>
                      {' · '}{combinedUsers} users · {combinedTokens.toLocaleString()} tokens
                    </p>
                  )}
                </div>
                {groups.length === 0 ? (
                  <p className="text-[11px] text-ey-muted py-3 text-center">No data at this step.</p>
                ) : groups.length <= 8 ? (
                  // Small value sets (CT/Non-CT, Region, Service Line, ...) get the same
                  // prominent clickable tile used for CT/Non-CT everywhere else in the app
                  // (RoiDrilldownView, ExecutiveMetricDrilldownView), instead of a plain table.
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {groups.map((g) => (
                      <button
                        key={g.value}
                        onClick={() => selectValue(currentLevel.id, f.key, f.label, g.value)}
                        title={`Click to drill down into ${g.value}`}
                        className="w-full flex items-center justify-between gap-3 bg-cyan-500/10 hover:bg-cyan-500/20 border-2 border-cyan-500/40 hover:border-cyan-400 px-4 py-3.5 rounded-2xl transition-all cursor-pointer group text-left shadow-sm hover:shadow-lg hover:shadow-cyan-500/10"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-cyan-300 font-extrabold text-xs uppercase tracking-wider truncate">{g.value}</span>
                            <span className="text-[9px] text-cyan-400 font-bold uppercase tracking-wider bg-cyan-500/15 px-1.5 py-0.5 rounded border border-cyan-500/30 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              Click to drill down
                            </span>
                          </div>
                          <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-2xl font-extrabold text-ey-light font-mono group-hover:text-cyan-200 transition-colors">
                              {fmtCost(g.cost)}
                            </span>
                          </div>
                          <p className="text-[11px] text-ey-muted mt-0.5">
                            {g.userCount} users · {g.tokens.toLocaleString()} tokens
                          </p>
                        </div>
                        <div className="p-2 bg-cyan-500/15 border border-cyan-500/40 rounded-xl text-cyan-300 group-hover:bg-cyan-500/25 group-hover:scale-110 transition-all shrink-0">
                          <ArrowUpRight className="w-5 h-5" />
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  // Large value sets (Engagement Code, etc. can run into the hundreds) stay
                  // a compact scannable table — a card per row wouldn't be readable at that volume.
                  <div className="overflow-x-auto border border-ey-border rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-ey-black/70 text-ey-muted uppercase tracking-wider border-b border-ey-border text-[10px]">
                        <tr>
                          <th className="px-3 py-2">{f.label}</th>
                          <th className="px-3 py-2 text-right">Users</th>
                          <th className="px-3 py-2 text-right">Tokens</th>
                          <th className="px-3 py-2 text-right">Cost ($)</th>
                          <th className="px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ey-border">
                        {groups.map((g) => (
                          <tr
                            key={g.value}
                            onClick={() => selectValue(currentLevel.id, f.key, f.label, g.value)}
                            className="hover:bg-ey-card-hover/80 transition cursor-pointer group"
                          >
                            <td className="px-3 py-2 font-semibold text-ey-light group-hover:text-ey-yellow">{g.value}</td>
                            <td className="px-3 py-2 text-right">{g.userCount}</td>
                            <td className="px-3 py-2 text-right font-mono">{g.tokens.toLocaleString()}</td>
                            <td className="px-3 py-2 text-right font-mono font-bold">{fmtCost(g.cost)}</td>
                            <td className="px-3 py-2 text-right text-ey-muted text-[10px]">Drill Down</td>
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
    </div>
  );
}
