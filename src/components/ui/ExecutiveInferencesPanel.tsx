'use client';

import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Sparkles,
  Layers,
  ArrowUpRight,
  ShieldAlert,
  CheckCircle2,
  BadgeDollarSign,
  AlertTriangle,
  Clock3,
} from 'lucide-react';
import { TokenCostSummary, GlobalFilterState } from '@/lib/metrics/types';
import { generatePrescriptiveInferences, PrescriptiveInference } from '@/lib/metrics/prescriptiveEngine';

interface ExecutiveInferencesPanelProps {
  summary?: TokenCostSummary;
  filters?: GlobalFilterState;
  onSelectInference?: (inferenceId: string) => void;
}

const INFERENCE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  license_reclamation: BadgeDollarSign,
  project_billability: Layers,
  pareto_risk: ShieldAlert,
  hours_saved_roi: Clock3,
  multi_tool_comparison: Layers,
  non_billable_overrun: AlertTriangle,
};

export function ExecutiveInferencesPanel({ summary, filters, onSelectInference }: ExecutiveInferencesPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!summary) return null;

  // The summary already carries pre-aggregated multiToolOverlap and byProjectCode
  // data — the same values the engine uses when no row-level data is provided.
  // Passing no rows here means all 6 inferences render immediately on first
  // paint with stable, final values: no fetch delay, no re-sort glitch.
  const inferences: PrescriptiveInference[] = generatePrescriptiveInferences(summary);

  const handleCardClick = (item: { id: string }) => {
    onSelectInference?.(item.id);
  };

  return (
    <div className="bg-ey-card border border-ey-border rounded-xl p-5 shadow-lg space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-ey-border/60 pb-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-ey-yellow/20 border border-ey-yellow/40 rounded-lg text-ey-yellow shrink-0 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-ey-light tracking-tight">
              Leadership Strategic Inferences &amp; Decision Intelligence
            </h2>
            <p className="text-xs text-ey-muted mt-0.5">
              Ranked dynamically by financial leverage and operational risk for current filters
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0 self-start sm:self-center">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center space-x-1.5 text-xs font-semibold text-ey-yellow hover:text-ey-light bg-ey-black/60 border border-ey-border px-3 py-1.5 rounded-lg transition cursor-pointer"
          >
            <span>{isExpanded ? 'Collapse Insights' : 'Expand Insights'}</span>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Grid of Inferences */}
      {isExpanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
          {inferences.map((item) => {
            const IconComponent = INFERENCE_ICONS[item.id] || Layers;

            return (
              <div
                key={item.id}
                onClick={() => handleCardClick(item)}
                className="bg-ey-black/70 border border-ey-border/80 rounded-xl p-4 space-y-3 hover:border-ey-yellow hover:shadow-xl hover:shadow-yellow-500/5 hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between cursor-pointer group select-none relative"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCardClick(item);
                  }
                }}
              >
                <div className="space-y-2.5">
                  {/* Top Badges: Category & Icon */}
                  <div className="flex items-center justify-between gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${item.tagColor} truncate`}>
                      {item.tag}
                    </span>
                    <IconComponent className="w-4 h-4 text-ey-muted group-hover:text-ey-yellow transition-colors shrink-0" />
                  </div>

                  {/* Title */}
                  <div>
                    <h3 className="text-xs font-bold text-ey-light leading-snug group-hover:text-ey-yellow transition-colors flex items-center justify-between">
                      <span>{item.title}</span>
                    </h3>
                  </div>

                  {/* Headline Metric Highlight */}
                  <div className="bg-ey-card/90 p-2.5 rounded-lg border border-ey-border/60 flex items-center justify-between group-hover:border-ey-yellow/40 transition-colors">
                    <div>
                      <div className="text-sm font-extrabold text-ey-yellow">{item.stat}</div>
                      <div className="text-[10px] text-ey-muted">{item.statSub}</div>
                    </div>
                    <div className="p-1 rounded-md bg-ey-yellow/10 text-ey-yellow group-hover:bg-ey-yellow group-hover:text-ey-black transition-colors shrink-0">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  {/* Diagnostic Finding */}
                  <p className="text-[11px] text-ey-muted leading-relaxed line-clamp-3">
                    <strong className="text-ey-light font-semibold">Finding: </strong>
                    {item.finding}
                  </p>
                </div>

                {/* Prescriptive Recommendation */}
                <div className="pt-2 border-t border-ey-border/60 space-y-2">
                  {/* Dynamic Suggestive Action */}
                  <div className="text-[11px] bg-ey-yellow/5 p-2 rounded-lg border border-ey-yellow/20 group-hover:border-ey-yellow/30 transition-colors">
                    <span className="font-bold text-ey-yellow block mb-0.5 text-[10px] uppercase tracking-wider">
                      Suggestive Action:
                    </span>
                    <span className="text-ey-light text-[10px] leading-normal line-clamp-3">
                      {item.actionableInsight}
                    </span>
                  </div>

                  {/* Benefits & Outcome */}
                  <div className="text-[11px] bg-emerald-500/5 p-2 rounded-lg border border-emerald-500/20 group-hover:border-emerald-500/30 transition-colors">
                    <span className="font-bold text-emerald-400 flex items-center gap-1 mb-0.5 text-[10px] uppercase tracking-wider">
                      <CheckCircle2 className="w-3 h-3" />
                      Benefits &amp; Outcome:
                    </span>
                    <span className="text-ey-light text-[10px] leading-normal line-clamp-2">
                      {item.benefitOutcome}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
