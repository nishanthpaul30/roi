import type { CsvUsageRow } from '@/lib/data/csvTypes';

// Shared by the Geo Pulse (hierarchy) and Engagement Analytics drilldowns —
// both walk a fixed dimension chain one level at a time and need the same
// path-tracking types and per-level aggregation.

export interface LevelField {
  key: keyof CsvUsageRow;
  label: string;
}

export interface Level {
  id: string;
  title: string;
  fields: LevelField[];
}

export interface PathEntry {
  levelId: string;
  field: keyof CsvUsageRow;
  fieldLabel: string;
  value: string;
}

export function summarize(rows: CsvUsageRow[], field: keyof CsvUsageRow) {
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
