'use client';

import { useState } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Zap,
  Building2,
  Users,
  Target,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Layers,
  ArrowUpRight,
  ShieldAlert,
} from 'lucide-react';

export function ExecutiveInferencesPanel() {
  const [isExpanded, setIsExpanded] = useState(true);

  const inferences = [
    {
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
      title: 'Vendor Unit Cost & Token Intensity Spread',
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
      title: 'Claude Organic Adoption Momentum',
      tag: 'Vendor Preference',
      tagColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      icon: Target,
      stat: '+88.9% User Growth',
      statSub: 'Claude expanded from 9 to 17 users',
      finding:
        'Claude user base expanded from 9 active users in March to 17 in August (+88.9%) — the fastest adoption growth rate across all tools. 15.7% of users (11 people) migrated tools on clean monthly boundaries.',
      actionableInsight:
        'Leverage organic user preference shifts toward Claude during upcoming enterprise vendor renewal negotiations.',
    },
    {
      title: 'Habitual User Retention & Health',
      tag: 'Adoption Health',
      tagColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      icon: Users,
      stat: '100% Habitual Usage',
      statSub: '36% Embedded, 57% Regular, 0% Dropouts',
      finding:
        'All 70 active users show habitual retention: 36% Embedded (16+ days/mo), 57% Regular (9-15 days/mo), and 7% Occasional (4-8 days/mo). Zero users fell into a one-off trial-only bucket.',
      actionableInsight:
        'AI tools have transitioned from pilot curiosity to daily core workflow. Focus shift from basic onboarding to advanced competency training.',
    },
  ];

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
          className="flex items-center space-x-1.5 text-xs font-semibold text-ey-yellow hover:text-ey-light bg-ey-black/60 border border-ey-border px-3 py-1.5 rounded-lg transition shrink-0 self-start sm:self-center"
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
                key={item.title}
                className="bg-ey-black/70 border border-ey-border/80 rounded-xl p-4 space-y-3 hover:border-ey-yellow/50 transition duration-200 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  {/* Top Badge & Metric */}
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${item.tagColor}`}>
                      {item.tag}
                    </span>
                    <IconComponent className="w-4 h-4 text-ey-muted" />
                  </div>

                  <h3 className="text-xs font-bold text-ey-light leading-snug">{item.title}</h3>

                  {/* Headline Metric Highlight */}
                  <div className="bg-ey-card/90 p-2.5 rounded-lg border border-ey-border/60 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-extrabold text-ey-yellow">{item.stat}</div>
                      <div className="text-[10px] text-ey-muted">{item.statSub}</div>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-ey-yellow/70" />
                  </div>

                  {/* Diagnostic Finding */}
                  <p className="text-[11px] text-ey-muted leading-relaxed">
                    <span className="font-semibold text-ey-light">Finding: </span>
                    {item.finding}
                  </p>
                </div>

                {/* Executive Recommendation */}
                <div className="mt-2 pt-2 border-t border-ey-border/60 text-[11px] bg-ey-yellow/5 p-2 rounded-lg border border-ey-yellow/20">
                  <span className="font-bold text-ey-yellow block mb-0.5">Strategic Action:</span>
                  <span className="text-ey-light text-[10px] leading-normal">{item.actionableInsight}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
