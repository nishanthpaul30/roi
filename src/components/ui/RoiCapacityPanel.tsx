'use client';

import { useMemo, useState } from 'react';
import { UserCapacityRow, GlobalFilterState } from '@/lib/metrics/types';
import { useRawRows } from '@/hooks/useRawRows';
import { HierarchyDrilldownPanel } from './HierarchyDrilldownPanel';
import { TrendingDown, TrendingUp, AlertCircle, ShieldAlert } from 'lucide-react';
import { formatCompactCurrency as fmtCost } from '@/lib/format';

interface RoiCapacityPanelProps {
  userCapacityBreakdown: UserCapacityRow[];
  totalWasteCost: number;
  totalOverageCost: number;
  licenseEfficiencyRate: number;
  ceilingRiskCount: number;
  hardCeiling: number;
  totalLicenseCost: number;
  licenseRoiPercent: number;
  licenseUnderutilizedCost: number;
  licenseOverutilizedValue: number;
  pageSize?: number;
  onSelectUser?: (user: UserCapacityRow) => void;
  onSelectZone?: (zone: 'zone1_under' | 'zone2_over' | 'ceiling_risk') => void;
  filters?: GlobalFilterState;
}

export function RoiCapacityPanel({
  userCapacityBreakdown,
  totalWasteCost,
  totalOverageCost,
  licenseEfficiencyRate,
  ceilingRiskCount,
  hardCeiling,
  totalLicenseCost,
  licenseRoiPercent,
  licenseUnderutilizedCost,
  licenseOverutilizedValue,
  onSelectUser,
  onSelectZone,
  filters,
}: RoiCapacityPanelProps) {
  const [activeTab, setActiveTab] = useState<'zone1' | 'zone2' | 'all'>('all');

  const zone1List = userCapacityBreakdown.filter((u) => u.zone === 'zone1_under');
  const zone2List = userCapacityBreakdown.filter((u) => u.zone === 'zone2_over');

  const displayedList =
    activeTab === 'zone1' ? zone1List : activeTab === 'zone2' ? zone2List : userCapacityBreakdown;

  const handleTabChange = (tab: 'zone1' | 'zone2' | 'all') => {
    setActiveTab(tab);
  };

  // Raw CSV rows, needed to walk the mandated hierarchy before any user is named.
  const { rows: allRows } = useRawRows(filters);

  const capacityByEmail = useMemo(() => {
    const map = new Map<string, UserCapacityRow>();
    for (const u of userCapacityBreakdown) map.set(u.userMail.toLowerCase(), u);
    return map;
  }, [userCapacityBreakdown]);

  // Scope raw rows down to the same set of seats currently shown in the tab (all / zone1 / zone2)
  const hierarchyRows = useMemo(() => {
    const allowedEmails = new Set(displayedList.map((u) => u.userMail.toLowerCase()));
    return allRows.filter((r) => allowedEmails.has((r.userMail || '').toLowerCase()));
  }, [allRows, displayedList]);

  return (
    <div className="space-y-6">
      {/* Strategic Capacity Summary Banner */}
      <div className="bg-ey-card border border-ey-border rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-ey-border pb-4">
          <div>
            <h2 className="text-base font-bold text-ey-light tracking-wide flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-ey-yellow" />
              <span>Financial Governance &amp; Capacity Optimization</span>
            </h2>
            <p className="text-xs text-ey-muted mt-0.5">
              Bifurcated analysis of unconsumed license quotas (Zone 1 Waste) vs usage limit breaches (Zone 2 Overage).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleTabChange('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                activeTab === 'all'
                  ? 'bg-ey-yellow/20 text-ey-yellow border-ey-yellow/40 shadow-sm'
                  : 'bg-ey-black text-ey-muted border-ey-border hover:text-ey-light'
              }`}
            >
              All Licenses — Mixed Data ({userCapacityBreakdown.length})
            </button>

            <button
              onClick={() => handleTabChange('zone1')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                activeTab === 'zone1'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                  : 'bg-ey-black text-ey-muted border-ey-border hover:text-ey-light'
              }`}
            >
              Zone 1: Under-Utilized ({zone1List.length})
            </button>

            <button
              onClick={() => handleTabChange('zone2')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                activeTab === 'zone2'
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-sm'
                  : 'bg-ey-black text-ey-muted border-ey-border hover:text-ey-light'
              }`}
            >
              Zone 2: Over-Utilized ({zone2List.length})
            </button>
          </div>
        </div>

        {/* Quick Insights Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 flex items-start space-x-3">
            <TrendingDown className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-300 font-bold">Zone 1 — Waste Recovery Opportunity</p>
              <p className="text-[11px] text-ey-muted mt-0.5">
                <strong className="text-amber-200">{fmtCost(totalWasteCost)}</strong> of license quotas went unconsumed across {zone1List.length} users.
              </p>
            </div>
          </div>

          <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3.5 flex items-start space-x-3">
            <TrendingUp className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-purple-300 font-bold">Zone 2 — Overage Spend Exposure</p>
              <p className="text-[11px] text-ey-muted mt-0.5">
                <strong className="text-purple-200">{fmtCost(totalOverageCost)}</strong> in additional usage billed beyond standard limits for {zone2List.length} users.
              </p>
            </div>
          </div>

          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3.5 flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-red-300 font-bold">Hard Dollar Cap Warning</p>
              <p className="text-[11px] text-ey-muted mt-0.5">
                <strong className="text-red-200">{ceilingRiskCount} users</strong> have reached or exceeded 90% of the platform hard spend ceiling ({fmtCost(hardCeiling)}).
              </p>
            </div>
          </div>
        </div>

        {/* License Cost ROI Insight */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-3.5 flex items-start space-x-3">
            <TrendingUp className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sky-300 font-bold">License Investment ROI</p>
              <p className="text-[11px] text-ey-muted mt-0.5">
                <strong className="text-sky-200">{licenseRoiPercent}%</strong> of total per-license Cost in USD ({fmtCost(totalLicenseCost)}) was actually consumed as usage.
              </p>
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 flex items-start space-x-3">
            <TrendingDown className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-300 font-bold">Underutilized License Spend</p>
              <p className="text-[11px] text-ey-muted mt-0.5">
                <strong className="text-amber-200">{fmtCost(licenseUnderutilizedCost)}</strong> of purchased license cost went unconsumed by usage.
              </p>
            </div>
          </div>

          <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3.5 flex items-start space-x-3">
            <TrendingUp className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-purple-300 font-bold">Usage Beyond License Cost</p>
              <p className="text-[11px] text-ey-muted mt-0.5">
                <strong className="text-purple-200">{fmtCost(licenseOverutilizedValue)}</strong> of usage cost exceeded what was paid in License Cost in USD.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Mandated Hierarchy Drilldown — named seats only surface at the final level */}
      <HierarchyDrilldownPanel
        rows={hierarchyRows}
        title={
          activeTab === 'zone1'
            ? 'Zone 1: Unconsumed AI License Waste Hierarchy'
            : activeTab === 'zone2'
            ? 'Zone 2: Budget Breach & Overage Hierarchy'
            : 'All User Licenses — Capacity & Zone Hierarchy'
        }
        onSelectUser={(email) => {
          const row = capacityByEmail.get(email.toLowerCase());
          if (row) onSelectUser?.(row);
        }}
      />
    </div>
  );
}

