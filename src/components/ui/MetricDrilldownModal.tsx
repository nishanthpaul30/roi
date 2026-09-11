'use client';

import { X, TrendingUp, TrendingDown, Layers, Building2, Globe2, Users, Coins, Zap, ShieldCheck, CheckCircle2, ArrowRight } from 'lucide-react';
import { MetricChart } from '@/components/ui/MetricChart';

export interface DrilldownMetricData {
  id: 'token_consumption' | 'total_investment' | 'avg_daily_cost' | 'cost_per_user' | 'tool_chatgpt' | 'tool_copilot' | 'tool_claude';
  title: string;
  subtitle: string;
  currentValue: string;
  deltaText: string;
  trend: 'up' | 'down' | 'neutral';
  series: { date: string; value: number }[];
  summaryData: any;
}

interface MetricDrilldownModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: DrilldownMetricData | null;
}

export function MetricDrilldownModal({ isOpen, onClose, data }: MetricDrilldownModalProps) {
  if (!isOpen || !data) return null;

  const { title, subtitle, currentValue, deltaText, trend, series, summaryData, id } = data;

  const byTool = summaryData?.byAiTool || [];
  const byRegion = summaryData?.byManagementRegion || [];
  const byServiceLine = summaryData?.byServiceLine || [];
  const topUsers = summaryData?.topUsers || [];
  const byProjectCode = summaryData?.byProjectCode || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in no-print">
      <div className="bg-ey-card border border-ey-border rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-ey-border flex items-start justify-between bg-ey-black/40">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-2 bg-ey-yellow/10 border border-ey-yellow/30 text-ey-yellow text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-md uppercase tracking-wider">
              <Zap className="w-3.5 h-3.5" />
              <span>Metric Deep-Dive Analytics</span>
            </div>
            <h2 className="text-xl font-bold text-ey-light tracking-tight flex items-center gap-3">
              <span>{title}</span>
              <span className="text-2xl font-extrabold text-ey-yellow font-mono">{currentValue}</span>
            </h2>
            <p className="text-xs text-ey-muted">{subtitle}</p>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-ey-muted hover:text-ey-light hover:bg-ey-card-hover rounded-xl transition"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Scrollable */}
        <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
          {/* Trend Chart */}
          <div className="bg-ey-black/40 border border-ey-border rounded-xl p-4">
            <MetricChart
              title={`${title} Trend Over Time`}
              subtitle="Daily telemetry points derived from ai_usage_data.csv"
              data={series}
              chartType="area"
              series={[{ key: 'value', name: title, color: '#FFE600' }]}
            />
          </div>

          {/* Dynamic Detailed Breakdown Views based on metric ID */}
          {id === 'token_consumption' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tool Breakdown */}
              <div className="bg-ey-black/40 border border-ey-border rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-ey-yellow flex items-center gap-1.5">
                  <Layers className="w-4 h-4" />
                  <span>Token Volume by AI Tool</span>
                </h4>
                <div className="space-y-2 text-xs">
                  {byTool.map((t: any) => {
                    const pct = summaryData?.totalTokenConsumption ? ((t.tokens / summaryData.totalTokenConsumption) * 100).toFixed(1) : 0;
                    return (
                      <div key={t.tool} className="space-y-1">
                        <div className="flex justify-between font-mono text-ey-light">
                          <span className="capitalize">{t.tool}</span>
                          <span>{t.tokens.toLocaleString()} ({pct}%)</span>
                        </div>
                        <div className="w-full bg-ey-border/50 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-ey-yellow h-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Service Line Token Breakdown */}
              <div className="bg-ey-black/40 border border-ey-border rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4" />
                  <span>Service Line Token Volume</span>
                </h4>
                <div className="space-y-2 text-xs font-mono">
                  {byServiceLine.map((s: any) => (
                    <div key={s.serviceLine} className="flex items-center justify-between border-b border-ey-border/40 pb-1.5">
                      <span className="text-ey-light">{s.serviceLine}</span>
                      <span className="text-ey-muted">{s.tokens.toLocaleString()} tokens</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {id === 'total_investment' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-xl">
                  <p className="text-ey-muted text-[10px]">Billable Client Spend</p>
                  <p className="text-lg font-bold text-emerald-400">${(summaryData?.billableSpend || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-emerald-300">{summaryData?.billableSpendPercent}% of total</p>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl">
                  <p className="text-ey-muted text-[10px]">Non-Billable Overhead</p>
                  <p className="text-lg font-bold text-amber-400">${(summaryData?.nonBillableSpend || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-amber-300">{(100 - (summaryData?.billableSpendPercent || 0)).toFixed(1)}% of total</p>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/30 p-3 rounded-xl">
                  <p className="text-ey-muted text-[10px]">External Client Projects</p>
                  <p className="text-lg font-bold text-blue-400">${(summaryData?.externalProjectSpend || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-blue-300">{summaryData?.externalProjectPercent}% external</p>
                </div>
              </div>

              {/* Regional Spend Grid */}
              <div className="bg-ey-black/40 border border-ey-border rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-ey-yellow flex items-center gap-1.5">
                  <Globe2 className="w-4 h-4" />
                  <span>Regional Spend Distribution</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {byRegion.map((r: any) => (
                    <div key={r.region} className="bg-ey-black border border-ey-border p-3 rounded-lg font-mono">
                      <p className="text-ey-muted text-[10px] uppercase">{r.region}</p>
                      <p className="text-sm font-bold text-ey-light mt-0.5">${r.cost.toFixed(2)}</p>
                      <p className="text-[10px] text-ey-muted">{r.tokens.toLocaleString()} tokens</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {id === 'cost_per_user' && (
            <div className="space-y-4">
              <div className="bg-ey-black/40 border border-ey-border rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-ey-yellow flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  <span>Top Active Users by Spend &amp; Token Efficiency</span>
                </h4>
                <div className="divide-y divide-ey-border text-xs">
                  {topUsers.slice(0, 5).map((u: any, idx: number) => (
                    <div key={u.userMail} className="py-2.5 flex items-center justify-between font-mono">
                      <div className="flex items-center space-x-2">
                        <span className="w-5 text-ey-muted text-[11px]">#{idx + 1}</span>
                        <div>
                          <p className="font-bold text-ey-light">{u.displayName}</p>
                          <p className="text-[10px] text-ey-muted">{u.userMail}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-ey-yellow">${u.cost.toFixed(2)}</p>
                        <p className="text-[10px] text-ey-muted">{u.tokens.toLocaleString()} tokens</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {id === 'avg_daily_cost' && (
            <div className="bg-ey-black/40 border border-ey-border rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-ey-yellow flex items-center gap-1.5">
                <Coins className="w-4 h-4" />
                <span>Daily Cost Run-Rate Dynamics</span>
              </h4>
              <p className="text-xs text-ey-muted">
                Measures average spend per active calendar day. Peak daily spikes indicate high-volume batch prompting or multi-developer team milestones.
              </p>
            </div>
          )}

          {/* Project Code Snippets preview if available */}
          {byProjectCode.length > 0 && (
            <div className="bg-ey-black/40 border border-ey-border rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>Top Associated Project Codes</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs font-mono">
                {byProjectCode.slice(0, 6).map((p: any) => (
                  <div key={p.projectCode} className="p-2 bg-ey-black border border-ey-border rounded-lg flex items-center justify-between">
                    <div>
                      <p className="font-bold text-ey-light">{p.projectCode}</p>
                      <p className="text-[10px] text-ey-muted">{p.projectType}</p>
                    </div>
                    <span className="font-bold text-ey-yellow">${p.cost.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-ey-border bg-ey-black/40 flex items-center justify-between text-xs text-ey-muted">
          <span>Source: ai_usage_data.csv</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-ey-yellow text-ey-black font-bold rounded-lg hover:bg-yellow-400 transition"
          >
            Close Drilldown
          </button>
        </div>
      </div>
    </div>
  );
}
