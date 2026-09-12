'use client';

import { useState } from 'react';
import { Calendar, LogOut, Bot, Globe2, BarChart3, RotateCcw, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { GlobalFilterState } from '@/lib/metrics/types';
import { useAuth } from '@/context/AuthContext';

interface FilterOptions {
  aiTools?: string[];
  managementRegions?: string[];
  serviceLines?: string[];
  countries?: string[];
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

const selectClass = 'h-9 w-full bg-ey-black border border-ey-border text-ey-light text-xs rounded-lg px-2.5 focus:outline-none focus:border-ey-yellow';
const labelClass = 'flex items-center gap-1 text-[10px] text-ey-muted font-semibold uppercase mb-1';

// The dataset only spans these 6 months — pick one, or "All" for the full range.
const ALL_MONTHS = { value: 'all', label: 'All Months (Mar - Aug 2026)', start: '2026-03-01', end: '2026-08-31' };
const MONTH_OPTIONS = [
  { value: '2026-03', label: 'March 2026', start: '2026-03-01', end: '2026-03-31' },
  { value: '2026-04', label: 'April 2026', start: '2026-04-01', end: '2026-04-30' },
  { value: '2026-05', label: 'May 2026', start: '2026-05-01', end: '2026-05-31' },
  { value: '2026-06', label: 'June 2026', start: '2026-06-01', end: '2026-06-30' },
  { value: '2026-07', label: 'July 2026', start: '2026-07-01', end: '2026-07-31' },
  { value: '2026-08', label: 'August 2026', start: '2026-08-01', end: '2026-08-31' },
];

export function GlobalFilterBar({
  filters,
  onFilterChange,
  onExportCsv,
  filterOptions,
}: GlobalFilterBarProps) {
  const { logout } = useAuth();
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  const handleChange = (key: keyof GlobalFilterState, value: string) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const selectedMonth =
    [ALL_MONTHS, ...MONTH_OPTIONS].find((m) => m.start === filters.startDate && m.end === filters.endDate)?.value || ALL_MONTHS.value;

  const handleMonthChange = (value: string) => {
    const month = [ALL_MONTHS, ...MONTH_OPTIONS].find((m) => m.value === value);
    if (!month) return;
    onFilterChange({ ...filters, startDate: month.start, endDate: month.end });
  };

  const resetToAll = () => {
    onFilterChange({
      ...filters,
      startDate: ALL_MONTHS.start,
      endDate: ALL_MONTHS.end,
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
    filters.country !== 'all',
  ].filter(Boolean).length;

  const activeFilterCountWithMonth = activeFilterCount + (selectedMonth !== 'all' ? 1 : 0);

  const monthSelectEl = (
    <select
      value={selectedMonth}
      onChange={(e) => handleMonthChange(e.target.value)}
      className={selectClass}
    >
      <option value={ALL_MONTHS.value}>{ALL_MONTHS.label}</option>
      {MONTH_OPTIONS.map((m) => (
        <option key={m.value} value={m.value}>{m.label}</option>
      ))}
    </select>
  );

  const toolSelectEl = (
    <select
      value={filters.aiTool}
      onChange={(e) => handleChange('aiTool', e.target.value)}
      className={selectClass}
    >
      <option value="all">All Tools</option>
      {(filterOptions?.aiTools || ['chatgpt', 'copilot', 'claude']).map(t => (
        <option key={t} value={t}>{TOOL_LABELS[t] || t}</option>
      ))}
    </select>
  );

  const regionSelectEl = (
    <select
      value={filters.managementRegion}
      onChange={(e) => handleChange('managementRegion', e.target.value)}
      className={selectClass}
    >
      <option value="all">All Regions</option>
      {(filterOptions?.managementRegions || ['EMEA', 'APAC', 'Americas']).map(r => (
        <option key={r} value={r}>{r}</option>
      ))}
    </select>
  );

  const serviceLineSelectEl = (
    <select
      value={filters.serviceLine}
      onChange={(e) => handleChange('serviceLine', e.target.value)}
      className={selectClass}
    >
      <option value="all">All Service Lines</option>
      {(filterOptions?.serviceLines || ['Consulting', 'Tax', 'Assurance', 'S&T', 'CBS']).map(s => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );

  const countrySelectEl = (
    <select
      value={filters.country}
      onChange={(e) => handleChange('country', e.target.value)}
      className={selectClass}
    >
      <option value="all">All Countries</option>
      {(filterOptions?.countries || []).map(c => (
        <option key={c} value={c}>{c}</option>
      ))}
    </select>
  );

  return (
    <div className="bg-ey-card border-b border-ey-border p-4 sticky top-0 z-20 shadow-md no-print">
      <div className="flex items-center justify-between gap-3">
        {/* Desktop: full inline filter row */}
        <div className="hidden md:flex items-center gap-2 flex-nowrap overflow-x-auto custom-scrollbar">
          <div className="h-9 flex items-center gap-1.5 shrink-0 w-44">
            <Calendar className="w-4 h-4 text-ey-yellow shrink-0" />
            {monthSelectEl}
          </div>

          <div className="h-9 flex items-center gap-1.5 border-l border-ey-border/60 pl-2 shrink-0 w-32">
            <Bot className="w-4 h-4 text-ey-yellow shrink-0" />
            {toolSelectEl}
          </div>

          <div className="h-9 flex items-center gap-1.5 shrink-0 w-32">
            <Globe2 className="w-4 h-4 text-sky-400 shrink-0" />
            {regionSelectEl}
          </div>

          <div className="h-9 flex items-center gap-1.5 shrink-0 w-36">
            <BarChart3 className="w-4 h-4 text-emerald-400 shrink-0" />
            {serviceLineSelectEl}
          </div>

          <div className="h-9 flex items-center gap-1.5 shrink-0 w-36">
            <Globe2 className="w-4 h-4 text-purple-400 shrink-0" />
            {countrySelectEl}
          </div>
        </div>

        {/* Mobile: single Filters toggle instead of 5 inline selects */}
        <button
          onClick={() => setIsMobileFiltersOpen((v) => !v)}
          aria-expanded={isMobileFiltersOpen}
          className={`md:hidden h-9 flex items-center gap-1.5 px-3 rounded-lg border text-xs font-semibold transition shrink-0 ${
            isMobileFiltersOpen || activeFilterCountWithMonth > 0
              ? 'bg-ey-yellow/15 border-ey-yellow/50 text-ey-yellow'
              : 'bg-ey-black border-ey-border text-ey-light'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Filters</span>
          {activeFilterCountWithMonth > 0 && (
            <span className="bg-ey-yellow text-ey-black font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center shrink-0">
              {activeFilterCountWithMonth}
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isMobileFiltersOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Right: Reset & User (always visible, both breakpoints) */}
        <div className="flex items-center gap-2 shrink-0 flex-nowrap">
          {activeFilterCountWithMonth > 0 && (
            <button
              onClick={resetToAll}
              title={`Clear ${activeFilterCountWithMonth} active filter${activeFilterCountWithMonth > 1 ? 's' : ''}`}
              aria-label="Clear active filters"
              className="h-9 w-9 flex items-center justify-center text-ey-yellow hover:text-red-400 bg-ey-yellow/10 border border-ey-yellow/40 hover:border-red-400/50 rounded-lg transition shrink-0"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          <div className="hidden sm:block h-6 w-[1px] bg-ey-border mx-1 shrink-0" />
          <div className="h-9 flex items-center space-x-2 bg-ey-black/80 border border-ey-border rounded-lg px-2 sm:px-3 text-xs shrink-0">
            <div className="w-5 h-5 rounded-full bg-ey-yellow/20 text-ey-yellow font-bold text-[10px] flex items-center justify-center border border-ey-yellow/40 shrink-0">
              N
            </div>
            <span className="hidden sm:inline font-semibold text-ey-light text-xs">admin</span>
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

      {/* Mobile: stacked filter panel, revealed by the Filters toggle above */}
      {isMobileFiltersOpen && (
        <div className="md:hidden mt-3 pt-3 border-t border-ey-border grid grid-cols-2 gap-3 text-xs">
          <div>
            <label className={labelClass}><Calendar className="w-3 h-3" />Month</label>
            {monthSelectEl}
          </div>
          <div>
            <label className={labelClass}><Bot className="w-3 h-3" />AI Tool</label>
            {toolSelectEl}
          </div>
          <div>
            <label className={labelClass}><Globe2 className="w-3 h-3" />Region</label>
            {regionSelectEl}
          </div>
          <div>
            <label className={labelClass}><BarChart3 className="w-3 h-3" />Service Line</label>
            {serviceLineSelectEl}
          </div>
          <div className="col-span-2">
            <label className={labelClass}><Globe2 className="w-3 h-3" />Country</label>
            {countrySelectEl}
          </div>
        </div>
      )}
    </div>
  );
}
