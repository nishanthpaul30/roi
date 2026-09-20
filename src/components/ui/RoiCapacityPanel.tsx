'use client';

import { useMemo } from 'react';
import { UserCapacityRow, GlobalFilterState } from '@/lib/metrics/types';
import { useRawRows } from '@/hooks/useRawRows';
import { HierarchyDrilldownPanel } from './HierarchyDrilldownPanel';

interface RoiCapacityPanelProps {
  userCapacityBreakdown: UserCapacityRow[];
  onSelectUser?: (user: UserCapacityRow) => void;
  filters?: GlobalFilterState;
}

// The "Financial Governance & Capacity Optimization" summary banner (zone
// tabs, quick-insight tiles) that used to wrap this was removed — those
// figures already surface as their own KPI cards on the ROI page. This is
// now just the mandated hierarchy navigator over the full license roster.
export function RoiCapacityPanel({
  userCapacityBreakdown,
  onSelectUser,
  filters,
}: RoiCapacityPanelProps) {
  // Raw CSV rows, needed to walk the mandated hierarchy before any user is named.
  const { rows: allRows } = useRawRows(filters);

  const capacityByEmail = useMemo(() => {
    const map = new Map<string, UserCapacityRow>();
    for (const u of userCapacityBreakdown) map.set(u.userMail.toLowerCase(), u);
    return map;
  }, [userCapacityBreakdown]);

  const hierarchyRows = useMemo(() => {
    const allowedEmails = new Set(userCapacityBreakdown.map((u) => u.userMail.toLowerCase()));
    return allRows.filter((r) => allowedEmails.has((r.userMail || '').toLowerCase()));
  }, [allRows, userCapacityBreakdown]);

  return (
    <HierarchyDrilldownPanel
      rows={hierarchyRows}
      title="All User Licenses — Capacity View"
      onSelectUser={(email) => {
        const row = capacityByEmail.get(email.toLowerCase());
        if (row) onSelectUser?.(row);
      }}
    />
  );
}
