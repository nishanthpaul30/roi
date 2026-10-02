'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Target, X } from 'lucide-react';
import { useMetricsData } from '@/hooks/useMetricsData';
import { useScoringData } from '@/hooks/useScoringData';
import { GlobalFilterBar } from '@/components/layout/GlobalFilterBar';
import { StatTile } from '@/components/ui/StatTile';
import { SortableTh } from '@/components/ui/SortableTh';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { EngagementScoreDetail, TIER_STYLES } from '@/components/ui/EngagementScoreDetail';
import { useTableSort } from '@/lib/useTableSort';
import {
  SCORE_DIMENSIONS,
  SCORING_CONFIG,
  TIER_ORDER,
  type EngagementScore,
  type ScoreDimensionId,
  type ScoreTier,
} from '@/lib/metrics/scoringConfig';
import { formatCompactCurrency } from '@/lib/format';

const PAGE_SIZE = 20;

// 'unscored' = engagements with nothing scoreable (no tier at all).
type TierFilter = ScoreTier | 'unscored' | 'all';

const dimOf = (s: EngagementScore, id: ScoreDimensionId) => s.dimensions.find((d) => d.id === id)!;

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-0.5 rounded-full text-[11px] font-semibold bg-ey-yellow/10 text-ey-yellow border border-ey-yellow/30">
      {label}
      <button
        type="button"
        onClick={onClear}
        aria-label={`Clear ${label}`}
        className="w-4 h-4 inline-flex items-center justify-center rounded-full hover:bg-ey-yellow/20 transition"
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

function ScoreCell({ score, id }: { score: EngagementScore; id: ScoreDimensionId }) {
  const d = dimOf(score, id);
  return d.score === null ? (
    <span className="text-ey-muted/40" title={d.detail}>
      &mdash;
    </span>
  ) : (
    <span className="font-semibold text-ey-light" title={d.detail}>
      {d.score.toFixed(1)}
    </span>
  );
}

