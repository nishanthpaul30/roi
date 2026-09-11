'use client';

import { useState } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Zap,
  Building2,
  Users,
  UserCheck,
  UserX,
  Target,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Layers,
  ArrowUpRight,
  ShieldAlert,
  FolderKanban,
  BarChart3,
} from 'lucide-react';
import { TokenCostSummary } from '@/lib/metrics/types';

interface ExecutiveInferencesPanelProps {
  summary?: TokenCostSummary;
  onSelectInference?: (inferenceId: string) => void;
}

export function ExecutiveInferencesPanel({ summary, onSelectInference }: ExecutiveInferencesPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Derive dynamic active / inactive telemetry stats from current summary context
  const totalRosterSeats = 70;
  const activeUserCount = summary?.topUsers ? summary.topUsers.length : 64;
  const inactiveUserCount = Math.max(0, totalRosterSeats - activeUserCount);
  const activeSeatPercent = ((activeUserCount / totalRosterSeats) * 100).toFixed(1);
  const inactiveLeakageCost = inactiveUserCount * 100; // $100/mo seat license cost

  const inferences = [
    {
      id: 'seat_utilization',
      title: 'Active / Inactive Users Telemetry (Seat Utilization)',
      tag: 'User Engagement Telemetry',
      tagColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      icon: UserCheck,
      stat: `${activeSeatPercent}% Active Utilization`,
      statSub: `${activeUserCount} Active vs ${inactiveUserCount} Inactive Seats ($${inactiveLeakageCost}/mo Leakage)`,
      finding:
        inactiveUserCount > 0
          ? `Out of ${totalRosterSeats} provisioned enterprise license seats, ${activeUserCount} users (${activeSeatPercent}%) recorded prompt activity in the selected window, while ${inactiveUserCount} seats (${(100 - parseFloat(activeSeatPercent)).toFixed(1)}%) remained completely inactive (0 tokens consumed), resulting in $${inactiveLeakageCost}/mo in unutilized seat license cost leakage.`
          : `All ${totalRosterSeats} provisioned enterprise license seats recorded active prompt consumption during this window, achieving 100% active seat engagement with zero dormant license overhead.`,
      actionableInsight:
        inactiveUserCount > 0
          ? `Automate a 30-day inactivity license reclamation workflow: automatically reallocate dormant seats to waitlisted teams or convert low-activity seats to consumption-only API keys.`
          : `Maintain active monitoring and expand license seat capacity proactively as new engineering cohorts onboard.`,
    },
    {
      id: 'financial_volatility',
      title: 'Financial Run-Rate & Volatility Alert',
      tag: 'Financial Governance',
      tagColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      icon: TrendingUp,
      stat: '+37.8% MoM Surge',
      statSub: 'August rebound to $277.60',
      finding:
        'Spend swung from $302.60 in March down to $182.70 in June, before surging +37.8% to $277.60 in August. High month-over-month volatility (-35.1% to +37.8%) reflects unmanaged on-demand usage.',
      actionableInsight:
        'Re-forecast mid-cycle budgets and establish monthly automated budget thresholds to smooth run-rate volatility.',
    },
    {
      id: 'pareto_risk',
      title: 'Pareto Cost Concentration (80/20 Risk)',
      tag: 'Cost Risk Exposure',
      tagColor: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
      icon: ShieldAlert,
      stat: '69.1% Spend in Top 20%',
      statSub: '14 power users drive majority cost',
      finding:
        'Spend is heavily concentrated: the top 10% of users (7 people) account for 46.5% of total spend, and the top 20% (14 people) account for 69.1% of all expenditure ($951.17).',
      actionableInsight:
        'Avoid broad, org-wide cuts. Conduct targeted usage reviews for the top 14 power users and negotiate tier-based volume plans.',
    },
    {
      id: 'multi_tool_comparison',
      title: 'Multi-Tool Spend & Efficiency Comparison',
      tag: 'Vendor Optimization',
      tagColor: 'bg-ey-yellow/10 text-ey-yellow border-ey-yellow/30',
      icon: Zap,
      stat: '81% Effective Rate Spread',
      statSub: 'Copilot $10.13/M vs Claude $18.31/M',
      finding:
        'Copilot unit cost is $10.13/M tokens, ChatGPT is $15.28/M (+50.8%), and Claude is $18.31/M (+80.7%). ChatGPT accounts for 46.2% of spend ($635.89) despite equal user count (32) with Copilot.',
      actionableInsight:
        'Steer high-volume, lower-complexity prompt workloads toward lower unit-cost tools ($10.13/M tokens) to reduce token spend.',
    },
    {
      id: 'geo_asymmetry',
      title: 'Geographic & Service Line Asymmetry',
      tag: 'Organizational Skew',
      tagColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
      icon: Building2,
      stat: '48.3% Spend in APAC',
      statSub: 'Consulting leads at 32.7% ($450.00)',
      finding:
        'APAC accounts for $665.24 (48.3% of spend) — >3x Americas ($211.54). Australia alone drives $385.50 (28% of total company spend). Consulting leads all units at $450.00 (>3x Healthcare).',
      actionableInsight:
        'Rebalance regional AI budget allocations and validate if Consulting spend reflects genuine client delivery intensity or unmanaged growth.',
    },
    {
      id: 'project_billability',
      title: 'Client Billability & Project Telemetry Alignment',
      tag: 'Project ROI Governance',
      tagColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      icon: Layers,
      stat: '78.4% Billable AI Spend',
      statSub: 'Client Projects (E-XXXXXX) vs Internal (I-XXXXXX)',
      finding:
        '78.4% of total AI spend is directly assigned to revenue-generating client projects (E-XXXXXX codes). Internal R&D projects (I-XXXXXX codes) account for 21.6% of spend, maintaining healthy innovation without non-billable cost leakage.',
      actionableInsight:
        'Audit top 5 internal project codes (I-XXXXXX) to ensure non-billable AI investment yields reusable intellectual property or client delivery templates.',
    },
    {
      id: 'external_vs_internal',
      title: 'External Projects vs. Internal Projects',
      tag: 'Portfolio Capitalization Governance',
      tagColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      icon: FolderKanban,
      stat: '66.1% External vs 33.9% Internal',
      statSub: '$909.66 Client Engagements (47 PRJs) vs $466.86 Internal R&D (23 PRJs)',
      finding:
        'Out of $1,376.51 in total AI consumption, $909.66 (66.1% across 696 transactions) was deployed on 47 external client delivery engagements (E-codes) with full fee-recovery potential, while $466.86 (33.9% across 304 transactions) was absorbed by 23 internal R&D and innovation codes (I-codes).',
      actionableInsight:
        'Institute mandatory capitalization milestone reviews for internal projects exceeding $50 in cumulative AI spend to verify IP conversion, while ensuring external client AI charges are systematically billed back to client engagements.',
    },
    {
      id: 'service_line_comparison',
      title: 'Service Line Usage & Cost Efficiency Comparison',
      tag: 'Practice Cost Benchmarking',
      tagColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      icon: BarChart3,
      stat: 'Consulting 32.7% Spend vs CBS $28.30/User Peak',
      statSub: 'Assurance lowest unit cost ($13.27/M) vs CBS highest ($15.38/M)',
      finding:
        'Usage and expenditure diverge sharply across service lines: Consulting leads in overall volume at $450.00 (32.7% of spend across 32.9M tokens), but Core Business Services (CBS) exhibits the highest per-user intensity at $28.30/user (+32% above Consulting) and the highest unit cost at $15.38/M tokens due to heavy Claude/ChatGPT weighting and 64.3% internal R&D allocation ($218.46). In contrast, Assurance achieves benchmark efficiency at $13.27/M tokens with 94.5% client billability ($260.68).',
      actionableInsight:
        'Cross-pollinate Assurance\'s high-efficiency prompt patterns (94.5% client fee pass-through) to CBS and Consulting. Establish automated cost-routing policies in CBS to curb the $15.38/M unit rate by transitioning routine data queries from Claude/ChatGPT to lower-cost models.',
    },
    {
      id: 'habitual_retention',
      title: 'Habitual User Retention & Health',
      tag: 'Adoption Health',
      tagColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      icon: Users,
      stat: '100% Habitual Retention',
      statSub: '36% Embedded, 57% Regular, 0% Dropouts',
      finding:
        'All active users show habitual retention: 36% Embedded (16+ days/mo), 57% Regular (9-15 days/mo), and 7% Occasional (4-8 days/mo). Zero users fell into a one-off trial-only bucket.',
      actionableInsight:
        'AI tools have transitioned from pilot curiosity to daily core workflow. Focus shift from basic onboarding to advanced competency training.',
    },
  ];

  const handleCardClick = (id: string) => {
    if (onSelectInference) {
      onSelectInference(id);
    }
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
              C-Suite actionable insights derived directly from <span className="font-mono text-ey-yellow font-medium">ai_usage_data.csv</span>
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center space-x-1.5 text-xs font-semibold text-ey-yellow hover:text-ey-light bg-ey-black/60 border border-ey-border px-3 py-1.5 rounded-lg transition shrink-0 self-start sm:self-center cursor-pointer"
        >
          <span>{isExpanded ? 'Collapse Insights' : 'Expand Insights'}</span>
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Grid of Inferences */}
      {isExpanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
          {inferences.map((item) => {
            const IconComponent = item.icon;
            return (
              <div
                key={item.id}
                onClick={() => handleCardClick(item.id)}
                className="bg-ey-black/70 border border-ey-border/80 rounded-xl p-4 space-y-3 hover:border-ey-yellow hover:shadow-xl hover:shadow-yellow-500/5 hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between cursor-pointer group select-none"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCardClick(item.id);
                  }
                }}
              >
                <div className="space-y-2.5">
                  {/* Top Badge & Metric */}
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${item.tagColor}`}>
                      {item.tag}
                    </span>
                    <IconComponent className="w-4 h-4 text-ey-muted group-hover:text-ey-yellow transition-colors" />
                  </div>

                  <h3 className="text-xs font-bold text-ey-light leading-snug group-hover:text-ey-yellow transition-colors flex items-center justify-between">
                    <span>{item.title}</span>
                  </h3>

                  {/* Headline Metric Highlight */}
                  <div className="bg-ey-card/90 p-2.5 rounded-lg border border-ey-border/60 flex items-center justify-between group-hover:border-ey-yellow/40 transition-colors">
                    <div>
                      <div className="text-sm font-extrabold text-ey-yellow">{item.stat}</div>
                      <div className="text-[10px] text-ey-muted">{item.statSub}</div>
                    </div>
                    <div className="p-1 rounded-md bg-ey-yellow/10 text-ey-yellow group-hover:bg-ey-yellow group-hover:text-ey-black transition-colors">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  {/* Diagnostic Finding */}
                  <p className="text-[11px] text-ey-muted leading-relaxed line-clamp-3">
                    <span className="font-semibold text-ey-light">Finding: </span>
                    {item.finding}
                  </p>
                </div>

                {/* Executive Recommendation */}
                <div className="pt-2 border-t border-ey-border/60">
                  <div className="text-[11px] bg-ey-yellow/5 p-2 rounded-lg border border-ey-yellow/20 group-hover:border-ey-yellow/30 transition-colors">
                    <span className="font-bold text-ey-yellow block mb-0.5 text-[10px] uppercase tracking-wider">Strategic Action:</span>
                    <span className="text-ey-light text-[10px] leading-normal line-clamp-2">{item.actionableInsight}</span>
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
