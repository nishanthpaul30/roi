'use client';

import { useMemo, useState } from 'react';
import { TokenCostSummary, GlobalFilterState } from '@/lib/metrics/types';
import { useRawRows } from '@/hooks/useRawRows';
import { formatCompactCurrency as fmtCost, formatCompactNumber } from '@/lib/format';
import { HierarchyDrilldownPanel } from './HierarchyDrilldownPanel';
import {
  Layers,
  Zap,
  Users,
  DollarSign,
  TrendingUp,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  ArrowUpRight,
  ChevronRight,
} from 'lucide-react';

interface MultiToolComparisonPanelProps {
  summary: TokenCostSummary | null;
  onDrilldown?: (tool?: string, userMail?: string) => void;
  filters?: GlobalFilterState;
}

const TOOL_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string; barBg: string }
> = {
  chatgpt: {
    label: 'ChatGPT Enterprise',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    barBg: 'bg-emerald-500',
  },
  github: {
    label: 'GitHub Copilot Enterprise',
    bg: 'bg-indigo-500/10',
    text: 'text-indigo-400',
    border: 'border-indigo-500/30',
    barBg: 'bg-indigo-500',
  },
  claude: {
    label: 'Claude Enterprise',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    barBg: 'bg-amber-500',
  },
  replit: {
    label: 'Replit Enterprise',
    bg: 'bg-sky-500/10',
    text: 'text-sky-400',
    border: 'border-sky-500/30',
    barBg: 'bg-sky-500',
  },
  factory: {
    label: 'Factory AI Enterprise',
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    border: 'border-rose-500/30',
    barBg: 'bg-rose-500',
  },
  cursor: {
    label: 'Cursor AI Enterprise',
    bg: 'bg-fuchsia-500/10',
    text: 'text-fuchsia-400',
    border: 'border-fuchsia-500/30',
    barBg: 'bg-fuchsia-500',
  },
};

