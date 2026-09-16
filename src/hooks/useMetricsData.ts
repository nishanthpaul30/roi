'use client';

import { useState, useEffect, useCallback } from 'react';
import { GlobalFilterState } from '@/lib/metrics/types';
import { fetchJsonWithRetry } from '@/lib/fetchWithRetry';

// Dates start empty on purpose: the server fills them in from the period the
// loaded CSV actually covers, and the first response tells us what it chose.
// Hardcoding a range here meant a dataset outside it rendered a blank
// dashboard, since the filter bar offered no month that would match.
const DEFAULT_FILTERS: GlobalFilterState = {
  startDate: '',
  endDate: '',
  comparisonPeriod: 'moM',
  // CSV-native dimensions
  aiTool: 'all',
  managementRegion: 'all',
  serviceLine: 'all',
  userMail: 'all',
  country: 'all',
  // Legacy (unused in CSV path)
  organization: 'all',
  team: 'all',
  user: 'all',
  repository: 'all',
  feature: 'all',
  model: 'all',
  language: 'all',
  ide: 'all',
  agent: 'all',
};

export function useMetricsData() {
  const [filters, setFilters] = useState<GlobalFilterState>(DEFAULT_FILTERS);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rangeResolved, setRangeResolved] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        startDate: filters.startDate,
        endDate: filters.endDate,
        comparisonPeriod: filters.comparisonPeriod,
        aiTool: filters.aiTool,
        managementRegion: filters.managementRegion,
        serviceLine: filters.serviceLine,
        userMail: filters.userMail,
        country: filters.country,
      });
      const result = await fetchJsonWithRetry(`/api/metrics/overview?${params.toString()}`);
      setData(result);

      // Fallback for when the dedicated range call failed: the overview
      // response carries the dataset's range too. Without this the KPI cards
      // still load (the API resolves empty dates server-side) while every panel
      // gated on a resolved range — raw rows, the pivot — never fetches at all.
      // In the normal path the dates are already set, so this is a no-op and
      // does not trigger a second round of requests.
      const opts = (result as any)?.filterOptions;
      if (opts?.datasetStartDate && opts?.datasetEndDate) {
        setFilters((prev) =>
          prev.startDate ? prev : { ...prev, startDate: opts.datasetStartDate, endDate: opts.datasetEndDate }
        );
      }
    } catch (err: any) {
      console.error('Failed to load metrics:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Resolve the dataset's own date range before requesting any data. Filters
  // start with empty dates because the range is no longer a known constant, and
  // fetching before it is known would send every request twice — once with
  // empty dates, then again once the real ones arrive.
  useEffect(() => {
    let cancelled = false;
    fetchJsonWithRetry('/api/metrics/dataset-range')
      .then((range: any) => {
        if (cancelled || !range?.startDate || !range?.endDate) return;
        setFilters((prev) =>
          prev.startDate ? prev : { ...prev, startDate: range.startDate, endDate: range.endDate }
        );
      })
      .catch((err) => {
        // Fail open: with dates left empty the API falls back to the dataset
        // range server-side anyway, so data still loads.
        console.error('Failed to resolve dataset range:', err);
      })
      .finally(() => {
        if (!cancelled) setRangeResolved(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!rangeResolved) return;
    loadData();
  }, [loadData, rangeResolved]);

  return { filters, setFilters, data, loading, error };
}
