'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  Coins,
  DollarSign,
  Zap,
  Users,
  Search,
  Filter,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Building,
  Building2,
  Globe2,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
  X,
  Download,
  Calendar,
  Layers,
  Database,
  Info,
} from 'lucide-react';
import { loadCsvData, CsvUsageRow } from '@/lib/data/csvLoader';
import { TokenCostSummary, UserCapacityRow } from '@/lib/metrics/types';

export interface RoiDrilldownTarget {
  type:
    | 'metric'
    | 'user'
    | 'project'
    | 'tool'
    | 'zone'
    | 'billability'
    | 'service_line'
    | 'sub_service_line'
    | 'region'
    | 'country';
  id: string; // 'waste' | 'overage' | 'efficiency' | 'ceiling' | user email | project code | tool name | serviceLine | subServiceLine | region | country
  title: string;
  subtitle?: string;
  badge?: string;
  filterCriteria?: {
    userEmail?: string;
    projectCode?: string;
    aiTool?: string;
    zone?: 'zone1_under' | 'zone2_over' | 'ceiling_risk';
    billable?: 'True' | 'False';
    projectType?: 'External' | 'Internal';
    serviceLine?: string;
    subServiceLine?: string;
    region?: string;
    managementRegion?: string;
    country?: string;
  };
}

interface RoiDrilldownViewProps {
  target: RoiDrilldownTarget;
  summary?: TokenCostSummary | null;
  onBack: () => void;
  parentTitle?: string;
}

