'use client';

import { useMemo } from 'react';
import { ChevronRight, Users, Download } from 'lucide-react';
import { GlobalFilterState } from '@/lib/metrics/types';
import { useRawRows } from '@/hooks/useRawRows';
import { DataTable, Column } from './DataTable';
import { formatCompactCurrency as fmtCost, formatCompactNumber } from '@/lib/format';

interface UserHierarchyRow {
  ctNonCt: string;
  serviceLine: string;
  subServiceLine1: string;
  subServiceLine2: string;
  engagementCode: string;
  displayName: string;
  userMail: string;
  tokenConsumption: number;
  cost: number;
}

interface UserThresholdDrilldownViewProps {
  /** Which of the two simple criteria this drilldown lists users for. */
  criteria: 'zero_consumption' | 'high_spend';
  /** Dollar threshold for 'high_spend' — users with cost strictly greater than this. */
  threshold?: number;
  title: string;
  subtitle: string;
  badge: string;
  parentTitle?: string;
  filters?: GlobalFilterState;
  onBack: () => void;
}

/**
 * Deliberately minimal beyond the required hierarchy columns — a single
 * count tile plus a paginated user list. These two ROI tiles are plain
 * per-user threshold checks, not a multi-dimension exploration, so nothing
 * beyond the mandated CT/Non-CT / Service Line / Sub-Service Line 1 /
 * Sub-Service Line 2 / Engagement columns is added.
 */