export function MultiToolComparisonPanel({ summary, onDrilldown, filters }: MultiToolComparisonPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showOverlapUsers, setShowOverlapUsers] = useState(false);

  // Raw CSV rows, needed to walk the mandated hierarchy before any overlap user is named.
  const { rows: allRows } = useRawRows(filters);

  const multiToolOverlap = summary?.multiToolOverlap;
  const overlapHierarchyRows = useMemo(() => {
    if (!multiToolOverlap?.multiToolUserList?.length) return [];
    const allowedEmails = new Set(multiToolOverlap.multiToolUserList.map((u) => u.userMail.toLowerCase()));
    return allRows.filter((r) => allowedEmails.has((r.userMail || '').toLowerCase()));
  }, [allRows, multiToolOverlap]);

  if (!summary || !summary.byAiTool || summary.byAiTool.length === 0) {
    return null;
  }

  // GitHub Copilot always displays first; the rest keep their existing relative order.
  const byAiTool = [...summary.byAiTool].sort((a, b) => (a.tool === 'github' ? -1 : b.tool === 'github' ? 1 : 0));

  // Find lowest cost per 1k tokens for efficiency highlight
  const minCostPer1k = Math.min(...byAiTool.map((t) => t.costPer1kTokens || 0));

  return (
    <div className="bg-ey-card border border-ey-border rounded-xl p-5 shadow-lg space-y-4">
      {/* Panel Header */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${isExpanded ? 'border-b border-ey-border/60 pb-3' : ''}`}>
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-ey-yellow/20 border border-ey-yellow/40 rounded-lg text-ey-yellow shrink-0 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-ey-light tracking-tight flex items-center gap-2">
              <span>Multi-Tool Spend &amp; Efficiency Comparison</span>
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-ey-yellow/10 text-ey-yellow border border-ey-yellow/30 rounded-full font-mono hidden md:inline-block">
                {byAiTool.map((t) => TOOL_CONFIG[t.tool]?.label.replace(' Enterprise', '') || t.tool).join(' vs ')}
              </span>
            </h2>
            <p className="text-xs text-ey-muted mt-0.5">
              Unit economics, user spend density, token cost efficiency ($/1K tokens), and license overlap detection.
            </p>
          </div>
        </div>

        {/* Quick summary tag, Drilldown CTA & Collapse Toggle */}
        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0 self-start sm:self-center">
          {onDrilldown && (
            <button
              onClick={() => onDrilldown()}
              className="flex items-center space-x-1.5 text-xs font-semibold text-ey-black bg-ey-yellow hover:bg-yellow-400 px-3 py-1.5 rounded-lg transition shadow shrink-0 cursor-pointer"
              title="Drill down to Level 2 Decomposition and Level 4 Raw Telemetry Logs"
            >
              <span>Deep Dive</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}

          <div className="hidden sm:flex items-center space-x-1.5 bg-ey-black/60 border border-ey-border px-2.5 py-1.5 rounded-lg text-xs font-mono">
            <Cpu className="w-3.5 h-3.5 text-ey-yellow" />
            <span className="text-ey-muted">Platforms:</span>
            <span className="text-ey-light font-bold">{byAiTool.length}</span>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center space-x-1.5 text-xs font-semibold text-ey-yellow hover:text-ey-light bg-ey-black/60 border border-ey-border px-3 py-1.5 rounded-lg transition shrink-0 cursor-pointer"
            title={isExpanded ? "Collapse insights" : "Expand insights"}
          >
            <span>{isExpanded ? 'Collapse Insights' : 'Expand Insights'}</span>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <>

      {/* Tool Comparison Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {byAiTool.map((toolData) => {
          const config = TOOL_CONFIG[toolData.tool] || {
            label: toolData.tool.toUpperCase(),
            bg: 'bg-purple-500/10',
            text: 'text-purple-400',
            border: 'border-purple-500/30',
            barBg: 'bg-purple-500',
          };

          const isMostEfficient =
            toolData.costPer1kTokens > 0 && toolData.costPer1kTokens === minCostPer1k;

          return (
            <div
              key={toolData.tool}
              onClick={() => onDrilldown?.(toolData.tool)}
              className={`bg-ey-black border ${config.border} hover:border-ey-yellow/80 hover:shadow-lg rounded-xl p-5 space-y-4 relative overflow-hidden flex flex-col justify-between cursor-pointer transition-all duration-200 group`}
              title={`Click to drill down into ${config.label} metrics and root-cause telemetry`}
            >
              {/* Tool Header */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-md border ${config.bg} ${config.text} ${config.border}`}
                  >
                    {config.label}
                  </span>
                  {isMostEfficient && (
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-full flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Most Efficient
                    </span>
                  )}
                </div>

                {/* Primary Spend & Token Stats */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <p className="text-[10px] font-mono text-ey-muted uppercase">Total Spend</p>
                    <p className="text-xl font-extrabold text-ey-light font-mono">
                      {fmtCost(toolData.cost)}
                    </p>
                    <p className="text-[10px] text-ey-muted">
                      {toolData.spendSharePercent.toFixed(1)}% of total spend
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] font-mono text-ey-muted uppercase">Tokens Consumed</p>
                    <p className="text-xl font-extrabold text-ey-light font-mono">
                      {formatCompactNumber(toolData.tokens)}
                    </p>
                    <p className="text-[10px] text-ey-muted">
                      {toolData.tokenSharePercent.toFixed(1)}% token share
                    </p>
                  </div>
                </div>
              </div>

              {/* Unit Economics Breakdown */}
              <div className="border-t border-ey-border/60 pt-3 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-ey-muted flex items-center gap-1 text-[11px]">
                    <Users className="w-3.5 h-3.5 text-ey-yellow" /> Active Users
                  </span>
                  <span className="font-bold text-ey-light font-mono">{toolData.userCount} users</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-ey-muted flex items-center gap-1 text-[11px]">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Avg Cost / User
                  </span>
                  <span className="font-bold text-emerald-400 font-mono">
                    {fmtCost(toolData.avgCostPerUser)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-ey-muted flex items-center gap-1 text-[11px]">
                    <Zap className="w-3.5 h-3.5 text-amber-400" /> Cost / 1K Tokens
                  </span>
                  <span
                    className={`font-bold font-mono ${
                      isMostEfficient ? 'text-emerald-400 font-extrabold' : 'text-ey-yellow'
                    }`}
                  >
                    ${toolData.costPer1kTokens.toFixed(4)}
                  </span>
                </div>
              </div>

              {/* Share Bar */}
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-[10px] text-ey-muted">
                  <span>Spend Share</span>
                  <span>{toolData.spendSharePercent.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-ey-card h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${config.barBg} rounded-full`}
                    style={{ width: `${Math.min(100, Math.max(2, toolData.spendSharePercent))}%` }}
                  />
                </div>
              </div>

              {/* Card Drilldown Indicator Footer */}
              <div className="pt-2 border-t border-ey-border/40 text-[10px] text-ey-yellow font-mono font-bold flex items-center justify-between group-hover:text-ey-light">
                <span>Inspect {config.label}</span>
                <ChevronRight className="w-3.5 h-3.5 text-ey-yellow group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Visual Portfolio Distribution Bars */}
      <div className="bg-ey-black border border-ey-border rounded-xl p-4 space-y-4">
        <h3 className="text-xs font-bold text-ey-light uppercase tracking-wider font-mono flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-ey-yellow" />
          Comparative Portfolio Share Distribution
        </h3>

        {/* Spend Distribution Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-ey-muted">Spend Distribution ($):</span>
            <span className="text-ey-light">
              Total {fmtCost(summary.totalSpend)}
            </span>
          </div>
          <div className="w-full bg-ey-card h-3.5 rounded-lg overflow-hidden flex p-0.5 gap-0.5">
            {byAiTool.map((t) => {
              const cfg = TOOL_CONFIG[t.tool] || { barBg: 'bg-purple-500', label: t.tool };
              return (
                <div
                  key={t.tool}
                  className={`${cfg.barBg} h-full first:rounded-l-md last:rounded-r-md transition-all duration-300 relative group`}
                  style={{ width: `${t.spendSharePercent}%` }}
                  title={`${cfg.label}: ${t.spendSharePercent.toFixed(1)}% (${fmtCost(t.cost)})`}
                />
              );
            })}
          </div>
          <div className="flex items-center gap-4 text-[11px] text-ey-muted pt-1">
            {byAiTool.map((t) => {
              const cfg = TOOL_CONFIG[t.tool] || { label: t.tool, text: 'text-purple-400' };
              return (
                <div key={t.tool} className="flex items-center space-x-1.5 font-mono">
                  <div className={`w-2.5 h-2.5 rounded-full ${cfg.text.replace('text-', 'bg-')}`} />
                  <span>{cfg.label}:</span>
                  <strong className="text-ey-light">{fmtCost(t.cost)} ({t.spendSharePercent.toFixed(1)}%)</strong>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Multi-Tool License Overlap & Consolidation Box */}
      {multiToolOverlap && (
        <div className="border border-amber-500/30 bg-amber-500/5 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-500/20 pb-3">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-amber-500/20 border border-amber-500/40 rounded-lg text-amber-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-ey-light tracking-tight flex items-center gap-2">
                  <span>Multi-Tool License Overlap &amp; License Consolidation Alert</span>
                </h3>
                <p className="text-xs text-ey-muted">
                  Users active across multiple AI platforms concurrently during this period.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4 font-mono text-xs">
              <div className="bg-ey-black border border-amber-500/30 px-3 py-1.5 rounded-lg text-right">
                <span className="text-amber-400 font-extrabold text-sm block">
                  {multiToolOverlap.dualToolUserCount} Users
                </span>
                <span className="text-[10px] text-ey-muted">Active on 2+ Tools</span>
              </div>
              <div className="bg-ey-black border border-amber-500/30 px-3 py-1.5 rounded-lg text-right">
                <span className="text-emerald-400 font-extrabold text-sm block">
                  {fmtCost(multiToolOverlap.totalDualToolSpend)}
                </span>
                <span className="text-[10px] text-ey-muted">Dual-License Spend</span>
              </div>
            </div>
          </div>

          <div className="text-xs text-ey-muted space-y-2">
            <div className="flex items-start space-x-2 bg-ey-black/60 p-3 rounded-lg border border-ey-border/60">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <p>
                <strong className="text-ey-light">Consolidation Insight:</strong> {multiToolOverlap.dualToolUserCount} power users generated active billable events on multiple AI tools (e.g., ChatGPT + Copilot or Claude + ChatGPT). Standardizing these users to a single primary Enterprise AI platform can eliminate redundant license costs while concentrating volume discounts.
              </p>
            </div>

            {/* Collapsible Overlap User List */}
            {multiToolOverlap.multiToolUserList.length > 0 && (
              <div className="pt-2">
                <button
                  onClick={() => setShowOverlapUsers(!showOverlapUsers)}
                  className="flex items-center space-x-2 text-xs font-mono font-bold text-ey-yellow hover:underline transition-all"
                >
                  {showOverlapUsers ? (
                    <>
                      <ChevronUp className="w-4 h-4" />
                      <span>Hide {multiToolOverlap.multiToolUserList.length} Dual-Platform Users</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      <span>View {multiToolOverlap.multiToolUserList.length} Dual-Platform Users &amp; Spend Breakdown</span>
                    </>
                  )}
                </button>

                {showOverlapUsers && (
                  <div className="mt-3">
                    <HierarchyDrilldownPanel
                      rows={overlapHierarchyRows}
                      title="Dual-Platform License Hierarchy"
                      subtitle="Individual user identity is only revealed at the final step of the required hierarchy."
                      onSelectUser={(email) => onDrilldown?.(undefined, email)}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
