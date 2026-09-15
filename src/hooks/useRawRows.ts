'use client';

import { useState, useEffect } from 'react';
import type { CsvUsageRow } from '@/lib/data/csvTypes';
import { GlobalFilterState } from '@/lib/metrics/types';

/**
 * Row-level CSV records for the drilldown views, fetched from the server
 * instead of parsed in the browser.
 *
 * These components need individual rows (hierarchy navigation down to a named
 * user, per-record log tables), which the aggregate /api/metrics/overview
 * response can't provide. Calling loadCsvData() directly from a Client
 * Component instead would drag the entire embedded CSV into the client bundle
 * and parse it on the main thread.
 *
 * Pass `filters` to scope to the global filter bar; omit it to get the full
 * default range unscoped.
 */
export function useRawRows(filters?: GlobalFilterState) {
  const [rows, setRows] = useState<CsvUsageRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams();
    if (filters) {
      params.set('startDate', filters.startDate);
      params.set('endDate', filters.endDate);
      params.set('aiTool', filters.aiTool);
      params.set('managementRegion', filters.managementRegion);
      params.set('serviceLine', filters.serviceLine);
      params.set('userMail', filters.userMail);
      params.set('country', filters.country);
    }

    fetch(`/api/metrics/raw-rows?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Server returned status ${res.status}`);
        return res.json();
      })
      .then((json) => {
        // A response that arrived after the filters changed again is stale — drop it.
        if (cancelled) return;
        setRows(json.rows || []);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to load raw rows:', err);
        setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filters]);

  return { rows, loading };
}