export function UserThresholdDrilldownView({
  criteria,
  threshold = 100,
  title,
  subtitle,
  badge,
  parentTitle = 'ROI Dashboard',
  filters,
  onBack,
}: UserThresholdDrilldownViewProps) {
  const { rows: allRows, loading } = useRawRows(filters);

  const rows = useMemo<UserHierarchyRow[]>(() => {
    const toRow = (r: (typeof allRows)[number], displayName: string, tokenConsumption: number, cost: number): UserHierarchyRow => ({
      ctNonCt: r.ctNonCt || 'Unclassified',
      serviceLine: r.orgServiceLine || 'General',
      subServiceLine1: r.subServiceLine1 || 'General',
      subServiceLine2: r.subServiceLine2 || 'General',
      engagementCode: r.projectCode || 'Unassigned',
      displayName,
      userMail: (r.userMail || '').toLowerCase().trim(),
      tokenConsumption,
      cost,
    });

    let result: UserHierarchyRow[];

    if (criteria === 'zero_consumption') {
      // User-level qualification: total GenAI Tool Consumption across every
      // Usage row in the period is zero -- including users with no Usage
      // row at all -- matching summary.inactiveUserCount's roster-gap
      // definition (Total Roster minus Active Licenses), not a per-row
      // check that would also catch a user who was active in one month and
      // idle in another (they'd wrongly appear here too).
      const totalsByUser = new Map<string, { displayName: string; tokenConsumption: number; cost: number }>();
      const leafByUser = new Map<string, (typeof allRows)[number]>();
      for (const r of allRows) {
        const email = (r.userMail || '').toLowerCase().trim();
        if (!email) continue;
        if (!totalsByUser.has(email)) totalsByUser.set(email, { displayName: r.displayName || email, tokenConsumption: 0, cost: 0 });
        if (!leafByUser.has(email)) leafByUser.set(email, r);
        if (r.calculationMethod === 'Usage') {
          const t = totalsByUser.get(email)!;
          t.tokenConsumption += r.tokenConsumption;
          t.cost += r.cost;
        }
      }
      result = [];
      for (const [email, totals] of totalsByUser.entries()) {
        if (totals.tokenConsumption !== 0) continue;
        const leaf = leafByUser.get(email)!;
        result.push(toRow(leaf, totals.displayName, 0, totals.cost));
      }
    } else {
      // User-level qualification (total cost > threshold across the whole
      // period): find each qualifying user's single highest-cost hierarchy
      // leaf and place their full period total there, so the table still
      // shows exactly one row per qualifying user.
      const totalsByUser = new Map<string, { displayName: string; tokenConsumption: number; cost: number }>();
      const leafCostByUser = new Map<string, Map<string, { row: (typeof allRows)[number]; cost: number }>>();
      for (const r of allRows) {
        if (r.calculationMethod !== 'Usage') continue;
        const email = (r.userMail || '').toLowerCase().trim();
        if (!email) continue;
        if (!totalsByUser.has(email)) totalsByUser.set(email, { displayName: r.displayName || email, tokenConsumption: 0, cost: 0 });
        const t = totalsByUser.get(email)!;
        t.tokenConsumption += r.tokenConsumption;
        t.cost += r.cost;

        const leafKey = `${r.ctNonCt}|${r.orgServiceLine}|${r.subServiceLine1}|${r.subServiceLine2}|${r.projectCode}`;
        if (!leafCostByUser.has(email)) leafCostByUser.set(email, new Map());
        const perLeaf = leafCostByUser.get(email)!;
        const entry = perLeaf.get(leafKey);
        if (entry) entry.cost += r.cost;
        else perLeaf.set(leafKey, { row: r, cost: r.cost });
      }

      result = [];
      for (const [email, totals] of totalsByUser.entries()) {
        if (totals.cost <= threshold) continue;
        const perLeaf = leafCostByUser.get(email);
        if (!perLeaf || perLeaf.size === 0) continue;
        const primary = Array.from(perLeaf.values()).sort((a, b) => b.cost - a.cost)[0];
        result.push(toRow(primary.row, totals.displayName, totals.tokenConsumption, totals.cost));
      }
    }

    return result.sort(
      (a, b) =>
        a.ctNonCt.localeCompare(b.ctNonCt) ||
        a.serviceLine.localeCompare(b.serviceLine) ||
        a.subServiceLine1.localeCompare(b.subServiceLine1) ||
        a.subServiceLine2.localeCompare(b.subServiceLine2) ||
        a.engagementCode.localeCompare(b.engagementCode) ||
        (criteria === 'high_spend' ? b.cost - a.cost : a.displayName.localeCompare(b.displayName))
    );
  }, [allRows, criteria, threshold]);

  // Distinct users, not rows — a user with zero-consumption instances under
  // two different engagements produces two rows but must still count once,
  // matching the "Matching Users" figure on the KPI tile that opened this.
  const distinctUserCount = useMemo(() => new Set(rows.map((r) => r.userMail)).size, [rows]);

  const columns: Column<UserHierarchyRow>[] = [
    { header: 'CT / Non-CT', accessorKey: 'ctNonCt' },
    { header: 'Service Line', accessorKey: 'serviceLine' },
    { header: 'Sub-Service Line 1', accessorKey: 'subServiceLine1' },
    { header: 'Sub-Service Line 2', accessorKey: 'subServiceLine2' },
    { header: 'Engagement', accessorKey: 'engagementCode' },
    { header: 'User', accessorKey: 'displayName' },
    { header: 'Email', accessorKey: 'userMail' },
    { header: 'Token Consumption', accessorKey: 'tokenConsumption', cell: (r) => formatCompactNumber(r.tokenConsumption) },
    { header: 'Cost ($)', accessorKey: 'cost', cell: (r) => fmtCost(r.cost) },
  ];

  // Exports the full, unpaginated row set exactly as sorted on screen.
  const handleExportCsv = () => {
    if (rows.length === 0) return;
    const headers = [
      'CT / Non-CT',
      'Service Line',
      'Sub-Service Line 1',
      'Sub-Service Line 2',
      'Engagement',
      'User',
      'Email',
      'Token Consumption',
      'Cost (USD)',
    ];
    const csvRows = rows.map((r) => [
      r.ctNonCt,
      r.serviceLine,
      r.subServiceLine1,
      r.subServiceLine2,
      r.engagementCode,
      `"${r.displayName}"`,
      r.userMail,
      r.tokenConsumption,
      r.cost.toFixed(4),
    ]);
    const csvContent = [headers.join(','), ...csvRows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${criteria}_users.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <div className="bg-ey-card border border-ey-border rounded-2xl px-4 py-3 shadow-sm flex items-center gap-1.5 text-xs font-mono">
        <button onClick={onBack} className="text-ey-muted hover:text-ey-yellow transition-colors font-semibold cursor-pointer">
          {parentTitle}
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-ey-border shrink-0" />
        <span className="text-ey-yellow font-bold">{title}</span>
      </div>

      {/* Header + single count tile — no extra breakdowns for a plain threshold check */}
      <div className="bg-ey-card border border-ey-border rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="px-2.5 py-0.5 text-[11px] font-mono font-bold rounded-full bg-ey-yellow/15 border border-ey-yellow/30 text-ey-yellow">
            {badge}
          </span>
          <h1 className="text-xl font-extrabold text-ey-light tracking-tight">{title}</h1>
          <p className="text-xs text-ey-muted">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3 bg-ey-black/70 border border-ey-border rounded-xl p-3 shrink-0">
          <div className="p-2 bg-ey-yellow/10 border border-ey-yellow/30 rounded-lg text-ey-yellow">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-ey-muted block uppercase tracking-wider">Matching Users</span>
            <span className="text-xl font-bold text-ey-light">{loading ? '—' : distinctUserCount}</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center text-ey-muted text-sm animate-pulse">
          Loading telemetry rows...
        </div>
      ) : (
        <>
          <div className="flex justify-end">
            <button
              onClick={handleExportCsv}
              disabled={rows.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-ey-yellow text-ey-black text-xs font-semibold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Export the full, unpaginated list to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
          <DataTable
            title={`Users with ${criteria === 'zero_consumption' ? 'Zero Consumption' : `Cost > $${threshold}`}`}
            data={rows}
            columns={columns}
            pageSize={15}
          />
        </>
      )}
    </div>
  );
}
