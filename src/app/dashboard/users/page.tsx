'use client';

import { useMetricsData } from '@/hooks/useMetricsData';
import { GlobalFilterBar } from '@/components/layout/GlobalFilterBar';
import { DataTable } from '@/components/ui/DataTable';
import { Users } from 'lucide-react';

export default function UsersPage() {
  const { filters, setFilters, data, loading } = useMetricsData();

  const summary = data?.tokenCostSummary;
  const usersList = summary?.topUsers || [];

  const tableData = usersList.map((u: any, idx: number) => ({
    rank: idx + 1,
    displayName: u.displayName || u.userMail,
    userMail: u.userMail,
    aiTools: u.aiTools || [],
    tokens: u.tokens.toLocaleString(),
    cost: `$${u.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`,
  }));

  return (
    <div className="flex-1 flex flex-col">
      <GlobalFilterBar filters={filters} onFilterChange={setFilters} filterOptions={data?.filterOptions} />

      <main className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Header Title Block */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-ey-card/50 border border-ey-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-ey-yellow/15 border border-ey-yellow/30 rounded-xl text-ey-yellow shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-ey-light tracking-wide">
                User Usage &amp; Spend Analytics
              </h1>
              <p className="text-xs text-ey-muted mt-0.5">
                Breakdown of token consumption and associated cost across all 70 users derived directly from <span className="font-mono text-ey-yellow">ai_usage_data.csv</span>.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-xs bg-ey-black/60 border border-ey-border rounded-lg px-3 py-2 text-ey-light shrink-0 self-start sm:self-center">
            <Users className="w-4 h-4 text-ey-yellow shrink-0" />
            <span className="font-mono text-[11px] text-ey-muted">Active Users: <strong>70 Unique Users</strong></span>
          </div>
        </div>

        {loading || !data ? (
          <div className="h-64 flex items-center justify-center text-ey-muted text-sm animate-pulse">Loading...</div>
        ) : (
          <>
            <DataTable
              title="User Token & Cost Breakdown"
              data={tableData}
              columns={[
                { header: '#', accessorKey: 'rank' },
                { header: 'Display Name', accessorKey: 'displayName' },
                { header: 'User Email', accessorKey: 'userMail' },
                {
                  header: 'AI Tool(s) Used',
                  accessorKey: 'aiTools',
                  cell: (row: any) => (
                    <div className="flex flex-wrap gap-1">
                      {row.aiTools && row.aiTools.length > 0 ? (
                        row.aiTools.map((tool: string) => {
                          const tLower = tool.toLowerCase();
                          let badgeStyle = 'bg-blue-500/10 text-blue-400 border-blue-500/30';
                          if (tLower.includes('chatgpt')) badgeStyle = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
                          if (tLower.includes('copilot')) badgeStyle = 'bg-purple-500/10 text-purple-400 border-purple-500/30';
                          if (tLower.includes('claude')) badgeStyle = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
                          return (
                            <span
                              key={tool}
                              className={`px-2 py-0.5 text-[10px] font-mono border rounded-md capitalize font-semibold ${badgeStyle}`}
                            >
                              {tool}
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-ey-muted text-xs">-</span>
                      )}
                    </div>
                  ),
                },
                { header: 'Token Consumption', accessorKey: 'tokens' },
                { header: 'Total Cost ($)', accessorKey: 'cost' },
              ]}
            />
          </>
        )}
      </main>
    </div>
  );
}
