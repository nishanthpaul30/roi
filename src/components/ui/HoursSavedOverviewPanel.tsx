'use client';

import { useState } from 'react';
import { Clock3, Table2, Grid3x3 } from 'lucide-react';
import { HoursSavedExecutiveSummary } from '@/components/ui/HoursSavedExecutiveSummary';
import { HoursSavedMatrixPanel } from '@/components/ui/HoursSavedMatrixPanel';
import { HoursSavedGroupedTable } from '@/components/ui/HoursSavedGroupedTable';
import type { TokenCostSummary } from '@/lib/metrics/types';

type HoursSavedRow = NonNullable<TokenCostSummary['hoursSavedByEngagement']>[number];

interface HoursSavedOverviewPanelProps {
  rows: HoursSavedRow[];
  onSelectEngagement: (projectCode: string) => void;
  devHourRate: number;
  onDevHourRateChange: (rate: number) => void;
}

/**
 * Top-level summary of every (Engagement, Tool) pair Hours Saved covers --
 * shown on the main Engagement Analytics screen itself, before any
 * drilldown, since this is a headline feature and shouldn't require
 * navigating deeper to discover. Clicking a row (or a matrix cell) jumps
 * straight into that engagement's full path, where EngagementHoursSavedPanel
 * shows the same row's monthly detail.
 *
 * Two ways to view it: Matrix (Engagement x Tool, one metric per cell --
 * the default, best for comparing tools side by side) and Table (grouped by
 * Engagement Code, expandable to each tool's full row of figures).
 */
export function HoursSavedOverviewPanel({ rows, onSelectEngagement, devHourRate, onDevHourRateChange }: HoursSavedOverviewPanelProps) {
  const [view, setView] = useState<'table' | 'matrix'>('matrix');

  if (rows.length === 0) return null;

  return (
    <div className="bg-ey-card border-2 border-ey-yellow/40 rounded-xl p-5 shadow-lg shadow-yellow-500/5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-ey-yellow/20 border border-ey-yellow/40 rounded-lg text-ey-yellow shrink-0">
            <Clock3 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-ey-light tracking-tight">Hours Saved &amp; Cost Efficiency</h3>
            <p className="text-xs text-ey-muted mt-0.5">
              Approved vs. actual productivity hours by engagement and tool, and the cost behind every hour saved. Click a row to see its full monthly breakdown.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-ey-black border border-ey-border rounded-lg px-2.5 py-1.5 shrink-0" title="Blended developer-hour rate used to value Hours Saved for ROI">
          <label htmlFor="dev-hour-rate" className="text-[11px] font-semibold text-ey-muted whitespace-nowrap">$ / dev-hr</label>
          <input
            id="dev-hour-rate"
            type="number"
            min={1}
            step={1}
            value={devHourRate}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (Number.isFinite(next) && next > 0) onDevHourRateChange(next);
            }}
            className="w-14 bg-transparent text-xs font-mono text-ey-yellow font-bold focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1 bg-ey-black border border-ey-border rounded-lg p-1 shrink-0">
          <button
            onClick={() => setView('matrix')}
            title="Engagement x Tool matrix view"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition ${view === 'matrix' ? 'bg-ey-yellow text-ey-black' : 'text-ey-muted hover:text-ey-light'}`}
          >
            <Grid3x3 className="w-3.5 h-3.5" />
            Matrix
          </button>
          <button
            onClick={() => setView('table')}
            title="Grouped table view"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition ${view === 'table' ? 'bg-ey-yellow text-ey-black' : 'text-ey-muted hover:text-ey-light'}`}
          >
            <Table2 className="w-3.5 h-3.5" />
            Table
          </button>
        </div>
      </div>

      <HoursSavedExecutiveSummary rows={rows} devHourRate={devHourRate} />

      {view === 'matrix' ? (
        <HoursSavedMatrixPanel rows={rows} onSelectEngagement={onSelectEngagement} devHourRate={devHourRate} />
      ) : (
        <HoursSavedGroupedTable rows={rows} onSelectEngagement={onSelectEngagement} devHourRate={devHourRate} />
      )}
    </div>
  );
}
