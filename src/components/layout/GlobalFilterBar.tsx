'use client';

import { useState } from 'react';
import { Filter, Calendar, LogOut, Bot, Globe2, BarChart3, User, RotateCcw } from 'lucide-react';
import { GlobalFilterState, ComparisonPeriod } from '@/lib/metrics/types';
import { subDays, format } from 'date-fns';
import { useAuth } from '@/context/AuthContext';

interface FilterOptions {
  aiTools?: string[];
  managementRegions?: string[];
  serviceLines?: string[];
  countries?: string[];
  users?: string[];
}

interface GlobalFilterBarProps {
  filters: GlobalFilterState;
  onFilterChange: (newFilters: GlobalFilterState) => void;
  onExportCsv?: () => void;
  filterOptions?: FilterOptions;
}

const TOOL_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT',
  copilot: 'GitHub Copilot',
  claude: 'Claude',
};

const DEFAULT_START = '2026-03-01';
const DEFAULT_END = '2026-08-31';

export function GlobalFilterBar({
  filters,
  onFilterChange,
  onExportCsv,
  filterOptions,
}: GlobalFilterBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { logout } = useAuth();

  const handleChange = (key: keyof GlobalFilterState, value: string) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const setPresetRange = (days: number, comparison: ComparisonPeriod) => {
    const end = new Date('2026-08-31');
    const start = subDays(end, days);
    onFilterChange({
      ...filters,
      startDate: format(start, 'yyyy-MM-dd'),
      endDate: format(end, 'yyyy-MM-dd'),
      comparisonPeriod: comparison,
    });
  };

  const resetToAll = () => {
    onFilterChange({
      ...filters,
      startDate: DEFAULT_START,
      endDate: DEFAULT_END,
      aiTool: 'all',
      managementRegion: 'all',
      serviceLine: 'all',
      userMail: 'all',
      country: 'all',
      comparisonPeriod: 'moM',
    });
  };

  const activeFilterCount = [
    filters.aiTool !== 'all',
    filters.managementRegion !== 'all',
    filters.serviceLine !== 'all',
    filters.userMail !== 'all',
    filters.country !== 'all',
  ].filter(Boolean).length;

  return (
    <div className="bg-ey-card border-b border-ey-border p-4 sticky top-0 z-20 shadow-md">
      <div className="flex items-center justify-between gap-3 overflow-x-auto custom-scrollbar flex-nowrap whitespace-nowrap">
        {/* Date Range + Presets */}
        <div className="flex items-center gap-2 shrink-0 flex-nowrap">
          <div className="h-9 flex items-center bg-ey-black/80 border border-ey-border rounded-lg px-2.5 text-xs text-ey-light shrink-0">
            <Calendar className="w-4 h-4 text-ey-yellow mr-2 shrink-0" />
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleChange('startDate', e.target.value)}
              className="bg-transparent text-ey-light focus:outline-none text-xs"
            />
            <span className="mx-1.5 text-ey-muted">to</span>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleChange('endDate', e.target.value)}
              className="bg-transparent text-ey-light focus:outline-none text-xs"
            />
          </div>

          {/* Quick Preset Buttons */}
          <div className="h-9 flex items-center bg-ey-black/60 p-0.5 rounded-lg border border-ey-border/60 text-xs shrink-0">
            <button
              onClick={() => setPresetRange(7, 'woW')}
              className={`h-7 px-2.5 rounded-md text-[11px] font-medium transition flex items-center justify-center ${filters.comparisonPeriod === 'woW'
                  ? 'bg-ey-yellow text-ey-black font-bold shadow-sm'
                  : 'text-ey-muted hover:text-ey-light'
                }`}
            >
              7D
            </button>
            <button
              onClick={() => setPresetRange(28, 'moM')}
              className={`h-7 px-2.5 rounded-md text-[11px] font-medium transition flex items-center justify-center ${filters.comparisonPeriod === 'moM'
                  ? 'bg-ey-yellow text-ey-black font-bold shadow-sm'
                  : 'text-ey-muted hover:text-ey-light'
                }`}
            >
              28D
            </button>
            <button
              onClick={() => {
                onFilterChange({ ...filters, startDate: DEFAULT_START, endDate: DEFAULT_END, comparisonPeriod: 'rolling28d' });
              }}
              className={`h-7 px-2.5 rounded-md text-[11px] font-medium transition flex items-center justify-center ${filters.comparisonPeriod === 'rolling28d'
                  ? 'bg-ey-yellow text-ey-black font-bold shadow-sm'
                  : 'text-ey-muted hover:text-ey-light'
                }`}
            >
              All Data
            </button>
          </div>

          {/* Comparison Period */}
          <div className="h-9 flex items-center text-xs shrink-0">
            <span className="text-ey-muted mr-1.5 font-medium shrink-0">vs:</span>
            <select
              value={filters.comparisonPeriod}
              onChange={(e) => handleChange('comparisonPeriod', e.target.value as ComparisonPeriod)}
              className="h-9 bg-ey-black border border-ey-border text-ey-light text-xs rounded-lg px-2.5 focus:outline-none focus:border-ey-yellow"
            >
              <option value="doD">Previous Day</option>
              <option value="woW">Previous Week</option>
              <option value="moM">Previous Month</option>
              <option value="rolling7d">Rolling 7D</option>
              <option value="rolling28d">Rolling 28D</option>
            </select>
          </div>

          {/* Inline quick filters — AI Tool & Region */}
          <div className="h-9 flex items-center gap-1.5 border-l border-ey-border/60 pl-2 shrink-0">
            <Bot className="w-4 h-4 text-ey-yellow shrink-0" />
            <select
              value={filters.aiTool}
              onChange={(e) => handleChange('aiTool', e.target.value)}
              className="h-9 bg-ey-black border border-ey-border text-ey-light text-xs rounded-lg px-2.5 focus:outline-none focus:border-ey-yellow"
            >
              <option value="all">All Tools</option>
              {(filterOptions?.aiTools || ['chatgpt', 'copilot', 'claude']).map(t => (
                <option key={t} value={t}>{TOOL_LABELS[t] || t}</option>
              ))}
            </select>
          </div>

          <div className="h-9 flex items-center gap-1.5 shrink-0">
            <Globe2 className="w-4 h-4 text-sky-400 shrink-0" />
            <select
              value={filters.managementRegion}
              onChange={(e) => handleChange('managementRegion', e.target.value)}
              className="h-9 bg-ey-black border border-ey-border text-ey-light text-xs rounded-lg px-2.5 focus:outline-none focus:border-ey-yellow"
            >
              <option value="all">All Regions</option>
              {(filterOptions?.managementRegions || ['EMEA', 'APAC', 'Americas']).map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: Expand Filters, Export, User */}
        <div className="flex items-center gap-2 shrink-0 flex-nowrap">
          {activeFilterCount > 0 && (
            <button
              onClick={resetToAll}
              title={`Clear ${activeFilterCount} active filter${activeFilterCount > 1 ? 's' : ''}`}
              aria-label="Clear active filters"
              className="h-9 w-9 flex items-center justify-center text-ey-yellow hover:text-red-400 bg-ey-yellow/10 border border-ey-yellow/40 hover:border-red-400/50 rounded-lg transition shrink-0"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse Filters Drawer' : 'More Filters'}
            aria-label="Toggle extra filters panel"
            className={`h-9 w-9 relative flex items-center justify-center rounded-lg border transition shrink-0 ${isExpanded || activeFilterCount > 0
                ? 'bg-ey-yellow/20 border-ey-yellow/50 text-ey-yellow'
                : 'bg-ey-black border-ey-border text-ey-light hover:bg-ey-card-hover'
              }`}
          >
            <Filter className="w-4 h-4 text-ey-yellow" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-ey-yellow text-ey-black font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center border border-ey-black shadow-sm">
                {activeFilterCount}
              </span>
            )}
          </button>



          <div className="h-6 w-[1px] bg-ey-border mx-1 shrink-0" />
          <div className="h-9 flex items-center space-x-2 bg-ey-black/80 border border-ey-border rounded-lg px-3 text-xs shrink-0">
            <div className="w-5 h-5 rounded-full bg-ey-yellow/20 text-ey-yellow font-bold text-[10px] flex items-center justify-center border border-ey-yellow/40 shrink-0">
              N
            </div>
            <span className="font-semibold text-ey-light text-xs">admin</span>
            <button
              onClick={logout}
              title="Log Out"
              className="ml-1 p-1 text-ey-muted hover:text-red-400 hover:bg-red-500/20 rounded transition shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Filters Panel */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-ey-border grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {/* Service Line */}
          <div>
            <label className="flex items-center gap-1 text-[10px] text-ey-muted font-semibold uppercase mb-1.5">
              <BarChart3 className="w-3 h-3" />
              Service Line
            </label>
            <select
              value={filters.serviceLine}
              onChange={(e) => handleChange('serviceLine', e.target.value)}
              className="w-full bg-ey-black border border-ey-border text-ey-light rounded px-2 py-1.5 focus:outline-none focus:border-ey-yellow"
            >
              <option value="all">All Service Lines</option>
              {(filterOptions?.serviceLines || ['Consulting', 'Power', 'Financial Services', 'Technology']).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Country */}
          <div>
            <label className="flex items-center gap-1 text-[10px] text-ey-muted font-semibold uppercase mb-1.5">
              <Globe2 className="w-3 h-3" />
              Country
            </label>
            <select
              value={filters.country}
              onChange={(e) => handleChange('country', e.target.value)}
              className="w-full bg-ey-black border border-ey-border text-ey-light rounded px-2 py-1.5 focus:outline-none focus:border-ey-yellow"
            >
              <option value="all">All Countries</option>
              {(filterOptions?.countries || []).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* AI Tool (full select for expanded) */}
          <div>
            <label className="flex items-center gap-1 text-[10px] text-ey-muted font-semibold uppercase mb-1.5">
              <Bot className="w-3 h-3" />
              AI Tool
            </label>
            <select
              value={filters.aiTool}
              onChange={(e) => handleChange('aiTool', e.target.value)}
              className="w-full bg-ey-black border border-ey-border text-ey-light rounded px-2 py-1.5 focus:outline-none focus:border-ey-yellow"
            >
              <option value="all">All Tools</option>
              {(filterOptions?.aiTools || ['chatgpt', 'copilot', 'claude']).map(t => (
                <option key={t} value={t}>{TOOL_LABELS[t] || t}</option>
              ))}
            </select>
          </div>

          {/* User */}
          <div>
            <label className="flex items-center gap-1 text-[10px] text-ey-muted font-semibold uppercase mb-1.5">
              <User className="w-3 h-3" />
              User
            </label>
            <select
              value={filters.userMail}
              onChange={(e) => handleChange('userMail', e.target.value)}
              className="w-full bg-ey-black border border-ey-border text-ey-light rounded px-2 py-1.5 focus:outline-none focus:border-ey-yellow"
            >
              <option value="all">All Users</option>
              {(filterOptions?.users || []).map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