function EngagementScoring() {
  const { filters, setFilters, data } = useMetricsData();
  const { scores, loading, error } = useScoringData(filters);

  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  // Dimension drilldown: when set, the table lists only engagements scored on this dimension, ranked by it.
  const [dimensionFocus, setDimensionFocus] = useState<ScoreDimensionId | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const tableCardRef = useRef<HTMLDivElement>(null);
  // Bumped when a tier drilldown should bring the table into view; the effect
  // below runs after the filter has rendered, so the scroll lands on the final layout.
  const [scrollToTableTick, setScrollToTableTick] = useState(0);

  useEffect(() => {
    if (scrollToTableTick === 0) return;
    tableCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [scrollToTableTick]);

  // Everything above the table is scoped by the global filter bar only; the
  // table's own search/tier filter narrows just the table.
  const summary = useMemo(() => {
    const tierCounts: Record<ScoreTier, number> = { Leading: 0, Performing: 0, Developing: 0, 'At Risk': 0 };
    let unscorable = 0;
    let percentSum = 0;
    let percentN = 0;
    for (const s of scores) {
      if (s.tier) tierCounts[s.tier]++;
      else unscorable++;
      if (s.percent !== null) {
        percentSum += s.percent;
        percentN++;
      }
    }
    const dimensions = SCORE_DIMENSIONS.map((def) => {
      const scored = scores.map((s) => dimOf(s, def.id).score).filter((v): v is number => v !== null);
      return {
        def,
        scoredCount: scored.length,
        avg: scored.length > 0 ? scored.reduce((a, b) => a + b, 0) / scored.length : null,
      };
    });
    return { tierCounts, unscorable, avgPercent: percentN > 0 ? percentSum / percentN : null, dimensions };
  }, [scores]);

  const tableRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return scores
      .filter((s) => (tierFilter === 'all' ? true : tierFilter === 'unscored' ? s.tier === null : s.tier === tierFilter))
      .filter((s) => !dimensionFocus || dimOf(s, dimensionFocus).score !== null)
      .filter((s) => !term || s.projectCode.toLowerCase().includes(term))
      .sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1));
  }, [scores, search, tierFilter, dimensionFocus]);

  const { sortKey, sortDir, sortedRows, handleSort, setSort } = useTableSort(tableRows, {
    projectCode: (s) => s.projectCode,
    financial: (s) => dimOf(s, 'financial').score,
    productivity: (s) => dimOf(s, 'productivity').score,
    adoption: (s) => dimOf(s, 'adoption').score,
    revenue: (s) => dimOf(s, 'revenue').score,
    quality: (s) => dimOf(s, 'quality').score,
    strategic: (s) => dimOf(s, 'strategic').score,
    percent: (s) => s.percent,
    completeness: (s) => s.scoredDimensionCount,
    totalCost: (s) => s.totalCost,
  });

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const page = Math.min(currentPage, totalPages);
  const pageRows = sortedRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selected = selectedCode ? scores.find((s) => s.projectCode === selectedCode) ?? null : null;

  // Tier Distribution drilldown: clicking a tier filters the table to it and
  // scrolls the table into view; clicking the active tier again clears it.
  const drillIntoTier = (tier: ScoreTier | 'unscored') => {
    const activating = tierFilter !== tier;
    setTierFilter(activating ? tier : 'all');
    setCurrentPage(1);
    if (activating) setScrollToTableTick((t) => t + 1);
  };

  // Dimension Breakdown drilldown: clicking a dimension narrows the table to the
  // engagements it was scored for and ranks them by its points (highest first);
  // clicking it again clears the focus and returns to the default ranking.
  const drillIntoDimension = (id: ScoreDimensionId) => {
    const activating = dimensionFocus !== id;
    setDimensionFocus(activating ? id : null);
    setSort(activating ? id : null, 'desc');
    setCurrentPage(1);
    if (activating) setScrollToTableTick((t) => t + 1);
  };

  const clearDimensionFocus = () => {
    setDimensionFocus(null);
    setSort(null);
    setCurrentPage(1);
  };

  const sortProps = (key: string) => ({
    sortKey: key,
    activeKey: sortKey,
    direction: sortDir,
    onSort: (k: string) => {
      handleSort(k);
      setCurrentPage(1);
    },
  });

  const { tiers } = SCORING_CONFIG;
  const tierRange: Record<ScoreTier, string> = {
    Leading: `≥ ${tiers.leading}%`,
    Performing: `${tiers.performing}–${tiers.leading}%`,
    Developing: `${tiers.developing}–${tiers.performing}%`,
    'At Risk': `< ${tiers.developing}%`,
  };
  const tierTooltip: Record<ScoreTier, string> = {
    Leading: `Engagements scoring ${tiers.leading}% or more of the points available to them. Blank dimensions are left out, so missing data doesn't count against an engagement.`,
    Performing: `Engagements scoring ${tiers.performing}% up to (but not including) ${tiers.leading}% of the points available to them.`,
    Developing: `Engagements scoring ${tiers.developing}% up to (but not including) ${tiers.performing}% of the points available to them.`,
    'At Risk': `Engagements scoring below ${tiers.developing}% of the points available to them.`,
  };

  return (
    <div className="flex-1 flex flex-col">
      <GlobalFilterBar filters={filters} onFilterChange={setFilters} filterOptions={data?.filterOptions} />

      <main className="flex-1 p-6 space-y-6 overflow-y-auto">
        <div>
          <h1 className="text-xl font-bold text-ey-light flex items-center gap-2">
            <Target className="w-5 h-5 text-ey-yellow" />
            Engagement Scoring
          </h1>
          <p className="text-xs text-ey-muted mt-1 max-w-3xl">
            Each engagement is scored out of 100 across six dimensions. A dimension with no data behind it is shown blank &mdash; not
            zero &mdash; and left out of the total, so the tier reflects the percentage of the points actually available to that
            engagement.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          <StatTile
            label="Engagements"
            value={scores.length}
            subtitle="in selected scope"
            tooltip="Distinct Engagement Codes with usage or license activity under the current filters. Each is scored on up to six dimensions."
            tooltipAlign="left"
            loading={loading}
          />
          <StatTile
            label="Avg Score"
            value={summary.avgPercent === null ? '—' : `${summary.avgPercent.toFixed(0)}%`}
            subtitle="of available points"
            tooltip="Average of each engagement's score as a percentage of the points that could be scored for it. Engagements with nothing scoreable are left out."
            loading={loading}
          />
          {TIER_ORDER.map((tier) => (
            <StatTile
              key={tier}
              label={tier}
              value={summary.tierCounts[tier]}
              valueClassName={TIER_STYLES[tier].text}
              subtitle={tierRange[tier]}
              tooltip={tierTooltip[tier]}
              loading={loading}
            />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-ey-card border border-ey-border rounded-xl p-5 space-y-4">
            <div>
              <h2 className="text-sm font-bold text-ey-light">Dimension Breakdown</h2>
              <p className="text-[11px] text-ey-muted mt-0.5">
                Average points among the engagements each dimension could be scored for. Click a dimension to see those engagements ranked by it.
              </p>
            </div>
            <div className="space-y-1">
              {summary.dimensions.map(({ def, scoredCount, avg }) => {
                const drillable = scoredCount > 0;
                const active = dimensionFocus === def.id;
                return (
                  <div
                    key={def.id}
                    role="button"
                    tabIndex={drillable ? 0 : -1}
                    aria-pressed={active}
                    aria-disabled={!drillable}
                    onClick={() => drillable && drillIntoDimension(def.id)}
                    onKeyDown={(e) => {
                      if (drillable && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        drillIntoDimension(def.id);
                      }
                    }}
                    className={`space-y-1 rounded-lg px-3 py-2 -mx-3 border transition ${
                      active ? 'bg-ey-card-hover border-ey-yellow/50' : 'border-transparent'
                    } ${drillable ? 'cursor-pointer hover:bg-ey-card-hover/60' : 'cursor-default'}`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-semibold text-ey-light truncate">{def.label}</span>
                        <span className="text-[10px] text-ey-muted font-mono">/{def.maxPoints}</span>
                        <span onClick={(e) => e.stopPropagation()} className="flex">
                          <InfoTooltip widthClassName="w-72" align="left">
                            <span className="font-semibold text-ey-yellow block mb-1">{def.measures}</span>
                            {def.rule}
                            {def.dataNeeded && (
                              <>
                                <br />
                                <span className="text-ey-muted">Needs: {def.dataNeeded}</span>
                              </>
                            )}
                          </InfoTooltip>
                        </span>
                      </div>
                      <span className="font-mono text-[11px] shrink-0">
                        {avg === null ? (
                          <span className="text-ey-muted/60">No data yet</span>
                        ) : (
                          <span className="text-ey-light">
                            {avg.toFixed(1)} <span className="text-ey-muted">avg</span>
                          </span>
                        )}
                      </span>
                    </div>
                    {avg === null ? (
                      <div className="h-2 rounded-full border border-dashed border-ey-border/80" />
                    ) : (
                      <div className="h-2 rounded-full bg-ey-black overflow-hidden">
                        <div className="h-full bg-ey-yellow" style={{ width: `${(avg / def.maxPoints) * 100}%` }} />
                      </div>
                    )}
                    <p className="text-[10px] text-ey-muted">
                      {scoredCount === 0
                        ? def.dataNeeded ?? 'No engagements could be scored.'
                        : `Scored for ${scoredCount} of ${scores.length} engagements`}
                    </p>
                  </div>
                );
              })}
            </div>
            {dimensionFocus && (
              <button type="button" onClick={clearDimensionFocus} className="text-[11px] font-semibold text-ey-yellow hover:underline">
                Clear dimension focus
              </button>
            )}
          </div>

          <div className="bg-ey-card border border-ey-border rounded-xl p-5 space-y-4">
            <div>
              <h2 className="text-sm font-bold text-ey-light">Tier Distribution</h2>
              <p className="text-[11px] text-ey-muted mt-0.5">
                Tier = percentage of available points. Click a tier to drill into its engagements.
              </p>
            </div>
            <div className="w-full h-3 rounded-full overflow-hidden flex bg-ey-black">
              {TIER_ORDER.map((tier) =>
                summary.tierCounts[tier] > 0 ? (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => drillIntoTier(tier)}
                    aria-label={`Show ${summary.tierCounts[tier]} ${tier} engagements`}
                    aria-pressed={tierFilter === tier}
                    className={`h-full ${TIER_STYLES[tier].bar} transition-opacity cursor-pointer hover:brightness-110 ${
                      tierFilter !== 'all' && tierFilter !== tier ? 'opacity-30' : ''
                    }`}
                    style={{ width: `${(summary.tierCounts[tier] / Math.max(scores.length, 1)) * 100}%` }}
                    title={`${tier}: ${summary.tierCounts[tier]} — click to drill in`}
                  />
                ) : null
              )}
            </div>
            <div className="space-y-1">
              {TIER_ORDER.map((tier) => {
                const count = summary.tierCounts[tier];
                const active = tierFilter === tier;
                return (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => drillIntoTier(tier)}
                    disabled={count === 0}
                    aria-pressed={active}
                    className={`w-full flex items-center justify-between text-xs rounded-md px-2 py-1.5 -mx-2 transition border ${
                      active ? 'bg-ey-card-hover border-ey-yellow/50' : 'border-transparent hover:bg-ey-card-hover/60'
                    } ${count === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span className="flex items-center gap-2 text-ey-light">
                      <span className={`inline-block w-2.5 h-2.5 rounded-sm ${TIER_STYLES[tier].bar}`} />
                      {tier}
                    </span>
                    <span className="font-mono text-ey-muted">
                      {count}
                      {scores.length > 0 && <span className="ml-1.5">({((count / scores.length) * 100).toFixed(0)}%)</span>}
                    </span>
                  </button>
                );
              })}
              {summary.unscorable > 0 && (
                <button
                  type="button"
                  onClick={() => drillIntoTier('unscored')}
                  aria-pressed={tierFilter === 'unscored'}
                  className={`w-full flex items-center justify-between text-xs text-ey-muted rounded-md px-2 py-1.5 -mx-2 transition border cursor-pointer ${
                    tierFilter === 'unscored' ? 'bg-ey-card-hover border-ey-yellow/50' : 'border-transparent hover:bg-ey-card-hover/60'
                  }`}
                >
                  <span>Nothing scoreable</span>
                  <span className="font-mono">{summary.unscorable}</span>
                </button>
              )}
            </div>
            {tierFilter !== 'all' && (
              <button
                type="button"
                onClick={() => {
                  setTierFilter('all');
                  setCurrentPage(1);
                }}
                className="text-[11px] font-semibold text-ey-yellow hover:underline"
              >
                Clear tier filter
              </button>
            )}
          </div>
        </div>

        <div ref={tableCardRef} className="bg-ey-card border border-ey-border rounded-xl p-5 space-y-3 scroll-mt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-ey-light">Engagement Scores</h2>
              <p className="text-[11px] text-ey-muted mt-0.5">
                {sortedRows.length} engagement{sortedRows.length === 1 ? '' : 's'}
                {tierFilter !== 'all' && <> in <span className="text-ey-yellow font-semibold">{tierFilter === 'unscored' ? 'Nothing scoreable' : tierFilter}</span></>}
                {dimensionFocus && <> scored on <span className="text-ey-yellow font-semibold">{SCORE_DIMENSIONS.find((d) => d.id === dimensionFocus)?.label}</span></>}{' '}
                &middot; click a row for the full breakdown
              </p>
              {(tierFilter !== 'all' || dimensionFocus) && (
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {tierFilter !== 'all' && (
                    <FilterChip
                      label={`Tier: ${tierFilter === 'unscored' ? 'Nothing scoreable' : tierFilter}`}
                      onClear={() => {
                        setTierFilter('all');
                        setCurrentPage(1);
                      }}
                    />
                  )}
                  {dimensionFocus && (
                    <FilterChip
                      label={`Dimension: ${SCORE_DIMENSIONS.find((d) => d.id === dimensionFocus)?.label}`}
                      onClear={clearDimensionFocus}
                    />
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={tierFilter}
                onChange={(e) => {
                  setTierFilter(e.target.value as TierFilter);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 text-xs bg-ey-black border border-ey-border rounded-lg text-ey-light focus:outline-none focus:border-ey-yellow/50"
                aria-label="Filter by tier"
              >
                <option value="all">All tiers</option>
                {TIER_ORDER.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
                {summary.unscorable > 0 && <option value="unscored">Nothing scoreable</option>}
              </select>
              <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ey-muted pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search engagement code..."
                  className="w-full pl-8 pr-3 py-2 text-xs bg-ey-black border border-ey-border rounded-lg text-ey-light placeholder-ey-muted focus:outline-none focus:border-ey-yellow/50 transition"
                />
              </div>
            </div>
          </div>

          {error ? (
            <div className="py-10 text-center text-sm text-rose-300">Couldn&apos;t load scores: {error}</div>
          ) : loading ? (
            <div className="py-10 text-center text-sm text-ey-muted animate-pulse">Calculating scores…</div>
          ) : (
            <>
              <div className="overflow-x-auto border border-ey-border rounded-xl">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-ey-black/70 text-ey-muted uppercase tracking-wider border-b border-ey-border">
                    <tr>
                      <SortableTh label="Engagement" className="px-4 py-3" {...sortProps('projectCode')} />
                      <th className="px-4 py-3">Tools</th>
                      {SCORE_DIMENSIONS.map((def) => (
                        <SortableTh
                          key={def.id}
                          label={
                            <span className="text-center">
                              {def.label}
                              <span className="block text-[9px] font-normal normal-case">/{def.maxPoints}</span>
                            </span>
                          }
                          className={`px-3 py-3 text-right ${dimensionFocus === def.id ? 'bg-ey-yellow/10' : ''}`}
                          align="right"
                          {...sortProps(def.id)}
                        />
                      ))}
                      <SortableTh label="Total" className="px-4 py-3 text-right" align="right" {...sortProps('percent')} />
                      <th className="px-4 py-3">Tier</th>
                      <SortableTh label="Scored" className="px-4 py-3 text-right" align="right" {...sortProps('completeness')} />
                      <SortableTh label="Cost" className="px-4 py-3 text-right" align="right" {...sortProps('totalCost')} />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ey-border">
                    {pageRows.length === 0 ? (
                      <tr>
                        <td colSpan={SCORE_DIMENSIONS.length + 6} className="px-4 py-8 text-center text-ey-muted">
                          No engagements match.
                        </td>
                      </tr>
                    ) : (
                      pageRows.map((s) => (
                        <tr
                          key={s.projectCode}
                          onClick={() => setSelectedCode(s.projectCode)}
                          className="hover:bg-ey-card-hover/60 transition cursor-pointer"
                        >
                          <td className="px-4 py-2.5 font-bold text-ey-yellow whitespace-nowrap">{s.projectCode}</td>
                          <td className="px-4 py-2.5 text-ey-muted max-w-[180px] truncate" title={s.aiTools.join(', ')}>
                            {s.aiTools.join(', ') || '—'}
                          </td>
                          {SCORE_DIMENSIONS.map((def) => (
                            <td key={def.id} className={`px-3 py-2.5 text-right ${dimensionFocus === def.id ? 'bg-ey-yellow/5' : ''}`}>
                              <ScoreCell score={s} id={def.id} />
                            </td>
                          ))}
                          <td className="px-4 py-2.5 text-right whitespace-nowrap">
                            {s.percent === null ? (
                              <span className="text-ey-muted/40">&mdash;</span>
                            ) : (
                              <>
                                <span className="font-bold text-ey-light">{s.scoredPoints.toFixed(1)}</span>
                                <span className="text-[10px] text-ey-muted"> / {s.availablePoints}</span>
                              </>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            {s.tier ? (
                              <span className={`inline-block whitespace-nowrap px-2 py-0.5 rounded text-[10px] font-bold border ${TIER_STYLES[s.tier].badge}`}>{s.tier}</span>
                            ) : (
                              <span className="text-ey-muted/40">&mdash;</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right text-ey-muted whitespace-nowrap">
                            {s.scoredDimensionCount}/{s.dimensions.length}
                          </td>
                          <td className="px-4 py-2.5 text-right text-ey-muted whitespace-nowrap">{formatCompactCurrency(s.totalCost)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-1 text-xs text-ey-muted">
                  <div>
                    Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sortedRows.length)} of {sortedRows.length}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      disabled={page === 1}
                      onClick={() => setCurrentPage(page - 1)}
                      className="px-3 py-1 bg-ey-black border border-ey-border rounded-lg hover:bg-ey-card-hover disabled:opacity-40 disabled:cursor-not-allowed font-medium"
                    >
                      Previous
                    </button>
                    <span className="font-mono">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      disabled={page === totalPages}
                      onClick={() => setCurrentPage(page + 1)}
                      className="px-3 py-1 bg-ey-black border border-ey-border rounded-lg hover:bg-ey-card-hover disabled:opacity-40 disabled:cursor-not-allowed font-medium"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {selected && <EngagementScoreDetail score={selected} onClose={() => setSelectedCode(null)} />}
    </div>
  );
}

export default function EngagementScoringPage() {
  return <EngagementScoring />;
}