export function RoiDrilldownView({ target, summary, onBack, parentTitle = 'ROI Dashboard' }: RoiDrilldownViewProps) {
  const { type, id, title, subtitle, badge, filterCriteria } = target;

  // Selected sub-entity within the drilldown (e.g. drilling down from "Wasted AI Capacity" or a Service Line into a specific sub-practice or employee)
  const [selectedSubEntity, setSelectedSubEntity] = useState<{
    type: 'user' | 'project' | 'tool' | 'service_line' | 'sub_service_line' | 'country' | 'region';
    id: string;
    name: string;
  } | null>(null);

  // Search & Pagination State for Level 3 Core Records
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [toolFilter, setToolFilter] = useState<string>('all');
  const [billableFilter, setBillableFilter] = useState<string>('all');

  // Modal Record Inspector State
  const [inspectingRecord, setInspectingRecord] = useState<CsvUsageRow | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Global Escape Key Listener for intuitive return navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (inspectingRecord) {
          setInspectingRecord(null);
        } else if (selectedSubEntity) {
          setSelectedSubEntity(null);
          setSearchTerm('');
          setCurrentPage(1);
        } else {
          onBack();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inspectingRecord, selectedSubEntity, onBack]);

  // Load all raw CSV rows synchronously from memory
  const allRows = useMemo(() => {
    try {
      return loadCsvData();
    } catch (_err) {
      return [];
    }
  }, []);

  // Compute map of active user capacity breakdown (zone1 vs zone2 vs ceiling risk)
  const userCapacityMap = useMemo(() => {
    const map = new Map<string, UserCapacityRow>();
    if (summary?.userCapacityBreakdown) {
      for (const u of summary.userCapacityBreakdown) {
        map.set(u.userMail.toLowerCase(), u);
      }
    }
    return map;
  }, [summary]);

  // Filter raw rows based on primary drilldown target and any active sub-entity selection
  const targetRows = useMemo(() => {
    return allRows.filter((r) => {
      const email = (r.userMail || '').toLowerCase().trim();
      const project = (r.projectCode || '').trim();
      const tool = (r.aiTool || '').toLowerCase().trim();
      const isBillable = r.billableFlag === 'True' || r.billableFlag === 'true';
      const isExternal =
        (r.projectType || '').toLowerCase() === 'external' || project.startsWith('E-');

      // 1. If a sub-entity is selected within this drilldown
      if (selectedSubEntity) {
        if (selectedSubEntity.type === 'user') {
          return email === selectedSubEntity.id.toLowerCase() || (r.displayName || '').toLowerCase() === selectedSubEntity.id.toLowerCase();
        }
        if (selectedSubEntity.type === 'project') {
          return project.toLowerCase() === selectedSubEntity.id.toLowerCase();
        }
        if (selectedSubEntity.type === 'tool') {
          return tool === selectedSubEntity.id.toLowerCase();
        }
        if (selectedSubEntity.type === 'service_line') {
          return (r.orgServiceLine || '').toLowerCase() === selectedSubEntity.id.toLowerCase();
        }
        if (selectedSubEntity.type === 'sub_service_line') {
          return (r.orgSubServiceLine || '').toLowerCase() === selectedSubEntity.id.toLowerCase();
        }
        if (selectedSubEntity.type === 'country') {
          return (r.country || '').toLowerCase() === selectedSubEntity.id.toLowerCase();
        }
        if (selectedSubEntity.type === 'region') {
          return (
            (r.managementRegion || '').toLowerCase() === selectedSubEntity.id.toLowerCase() ||
            (r.region || '').toLowerCase() === selectedSubEntity.id.toLowerCase()
          );
        }
      }

      // 2. Primary target criteria
      if (type === 'service_line') {
        return (r.orgServiceLine || '').toLowerCase() === id.toLowerCase();
      }

      if (type === 'sub_service_line') {
        return (r.orgSubServiceLine || '').toLowerCase() === id.toLowerCase();
      }

      if (type === 'region') {
        return (
          (r.managementRegion || '').toLowerCase() === id.toLowerCase() ||
          (r.region || '').toLowerCase() === id.toLowerCase()
        );
      }

      if (type === 'country') {
        return (r.country || '').toLowerCase() === id.toLowerCase();
      }

      if (type === 'user') {
        return email === id.toLowerCase() || (r.displayName || '').toLowerCase() === id.toLowerCase();
      }

      if (type === 'project') {
        return project.toLowerCase() === id.toLowerCase();
      }

      if (type === 'tool') {
        return tool === id.toLowerCase();
      }

      if (type === 'billability') {
        if (id === 'billable') return isBillable;
        if (id === 'non_billable') return !isBillable;
        if (id === 'external') return isExternal;
        if (id === 'internal') return !isExternal;
      }

      if (type === 'zone' || type === 'metric') {
        if (id === 'waste' || id === 'zone1_under') {
          const cap = userCapacityMap.get(email);
          return cap ? cap.zone === 'zone1_under' : false;
        }
        if (id === 'overage' || id === 'zone2_over') {
          const cap = userCapacityMap.get(email);
          return cap ? cap.zone === 'zone2_over' : false;
        }
        if (id === 'ceiling') {
          const cap = userCapacityMap.get(email);
          return cap ? cap.ceilingPercent >= 90 : false;
        }
        if (id === 'efficiency') {
          return true; // shows entire active roster with efficiency telemetry
        }
      }

      // Fallback custom criteria
      if (filterCriteria?.userEmail) {
        if (email !== filterCriteria.userEmail.toLowerCase()) return false;
      }
      if (filterCriteria?.projectCode) {
        if (project.toLowerCase() !== filterCriteria.projectCode.toLowerCase()) return false;
      }
      if (filterCriteria?.aiTool) {
        if (tool !== filterCriteria.aiTool.toLowerCase()) return false;
      }
      if (filterCriteria?.serviceLine) {
        if ((r.orgServiceLine || '').toLowerCase() !== filterCriteria.serviceLine.toLowerCase()) return false;
      }
      if (filterCriteria?.subServiceLine) {
        if ((r.orgSubServiceLine || '').toLowerCase() !== filterCriteria.subServiceLine.toLowerCase()) return false;
      }
      if (filterCriteria?.region) {
        if (
          (r.managementRegion || '').toLowerCase() !== filterCriteria.region.toLowerCase() &&
          (r.region || '').toLowerCase() !== filterCriteria.region.toLowerCase()
        ) return false;
      }
      if (filterCriteria?.country) {
        if ((r.country || '').toLowerCase() !== filterCriteria.country.toLowerCase()) return false;
      }

      return true;
    });
  }, [allRows, type, id, selectedSubEntity, filterCriteria, userCapacityMap]);

  // Apply in-table search & dropdown filters on target rows
  const filteredRows = useMemo(() => {
    return targetRows.filter((r) => {
      // Tool filter
      if (toolFilter !== 'all' && (r.aiTool || '').toLowerCase() !== toolFilter.toLowerCase()) {
        return false;
      }
      // Billable filter
      if (billableFilter !== 'all') {
        const isB = r.billableFlag === 'True' || r.billableFlag === 'true';
        if (billableFilter === 'billable' && !isB) return false;
        if (billableFilter === 'non_billable' && isB) return false;
      }
      // Search term
      if (!searchTerm.trim()) return true;
      const s = searchTerm.toLowerCase().trim();
      return (
        (r.displayName || '').toLowerCase().includes(s) ||
        (r.userMail || '').toLowerCase().includes(s) ||
        (r.aiTool || '').toLowerCase().includes(s) ||
        (r.projectCode || '').toLowerCase().includes(s) ||
        (r.orgServiceLine || '').toLowerCase().includes(s) ||
        (r.orgSubServiceLine || '').toLowerCase().includes(s) ||
        (r.activityDate || '').includes(s) ||
        (r.country || '').toLowerCase().includes(s)
      );
    });
  }, [targetRows, searchTerm, toolFilter, billableFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredRows.length / itemsPerPage) || 1;
  const paginatedRows = useMemo(() => {
    return filteredRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredRows, currentPage, itemsPerPage]);

  // Telemetry Aggregates for current slice
  const totalSliceCost = useMemo(() => targetRows.reduce((sum, r) => sum + r.cost, 0), [targetRows]);
  const totalSliceTokens = useMemo(() => targetRows.reduce((sum, r) => sum + r.tokenConsumption, 0), [targetRows]);
  const billableSliceRows = useMemo(
    () => targetRows.filter((r) => r.billableFlag === 'True' || r.billableFlag === 'true').length,
    [targetRows]
  );
  const billableSliceCost = useMemo(
    () => targetRows.filter((r) => r.billableFlag === 'True' || r.billableFlag === 'true').reduce((sum, r) => sum + r.cost, 0),
    [targetRows]
  );
  const uniqueUsers = useMemo(
    () => new Set(targetRows.map((r) => (r.userMail || '').toLowerCase())).size,
    [targetRows]
  );

  // Associated users breakdown for Level 2 selector
  const associatedUsers = useMemo(() => {
    const map = new Map<string, { email: string; name: string; cost: number; tokens: number; count: number; tools: Set<string> }>();
    for (const r of targetRows) {
      const email = (r.userMail || '').toLowerCase().trim();
      if (!email) continue;
      if (!map.has(email)) {
        map.set(email, {
          email,
          name: r.displayName || email.split('@')[0],
          cost: 0,
          tokens: 0,
          count: 0,
          tools: new Set<string>(),
        });
      }
      const item = map.get(email)!;
      item.cost += r.cost;
      item.tokens += r.tokenConsumption;
      item.count += 1;
      if (r.aiTool) item.tools.add(r.aiTool.toLowerCase());
    }
    return Array.from(map.values()).sort((a, b) => b.cost - a.cost);
  }, [targetRows]);

  // Associated project codes breakdown
  const associatedProjects = useMemo(() => {
    const map = new Map<string, { code: string; type: string; cost: number; tokens: number; count: number }>();
    for (const r of targetRows) {
      const code = (r.projectCode || 'N/A').trim();
      if (!map.has(code)) {
        map.set(code, {
          code,
          type: r.projectType || (code.startsWith('E-') ? 'External' : 'Internal'),
          cost: 0,
          tokens: 0,
          count: 0,
        });
      }
      const item = map.get(code)!;
      item.cost += r.cost;
      item.tokens += r.tokenConsumption;
      item.count += 1;
    }
    return Array.from(map.values()).sort((a, b) => b.cost - a.cost);
  }, [targetRows]);

  // Associated tools breakdown
  const associatedTools = useMemo(() => {
    const map = new Map<string, { tool: string; cost: number; tokens: number; count: number }>();
    for (const r of targetRows) {
      const t = (r.aiTool || 'other').toLowerCase().trim();
      if (!map.has(t)) {
        map.set(t, { tool: t, cost: 0, tokens: 0, count: 0 });
      }
      const item = map.get(t)!;
      item.cost += r.cost;
      item.tokens += r.tokenConsumption;
      item.count += 1;
    }
    return Array.from(map.values()).sort((a, b) => b.cost - a.cost);
  }, [targetRows]);

  // Associated Sub-Service Line Practices breakdown
  const associatedSubServiceLines = useMemo(() => {
    const map = new Map<string, { subServiceLine: string; cost: number; tokens: number; count: number }>();
    for (const r of targetRows) {
      const ssl = (r.orgSubServiceLine || 'General').trim();
      if (!map.has(ssl)) {
        map.set(ssl, { subServiceLine: ssl, cost: 0, tokens: 0, count: 0 });
      }
      const item = map.get(ssl)!;
      item.cost += r.cost;
      item.tokens += r.tokenConsumption;
      item.count += 1;
    }
    return Array.from(map.values()).sort((a, b) => b.cost - a.cost);
  }, [targetRows]);

  // Associated Service Lines breakdown
  const associatedServiceLines = useMemo(() => {
    const map = new Map<string, { serviceLine: string; cost: number; tokens: number; count: number }>();
    for (const r of targetRows) {
      const sl = (r.orgServiceLine || 'General').trim();
      if (!map.has(sl)) {
        map.set(sl, { serviceLine: sl, cost: 0, tokens: 0, count: 0 });
      }
      const item = map.get(sl)!;
      item.cost += r.cost;
      item.tokens += r.tokenConsumption;
      item.count += 1;
    }
    return Array.from(map.values()).sort((a, b) => b.cost - a.cost);
  }, [targetRows]);

  // Associated Countries breakdown
  const associatedCountries = useMemo(() => {
    const map = new Map<string, { country: string; cost: number; tokens: number; count: number }>();
    for (const r of targetRows) {
      const c = (r.country || 'N/A').trim();
      if (!map.has(c)) {
        map.set(c, { country: c, cost: 0, tokens: 0, count: 0 });
      }
      const item = map.get(c)!;
      item.cost += r.cost;
      item.tokens += r.tokenConsumption;
      item.count += 1;
    }
    return Array.from(map.values()).sort((a, b) => b.cost - a.cost);
  }, [targetRows]);

  // Toast notification helper
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Export filtered CSV audit trail
  const handleExportFilteredCsv = () => {
    if (filteredRows.length === 0) return;
    const headers = [
      'Activity Date',
      'Display Name',
      'User Email',
      'AI Tool Flag',
      'Project Investment Code',
      'Org Service Line',
      'Org Sub Service Line',
      'Country',
      'Region',
      'Management Region',
      'Billable/Non-Billable',
      'Token Consumption',
      'Cost in USD',
      'License Cost in USD',
      'Usage Free Token Limit',
    ];
    const rows = filteredRows.map((r) => [
      r.activityDate,
      `"${r.displayName}"`,
      r.userMail,
      r.aiTool,
      r.projectCode,
      r.orgServiceLine,
      r.orgSubServiceLine,
      r.country,
      r.region,
      r.managementRegion,
      r.billableFlag,
      r.tokenConsumption,
      r.cost.toFixed(4),
      r.licenseCost || 100.0,
      r.usageFreeTokenLimit || 80.0,
    ]);
    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `roi_${id}_telemetry_audit.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast('Filtered CSV audit trail exported successfully!');
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* ========================================================================= */}
      {/* BREADCRUMB CONTEXT HEADER                                                 */}
      {/* ========================================================================= */}
      <div className="bg-ey-card border border-ey-border rounded-2xl px-4 py-3 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <nav className="flex items-center flex-wrap gap-1.5 text-xs font-mono">
          <button
            onClick={onBack}
            className="text-ey-muted hover:text-ey-yellow transition-colors font-semibold flex items-center gap-1 cursor-pointer"
          >
            <span>{parentTitle}</span>
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-ey-border shrink-0" />

          <button
            onClick={() => {
              if (selectedSubEntity) {
                setSelectedSubEntity(null);
                setSearchTerm('');
                setCurrentPage(1);
              }
            }}
            className={`${
              selectedSubEntity ? 'text-ey-muted hover:text-ey-yellow cursor-pointer' : 'text-ey-yellow font-bold'
            } transition-colors flex items-center gap-1`}
          >
            <span>{title}</span>
          </button>

          {selectedSubEntity && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-ey-border shrink-0" />
              <span className="text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded flex items-center gap-1">
                <span>{selectedSubEntity.name}</span>
                <span className="text-[10px] text-emerald-300/80 font-normal">
                  ({selectedSubEntity.type})
                </span>
              </span>
            </>
          )}
        </nav>

        <div className="flex items-center space-x-2 text-xs font-mono">
          <span className="px-2 py-0.5 rounded bg-ey-black text-ey-muted border border-ey-border">
            Data Source: <strong className="text-ey-light">ai_usage_data.csv</strong>
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TELEMETRY CONTEXT HERO CARD                                               */}
      {/* ========================================================================= */}
      <div className="bg-ey-card border border-ey-border rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-ey-border pb-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 text-[11px] font-mono font-bold rounded-full bg-ey-yellow/15 border border-ey-yellow/30 text-ey-yellow">
                {badge || 'Financial Governance Telemetry'}
              </span>
              {selectedSubEntity && (
                <span className="px-2 py-0.5 text-[11px] font-mono font-bold rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                  Filtered by {selectedSubEntity.type}: {selectedSubEntity.name}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-extrabold text-ey-light tracking-tight flex items-center gap-3">
              <span>{selectedSubEntity ? `Usage Logs: ${selectedSubEntity.name}` : title}</span>
            </h1>
            <p className="text-xs text-ey-muted">
              {selectedSubEntity
                ? `Inspecting all row-level activity log events for ${selectedSubEntity.name} in ai_usage_data.csv.`
                : subtitle || 'Deep telemetry decomposition and raw log records derived from live CSV data.'}
            </p>
          </div>

          {/* Quick Metrics Header Pill */}
          <div className="flex items-center space-x-4 bg-ey-black/70 border border-ey-border rounded-xl p-3 text-xs font-mono shrink-0">
            <div>
              <span className="text-[10px] text-ey-muted block">AGGREGATE COST</span>
              <span className="text-base font-bold text-ey-yellow">${totalSliceCost.toFixed(2)}</span>
            </div>
            <div className="w-px h-8 bg-ey-border" />
            <div>
              <span className="text-[10px] text-ey-muted block">TOTAL TOKENS</span>
              <span className="text-base font-bold text-ey-light">{totalSliceTokens.toLocaleString()}</span>
            </div>
            <div className="w-px h-8 bg-ey-border" />
            <div>
              <span className="text-[10px] text-ey-muted block">RAW LOG ROWS</span>
              <span className="text-base font-bold text-emerald-400">{targetRows.length} entries</span>
            </div>
          </div>
        </div>

        {/* 4 Slice Summary KPI Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="p-3 bg-ey-black/40 border border-ey-border rounded-xl space-y-0.5">
            <span className="text-[10px] text-ey-muted">UNIQUE ACTIVE USERS</span>
            <p className="text-base font-bold text-ey-light">{uniqueUsers} employees</p>
          </div>

          <div className="p-3 bg-ey-black/40 border border-ey-border rounded-xl space-y-0.5">
            <span className="text-[10px] text-ey-muted">BILLABLE REVENUE SHARE</span>
            <p className="text-base font-bold text-emerald-400">
              ${billableSliceCost.toFixed(2)}{' '}
              <span className="text-[10px] text-emerald-300/80">
                ({targetRows.length > 0 ? ((billableSliceRows / targetRows.length) * 100).toFixed(1) : 0}%)
              </span>
            </p>
          </div>

          <div className="p-3 bg-ey-black/40 border border-ey-border rounded-xl space-y-0.5">
            <span className="text-[10px] text-ey-muted">PROJECTS INVOLVED</span>
            <p className="text-base font-bold text-blue-400">{associatedProjects.length} projects</p>
          </div>

          <div className="p-3 bg-ey-black/40 border border-ey-border rounded-xl space-y-0.5">
            <span className="text-[10px] text-ey-muted">AVG RECORD COST</span>
            <p className="text-base font-bold text-ey-yellow">
              ${targetRows.length > 0 ? (totalSliceCost / targetRows.length).toFixed(4) : '0.0000'}
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* LEVEL 2 DECOMPOSITION: Quick Selectors (Users / Projects / Tools)           */}
      {/* ========================================================================= */}
      {!selectedSubEntity && (
        <>
          {type === 'service_line' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Sub-Service Line Practices */}
              <div className="bg-ey-card border border-ey-border rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-ey-border pb-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ey-light flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-ey-yellow" />
                    <span>Sub-Practices</span>
                  </h3>
                  <span className="text-[10px] text-ey-muted font-mono">{associatedSubServiceLines.length} practices</span>
                </div>
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1 text-xs font-mono divide-y divide-ey-border/40">
                  {associatedSubServiceLines.map((ssl) => (
                    <div
                      key={ssl.subServiceLine}
                      onClick={() =>
                        setSelectedSubEntity({
                          type: 'sub_service_line',
                          id: ssl.subServiceLine,
                          name: ssl.subServiceLine,
                        })
                      }
                      className="pt-2 first:pt-0 pb-1.5 flex items-center justify-between hover:bg-ey-black/40 px-2 rounded-lg cursor-pointer transition group"
                    >
                      <div className="truncate pr-2">
                        <p className="font-bold text-ey-light group-hover:text-ey-yellow flex items-center gap-1 truncate">
                          <span>{ssl.subServiceLine}</span>
                          <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-ey-yellow shrink-0" />
                        </p>
                        <p className="text-[10px] text-ey-muted truncate">{ssl.tokens.toLocaleString()} tokens</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-ey-yellow">${ssl.cost.toFixed(2)}</p>
                        <p className="text-[10px] text-ey-muted">{ssl.count} logs</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. Top Contributing Employees */}
              <div className="bg-ey-card border border-ey-border rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-ey-border pb-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ey-light flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-emerald-400" />
                    <span>Contributing Users</span>
                  </h3>
                  <span className="text-[10px] text-ey-muted font-mono">{associatedUsers.length} users</span>
                </div>
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1 text-xs font-mono divide-y divide-ey-border/40">
                  {associatedUsers.slice(0, 15).map((u) => (
                    <div
                      key={u.email}
                      onClick={() =>
                        setSelectedSubEntity({
                          type: 'user',
                          id: u.email,
                          name: u.name,
                        })
                      }
                      className="pt-2 first:pt-0 pb-1.5 flex items-center justify-between hover:bg-ey-black/40 px-2 rounded-lg cursor-pointer transition group"
                    >
                      <div className="truncate pr-2">
                        <p className="font-bold text-ey-light group-hover:text-emerald-300 flex items-center gap-1 truncate">
                          <span>{u.name}</span>
                          <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-emerald-300 shrink-0" />
                        </p>
                        <p className="text-[10px] text-ey-muted truncate">{u.email}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-emerald-400">${u.cost.toFixed(2)}</p>
                        <p className="text-[10px] text-ey-muted">{u.count} logs</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Top Project Codes */}
              <div className="bg-ey-card border border-ey-border rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-ey-border pb-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ey-light flex items-center gap-1.5">
                    <Briefcase className="w-4 h-4 text-blue-400" />
                    <span>Project Codes</span>
                  </h3>
                  <span className="text-[10px] text-ey-muted font-mono">{associatedProjects.length} projects</span>
                </div>
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1 text-xs font-mono divide-y divide-ey-border/40">
                  {associatedProjects.slice(0, 15).map((p) => (
                    <div
                      key={p.code}
                      onClick={() =>
                        setSelectedSubEntity({
                          type: 'project',
                          id: p.code,
                          name: p.code,
                        })
                      }
                      className="pt-2 first:pt-0 pb-1.5 flex items-center justify-between hover:bg-ey-black/40 px-2 rounded-lg cursor-pointer transition group"
                    >
                      <div className="truncate pr-2">
                        <p className="font-bold text-ey-light group-hover:text-blue-300 flex items-center gap-1 truncate">
                          <span>{p.code}</span>
                          <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-blue-300 shrink-0" />
                        </p>
                        <span
                          className={`text-[9px] px-1 py-0.2 rounded font-semibold ${
                            p.type === 'External' ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300'
                          }`}
                        >
                          {p.type}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-ey-light">${p.cost.toFixed(2)}</p>
                        <p className="text-[10px] text-ey-muted">{p.tokens.toLocaleString()} tok</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. Country Footprint */}
              <div className="bg-ey-card border border-ey-border rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-ey-border pb-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ey-light flex items-center gap-1.5">
                    <Globe2 className="w-4 h-4 text-purple-400" />
                    <span>Countries Active</span>
                  </h3>
                  <span className="text-[10px] text-ey-muted font-mono">{associatedCountries.length} countries</span>
                </div>
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1 text-xs font-mono divide-y divide-ey-border/40">
                  {associatedCountries.map((c) => (
                    <div
                      key={c.country}
                      onClick={() =>
                        setSelectedSubEntity({
                          type: 'country',
                          id: c.country,
                          name: c.country,
                        })
                      }
                      className="pt-2 first:pt-0 pb-1.5 flex items-center justify-between hover:bg-ey-black/40 px-2 rounded-lg cursor-pointer transition group"
                    >
                      <div className="truncate pr-2">
                        <p className="font-bold text-ey-light group-hover:text-purple-300 flex items-center gap-1 truncate">
                          <span>{c.country}</span>
                          <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-purple-300 shrink-0" />
                        </p>
                        <p className="text-[10px] text-ey-muted truncate">{c.tokens.toLocaleString()} tokens</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-purple-400">${c.cost.toFixed(2)}</p>
                        <p className="text-[10px] text-ey-muted">{c.count} logs</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : type === 'region' || type === 'country' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Service Lines Active */}
              <div className="bg-ey-card border border-ey-border rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-ey-border pb-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ey-light flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-ey-yellow" />
                    <span>Service Lines</span>
                  </h3>
                  <span className="text-[10px] text-ey-muted font-mono">{associatedServiceLines.length} active</span>
                </div>
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1 text-xs font-mono divide-y divide-ey-border/40">
                  {associatedServiceLines.map((sl) => (
                    <div
                      key={sl.serviceLine}
                      onClick={() =>
                        setSelectedSubEntity({
                          type: 'service_line',
                          id: sl.serviceLine,
                          name: sl.serviceLine,
                        })
                      }
                      className="pt-2 first:pt-0 pb-1.5 flex items-center justify-between hover:bg-ey-black/40 px-2 rounded-lg cursor-pointer transition group"
                    >
                      <div className="truncate pr-2">
                        <p className="font-bold text-ey-light group-hover:text-ey-yellow flex items-center gap-1 truncate">
                          <span>{sl.serviceLine}</span>
                          <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-ey-yellow shrink-0" />
                        </p>
                        <p className="text-[10px] text-ey-muted truncate">{sl.tokens.toLocaleString()} tokens</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-ey-yellow">${sl.cost.toFixed(2)}</p>
                        <p className="text-[10px] text-ey-muted">{sl.count} logs</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. Sub-Practices or Countries */}
              {type === 'region' ? (
                <div className="bg-ey-card border border-ey-border rounded-2xl p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-ey-border pb-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-ey-light flex items-center gap-1.5">
                      <Globe2 className="w-4 h-4 text-purple-400" />
                      <span>Countries in Region</span>
                    </h3>
                    <span className="text-[10px] text-ey-muted font-mono">{associatedCountries.length} countries</span>
                  </div>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1 text-xs font-mono divide-y divide-ey-border/40">
                    {associatedCountries.map((c) => (
                      <div
                        key={c.country}
                        onClick={() =>
                          setSelectedSubEntity({
                            type: 'country',
                            id: c.country,
                            name: c.country,
                          })
                        }
                        className="pt-2 first:pt-0 pb-1.5 flex items-center justify-between hover:bg-ey-black/40 px-2 rounded-lg cursor-pointer transition group"
                      >
                        <div className="truncate pr-2">
                          <p className="font-bold text-ey-light group-hover:text-purple-300 flex items-center gap-1 truncate">
                            <span>{c.country}</span>
                            <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-purple-300 shrink-0" />
                          </p>
                          <p className="text-[10px] text-ey-muted truncate">{c.tokens.toLocaleString()} tokens</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-purple-400">${c.cost.toFixed(2)}</p>
                          <p className="text-[10px] text-ey-muted">{c.count} logs</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-ey-card border border-ey-border rounded-2xl p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-ey-border pb-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-ey-light flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-cyan-400" />
                      <span>Sub-Practices</span>
                    </h3>
                    <span className="text-[10px] text-ey-muted font-mono">{associatedSubServiceLines.length} practices</span>
                  </div>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1 text-xs font-mono divide-y divide-ey-border/40">
                    {associatedSubServiceLines.map((ssl) => (
                      <div
                        key={ssl.subServiceLine}
                        onClick={() =>
                          setSelectedSubEntity({
                            type: 'sub_service_line',
                            id: ssl.subServiceLine,
                            name: ssl.subServiceLine,
                          })
                        }
                        className="pt-2 first:pt-0 pb-1.5 flex items-center justify-between hover:bg-ey-black/40 px-2 rounded-lg cursor-pointer transition group"
                      >
                        <div className="truncate pr-2">
                          <p className="font-bold text-ey-light group-hover:text-cyan-300 flex items-center gap-1 truncate">
                            <span>{ssl.subServiceLine}</span>
                            <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-cyan-300 shrink-0" />
                          </p>
                          <p className="text-[10px] text-ey-muted truncate">{ssl.tokens.toLocaleString()} tokens</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-cyan-400">${ssl.cost.toFixed(2)}</p>
                          <p className="text-[10px] text-ey-muted">{ssl.count} logs</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Top Contributing Employees */}
              <div className="bg-ey-card border border-ey-border rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-ey-border pb-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ey-light flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-emerald-400" />
                    <span>Contributing Users</span>
                  </h3>
                  <span className="text-[10px] text-ey-muted font-mono">{associatedUsers.length} users</span>
                </div>
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1 text-xs font-mono divide-y divide-ey-border/40">
                  {associatedUsers.slice(0, 15).map((u) => (
                    <div
                      key={u.email}
                      onClick={() =>
                        setSelectedSubEntity({
                          type: 'user',
                          id: u.email,
                          name: u.name,
                        })
                      }
                      className="pt-2 first:pt-0 pb-1.5 flex items-center justify-between hover:bg-ey-black/40 px-2 rounded-lg cursor-pointer transition group"
                    >
                      <div className="truncate pr-2">
                        <p className="font-bold text-ey-light group-hover:text-emerald-300 flex items-center gap-1 truncate">
                          <span>{u.name}</span>
                          <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-emerald-300 shrink-0" />
                        </p>
                        <p className="text-[10px] text-ey-muted truncate">{u.email}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-emerald-400">${u.cost.toFixed(2)}</p>
                        <p className="text-[10px] text-ey-muted">{u.count} logs</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. AI Platforms */}
              <div className="bg-ey-card border border-ey-border rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-ey-border pb-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ey-light flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-ey-yellow" />
                    <span>AI Platforms</span>
                  </h3>
                  <span className="text-[10px] text-ey-muted font-mono">{associatedTools.length} models</span>
                </div>
                <div className="space-y-2 text-xs font-mono">
                  {associatedTools.map((t) => (
                    <div
                      key={t.tool}
                      onClick={() =>
                        setSelectedSubEntity({
                          type: 'tool',
                          id: t.tool,
                          name: t.tool.toUpperCase(),
                        })
                      }
                      className="p-2.5 bg-ey-black/50 border border-ey-border/80 hover:border-ey-yellow/60 rounded-xl flex items-center justify-between cursor-pointer transition group"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-ey-light group-hover:text-ey-yellow uppercase text-[11px]">
                          {t.tool}
                        </span>
                        <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-ey-yellow" />
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-ey-yellow text-xs">${t.cost.toFixed(2)}</p>
                        <p className="text-[10px] text-ey-muted">{t.count} logs</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Top Contributing Users Selector */}
              <div className="bg-ey-card border border-ey-border rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-ey-border pb-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ey-light flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-ey-yellow" />
                    <span>Filter by Contributing User</span>
                  </h3>
                  <span className="text-[10px] text-ey-muted font-mono">{associatedUsers.length} total</span>
                </div>
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1 text-xs font-mono divide-y divide-ey-border/40">
                  {associatedUsers.slice(0, 15).map((u) => (
                    <div
                      key={u.email}
                      onClick={() =>
                        setSelectedSubEntity({
                          type: 'user',
                          id: u.email,
                          name: u.name,
                        })
                      }
                      className="pt-2 first:pt-0 pb-1.5 flex items-center justify-between hover:bg-ey-black/40 px-2 rounded-lg cursor-pointer transition group"
                    >
                      <div className="truncate pr-2">
                        <p className="font-bold text-ey-light group-hover:text-ey-yellow flex items-center gap-1 truncate">
                          <span>{u.name}</span>
                          <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-ey-yellow shrink-0" />
                        </p>
                        <p className="text-[10px] text-ey-muted truncate">{u.email}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-ey-yellow">${u.cost.toFixed(2)}</p>
                        <p className="text-[10px] text-ey-muted">{u.count} records</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Project Codes Selector */}
              <div className="bg-ey-card border border-ey-border rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-ey-border pb-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ey-light flex items-center gap-1.5">
                    <Briefcase className="w-4 h-4 text-blue-400" />
                    <span>Filter by Project Code</span>
                  </h3>
                  <span className="text-[10px] text-ey-muted font-mono">{associatedProjects.length} total</span>
                </div>
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1 text-xs font-mono divide-y divide-ey-border/40">
                  {associatedProjects.slice(0, 15).map((p) => (
                    <div
                      key={p.code}
                      onClick={() =>
                        setSelectedSubEntity({
                          type: 'project',
                          id: p.code,
                          name: p.code,
                        })
                      }
                      className="pt-2 first:pt-0 pb-1.5 flex items-center justify-between hover:bg-ey-black/40 px-2 rounded-lg cursor-pointer transition group"
                    >
                      <div className="truncate pr-2">
                        <p className="font-bold text-ey-light group-hover:text-blue-300 flex items-center gap-1 truncate">
                          <span>{p.code}</span>
                          <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-blue-300 shrink-0" />
                        </p>
                        <span
                          className={`text-[9px] px-1 py-0.2 rounded font-semibold ${
                            p.type === 'External' ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300'
                          }`}
                        >
                          {p.type}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-ey-light">${p.cost.toFixed(2)}</p>
                        <p className="text-[10px] text-ey-muted">{p.tokens.toLocaleString()} tok</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Tool Distribution Selector */}
              <div className="bg-ey-card border border-ey-border rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-ey-border pb-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ey-light flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <span>Filter by AI Platform</span>
                  </h3>
                  <span className="text-[10px] text-ey-muted font-mono">{associatedTools.length} models</span>
                </div>
                <div className="space-y-2 text-xs font-mono">
                  {associatedTools.map((t) => (
                    <div
                      key={t.tool}
                      onClick={() =>
                        setSelectedSubEntity({
                          type: 'tool',
                          id: t.tool,
                          name: t.tool.toUpperCase(),
                        })
                      }
                      className="p-3 bg-ey-black/50 border border-ey-border/80 hover:border-emerald-400/60 rounded-xl flex items-center justify-between cursor-pointer transition group"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-ey-light group-hover:text-emerald-300 uppercase">
                          {t.tool}
                        </span>
                        <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-emerald-300" />
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-emerald-400">${t.cost.toFixed(2)}</p>
                        <p className="text-[10px] text-ey-muted">{t.count} log events</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* LEVEL 3: CORE RAW LOG TELEMETRY TABLE (ai_usage_data.csv)                 */}
      {/* ========================================================================= */}
      <div className="bg-ey-card border border-ey-border rounded-2xl p-6 shadow-sm space-y-4">
        {/* Table Controls & Filter Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-ey-border pb-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-ey-light flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-ey-yellow" />
              <span>Core Telemetry Log Stream</span>
              <span className="text-xs font-normal text-ey-muted font-mono">
                ({filteredRows.length} matching rows)
              </span>
            </h2>
            <p className="text-xs text-ey-muted">
              Row-by-row raw CSV records from <strong className="text-ey-light">ai_usage_data.csv</strong>. Click any row to inspect complete record JSON.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-ey-muted absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search user, project, tool..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-ey-black border border-ey-border text-ey-light text-xs rounded-xl pl-8 pr-3 py-1.5 focus:outline-none focus:border-ey-yellow w-48 sm:w-60 font-mono"
              />
            </div>

            {/* AI Tool Dropdown Filter */}
            <select
              value={toolFilter}
              onChange={(e) => {
                setToolFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-ey-black border border-ey-border text-ey-light text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-ey-yellow font-mono cursor-pointer"
            >
              <option value="all">All Tools</option>
              <option value="copilot">Copilot</option>
              <option value="chatgpt">ChatGPT</option>
              <option value="claude">Claude</option>
            </select>

            {/* Billability Filter */}
            <select
              value={billableFilter}
              onChange={(e) => {
                setBillableFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-ey-black border border-ey-border text-ey-light text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-ey-yellow font-mono cursor-pointer"
            >
              <option value="all">All Billability</option>
              <option value="billable">Billable Only</option>
              <option value="non_billable">Non-Billable Only</option>
            </select>

            {/* Export CSV Button */}
            <button
              onClick={handleExportFilteredCsv}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-ey-black border border-ey-border hover:border-ey-yellow text-ey-light hover:text-ey-yellow text-xs font-mono rounded-xl transition cursor-pointer"
              title="Download audit trail of currently displayed records"
            >
              <Download className="w-3.5 h-3.5 text-ey-yellow" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Granular Telemetry Table */}
        <div className="overflow-x-auto border border-ey-border rounded-xl">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-ey-black/70 text-ey-muted uppercase tracking-wider border-b border-ey-border">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">AI Tool</th>
                <th className="px-4 py-3">Project Code</th>
                <th className="px-4 py-3">Service Line</th>
                <th className="px-4 py-3">Sub Service Line</th>
                <th className="px-4 py-3 text-center">Billable</th>
                <th className="px-4 py-3 text-right">Tokens</th>
                <th className="px-4 py-3 text-right">Cost (USD)</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ey-border">
              {paginatedRows.length > 0 ? (
                paginatedRows.map((r, idx) => (
                  <tr
                    key={idx}
                    onClick={() => setInspectingRecord(r)}
                    className="hover:bg-ey-card-hover/80 transition cursor-pointer group"
                  >
                    <td className="px-4 py-3 text-ey-muted whitespace-nowrap">{r.activityDate}</td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-ey-light group-hover:text-ey-yellow flex items-center gap-1">
                        <span>{r.displayName}</span>
                      </p>
                      <p className="text-[10px] text-ey-muted">{r.userMail}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="uppercase font-bold text-ey-yellow">{r.aiTool}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                          (r.projectCode || '').startsWith('E-')
                            ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                            : 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                        }`}
                      >
                        {r.projectCode || 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ey-light">{r.orgServiceLine}</td>
                    <td className="px-4 py-3 text-cyan-300 font-semibold">{r.orgSubServiceLine || 'N/A'}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          r.billableFlag === 'True' || r.billableFlag === 'true'
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {r.billableFlag}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-ey-light">{r.tokenConsumption.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-bold text-ey-yellow">${r.cost.toFixed(4)}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setInspectingRecord(r);
                        }}
                        className="px-2 py-1 bg-ey-black hover:bg-ey-card text-ey-muted hover:text-ey-yellow border border-ey-border rounded-lg text-[10px] transition"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-ey-muted">
                    No telemetry records found matching the specified filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-ey-muted font-mono pt-2">
            <div>
              Showing {((currentPage - 1) * itemsPerPage) + 1} to{' '}
              {Math.min(currentPage * itemsPerPage, filteredRows.length)} of {filteredRows.length} records
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 bg-ey-black border border-ey-border rounded-lg hover:bg-ey-card disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 bg-ey-black border border-ey-border rounded-lg hover:bg-ey-card disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* FLOATING QUICK-RETURN BUTTON (EXCLUSIVE PERSISTENT ON-SCREEN CONTROL)     */}
      {/* ========================================================================= */}
      <div className="fixed bottom-6 right-6 z-40 flex items-center space-x-2 animate-fade-in shadow-2xl">
        <button
          onClick={() => {
            if (selectedSubEntity) {
              setSelectedSubEntity(null);
              setSearchTerm('');
              setCurrentPage(1);
            } else {
              onBack();
            }
          }}
          className="flex items-center space-x-2 px-4 py-2.5 bg-ey-yellow hover:bg-yellow-400 text-ey-black font-extrabold text-xs rounded-full shadow-2xl border-2 border-ey-black transition-all transform hover:scale-105 cursor-pointer"
          title="Return to previous view (Esc)"
        >
          <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
          <span>{selectedSubEntity ? `Back to ${title}` : `Back to ${parentTitle}`}</span>
          <kbd className="text-[10px] bg-black/20 text-ey-black px-1.5 py-0.5 rounded font-mono font-bold">Esc</kbd>
        </button>

        {selectedSubEntity && (
          <button
            onClick={onBack}
            className="p-2.5 bg-ey-black hover:bg-ey-card text-ey-light hover:text-ey-yellow border border-ey-border hover:border-ey-yellow rounded-full shadow-2xl transition cursor-pointer"
            title={`Exit Drilldown to ${parentTitle}`}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* RAW CSV RECORD INSPECTOR MODAL                                            */}
      {/* ========================================================================= */}
      {inspectingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-ey-card border border-ey-border rounded-2xl w-full max-w-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto font-mono text-xs">
            <div className="flex items-center justify-between border-b border-ey-border pb-3">
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="w-5 h-5 text-ey-yellow" />
                <h3 className="text-base font-bold text-ey-light">
                  Raw CSV Record Inspector (ai_usage_data.csv)
                </h3>
              </div>
              <button
                onClick={() => setInspectingRecord(null)}
                className="p-1 rounded-lg hover:bg-ey-black text-ey-muted hover:text-ey-light transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-ey-black/60 p-4 rounded-xl border border-ey-border">
              <div>
                <span className="text-ey-muted text-[10px] block">ACTIVITY DATE</span>
                <span className="text-ey-light font-bold">{inspectingRecord.activityDate}</span>
              </div>
              <div>
                <span className="text-ey-muted text-[10px] block">MONTH / YEAR</span>
                <span className="text-ey-light font-bold">{inspectingRecord.monthYear} ({inspectingRecord.monthId})</span>
              </div>
              <div>
                <span className="text-ey-muted text-[10px] block">EMPLOYEE DISPLAY NAME</span>
                <span className="text-ey-yellow font-bold">{inspectingRecord.displayName}</span>
              </div>
              <div>
                <span className="text-ey-muted text-[10px] block">USER EMAIL</span>
                <span className="text-ey-light">{inspectingRecord.userMail}</span>
              </div>
              <div>
                <span className="text-ey-muted text-[10px] block">AI TOOL FLAG</span>
                <span className="text-ey-light font-bold uppercase">{inspectingRecord.aiTool}</span>
              </div>
              <div>
                <span className="text-ey-muted text-[10px] block">PROJECT INVESTMENT CODE</span>
                <span className="text-cyan-400 font-bold">{inspectingRecord.projectCode}</span>
              </div>
              <div>
                <span className="text-ey-muted text-[10px] block">ORG SERVICE LINE</span>
                <span className="text-ey-light">{inspectingRecord.orgServiceLine}</span>
              </div>
              <div>
                <span className="text-ey-muted text-[10px] block">ORG SUB SERVICE LINE</span>
                <span className="text-ey-light">{inspectingRecord.orgSubServiceLine || 'N/A'}</span>
              </div>
              <div>
                <span className="text-ey-muted text-[10px] block">COUNTRY / REGION</span>
                <span className="text-ey-light">{inspectingRecord.country} ({inspectingRecord.managementRegion})</span>
              </div>
              <div>
                <span className="text-ey-muted text-[10px] block">BILLABLE FLAG</span>
                <span className={`font-bold ${inspectingRecord.billableFlag === 'True' || inspectingRecord.billableFlag === 'true' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {inspectingRecord.billableFlag} ({inspectingRecord.projectType || 'External'})
                </span>
              </div>
              <div>
                <span className="text-ey-muted text-[10px] block">TOKEN CONSUMPTION</span>
                <span className="text-ey-light font-bold">{inspectingRecord.tokenConsumption.toLocaleString()} tokens</span>
              </div>
              <div>
                <span className="text-ey-muted text-[10px] block">COST IN USD</span>
                <span className="text-ey-yellow font-bold text-sm">${inspectingRecord.cost.toFixed(4)}</span>
              </div>
              <div>
                <span className="text-ey-muted text-[10px] block">LICENSE COST IN USD</span>
                <span className="text-ey-light">${inspectingRecord.licenseCost?.toFixed(2) || '100.00'}</span>
              </div>
              <div>
                <span className="text-ey-muted text-[10px] block">USAGE FREE TOKEN LIMIT</span>
                <span className="text-ey-light">{inspectingRecord.usageFreeTokenLimit || 80.0}</span>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-ey-border">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(inspectingRecord, null, 2));
                  triggerToast('Record JSON copied to clipboard!');
                  setInspectingRecord(null);
                }}
                className="px-4 py-2 bg-ey-yellow text-ey-black font-bold rounded-xl hover:bg-yellow-400 transition cursor-pointer"
              >
                Copy Record JSON
              </button>
              <button
                onClick={() => setInspectingRecord(null)}
                className="px-4 py-2 bg-ey-black border border-ey-border text-ey-light rounded-xl hover:bg-ey-card transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-ey-card border border-ey-yellow/60 text-ey-light px-4 py-2.5 rounded-xl shadow-2xl flex items-center space-x-2 animate-fade-in font-mono text-xs">
          <CheckCircle2 className="w-4 h-4 text-ey-yellow shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
