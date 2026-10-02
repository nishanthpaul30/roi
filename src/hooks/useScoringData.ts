'use client';

import { useState, useEffect, useMemo } from 'react';
import type { GlobalFilterState } from '@/lib/metrics/types';
import type { EngagementScore } from '@/lib/metrics/scoringConfig';
import { fetchJsonWithRetry } from '@/lib/fetchWithRetry';

interface ScoringResult {
  key: string;
  scores: EngagementScore[];
  error: string | null;
}

/**
 * Per-engagement scores for the Engagement Scoring page, fetched from
 * /api/metrics/scoring and scoped by the global filter bar. Same lifecycle as
 * useRawRows: waits for the dataset's date range to resolve and drops a
 * response that arrives after the filters changed again.
 *
 * `loading` is derived (the latest settled result belongs to a different
 * request than the current filters) instead of being set from inside the
 * effect, so the previous scores stay on screen while a new request is in flight.
 */
export function useScoringData(filters: GlobalFilterState) {
  const [result, setResult] = useState<ScoringResult | null>(null);

  const key = useMemo(() => {
    if (!filters.startDate) return null;
    return new URLSearchParams({
      startDate: filters.startDate,
      endDate: filters.endDate,
      aiTool: filters.aiTool,
      managementRegion: filters.managementRegion,
      serviceLine: filters.serviceLine,
      userMail: filters.userMail,
      country: filters.country,
    }).toString();
  }, [filters]);

  useEffect(() => {
    if (!key) return;

    let cancelled = false;
    const controller = new AbortController();

    fetchJsonWithRetry(`/api/metrics/scoring?${key}`, { signal: controller.signal })
      .then((json) => {
        if (!cancelled) setResult({ key, scores: json.scores || [], error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to load engagement scores:', err);
        setResult({ key, scores: [], error: err?.message || 'Failed to load engagement scores' });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [key]);

  const settled = result !== null && result.key === key;
  return {
    scores: result?.scores ?? [],
    loading: key === null || !settled,
    error: settled ? result.error : null,
  };
}
