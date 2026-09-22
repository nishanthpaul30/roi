'use client';

import { ArrowUpRight } from 'lucide-react';
import { formatCompactCurrency as fmtCost, formatCompactNumber } from '@/lib/format';
import { useTableSort } from '@/lib/useTableSort';
import { SortableTh } from '@/components/ui/SortableTh';

export interface SummaryGroup {
  value: string;
  rowCount?: number;
  userCount: number;
  tokens: number;
  cost: number;
}

interface GroupsTableProps {
  groups: SummaryGroup[];
  labelHeader: string;
  onSelect: (value: string) => void;
  renderAction?: (g: SummaryGroup) => React.ReactNode;
}

/**
 * Shared "Level N: <dimension>" drilldown table (Country/Service Line/etc. ->
 * Active Users -> Token Consumption -> Total Cost -> Drill Down) used across
 * the Geo Pulse and Engagement Analytics pages. Sorting lives here, once, so
 * every level of every hierarchy drill gets it for free.
 */
export function GroupsTable({ groups, labelHeader, onSelect, renderAction }: GroupsTableProps) {
  const { sortKey, sortDir, sortedRows, handleSort } = useTableSort<SummaryGroup>(groups, {
    value: (g) => g.value,
    userCount: (g) => g.userCount,
    tokens: (g) => g.tokens,
    cost: (g) => g.cost,
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs text-ey-light">
        <thead className="bg-ey-black/80 text-[11px] uppercase font-semibold text-ey-muted border-b border-ey-border">
          <tr>
            <SortableTh label={labelHeader} sortKey="value" activeKey={sortKey} direction={sortDir} onSort={handleSort} />
            <SortableTh
              label="Active Users"
              sortKey="userCount"
              activeKey={sortKey}
              direction={sortDir}
              onSort={handleSort}
              className="px-4 py-2.5 text-right"
              align="right"
            />
            <SortableTh
              label="Token Consumption"
              sortKey="tokens"
              activeKey={sortKey}
              direction={sortDir}
              onSort={handleSort}
              className="px-4 py-2.5 text-right"
              align="right"
            />
            <SortableTh
              label="Total Cost ($)"
              sortKey="cost"
              activeKey={sortKey}
              direction={sortDir}
              onSort={handleSort}
              className="px-4 py-2.5 text-right"
              align="right"
            />
            <th className="px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ey-border">
          {sortedRows.map((g) => (
            <tr
              key={g.value}
              onClick={() => onSelect(g.value)}
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
                {renderAction ? renderAction(g) : <span className="text-ey-muted">Drill Down</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
