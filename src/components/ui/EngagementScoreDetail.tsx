'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { SCORE_DIMENSIONS, type EngagementScore, type ScoreTier } from '@/lib/metrics/scoringConfig';

// Full literal class strings so Tailwind's JIT can see them.
export const TIER_STYLES: Record<ScoreTier, { badge: string; bar: string; text: string }> = {
  Leading: { badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', bar: 'bg-emerald-400', text: 'text-emerald-300' },
  Performing: { badge: 'bg-sky-500/15 text-sky-300 border-sky-500/30', bar: 'bg-sky-400', text: 'text-sky-300' },
  Developing: { badge: 'bg-ey-yellow/15 text-ey-yellow border-ey-yellow/30', bar: 'bg-ey-yellow', text: 'text-ey-yellow' },
  'At Risk': { badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30', bar: 'bg-rose-400', text: 'text-rose-300' },
};

interface EngagementScoreDetailProps {
  score: EngagementScore;
  onClose: () => void;
}

/**
 * Side panel with the full per-dimension breakdown for one engagement. A
 * dimension that couldn't be scored is shown as an empty bar with the reason,
 * not as a zero.
 */
export function EngagementScoreDetail({ score, onClose }: EngagementScoreDetailProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const tierStyle = score.tier ? TIER_STYLES[score.tier] : null;
  const blankCount = score.dimensions.length - score.scoredDimensionCount;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <aside
        className="fixed top-0 right-0 h-full w-full max-w-md bg-ey-card border-l border-ey-border shadow-2xl z-50 overflow-y-auto p-5 space-y-5"
        role="dialog"
        aria-label={`Score breakdown for ${score.projectCode}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-ey-yellow font-mono">{score.projectCode}</h2>
            <p className="text-[11px] text-ey-muted mt-0.5">
              {[score.engagementServiceLine, score.engagementCompetency]
                .filter(Boolean)
                .join(' · ') || '—'}
            </p>
            <p className="text-[11px] text-ey-muted">Tools: {score.aiTools.length > 0 ? score.aiTools.join(', ') : '—'}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-ey-muted hover:text-ey-light hover:bg-ey-card-hover transition shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-ey-black/60 border border-ey-border/80 rounded-xl p-4 space-y-2">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] text-ey-muted uppercase tracking-wider">Total score</p>
              <p className="text-3xl font-extrabold text-ey-light font-mono">
                {score.percent === null ? '—' : score.scoredPoints.toFixed(1)}
                {score.percent !== null && (
                  <span className="text-sm text-ey-muted font-normal"> / {score.availablePoints} available</span>
                )}
              </p>
            </div>
            {score.tier && tierStyle && (
              <span className={`whitespace-nowrap px-2.5 py-1 rounded-md text-xs font-bold border ${tierStyle.badge}`}>{score.tier}</span>
            )}
          </div>
          {score.percent !== null && tierStyle && (
            <div className="h-2 rounded-full bg-ey-card overflow-hidden">
              <div className={`h-full ${tierStyle.bar}`} style={{ width: `${Math.min(score.percent, 100)}%` }} />
            </div>
          )}
          <p className="text-[11px] text-ey-muted">
            {score.percent === null ? 'Nothing could be scored for this engagement.' : `${score.percent.toFixed(0)}% of available points`} &middot;{' '}
            {score.scoredDimensionCount} of {score.dimensions.length} dimensions scored
          </p>
        </div>

        <div className="space-y-4">
          {score.dimensions.map((d) => {
            const def = SCORE_DIMENSIONS.find((x) => x.id === d.id);
            if (!def) return null;
            return (
              <div key={d.id} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <div>
                    <span className="text-xs font-semibold text-ey-light">{def.label}</span>
                    <span className="text-[10px] text-ey-muted ml-1.5">{def.measures}</span>
                  </div>
                  {d.score === null ? (
                    <span className="text-xs font-mono text-ey-muted/60">— / {d.maxPoints}</span>
                  ) : (
                    <span className="text-xs font-mono font-bold text-ey-light">
                      {d.score.toFixed(1)} <span className="text-ey-muted font-normal">/ {d.maxPoints}</span>
                    </span>
                  )}
                </div>
                {d.score === null ? (
                  <div className="h-2 rounded-full border border-dashed border-ey-border/80" />
                ) : (
                  <div className="h-2 rounded-full bg-ey-black overflow-hidden">
                    <div className="h-full bg-ey-yellow" style={{ width: `${(d.score / d.maxPoints) * 100}%` }} />
                  </div>
                )}
                <p className={`text-[11px] leading-relaxed ${d.score === null ? 'text-ey-muted italic' : 'text-ey-muted'}`}>{d.detail}</p>
              </div>
            );
          })}
        </div>

        {blankCount > 0 && (
          <p className="text-[11px] text-ey-muted border-t border-ey-border/60 pt-3">
            Blank dimensions are left out of the total and the tier &mdash; the tier is based on the percentage of the{' '}
            {score.availablePoints} points that could be scored here, so missing data doesn&apos;t count against this engagement.
          </p>
        )}
      </aside>
    </>
  );
}
