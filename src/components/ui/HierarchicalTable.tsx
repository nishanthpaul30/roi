'use client';

import { useMemo, useState, Fragment } from 'react';
import { ChevronDown, ChevronRight, ArrowUpRight, Search, BarChart3, Table2 } from 'lucide-react';
import { ExplorerChart } from './ExplorerChart';

export interface HierBadge {
  label: string;
  bg: string;
  textColor: string;
  border: string;
}

export interface HierRow {
  id: string;
  badge?: HierBadge;
  plainLabel?: string;
  meta?: string;
  users: string;
  tokens: string;
  cost: string;
  share: string;
}

export interface HierGroup {
  parent: HierRow;
  children: HierRow[];
}

interface HierarchicalTableProps {
  title: string;
  subtitle?: string;
  groups: HierGroup[];
  parentColumnHeader: string;
  childColumnHeader: string;
  metaColumnHeader?: string;
  onParentClick: (id: string) => void;
  onChildClick: (parentId: string, id: string) => void;
  /** Optional: enables a Chart/Table toggle. Chart shows parent totals stacked by their children. */
  chartRows?: Record<string, any>[];
  chartColumns?: string[];
  chartMetric?: string;
  chartMetricLabel?: string;
}

/**
 * A parent/child expandable table used to fold two related flat breakdowns
 * (e.g. Service Line + its Sub-Service Line practices) into one section
 * without losing per-child drilldown or row-level detail.
 */
export function HierarchicalTable({
  title,
  subtitle,
  groups,
  parentColumnHeader,
  childColumnHeader,
  metaColumnHeader,
  onParentClick,
  onChildClick,
  chartRows,
  chartColumns,
  chartMetric,
  chartMetricLabel,
}: HierarchicalTableProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState<'table' | 'chart'>('table');
  const canChart = !!(chartRows && chartColumns && chartMetric && chartMetricLabel);

  const filteredGroups = useMemo(() => {
    if (!searchTerm.trim()) return groups;
    const q = searchTerm.toLowerCase();
    return groups
      .map((g) => {
        const parentText = (g.parent.badge?.label || g.parent.plainLabel || '').toLowerCase();
        if (parentText.includes(q)) return g;
        const matchingChildren = g.children.filter((c) => (c.plainLabel || '').toLowerCase().includes(q));
        return matchingChildren.length > 0 ? { parent: g.parent, children: matchingChildren } : null;
      })
      .filter((g): g is HierGroup => g !== null);
  }, [groups, searchTerm]);

  const toggle = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="bg-ey-card border border-ey-border rounded-xl p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-bold text-ey-light">{title}</h3>
          {subtitle && <p className="text-xs text-ey-muted mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {view === 'table' && (
            <div className="relative w-60">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-ey-muted" />
              <input
                type="text"
                placeholder={`Search ${parentColumnHeader.toLowerCase()} or ${childColumnHeader.toLowerCase()}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-ey-black border border-ey-border text-ey-light text-xs rounded-md pl-9 pr-3 py-1.5 focus:outline-none focus:border-ey-yellow"
              />
            </div>
          )}
          {canChart && (
            <div className="flex items-center gap-1 bg-ey-black border border-ey-border rounded-lg p-1 shrink-0">
              <button
                onClick={() => setView('table')}
                title="Table view"
                className={`p-1.5 rounded-md transition ${view === 'table' ? 'bg-ey-yellow text-ey-black' : 'text-ey-muted hover:text-ey-light'}`}
              >
                <Table2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setView('chart')}
                title="Chart view"
                className={`p-1.5 rounded-md transition ${view === 'chart' ? 'bg-ey-yellow text-ey-black' : 'text-ey-muted hover:text-ey-light'}`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {view === 'chart' && canChart ? (
        <ExplorerChart
          title=""
          rows={chartRows!}
          colDim="children"
          columns={chartColumns!}
          metric={chartMetric!}
          metricLabel={chartMetricLabel!}
          rowDimLabel={parentColumnHeader}
          embedded
        />
      ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-ey-light">
          <thead className="bg-ey-black/80 text-[11px] uppercase font-semibold text-ey-muted border-b border-ey-border">
            <tr>
              <th className="px-3 py-3 w-8"></th>
              <th className="px-4 py-3">{parentColumnHeader} / {childColumnHeader}</th>
              {metaColumnHeader && <th className="px-4 py-3">{metaColumnHeader}</th>}
              <th className="px-4 py-3">Active Users</th>
              <th className="px-4 py-3">Token Consumption</th>
              <th className="px-4 py-3">Total Cost ($)</th>
              <th className="px-4 py-3">Share</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ey-border">
            {filteredGroups.length === 0 ? (
              <tr>
                <td colSpan={7 + (metaColumnHeader ? 1 : 0)} className="px-4 py-8 text-center text-ey-muted">
                  No matching records found.
                </td>
              </tr>
            ) : (
              filteredGroups.map((g) => {
                const isOpen = !collapsed.has(g.parent.id) || !!searchTerm.trim();
                return (
                  <Fragment key={g.parent.id}>
                    <tr
                      onClick={() => onParentClick(g.parent.id)}
                      className="hover:bg-ey-card-hover/80 transition cursor-pointer bg-ey-black/20"
                    >
                      <td
                        className="px-3 py-3"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggle(g.parent.id);
                        }}
                      >
                        {isOpen ? (
                          <ChevronDown className="w-4 h-4 text-ey-muted hover:text-ey-yellow" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-ey-muted hover:text-ey-yellow" />
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {g.parent.badge ? (
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold border ${g.parent.badge.bg} ${g.parent.badge.textColor} ${g.parent.badge.border}`}
                          >
                            {g.parent.badge.label}
                          </span>
                        ) : (
                          <span className="font-bold">{g.parent.plainLabel}</span>
                        )}
                        <span className="ml-2 text-[10px] text-ey-muted font-mono">
                          ({g.children.length})
                        </span>
                      </td>
                      {metaColumnHeader && (
                        <td className="px-4 py-3 text-ey-muted text-[11px]">{g.parent.meta || '-'}</td>
                      )}
                      <td className="px-4 py-3">{g.parent.users}</td>
                      <td className="px-4 py-3 font-mono">{g.parent.tokens}</td>
                      <td className="px-4 py-3 font-mono font-bold">{g.parent.cost}</td>
                      <td className="px-4 py-3">{g.parent.share}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-ey-yellow hover:underline">
                          <span>Drill Down</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </span>
                      </td>
                    </tr>

                    {isOpen &&
                      g.children.map((c) => (
                        <tr
                          key={c.id}
                          onClick={() => onChildClick(g.parent.id, c.id)}
                          className="hover:bg-ey-card-hover/60 transition cursor-pointer"
                        >
                          <td className="px-3 py-2.5"></td>
                          <td className="px-4 py-2.5 pl-8 text-ey-light">
                            <span className="text-ey-border mr-1.5">&#8627;</span>
                            {c.plainLabel}
                          </td>
                          {metaColumnHeader && <td className="px-4 py-2.5"></td>}
                          <td className="px-4 py-2.5 text-ey-muted">{c.users}</td>
                          <td className="px-4 py-2.5 font-mono text-ey-muted">{c.tokens}</td>
                          <td className="px-4 py-2.5 font-mono">{c.cost}</td>
                          <td className="px-4 py-2.5 text-ey-muted">{c.share}</td>
                          <td className="px-4 py-2.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-ey-yellow hover:underline">
                              <span>Drill Down</span>
                              <ArrowUpRight className="w-3 h-3" />
                            </span>
                          </td>
                        </tr>
                      ))}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
