'use client';

import { useMemo, useState } from 'react';

export type SortDirection = 'asc' | 'desc';

/**
 * Generic column-sort state for hand-rolled <table> markup (tables that
 * don't go through the shared DataTable component). Accessors are keyed by
 * an arbitrary sort key string chosen by the caller (usually the column id).
 */
type SortValue = string | number | null | undefined;

export function useTableSort<T>(rows: T[], accessors: Record<string, (row: T) => SortValue>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>('asc');

  const sortedRows = useMemo(() => {
    const getValue = sortKey ? accessors[sortKey] : null;
    if (!getValue) return rows;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);
      if (va === vb) return 0;
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb), undefined, { numeric: true }) * dir;
    });
  }, [rows, sortKey, sortDir]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // Programmatic sort (e.g. a drilldown that wants rows ranked by a column);
  // pass a null key to go back to the rows' incoming order.
  const setSort = (key: string | null, dir: SortDirection = 'asc') => {
    setSortKey(key);
    setSortDir(dir);
  };

  return { sortKey, sortDir, sortedRows, handleSort, setSort };
}
