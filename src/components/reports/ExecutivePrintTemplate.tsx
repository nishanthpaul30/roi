'use client';

import { GlobalFilterState, TokenCostSummary } from '@/lib/metrics/types';

interface ExecutivePrintTemplateProps {
  data: any;
  filters: GlobalFilterState;
}

const TOOL_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT Enterprise',
  copilot: 'GitHub Copilot Enterprise',
  claude: 'Claude Enterprise',
};

export function ExecutivePrintTemplate({ data, filters }: ExecutivePrintTemplateProps) {
  if (!data) return null;

  const summary: TokenCostSummary | null = data?.tokenCostSummary ?? null;
  const metrics = data?.metrics;

  const totalCost = metrics?.cost?.summary?.current ?? 0;
  const totalTokens = metrics?.tokenConsumption?.summary?.current ?? 0;
  const avgDailyCost = metrics?.avgDailyCost?.summary?.current ?? 0;
  const costPerActiveUser = metrics?.costPerActiveUser?.summary?.current ?? 0;

  const toolBreakdown = summary?.byAiTool ?? [];
  const regionalBreakdown = summary?.byManagementRegion ?? [];
  const topUsers = summary?.topUsers?.slice(0, 5) ?? [];

  const dominantTool = toolBreakdown.length > 0 ? (TOOL_LABELS[toolBreakdown[0].tool] || toolBreakdown[0].tool) : 'N/A';

  return (
    <div className="hidden print:block print-only w-full text-slate-900 font-sans p-8 bg-white space-y-6">
      {/* Executive Header Banner */}
      <div className="border-b-2 border-slate-900 pb-5 flex items-start justify-between">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-2 bg-slate-900 text-yellow-400 text-xs font-black px-3 py-1 rounded-md uppercase tracking-wider shadow-sm">
            <span>EY Analytics</span>
            <span className="text-white">|</span>
            <span className="text-white">Enterprise AI Telemetry</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 mt-2">
            AI Investment &amp; Spend Executive Brief
          </h1>
          <p className="text-xs text-slate-600 font-medium">
            Strategic C-Suite Financial &amp; Usage Governance Report
          </p>
        </div>

        <div className="text-right text-xs text-slate-700 font-mono space-y-1 bg-slate-50 border border-slate-200 p-3 rounded-lg">
          <p>Report Date: <strong className="text-slate-900 font-bold">{new Date().toLocaleDateString()}</strong></p>
          <p>Filter Period: <strong className="text-slate-900">{filters.startDate} → {filters.endDate}</strong></p>
          <p>Source Data: <strong className="text-slate-900">ai_usage_data.csv</strong></p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-4 gap-4">
        <div className="border border-slate-300 rounded-xl p-4 bg-slate-50/80 shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Total AI Investment</span>
          <div className="text-2xl font-black text-slate-900 font-mono mt-1">
            ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-600 mt-1 font-medium">Actual billed cost (USD)</p>
        </div>

        <div className="border border-slate-300 rounded-xl p-4 bg-slate-50/80 shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Billable Tokens</span>
          <div className="text-2xl font-black text-slate-900 font-mono mt-1">
            {Math.round(totalTokens).toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-600 mt-1 font-medium">Token consumption volume</p>
        </div>

        <div className="border border-slate-300 rounded-xl p-4 bg-slate-50/80 shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Avg Daily Cost</span>
          <div className="text-2xl font-black text-slate-900 font-mono mt-1">
            ${avgDailyCost.toFixed(2)}
          </div>
          <p className="text-[11px] text-slate-600 mt-1 font-medium">Cost per active day</p>
        </div>

        <div className="border border-slate-300 rounded-xl p-4 bg-slate-50/80 shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Dominant AI Tool</span>
          <div className="text-lg font-black text-slate-900 font-mono mt-1 truncate">
            {dominantTool}
          </div>
          <p className="text-[11px] text-slate-600 mt-1 font-medium">Highest token volume</p>
        </div>
      </div>

      {/* AI Tool Portfolio Breakdown Table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between border-b border-slate-300 pb-1.5">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">
            1. AI Tool Portfolio Breakdown &amp; Efficiency (ChatGPT vs Copilot vs Claude)
          </h2>
          <span className="text-[10px] font-mono text-slate-500">Source: AI Tool Flag</span>
        </div>
        <table className="w-full text-xs text-left border border-slate-300 rounded-lg overflow-hidden">
          <thead className="bg-slate-900 text-white font-mono text-[10px] uppercase">
            <tr>
              <th className="px-3 py-2.5">AI Tool Name</th>
              <th className="px-3 py-2.5">Total Spend ($)</th>
              <th className="px-3 py-2.5">Spend Share</th>
              <th className="px-3 py-2.5">Billable Tokens</th>
              <th className="px-3 py-2.5">Active Users</th>
              <th className="px-3 py-2.5">Avg $/User</th>
              <th className="px-3 py-2.5">Cost / 1K Tokens</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
            {toolBreakdown.map((row: any, idx: number) => (
              <tr key={row.tool} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                <td className="px-3 py-2.5 font-bold text-slate-900 uppercase">
                  {TOOL_LABELS[row.tool] || row.tool}
                </td>
                <td className="px-3 py-2.5 font-bold text-slate-900">
                  ${row.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="px-3 py-2.5 font-bold text-slate-700">
                  <div className="flex items-center space-x-1.5">
                    <span>{totalCost > 0 ? ((row.cost / totalCost) * 100).toFixed(1) : 0}%</span>
                    <div className="w-12 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-slate-900 h-full rounded-full"
                        style={{ width: `${totalCost > 0 ? (row.cost / totalCost) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 font-semibold text-slate-900">{Math.round(row.tokens).toLocaleString()}</td>
                <td className="px-3 py-2.5 font-semibold text-slate-800">{row.userCount || 0} users</td>
                <td className="px-3 py-2.5 font-bold text-slate-900">${(row.avgCostPerUser || 0).toFixed(2)}</td>
                <td className="px-3 py-2.5 font-bold text-slate-900">${(row.costPer1kTokens || 0).toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {summary?.multiToolOverlap && (
          <div className="border border-amber-300 bg-amber-50/70 p-3 rounded-lg flex items-center justify-between text-xs font-mono text-slate-800">
            <div>
              <span className="font-bold text-amber-900">Seat Consolidation Alert:</span>{' '}
              <span>
                <strong>{summary.multiToolOverlap.dualToolUserCount} users</strong> generate active usage across 2+ AI platforms concurrently.
              </span>
            </div>
            <div className="font-bold text-slate-900 bg-white border border-amber-300 px-2.5 py-1 rounded">
              Overlap Spend: ${summary.multiToolOverlap.totalDualToolSpend.toFixed(2)}
            </div>
          </div>
        )}
      </div>

      {/* Side-by-Side: Regional Breakdown & Top Users */}
      <div className="grid grid-cols-2 gap-5">
        {/* Regional Breakdown Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between border-b border-slate-300 pb-1.5">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">
              2. Management Region Spend
            </h2>
            <span className="text-[10px] font-mono text-slate-500">Region</span>
          </div>
          <table className="w-full text-xs text-left border border-slate-300 rounded-lg overflow-hidden">
            <thead className="bg-slate-900 text-white font-mono text-[10px] uppercase">
              <tr>
                <th className="px-3 py-2">Region</th>
                <th className="px-3 py-2">Spend ($)</th>
                <th className="px-3 py-2">Tokens</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
              {regionalBreakdown.map((r: any, idx: number) => (
                <tr key={r.region} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                  <td className="px-3 py-2 font-bold text-slate-900">{r.region}</td>
                  <td className="px-3 py-2 font-bold text-slate-900">${r.cost.toFixed(2)}</td>
                  <td className="px-3 py-2 text-slate-700">{Math.round(r.tokens).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Top 5 Spenders Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between border-b border-slate-300 pb-1.5">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">
              3. Top 5 Power Spenders
            </h2>
            <span className="text-[10px] font-mono text-slate-500">User Mail</span>
          </div>
          <table className="w-full text-xs text-left border border-slate-300 rounded-lg overflow-hidden">
            <thead className="bg-slate-900 text-white font-mono text-[10px] uppercase">
              <tr>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Spend ($)</th>
                <th className="px-3 py-2">Tokens</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
              {topUsers.map((u: any, idx: number) => (
                <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                  <td className="px-3 py-2 font-bold text-slate-900 truncate max-w-[130px]" title={u.displayName || u.userMail}>
                    {u.displayName || u.userMail}
                  </td>
                  <td className="px-3 py-2 font-bold text-slate-900">${u.cost.toFixed(2)}</td>
                  <td className="px-3 py-2 text-slate-700">{Math.round(u.tokens).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Strategic Observations & Governance Box */}
      <div className="border-l-4 border-yellow-400 border border-slate-300 rounded-r-xl p-4 bg-slate-50/80 space-y-2">
        <h3 className="font-extrabold text-slate-900 uppercase tracking-wider text-xs flex items-center space-x-1.5">
          <span>4. Strategic Observations &amp; Executive Cost Guidance</span>
        </h3>
        <ul className="list-disc pl-4 text-slate-700 space-y-1 text-xs font-medium">
          <li>Average spend per active user stands at <strong>${costPerActiveUser.toFixed(2)}</strong> across the filtered period.</li>
          <li>Dominant portfolio tool is <strong>{dominantTool}</strong> driving high enterprise adoption and token consumption.</li>
          <li>Telemetry data verified directly from source usage log entries (<span className="font-mono">ai_usage_data.csv</span>).</li>
        </ul>
      </div>

      {/* Executive Footer */}
      <div className="border-t border-slate-300 pt-4 flex items-center justify-between text-[10px] text-slate-500 font-mono">
        <span>Generated via EY Enterprise AI Analytics Platform</span>
        <span className="font-bold text-slate-700">CONFIDENTIAL — FOR INTERNAL C-SUITE &amp; BOARD USE ONLY</span>
      </div>
    </div>
  );
}
