'use client';

import { useState } from 'react';
import {
  Printer,
  X,
  Zap,
  Building2,
  Globe,
  Coins,
  ShieldCheck,
  TrendingUp,
  FileText,
  MessageSquare,
} from 'lucide-react';
import { GlobalFilterState, TokenCostSummary } from '@/lib/metrics/types';

interface ExecutiveBriefModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: any;
  filters: GlobalFilterState;
}

const TOOL_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT',
  copilot: 'GitHub Copilot',
  claude: 'Claude',
};

export function ExecutiveBriefModal({ isOpen, onClose, data, filters }: ExecutiveBriefModalProps) {
  const [executiveNotes, setExecutiveNotes] = useState<string>(
    'Key Observation: AI tool adoption is tracking steadily across regions with high cost efficiency.'
  );

  if (!isOpen || !data) return null;

  const summary: TokenCostSummary | null = data?.tokenCostSummary ?? null;
  const metrics = data?.metrics;

  const totalCost = metrics?.cost?.summary?.current ?? 0;
  const totalTokens = metrics?.tokenConsumption?.summary?.current ?? 0;
  const avgDailyCost = metrics?.avgDailyCost?.summary?.current ?? 0;
  const costPer1k = metrics?.costPer1kTokens?.summary?.current ?? 0;

  const toolBreakdown = summary?.byAiTool ?? [];
  const regionalBreakdown = summary?.byManagementRegion ?? [];
  const serviceLineBreakdown = summary?.byServiceLine ?? [];
  const topUsers = summary?.topUsers?.slice(0, 5) ?? [];

  const dominantTool = toolBreakdown.length > 0 ? (TOOL_LABELS[toolBreakdown[0].tool] || toolBreakdown[0].tool) : 'N/A';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto">
      {/* Modal Card Container */}
      <div className="bg-ey-card border border-ey-border rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col print:max-w-none print:max-h-none print:border-none print:shadow-none print:bg-white print:text-black">
        {/* Modal Action Header (Hidden in Print) */}
        <div className="p-4 border-b border-ey-border flex items-center justify-between bg-ey-black/60 sticky top-0 z-10 print:hidden">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-ey-yellow/15 border border-ey-yellow/30 text-ey-yellow rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-ey-light">Executive Briefing Report</h2>
              <p className="text-xs text-ey-muted">1-Click C-Suite &amp; Board Summary PDF Export</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="flex items-center space-x-2 px-4 py-2 bg-ey-yellow text-ey-black font-bold text-xs rounded-xl shadow-lg shadow-yellow-500/10 hover:bg-yellow-400 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save as PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-ey-muted hover:text-ey-light hover:bg-ey-card-hover rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Executive Report Content */}
        <div className="p-6 md:p-8 space-y-6 print:p-0 print:space-y-4 print:text-black font-sans">
          {/* Executive Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-ey-border print:border-gray-300 pb-5 gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-ey-yellow rounded-xl text-ey-black font-bold text-xl shadow-md shrink-0">
                <Zap className="w-6 h-6 fill-current" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-ey-light print:text-black tracking-tight">
                  Enterprise AI Investment &amp; Usage Brief
                </h1>
                <p className="text-xs text-ey-yellow print:text-gray-700 font-semibold mt-0.5">
                  Executive Decision &amp; Spend Summary
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right text-xs text-ey-muted print:text-gray-600 font-mono space-y-0.5">
              <p>Report Date: <strong className="text-ey-light print:text-black font-bold">{new Date().toLocaleDateString()}</strong></p>
              <p>Period: <span className="text-ey-yellow print:text-black">{filters.startDate} to {filters.endDate}</span></p>
              <p>Source: <span className="text-emerald-400 print:text-gray-800">ai_usage_data.csv</span></p>
            </div>
          </div>

          {/* Executive KPI Scorecard Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-ey-black/50 border border-ey-border print:border-gray-300 print:bg-gray-50 rounded-xl p-4 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ey-muted print:text-gray-600">Total API Spend</span>
              <div className="text-xl md:text-2xl font-extrabold text-emerald-400 print:text-black font-mono">
                ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-ey-muted print:text-gray-500">Actual billed cost</p>
            </div>

            <div className="bg-ey-black/50 border border-ey-border print:border-gray-300 print:bg-gray-50 rounded-xl p-4 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ey-muted print:text-gray-600">Total Billable Tokens</span>
              <div className="text-xl md:text-2xl font-extrabold text-ey-light print:text-black font-mono">
                {Math.round(totalTokens).toLocaleString()}
              </div>
              <p className="text-[11px] text-ey-muted print:text-gray-500">Token consumption</p>
            </div>

            <div className="bg-ey-black/50 border border-ey-border print:border-gray-300 print:bg-gray-50 rounded-xl p-4 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ey-muted print:text-gray-600">Avg Daily Cost</span>
              <div className="text-xl md:text-2xl font-extrabold text-ey-yellow print:text-black font-mono">
                ${avgDailyCost.toFixed(2)}
              </div>
              <p className="text-[11px] text-ey-muted print:text-gray-500">Cost per active day</p>
            </div>

            <div className="bg-ey-black/50 border border-ey-border print:border-gray-300 print:bg-gray-50 rounded-xl p-4 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ey-muted print:text-gray-600">Dominant AI Tool</span>
              <div className="text-lg md:text-xl font-extrabold text-ey-light print:text-black font-mono truncate">
                {dominantTool}
              </div>
              <p className="text-[11px] text-ey-muted print:text-gray-500">Highest token volume</p>
            </div>
          </div>

          {/* AI Tool Portfolio Breakdown Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ey-muted print:text-black flex items-center space-x-1.5">
              <Coins className="w-4 h-4 text-ey-yellow print:text-black" />
              <span>1. AI Tool Portfolio Breakdown (ChatGPT vs Copilot vs Claude)</span>
            </h3>
            <div className="overflow-x-auto border border-ey-border print:border-gray-300 rounded-xl">
              <table className="w-full text-xs text-left text-ey-light print:text-black">
                <thead className="bg-ey-black/70 print:bg-gray-100 text-ey-muted print:text-gray-700 font-mono text-[10px] uppercase border-b border-ey-border print:border-gray-300">
                  <tr>
                    <th className="px-4 py-2.5">AI Tool</th>
                    <th className="px-4 py-2.5">Total Spend ($)</th>
                    <th className="px-4 py-2.5">Share of Spend (%)</th>
                    <th className="px-4 py-2.5">Billable Tokens</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ey-border/60 print:divide-gray-200">
                  {toolBreakdown.map((row: any) => (
                    <tr key={row.tool} className="hover:bg-ey-black/30 print:hover:bg-transparent">
                      <td className="px-4 py-2.5 font-bold text-ey-yellow print:text-black uppercase">
                        {TOOL_LABELS[row.tool] || row.tool}
                      </td>
                      <td className="px-4 py-2.5 font-mono font-semibold text-emerald-400 print:text-black">
                        ${row.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-2.5 font-mono">
                        {totalCost > 0 ? ((row.cost / totalCost) * 100).toFixed(1) : 0}%
                      </td>
                      <td className="px-4 py-2.5 font-mono">{Math.round(row.tokens).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Regional & Service Line Spend Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Regional Distribution */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ey-muted print:text-black flex items-center space-x-1.5">
                <Globe className="w-4 h-4 text-blue-400 print:text-black" />
                <span>2. Management Region Distribution</span>
              </h3>
              <div className="border border-ey-border print:border-gray-300 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left text-ey-light print:text-black">
                  <thead className="bg-ey-black/70 print:bg-gray-100 text-ey-muted print:text-gray-700 font-mono text-[10px] uppercase border-b border-ey-border print:border-gray-300">
                    <tr>
                      <th className="px-3 py-2">Region</th>
                      <th className="px-3 py-2">Spend ($)</th>
                      <th className="px-3 py-2">Tokens</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ey-border/60 print:divide-gray-200">
                    {regionalBreakdown.map((r: any) => (
                      <tr key={r.region}>
                        <td className="px-3 py-2 font-semibold text-ey-light print:text-black">{r.region}</td>
                        <td className="px-3 py-2 font-mono text-emerald-400 print:text-black">${r.cost.toFixed(2)}</td>
                        <td className="px-3 py-2 font-mono text-ey-muted print:text-black">{Math.round(r.tokens).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top 5 Power Spenders */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ey-muted print:text-black flex items-center space-x-1.5">
                <Building2 className="w-4 h-4 text-purple-400 print:text-black" />
                <span>3. Top 5 Power Spenders</span>
              </h3>
              <div className="border border-ey-border print:border-gray-300 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left text-ey-light print:text-black">
                  <thead className="bg-ey-black/70 print:bg-gray-100 text-ey-muted print:text-gray-700 font-mono text-[10px] uppercase border-b border-ey-border print:border-gray-300">
                    <tr>
                      <th className="px-3 py-2">User</th>
                      <th className="px-3 py-2">Spend ($)</th>
                      <th className="px-3 py-2">Tokens</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ey-border/60 print:divide-gray-200">
                    {topUsers.map((u: any, i: number) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-semibold text-ey-light print:text-black truncate max-w-[130px]" title={u.displayName || u.userMail}>
                          {u.displayName || u.userMail}
                        </td>
                        <td className="px-3 py-2 font-mono text-emerald-400 print:text-black">${u.cost.toFixed(2)}</td>
                        <td className="px-3 py-2 font-mono text-ey-muted print:text-black">{Math.round(u.tokens).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Strategic Executive Takeaways & Comments */}
          <div className="space-y-2 pt-2 border-t border-ey-border print:border-gray-300">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ey-muted print:text-black flex items-center space-x-1.5">
              <MessageSquare className="w-4 h-4 text-ey-yellow print:text-black" />
              <span>4. Executive Notes &amp; Observations</span>
            </h3>
            <textarea
              value={executiveNotes}
              onChange={(e) => setExecutiveNotes(e.target.value)}
              rows={2}
              className="w-full bg-ey-black/60 border border-ey-border print:border-gray-300 print:bg-white print:text-black rounded-xl p-3 text-xs text-ey-light focus:outline-none focus:border-ey-yellow font-sans"
              placeholder="Add executive comments or governance notes before exporting..."
            />
          </div>

          {/* Report Footer */}
          <div className="pt-4 border-t border-ey-border print:border-gray-300 flex items-center justify-between text-[10px] text-ey-muted print:text-gray-600">
            <span>Generated via Enterprise AI Usage Analytics Dashboard</span>
            <span>Confidential — Internal Executive Use Only</span>
          </div>
        </div>
      </div>
    </div>
  );
}
