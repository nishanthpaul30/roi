'use client';

import { useState, useEffect, useCallback } from 'react';
import { GlobalFilterState } from '@/lib/metrics/types';
import { fetchJsonWithRetry } from '@/lib/fetchWithRetry';

// Defaults to "All Months" — the full span of the dataset (March - August 2026).
const DEFAULT_FILTERS: GlobalFilterState = {
  startDate: '2026-03-01',
  endDate: '2026-08-31',
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
    } catch (err: any) {
      console.error('Failed to load metrics:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return { filters, setFilters, data, loading, error };
}
