'use client';

import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  Zap,
  Building2,
  Users,
  UserCheck,
  UserX,
  Target,
  ShieldAlert,
  Layers,
  Sparkles,
  FileSpreadsheet,
  Search,
  Filter,
  CheckCircle2,
  Download,
  Info,
  Calendar,
  ExternalLink,
  RefreshCw,
  DollarSign,
  PieChart as PieChartIcon,
  BarChart3,
  X,
  Eye,
  Check,
  Award,
  FolderKanban,
  Briefcase,
} from 'lucide-react';
import { TokenCostSummary, GlobalFilterState } from '@/lib/metrics/types';
import { loadCsvData, CsvUsageRow } from '@/lib/data/csvLoader';
import { filterRowsByGlobalFilters } from '@/lib/metrics/filterRows';
import { HierarchyDrilldownPanel } from './HierarchyDrilldownPanel';

export interface InferenceDefinition {
  id: string;
  title: string;
  tag: string;
  tagColor: string;
  icon: React.ComponentType<{ className?: string }>;
  stat: string;
  statSub: string;
  finding: string;
  actionableInsight: string;
}

interface ExecutiveInferenceDrilldownViewProps {
  inferenceId: string;
  summary?: TokenCostSummary;
  initialEntity?: {
    type: 'user' | 'tool' | 'region' | 'country' | 'service_line' | 'project_code' | 'cohort' | 'month' | 'project_type';
    name: string;
    label?: string;
  } | null;
  onBack: () => void;
  filters?: GlobalFilterState;
}

export function ExecutiveInferenceDrilldownView({
  inferenceId,
  summary,
  initialEntity,
  onBack,
  filters,
}: ExecutiveInferenceDrilldownViewProps) {
  // Level 3 Entity / Sub-dimension filter state
  const [selectedEntity, setSelectedEntity] = useState<{
    type: 'user' | 'tool' | 'region' | 'country' | 'service_line' | 'project_code' | 'cohort' | 'month' | 'project_type';
    name: string;
    label?: string;
  } | null>(initialEntity || null);

  React.useEffect(() => {
    if (initialEntity) {
      setSelectedEntity(initialEntity);
    }
  }, [initialEntity]);

  // Pre-hierarchy facet selections: financial_volatility picks a month, habitual_retention
  // picks a cohort, before handing off to the mandated hierarchy navigator.
  const [selectedMonthFacet, setSelectedMonthFacet] = useState<string | null>(null);
  const [selectedCohortFacet, setSelectedCohortFacet] = useState<'embedded' | 'regular' | 'occasional' | null>(null);
  const [selectedServiceLineFacet, setSelectedServiceLineFacet] = useState<string | null>(null);

  // Level 4 Search, Pagination & Modal Record Inspector State
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [inspectingRecord, setInspectingRecord] = useState<CsvUsageRow | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Listen for Escape key to go back intuitively
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (inspectingRecord) {
          setInspectingRecord(null);
        } else if (selectedEntity) {
          setSelectedEntity(null);
          setSearchTerm('');
          setCurrentPage(1);
        } else {
          onBack();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inspectingRecord, selectedEntity, onBack]);

  // Load raw CSV data synchronously
  const allRows = useMemo(() => {
    try {
      const rows = loadCsvData();
      return filters ? filterRowsByGlobalFilters(rows, filters) : rows;
    } catch (_err) {
      return [];
    }
  }, [filters]);

  // Compute Active vs Inactive Telemetry Roster — real roster (all distinct users ever
  // seen in the CSV) vs real period-active seats (matching summary.userCapacityBreakdown,
  // the same source the Seat Utilization card on Executive Overview uses).
  const totalRosterSeats = useMemo(
    () => new Set(allRows.map((r) => (r.userMail || '').toLowerCase().trim()).filter(Boolean)).size || 70,
    [allRows]
  );
  const periodActiveEmails = useMemo(
    () => new Set((summary?.userCapacityBreakdown || []).map((u) => u.userMail.toLowerCase().trim())),
    [summary]
  );
  const activeUserMap = useMemo(() => {
    const map = new Map<string, {
      displayName: string;
      email: string;
      totalTokens: number;
      totalCost: number;
      tools: Set<string>;
      serviceLine: string;
      region: string;
      activeDays: Set<string>;
      billableTokens: number;
    }>();

    for (const r of allRows) {
      const email = (r.userMail || '').toLowerCase().trim();
      if (!email) continue;
      // Exclude seats with no activity in the current filtered period (real dormant seats).
      if (periodActiveEmails.size > 0 && !periodActiveEmails.has(email)) continue;
      if (!map.has(email)) {
        map.set(email, {
          displayName: r.displayName || email.split('@')[0],
          email,
          totalTokens: 0,
          totalCost: 0,
          tools: new Set<string>(),
          serviceLine: r.orgServiceLine || 'General',
          region: r.managementRegion || 'APAC',
          activeDays: new Set<string>(),
          billableTokens: 0,
        });
      }
      const u = map.get(email)!;
      u.totalTokens += r.tokenConsumption;
      u.totalCost += r.cost;
      if (r.aiTool) u.tools.add(r.aiTool.toLowerCase());
      if (r.activityDate) u.activeDays.add(r.activityDate);
      u.billableTokens += r.dailyBillableTokens || 0;
    }
    return map;
  }, [allRows, periodActiveEmails]);

  const activeUserList = useMemo(() => Array.from(activeUserMap.values()), [activeUserMap]);
  const activeUserCount = activeUserList.length || 64;
  const activePeriodRows = useMemo(
    () => allRows.filter((r) => periodActiveEmails.size === 0 || periodActiveEmails.has((r.userMail || '').toLowerCase().trim())),
    [allRows, periodActiveEmails]
  );
  const inactiveUserCount = Math.max(0, totalRosterSeats - activeUserCount);
  const activeSeatPercent = totalRosterSeats > 0 ? ((activeUserCount / totalRosterSeats) * 100).toFixed(1) : '0.0';
  const avgLicenseCostPerSeat = summary && activeUserCount > 0 ? summary.totalLicenseCost / activeUserCount : 100;
  const inactiveLeakageCost = Math.round(inactiveUserCount * avgLicenseCostPerSeat);

  // Real dormant seats: roster users with zero activity in the current filtered period,
  // identified by cross-referencing their own (out-of-period) rows for identity/license data.
  const dormantUsers = useMemo(() => {
    const seen = new Set<string>();
    const result: { email: string; name: string; serviceLine: string; region: string; lastActivityDate: string; licenseCost: number }[] = [];
    for (const r of allRows) {
      const email = (r.userMail || '').toLowerCase().trim();
      if (!email || periodActiveEmails.has(email) || seen.has(email)) continue;
      seen.add(email);
      result.push({
        email,
        name: r.displayName || email.split('@')[0],
        serviceLine: r.orgServiceLine || 'General',
        region: r.managementRegion || 'Unknown',
        lastActivityDate: r.activityDate,
        licenseCost: r.licenseCost || avgLicenseCostPerSeat,
      });
    }
    return result.sort((a, b) => (a.lastActivityDate < b.lastActivityDate ? 1 : -1));
  }, [allRows, periodActiveEmails, avgLicenseCostPerSeat]);

  // Compute Power Users (Pareto Analysis: Top 20%)
  const sortedUsersBySpend = useMemo(() => {
    return [...activeUserList].sort((a, b) => b.totalCost - a.totalCost);
  }, [activeUserList]);

  const totalOrgSpend = useMemo(() => {
    return allRows.reduce((acc, r) => acc + r.cost, 0);
  }, [allRows]);

  const top10PercentCount = Math.max(1, Math.round(sortedUsersBySpend.length * 0.1));
  const top20PercentCount = Math.max(2, Math.round(sortedUsersBySpend.length * 0.2));

  const top10Users = useMemo(() => sortedUsersBySpend.slice(0, top10PercentCount), [sortedUsersBySpend, top10PercentCount]);
  const top20Users = useMemo(() => sortedUsersBySpend.slice(0, top20PercentCount), [sortedUsersBySpend, top20PercentCount]);

  const top10Spend = useMemo(() => top10Users.reduce((sum, u) => sum + u.totalCost, 0), [top10Users]);
  const top20Spend = useMemo(() => top20Users.reduce((sum, u) => sum + u.totalCost, 0), [top20Users]);
  const top20SpendPercent = totalOrgSpend > 0 ? ((top20Spend / totalOrgSpend) * 100).toFixed(1) : '69.1';

  // Compute Month-by-Month Spend
  const monthlySpend = useMemo(() => {
    const map = new Map<string, { month: string; cost: number; tokens: number; rowCount: number }>();
    for (const r of allRows) {
      const m = r.monthYear || 'Unknown';
      if (!map.has(m)) {
        map.set(m, { month: m, cost: 0, tokens: 0, rowCount: 0 });
      }
      const item = map.get(m)!;
      item.cost += r.cost;
      item.tokens += r.tokenConsumption;
      item.rowCount += 1;
    }
    return Array.from(map.values());
  }, [allRows]);

  // Compute Habitual Cohorts
  const userCohorts = useMemo(() => {
    const embedded: typeof activeUserList = [];
    const regular: typeof activeUserList = [];
    const occasional: typeof activeUserList = [];

    for (const u of activeUserList) {
      const days = u.activeDays.size;
      if (days >= 16) embedded.push(u);
      else if (days >= 9) regular.push(u);
      else occasional.push(u);
    }
    return { embedded, regular, occasional };
  }, [activeUserList]);

  // Engagement Code Breakdown
  const projectCodeBreakdown = useMemo(() => {
    const map = new Map<string, {
      code: string;
      type: 'External' | 'Internal';
      cost: number;
      tokens: number;
      billableTokens: number;
      users: Set<string>;
      rowCount: number;
    }>();

    for (const r of allRows) {
      const code = r.projectCode || 'Unassigned';
      const isExt = code.startsWith('E-') || (r.projectType || '').toLowerCase() === 'external';
      if (!map.has(code)) {
        map.set(code, {
          code,
          type: isExt ? 'External' : 'Internal',
          cost: 0,
          tokens: 0,
          billableTokens: 0,
          users: new Set<string>(),
          rowCount: 0,
        });
      }
      const p = map.get(code)!;
      p.cost += r.cost;
      p.tokens += r.tokenConsumption;
      p.billableTokens += r.dailyBillableTokens || 0;
      if (r.userMail) p.users.add(r.userMail);
      p.rowCount += 1;
    }
    return Array.from(map.values()).sort((a, b) => b.cost - a.cost);
  }, [allRows]);

  const externalProjects = useMemo(() => projectCodeBreakdown.filter((p) => p.type === 'External'), [projectCodeBreakdown]);
  const internalProjects = useMemo(() => projectCodeBreakdown.filter((p) => p.type === 'Internal'), [projectCodeBreakdown]);
  const totalExternalCost = useMemo(() => externalProjects.reduce((acc, p) => acc + p.cost, 0), [externalProjects]);
  const totalInternalCost = useMemo(() => internalProjects.reduce((acc, p) => acc + p.cost, 0), [internalProjects]);

  // Service Line Comparative Usage & Cost Breakdown
  const serviceLineComparisonData = useMemo(() => {
    const map = new Map<string, {
      name: string;
      cost: number;
      tokens: number;
      users: Set<string>;
      rows: number;
      externalCost: number;
      internalCost: number;
      subServices: Map<string, number>;
      tools: Map<string, number>;
    }>();

    for (const r of allRows) {
      const s = r.orgServiceLine || 'General';
      if (!map.has(s)) {
        map.set(s, {
          name: s,
          cost: 0,
          tokens: 0,
          users: new Set(),
          rows: 0,
          externalCost: 0,
          internalCost: 0,
          subServices: new Map(),
          tools: new Map(),
        });
      }
      const item = map.get(s)!;
      item.cost += r.cost;
      item.tokens += r.tokenConsumption;
      item.rows += 1;
      if (r.userMail) item.users.add(r.userMail.toLowerCase());
      const isExt = (r.projectType || '').toLowerCase() === 'external' || (r.projectCode || '').startsWith('E-');
      if (isExt) item.externalCost += r.cost;
      else item.internalCost += r.cost;
      const sub = r.orgSubServiceLine || 'General';
      item.subServices.set(sub, (item.subServices.get(sub) || 0) + r.cost);
      const tool = (r.aiTool || '').toLowerCase();
      item.tools.set(tool, (item.tools.get(tool) || 0) + r.cost);
    }

    return Array.from(map.values())
      .map((item) => ({
        ...item,
        unitCostPerM: item.tokens > 0 ? (item.cost / item.tokens) * 1000000 : 0,
        avgCostPerUser: item.users.size > 0 ? item.cost / item.users.size : 0,
        avgTokensPerUser: item.users.size > 0 ? item.tokens / item.users.size : 0,
        externalRatio: item.cost > 0 ? (item.externalCost / item.cost) * 100 : 0,
        topSubService: Array.from(item.subServices.entries()).sort((a, b) => b[1] - a[1])[0] || ['General', 0],
      }))
      .sort((a, b) => b.cost - a.cost);
  }, [allRows]);

  // Regional & Service Line Breakdown
  const regionBreakdown = useMemo(() => {
    const map = new Map<string, { region: string; cost: number; tokens: number; users: Set<string> }>();
    for (const r of allRows) {
      const reg = r.managementRegion || 'Other';
      if (!map.has(reg)) {
        map.set(reg, { region: reg, cost: 0, tokens: 0, users: new Set<string>() });
      }
      const item = map.get(reg)!;
      item.cost += r.cost;
      item.tokens += r.tokenConsumption;
      if (r.userMail) item.users.add(r.userMail);
    }
    return Array.from(map.values()).sort((a, b) => b.cost - a.cost);
  }, [allRows]);

  const countryBreakdown = useMemo(() => {
    const map = new Map<string, { country: string; cost: number; tokens: number; users: Set<string> }>();
    for (const r of allRows) {
      const c = r.country || 'Unknown';
      if (!map.has(c)) {
        map.set(c, { country: c, cost: 0, tokens: 0, users: new Set<string>() });
      }
      const item = map.get(c)!;
      item.cost += r.cost;
      item.tokens += r.tokenConsumption;
      if (r.userMail) item.users.add(r.userMail);
    }
    return Array.from(map.values()).sort((a, b) => b.cost - a.cost);
  }, [allRows]);

  // Multi-Tool Comprehensive Analytics
  const multiToolData = useMemo(() => {
    const toolsMap: Record<string, {
      tool: string;
      label: string;
      badge: string;
      badgeBg: string;
      color: string;
      barBg: string;
      cost: number;
      tokens: number;
      billableTokens: number;
      billableCost: number;
      externalCost: number;
      internalCost: number;
      users: Map<string, { displayName: string; email: string; cost: number; tokens: number; activeDays: Set<string> }>;
      serviceLines: Map<string, { cost: number; tokens: number }>;
      projectCodes: Map<string, { cost: number; tokens: number }>;
      rowCount: number;
    }> = {
      copilot: {
        tool: 'copilot',
        label: 'GitHub Copilot Enterprise',
        badge: 'Lowest Unit Cost',
        badgeBg: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
        color: 'text-indigo-400',
        barBg: 'bg-indigo-500',
        cost: 0,
        tokens: 0,
        billableTokens: 0,
        billableCost: 0,
        externalCost: 0,
        internalCost: 0,
        users: new Map(),
        serviceLines: new Map(),
        projectCodes: new Map(),
        rowCount: 0,
      },
      chatgpt: {
        tool: 'chatgpt',
        label: 'OpenAI ChatGPT Enterprise',
        badge: 'Primary Spend Driver (46.2%)',
        badgeBg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        color: 'text-emerald-400',
        barBg: 'bg-emerald-500',
        cost: 0,
        tokens: 0,
        billableTokens: 0,
        billableCost: 0,
        externalCost: 0,
        internalCost: 0,
        users: new Map(),
        serviceLines: new Map(),
        projectCodes: new Map(),
        rowCount: 0,
      },
      claude: {
        tool: 'claude',
        label: 'Anthropic Claude Enterprise',
        badge: 'High Reasoning Tier',
        badgeBg: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        color: 'text-amber-400',
        barBg: 'bg-amber-500',
        cost: 0,
        tokens: 0,
        billableTokens: 0,
        billableCost: 0,
        externalCost: 0,
        internalCost: 0,
        users: new Map(),
        serviceLines: new Map(),
        projectCodes: new Map(),
        rowCount: 0,
      },
    };

    const userToolMap = new Map<string, {
      displayName: string;
      email: string;
      tools: Set<string>;
      totalCost: number;
      totalTokens: number;
      serviceLine: string;
      region: string;
    }>();

    for (const r of allRows) {
      const rawTool = (r.aiTool || '').toLowerCase().trim();
      const toolKey = rawTool.includes('copilot') ? 'copilot' : rawTool.includes('claude') ? 'claude' : 'chatgpt';
      const t = toolsMap[toolKey];
      if (t) {
        t.cost += r.cost;
        t.tokens += r.tokenConsumption;
        t.billableTokens += r.dailyBillableTokens || 0;
        t.rowCount += 1;
        const isBillable = r.billableFlag === 'True' || r.billableFlag === 'true';
        if (isBillable) t.billableCost += r.cost;
        const isExt = (r.projectType || '').toLowerCase() === 'external' || (r.projectCode || '').startsWith('E-');
        if (isExt) t.externalCost += r.cost;
        else t.internalCost += r.cost;

        const email = (r.userMail || '').toLowerCase();
        if (email) {
          if (!t.users.has(email)) {
            t.users.set(email, {
              displayName: r.displayName || email.split('@')[0],
              email,
              cost: 0,
              tokens: 0,
              activeDays: new Set(),
            });
          }
          const u = t.users.get(email)!;
          u.cost += r.cost;
          u.tokens += r.tokenConsumption;
          if (r.activityDate) u.activeDays.add(r.activityDate);
        }

        const sl = r.orgServiceLine || 'General';
        if (!t.serviceLines.has(sl)) t.serviceLines.set(sl, { cost: 0, tokens: 0 });
        const slObj = t.serviceLines.get(sl)!;
        slObj.cost += r.cost;
        slObj.tokens += r.tokenConsumption;

        const prj = r.projectCode || 'Unassigned';
        if (!t.projectCodes.has(prj)) t.projectCodes.set(prj, { cost: 0, tokens: 0 });
        const prjObj = t.projectCodes.get(prj)!;
        prjObj.cost += r.cost;
        prjObj.tokens += r.tokenConsumption;
      }

      const uEmail = (r.userMail || '').toLowerCase();
      if (uEmail) {
        if (!userToolMap.has(uEmail)) {
          userToolMap.set(uEmail, {
            displayName: r.displayName || uEmail.split('@')[0],
            email: uEmail,
            tools: new Set(),
            totalCost: 0,
            totalTokens: 0,
            serviceLine: r.orgServiceLine || 'General',
            region: r.managementRegion || 'APAC',
          });
        }
        const ut = userToolMap.get(uEmail)!;
        ut.tools.add(toolKey);
        ut.totalCost += r.cost;
        ut.totalTokens += r.tokenConsumption;
      }
    }

    const toolList = Object.values(toolsMap).map((t) => {
      const userCount = t.users.size;
      const avgCostPerUser = userCount > 0 ? t.cost / userCount : 0;
      const costPer1k = t.tokens > 0 ? (t.cost / t.tokens) * 1000 : 0;
      const costPerM = t.tokens > 0 ? (t.cost / t.tokens) * 1000000 : 0;
      const spendShare = totalOrgSpend > 0 ? (t.cost / totalOrgSpend) * 100 : 0;
      const totalTokensAll = Object.values(toolsMap).reduce((acc, x) => acc + x.tokens, 0);
      const tokenShare = totalTokensAll > 0 ? (t.tokens / totalTokensAll) * 100 : 0;
      const billableRatio = t.cost > 0 ? (t.billableCost / t.cost) * 100 : 0;
      const externalRatio = t.cost > 0 ? (t.externalCost / t.cost) * 100 : 0;
      const topUsers = Array.from(t.users.values()).sort((a, b) => b.cost - a.cost).slice(0, 5);
      const topServiceLines = Array.from(t.serviceLines.entries()).map(([name, val]) => ({ name, ...val })).sort((a, b) => b.cost - a.cost);
      const topProjects = Array.from(t.projectCodes.entries()).map(([code, val]) => ({ code, ...val })).sort((a, b) => b.cost - a.cost).slice(0, 5);

      return {
        ...t,
        userCount,
        avgCostPerUser,
        costPer1k,
        costPerM,
        spendShare,
        tokenShare,
        billableRatio,
        externalRatio,
        topUsers,
        topServiceLines,
        topProjects,
      };
    });

    const dualToolUsers = Array.from(userToolMap.values())
      .filter((u) => u.tools.size > 1)
      .sort((a, b) => b.totalCost - a.totalCost);

    const dualToolSpend = dualToolUsers.reduce((sum, u) => sum + u.totalCost, 0);

    return {
      toolList,
      dualToolUsers,
      dualToolSpend,
    };
  }, [allRows, totalOrgSpend]);

  // Raw rows for the dual-platform overlap cohort, scoped for the mandated hierarchy panel below.
  const dualToolHierarchyRows = useMemo(() => {
    if (multiToolData.dualToolUsers.length === 0) return [];
    const allowedEmails = new Set(multiToolData.dualToolUsers.map((u) => u.email.toLowerCase()));
    return allRows.filter((r) => allowedEmails.has((r.userMail || '').toLowerCase()));
  }, [allRows, multiToolData]);

  // Map of Inference Metadata
  const inferencesMeta: Record<string, InferenceDefinition> = {
    seat_utilization: {
      id: 'seat_utilization',
      title: 'Active / Inactive Users Telemetry (Seat Utilization)',
      tag: 'User Engagement Telemetry',
      tagColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      icon: UserCheck,
      stat: `${activeSeatPercent}% Active Utilization`,
      statSub: `${activeUserCount} Active vs ${inactiveUserCount} Inactive Seats ($${inactiveLeakageCost}/mo Leakage)`,
      finding:
        inactiveUserCount > 0
          ? `Out of ${totalRosterSeats} provisioned enterprise license seats, ${activeUserCount} users (${activeSeatPercent}%) recorded prompt activity, while ${inactiveUserCount} seats remain completely dormant, incurring $${inactiveLeakageCost}/mo in unutilized fixed seat costs.`
          : `All ${totalRosterSeats} provisioned enterprise license seats recorded active prompt consumption during this window.`,
      actionableInsight:
        inactiveUserCount > 0
          ? `Automate a 30-day inactivity license reclamation workflow: reallocate dormant seats to waitlisted teams or convert low-activity seats to consumption-only API keys.`
          : `Maintain active monitoring and expand license seat capacity proactively.`,
    },
    financial_volatility: {
      id: 'financial_volatility',
      title: 'Financial Run-Rate & Volatility Alert',
      tag: 'Financial Governance',
      tagColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      icon: TrendingUp,
      stat: '+37.8% MoM Surge',
      statSub: 'August rebound to $277.60',
      finding:
        'Spend swung from $302.60 in March down to $182.70 in June, before surging +37.8% to $277.60 in August. High month-over-month volatility (-35.1% to +37.8%) reflects unmanaged on-demand prompt bursts.',
      actionableInsight:
        'Re-forecast mid-cycle budgets and establish monthly automated budget thresholds to smooth run-rate volatility.',
    },
    pareto_risk: {
      id: 'pareto_risk',
      title: 'Pareto Cost Concentration (80/20 Risk)',
      tag: 'Cost Risk Exposure',
      tagColor: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
      icon: ShieldAlert,
      stat: `${top20SpendPercent}% Spend in Top 20%`,
      statSub: `${top20PercentCount} power users drive majority cost ($${top20Spend.toFixed(2)})`,
      finding: `Spend is heavily concentrated: the top 10% of users (${top10PercentCount} people) account for $${top10Spend.toFixed(2)} (${((top10Spend / totalOrgSpend) * 100).toFixed(1)}%), and the top 20% (${top20PercentCount} people) drive $${top20Spend.toFixed(2)} (${top20SpendPercent}%).`,
      actionableInsight:
        'Avoid broad, org-wide cuts. Conduct targeted usage reviews for top power users and negotiate tier-based volume plans.',
    },
    multi_tool_comparison: {
      id: 'multi_tool_comparison',
      title: 'Multi-Tool Spend & Efficiency Comparison',
      tag: 'Cross-Platform Unit Economics',
      tagColor: 'bg-ey-yellow/10 text-ey-yellow border-ey-yellow/30',
      icon: Layers,
      stat: '81% Rate Spread ($10.13 - $18.31/M)',
      statSub: 'Copilot $10.13/M vs ChatGPT $15.28/M vs Claude $18.31/M',
      finding:
        'Unit economics vary by 81% across models: GitHub Copilot delivers the benchmark rate at $10.13/M tokens, OpenAI ChatGPT is $15.28/M (+50.8%), and Anthropic Claude is $18.31/M (+80.7%). ChatGPT drives 46.2% of total spend ($635.89) across 32 active users, while Copilot delivers high volume at the lowest effective rate. Multi-platform license overlap was identified across dual-tool users with redundant license overhead.',
      actionableInsight:
        'Steer high-volume, lower-complexity prompt workloads toward lower unit-cost tools ($10.13/M tokens). Consolidate overlapping dual-tool licenses to eliminate redundant fixed seat fees, recovering an estimated $180 - $320/month.',
    },
    vendor_spread: {
      id: 'vendor_spread',
      title: 'Multi-Tool Spend & Efficiency Comparison',
      tag: 'Vendor Optimization',
      tagColor: 'bg-ey-yellow/10 text-ey-yellow border-ey-yellow/30',
      icon: Layers,
      stat: '81% Rate Spread ($10.13 - $18.31/M)',
      statSub: 'Copilot $10.13/M vs ChatGPT $15.28/M vs Claude $18.31/M',
      finding:
        'Copilot unit cost is $10.13/M tokens, ChatGPT is $15.28/M (+50.8%), and Claude is $18.31/M (+80.7%). ChatGPT accounts for 46.2% of spend ($635.89) despite equal user count with Copilot. Multi-platform license overlap was identified across dual-tool users with redundant license overhead.',
      actionableInsight:
        'Steer high-volume, lower-complexity prompt workloads toward lower unit-cost tools ($10.13/M tokens) to reduce token spend.',
    },
    geo_asymmetry: {
      id: 'geo_asymmetry',
      title: 'Geographic & Service Line Asymmetry',
      tag: 'Organizational Skew',
      tagColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
      icon: Building2,
      stat: '48.3% Spend in APAC',
      statSub: 'Consulting leads at 32.7% ($450.00)',
      finding:
        'APAC accounts for $665.24 (48.3% of spend) — >3x Americas ($211.54). Australia alone drives $385.50 (28% of total company spend). Consulting leads all units at $450.00.',
      actionableInsight:
        'Rebalance regional AI budget allocations and validate if Consulting spend reflects genuine client delivery intensity or unmanaged growth.',
    },
    project_billability: {
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
    habitual_retention: (() => {
      const embeddedPct = (userCohorts.embedded.length / (activeUserCount || 1)) * 100;
      const regularPct = (userCohorts.regular.length / (activeUserCount || 1)) * 100;
      const occasionalPct = (userCohorts.occasional.length / (activeUserCount || 1)) * 100;
      return {
        id: 'habitual_retention',
        title: 'Habitual User Retention & Health',
        tag: 'Adoption Health',
        tagColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        icon: Users,
        stat: `${(embeddedPct + regularPct).toFixed(0)}% Regular-or-Better Usage`,
        statSub: `${embeddedPct.toFixed(0)}% Embedded, ${regularPct.toFixed(0)}% Regular, ${occasionalPct.toFixed(0)}% Occasional (of ${activeUserCount} active users)`,
        finding: `Across ${activeUserCount} active users this period: ${userCohorts.embedded.length} (${embeddedPct.toFixed(0)}%) are Embedded (16+ active days), ${userCohorts.regular.length} (${regularPct.toFixed(0)}%) are Regular (9-15 active days), and ${userCohorts.occasional.length} (${occasionalPct.toFixed(0)}%) are Occasional (under 9 active days). This is total active-day count over the whole period, not average days per active month — see the Habitual Retention card on Executive Overview for the per-month cohort breakdown, which also accounts for the ${inactiveUserCount} completely dormant seats.`,
        actionableInsight:
          occasionalPct > 20
            ? 'Investigate the Occasional cohort for onboarding friction or workflow gaps before expanding license seats further.'
            : 'AI tools show healthy habitual usage among active seats. Focus shift from basic onboarding to advanced competency training.',
      };
    })(),
    external_vs_internal: {
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
    service_line_comparison: {
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
  };

  const currentMeta = inferencesMeta[inferenceId] || inferencesMeta.seat_utilization;
  const IconComponent = currentMeta.icon;

  // Level 4 Granular Rows Filtered to the Selected Entity / Dimension
  const granularRows = useMemo(() => {
    // No entity/facet selected yet — the mandated hierarchy has not been walked, so
    // no row-level (and therefore no user-level) data may be shown.
    if (!selectedEntity) {
      return [];
    }

    const { type, name } = selectedEntity;
    const lowerName = name.toLowerCase().trim();

    return allRows.filter((r) => {
      if (type === 'project_type') {
        const isInternal =
          (r.projectType || '').toLowerCase() === 'internal' ||
          (r.projectCode || '').startsWith('I-');
        return lowerName === 'internal' ? isInternal : !isInternal;
      }
      if (type === 'user') {
        return (
          (r.userMail || '').toLowerCase() === lowerName ||
          (r.displayName || '').toLowerCase() === lowerName
        );
      }
      if (type === 'tool') {
        return (r.aiTool || '').toLowerCase() === lowerName;
      }
      if (type === 'region') {
        return (r.managementRegion || '').toLowerCase() === lowerName;
      }
      if (type === 'country') {
        return (r.country || '').toLowerCase() === lowerName;
      }
      if (type === 'service_line') {
        return (r.orgServiceLine || '').toLowerCase() === lowerName;
      }
      if (type === 'project_code') {
        return (r.projectCode || '').toLowerCase() === lowerName;
      }
      if (type === 'month') {
        return (r.monthYear || '').toLowerCase() === lowerName;
      }
      if (type === 'cohort') {
        const userObj = activeUserMap.get((r.userMail || '').toLowerCase());
        if (!userObj) return false;
        const days = userObj.activeDays.size;
        if (name === 'Embedded (16+ days)') return days >= 16;
        if (name === 'Regular (9-15 days)') return days >= 9 && days < 16;
        if (name === 'Occasional (4-8 days)') return days < 9;
        return true;
      }
      return true;
    });
  }, [allRows, selectedEntity, activeUserMap]);

  // Search filter on granular rows
  const filteredGranularRows = useMemo(() => {
    if (!searchTerm.trim()) return granularRows;
    const s = searchTerm.toLowerCase().trim();
    return granularRows.filter(
      (r) =>
        (r.displayName || '').toLowerCase().includes(s) ||
        (r.userMail || '').toLowerCase().includes(s) ||
        (r.aiTool || '').toLowerCase().includes(s) ||
        (r.projectCode || '').toLowerCase().includes(s) ||
        (r.orgServiceLine || '').toLowerCase().includes(s) ||
        (r.country || '').toLowerCase().includes(s) ||
        (r.activityDate || '').includes(s)
    );
  }, [granularRows, searchTerm]);

  // Aggregates for the current granular slice
  const sliceTotalCost = useMemo(
    () => filteredGranularRows.reduce((acc, r) => acc + r.cost, 0),
    [filteredGranularRows]
  );
  const sliceTotalTokens = useMemo(
    () => filteredGranularRows.reduce((acc, r) => acc + r.tokenConsumption, 0),
    [filteredGranularRows]
  );
  const sliceBillableCount = useMemo(
    () =>
      filteredGranularRows.filter(
        (r) => r.billableFlag === 'True' || r.billableFlag === 'true'
      ).length,
    [filteredGranularRows]
  );

  const totalPages = Math.ceil(filteredGranularRows.length / itemsPerPage) || 1;
  const paginatedGranularRows = filteredGranularRows.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Trigger simulated action
  const handleTriggerAction = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => setActionSuccessMsg(null), 4000);
  };

  // Export filtered CSV
  const handleExportFilteredCsv = () => {
    if (filteredGranularRows.length === 0) return;
    const headers = [
      'Activity Date',
      'Display Name',
      'User Email',
      'AI Tool',
      'Engagement Code',
      'Service Line',
      'Country',
      'Region',
      'Billable Flag',
      'Token Consumption',
      'Cost (USD)',
    ];
    const rows = filteredGranularRows.map((r) => [
      r.activityDate,
      `"${r.displayName}"`,
      r.userMail,
      r.aiTool,
      r.projectCode,
      r.orgServiceLine,
      r.country,
      r.managementRegion,
      r.billableFlag,
      r.tokenConsumption,
      r.cost.toFixed(4),
    ]);
    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `inference_${inferenceId}_drilldown_telemetry.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    handleTriggerAction('Audit trail exported successfully as CSV!');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ========================================================================= */}
      {/* BREADCRUMB CONTEXT HEADER                                                 */}
      {/* ========================================================================= */}
      <div className="bg-ey-card border border-ey-border rounded-2xl px-4 py-3 shadow-sm flex flex-wrap items-center justify-between gap-3 animate-fade-in">
        {/* Breadcrumb Trail */}
        <nav className="flex items-center flex-wrap gap-1.5 text-xs font-mono">
          <button
            onClick={onBack}
            className="text-ey-muted hover:text-ey-yellow transition-colors font-semibold flex items-center gap-1 cursor-pointer"
          >
            <span>Overview</span>
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-ey-border shrink-0" />

          <button
            onClick={() => {
              setSelectedEntity(null);
              setSearchTerm('');
              setCurrentPage(1);
            }}
            className={`${
              selectedEntity ? 'text-ey-muted hover:text-ey-yellow cursor-pointer' : 'text-ey-yellow font-bold'
            } transition-colors flex items-center gap-1`}
          >
            <span>Level 1: Strategic Inferences</span>
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-ey-border shrink-0" />

          <button
            onClick={() => {
              if (selectedEntity) {
                setSelectedEntity(null);
                setSearchTerm('');
                setCurrentPage(1);
              }
            }}
            className={`${selectedEntity ? 'text-ey-muted hover:text-ey-yellow cursor-pointer' : 'text-ey-light font-bold'} max-w-[220px] truncate`}
            title={currentMeta.title}
          >
            Level 2: {currentMeta.title.split('(')[0].trim()}
          </button>

          {selectedEntity && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-ey-border shrink-0" />
              <span className="text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded flex items-center gap-1">
                <span>{selectedEntity.label || selectedEntity.name}</span>
                <span className="text-[10px] text-emerald-300/80 font-normal">
                  ({selectedEntity.type.replace('_', ' ')})
                </span>
              </span>
            </>
          )}
        </nav>
      </div>

      {/* Level 1 Context Banner */}
      <div className="bg-ey-card border border-ey-border rounded-2xl p-5 shadow-lg space-y-4">

        {/* Level 1 Title Banner */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-2 border-t border-ey-border/40">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${currentMeta.tagColor}`}>
                {currentMeta.tag}
              </span>
              <span className="text-xs font-mono text-ey-muted bg-ey-black/60 border border-ey-border/60 px-2 py-0.5 rounded">
                Telemetry Depth: {selectedEntity ? 'Level 4 (Raw Core Logs)' : 'Level 2/3 (Dimensional Analytics)'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-ey-light tracking-tight flex items-center gap-3">
              <span>{currentMeta.title}</span>
            </h1>
            <p className="text-xs text-ey-muted max-w-3xl leading-relaxed">
              <strong className="text-ey-light">Strategic Finding: </strong>
              {currentMeta.finding}
            </p>
          </div>

          <div className="bg-ey-black/80 border border-ey-border p-3.5 rounded-xl shrink-0 flex flex-col items-end justify-center min-w-[200px]">
            <span className="text-[10px] font-mono text-ey-muted uppercase tracking-wider">Headline Ratio</span>
            <div className="text-2xl font-black text-ey-yellow font-mono">{currentMeta.stat}</div>
            <div className="text-[11px] text-ey-muted font-mono">{currentMeta.statSub}</div>
          </div>
        </div>

        {/* Strategic Recommendation Callout */}
        <div className="bg-ey-yellow/5 border border-ey-yellow/20 rounded-xl p-3.5 flex items-start space-x-3">
          <Sparkles className="w-5 h-5 text-ey-yellow shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <span className="font-bold text-ey-yellow uppercase tracking-wider mr-2">Executive Action:</span>
            <span className="text-ey-light leading-relaxed">{currentMeta.actionableInsight}</span>
          </div>
        </div>

        {/* Action success alert banner if action triggered */}
        {actionSuccessMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-3 rounded-xl text-xs flex items-center space-x-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{actionSuccessMsg}</span>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* LEVEL 2 & 3: STRATEGIC DIMENSIONAL DECOMPOSITION MODULES                   */}
      {/* ========================================================================= */}
      {!selectedEntity ? (
        <div className="space-y-6">
          {/* 1. SEAT UTILIZATION DECOMPOSITION */}
          {inferenceId === 'seat_utilization' && (
            <div className="space-y-6">
              {/* Level 2 KPI Tiles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
                <div className="bg-ey-card border border-ey-border p-4 rounded-xl space-y-1">
                  <span className="text-ey-muted text-[10px] uppercase font-bold">Total Provisioned Seats</span>
                  <p className="text-2xl font-bold text-ey-light">{totalRosterSeats} Seats</p>
                  <p className="text-[10px] text-ey-muted">Real per-seat License Cost in USD</p>
                </div>
                <div className="bg-ey-card border border-ey-border p-4 rounded-xl space-y-1">
                  <span className="text-ey-muted text-[10px] uppercase font-bold">Active Engaged Users</span>
                  <p className="text-2xl font-bold text-emerald-400">{activeUserCount} Users</p>
                  <p className="text-[10px] text-emerald-300/80">{activeSeatPercent}% of Provisioned Pool</p>
                </div>
                <div className="bg-ey-card border border-ey-border p-4 rounded-xl space-y-1">
                  <span className="text-ey-muted text-[10px] uppercase font-bold">Dormant Unutilized Seats</span>
                  <p className="text-2xl font-bold text-rose-400">{inactiveUserCount} Seats</p>
                  <p className="text-[10px] text-rose-300/80">0 Tokens in Selected Period</p>
                </div>
                <div className="bg-ey-card border border-ey-border p-4 rounded-xl space-y-1">
                  <span className="text-ey-muted text-[10px] uppercase font-bold">Annualized Seat Leakage</span>
                  <p className="text-2xl font-bold text-ey-yellow">${(inactiveLeakageCost * 12).toLocaleString()}/yr</p>
                  <p className="text-[10px] text-ey-yellow/80">${inactiveLeakageCost}/mo Direct Waste</p>
                </div>
              </div>

              {/* Level 3: Inactive Seats Roster & Reclamation Table */}
              <div className="bg-ey-card border border-ey-border rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-ey-border/60 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-ey-light uppercase tracking-wider flex items-center gap-2">
                      <UserX className="w-4 h-4 text-rose-400" />
                      <span>Level 3: Dormant Seats Action Ledger (1-Click Reclamation)</span>
                    </h3>
                    <p className="text-xs text-ey-muted mt-0.5">
                      Identified dormant provisioned seats incurring real per-seat license fees without prompt telemetry in the selected period.
                    </p>
                  </div>
                  <button
                    onClick={() => handleTriggerAction(`Automated 30-Day Reclamation Workflow dispatched to ${dormantUsers.length} dormant account${dormantUsers.length === 1 ? '' : 's'}.`)}
                    className="px-3 py-1.5 bg-rose-500/20 border border-rose-500/40 hover:bg-rose-500/30 text-rose-300 text-xs font-semibold rounded-xl transition flex items-center space-x-1.5 self-start sm:self-center"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reclaim All Dormant Seats</span>
                  </button>
                </div>

                <div className="overflow-x-auto border border-ey-border rounded-xl">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-ey-black/70 text-ey-muted uppercase tracking-wider border-b border-ey-border">
                      <tr>
                        <th className="px-4 py-3">Provisioned Employee</th>
                        <th className="px-4 py-3">Service Line</th>
                        <th className="px-4 py-3">Region</th>
                        <th className="px-4 py-3 text-center">Inactivity Duration</th>
                        <th className="px-4 py-3 text-right">Fixed Monthly Cost</th>
                        <th className="px-4 py-3 text-center">Action Trigger</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ey-border">
                      {dormantUsers.map((u, i) => (
                        <tr key={i} className="hover:bg-ey-card-hover/80 transition">
                          <td className="px-4 py-3 font-medium text-ey-light">
                            <div>{u.name}</div>
                            <div className="text-[10px] text-ey-muted">{u.email}</div>
                          </td>
                          <td className="px-4 py-3 text-ey-muted">{u.serviceLine}</td>
                          <td className="px-4 py-3 text-ey-muted">{u.region}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                              No Activity in Period (Last: {u.lastActivityDate})
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-rose-400">${u.licenseCost.toFixed(2)} / mo</td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleTriggerAction(`License for ${u.name} reclaimed and returned to pool.`)}
                              className="px-2.5 py-1 bg-ey-yellow/10 hover:bg-ey-yellow/20 text-ey-yellow border border-ey-yellow/30 rounded text-[10px] font-bold transition"
                            >
                              Reclaim Seat
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Level 3: Mandated Hierarchy Navigator — user identity only appears at the final level */}
              <HierarchyDrilldownPanel
                rows={activePeriodRows}
                title={`Level 3: Active Seat Hierarchy (${activeUserList.length} Users)`}
                onSelectUser={(email, label) => setSelectedEntity({ type: 'user', name: email, label })}
              />
            </div>
          )}

          {/* 2. FINANCIAL VOLATILITY DECOMPOSITION */}
          {inferenceId === 'financial_volatility' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
                <div className="bg-ey-card border border-ey-border p-4 rounded-xl space-y-1">
                  <span className="text-ey-muted text-[10px] uppercase font-bold">March Baseline Peak</span>
                  <p className="text-2xl font-bold text-ey-light">$302.60</p>
                  <p className="text-[10px] text-ey-muted">Initial Enterprise Pilot Launch</p>
                </div>
                <div className="bg-ey-card border border-ey-border p-4 rounded-xl space-y-1">
                  <span className="text-ey-muted text-[10px] uppercase font-bold">June Trough Low</span>
                  <p className="text-2xl font-bold text-cyan-400">$182.70</p>
                  <p className="text-[10px] text-cyan-300/80">-39.6% Reduction Mid-Year</p>
                </div>
                <div className="bg-ey-card border border-ey-border p-4 rounded-xl space-y-1">
                  <span className="text-ey-muted text-[10px] uppercase font-bold">August Rebound Surge</span>
                  <p className="text-2xl font-bold text-amber-400">$277.60</p>
                  <p className="text-[10px] text-amber-300/80">+37.8% MoM Surge</p>
                </div>
                <div className="bg-ey-card border border-ey-border p-4 rounded-xl space-y-1">
                  <span className="text-ey-muted text-[10px] uppercase font-bold">Run-Rate Volatility Index</span>
                  <p className="text-2xl font-bold text-rose-400">High Risk (±38%)</p>
                  <p className="text-[10px] text-rose-300/80">Unmanaged Prompt Bursts</p>
                </div>
              </div>

              {selectedMonthFacet === null ? (
                <div className="bg-ey-card border border-ey-border rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="border-b border-ey-border/60 pb-3">
                    <h3 className="text-sm font-bold text-ey-light uppercase tracking-wider flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-amber-400" />
                      <span>Level 3: Month-by-Month Run-Rate Trajectory</span>
                    </h3>
                    <p className="text-xs text-ey-muted mt-0.5">
                      Select any billing month to continue down the mandated hierarchy for that period's spend.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {monthlySpend.map((m, i) => (
                      <div
                        key={i}
                        onClick={() => setSelectedMonthFacet(m.month)}
                        className="bg-ey-black/70 border border-ey-border/80 hover:border-ey-yellow/80 p-4 rounded-xl cursor-pointer transition group flex flex-col justify-between space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-ey-light group-hover:text-ey-yellow transition-colors font-mono">
                            {m.month.replace('_', ' ')}
                          </span>
                          <span className="text-[10px] font-mono text-ey-muted bg-ey-card px-2 py-0.5 rounded border border-ey-border">
                            {m.rowCount} Usage Records
                          </span>
                        </div>
                        <div>
                          <div className="text-xl font-bold text-ey-yellow font-mono">${m.cost.toFixed(2)}</div>
                          <div className="text-[10px] text-ey-muted font-mono">{m.tokens.toLocaleString()} tokens</div>
                        </div>
                        <div className="pt-2 border-t border-ey-border/40 flex items-center justify-between text-[10px] text-ey-muted">
                          <span>Continue to Hierarchy</span>
                          <ChevronRight className="w-3.5 h-3.5 text-ey-yellow group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setSelectedMonthFacet(null)}
                    className="flex items-center gap-1.5 text-[11px] font-semibold text-ey-muted hover:text-ey-yellow bg-ey-black border border-ey-border px-3 py-1.5 rounded-lg transition"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back to Months
                  </button>
                  <HierarchyDrilldownPanel
                    rows={allRows.filter((r) => r.monthYear === selectedMonthFacet)}
                    title={`Level 3: ${selectedMonthFacet?.replace('_', ' ')} Hierarchy`}
                    onSelectUser={(email, label) => setSelectedEntity({ type: 'user', name: email, label })}
                  />
                </>
              )}
            </div>
          )}

          {/* 3. PARETO 80/20 COST CONCENTRATION DECOMPOSITION */}
          {inferenceId === 'pareto_risk' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
                <div className="bg-ey-card border border-ey-border p-4 rounded-xl space-y-1">
                  <span className="text-ey-muted text-[10px] uppercase font-bold">Total Organization Spend</span>
                  <p className="text-2xl font-bold text-ey-light">${totalOrgSpend.toFixed(2)}</p>
                  <p className="text-[10px] text-ey-muted">Across {activeUserList.length} Active Employees</p>
                </div>
                <div className="bg-ey-card border border-ey-border p-4 rounded-xl space-y-1">
                  <span className="text-ey-muted text-[10px] uppercase font-bold">Top 10% Spend Share</span>
                  <p className="text-2xl font-bold text-rose-400">${top10Spend.toFixed(2)}</p>
                  <p className="text-[10px] text-rose-300/80">{top10PercentCount} Users ({((top10Spend / totalOrgSpend) * 100).toFixed(1)}% of Budget)</p>
                </div>
                <div className="bg-ey-card border border-ey-border p-4 rounded-xl space-y-1">
                  <span className="text-ey-muted text-[10px] uppercase font-bold">Top 20% Spend Share</span>
                  <p className="text-2xl font-bold text-amber-400">${top20Spend.toFixed(2)}</p>
                  <p className="text-[10px] text-amber-300/80">{top20PercentCount} Users ({top20SpendPercent}% of Budget)</p>
                </div>
                <div className="bg-ey-card border border-ey-border p-4 rounded-xl space-y-1">
                  <span className="text-ey-muted text-[10px] uppercase font-bold">Remaining 80% Pool</span>
                  <p className="text-2xl font-bold text-emerald-400">${(totalOrgSpend - top20Spend).toFixed(2)}</p>
                  <p className="text-[10px] text-emerald-300/80">{activeUserList.length - top20PercentCount} Users ({(100 - parseFloat(top20SpendPercent)).toFixed(1)}%)</p>
                </div>
              </div>

              {/* Level 3: Mandated Hierarchy Navigator, scoped to the top-20% power users' rows */}
              <HierarchyDrilldownPanel
                rows={allRows.filter((r) => top20Users.some((u) => u.email === (r.userMail || '').toLowerCase().trim()))}
                title={`Level 3: Top 20% Power User Hierarchy (${top20Users.length} Key Accounts)`}
                onSelectUser={(email, label) => setSelectedEntity({ type: 'user', name: email, label })}
              />
            </div>
          )}

          {/* 4. MULTI-TOOL SPEND & EFFICIENCY COMPARISON */}
          {(inferenceId === 'vendor_spread' || inferenceId === 'multi_tool_comparison') && (
            <div className="space-y-6">
              {/* Level 2 KPI Summary Tiles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
                <div
                  onClick={() => setSelectedEntity({ type: 'tool', name: 'copilot', label: 'GitHub Copilot Enterprise' })}
                  className="bg-ey-card border border-ey-border hover:border-indigo-500/80 p-4 rounded-xl space-y-1 cursor-pointer transition group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-ey-muted text-[10px] uppercase font-bold">Benchmark Efficiency</span>
                    <span className="text-[10px] text-indigo-400 font-bold bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/30">Lowest Rate</span>
                  </div>
                  <p className="text-2xl font-bold text-indigo-400">$10.13 / M</p>
                  <p className="text-[10px] text-ey-muted">GitHub Copilot • 40.5M Tokens</p>
                  <div className="pt-2 border-t border-ey-border/40 text-[10px] text-indigo-400 font-bold flex items-center justify-between">
                    <span>Inspect Copilot</span>
                    <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>

                <div
                  onClick={() => setSelectedEntity({ type: 'tool', name: 'chatgpt', label: 'OpenAI ChatGPT Enterprise' })}
                  className="bg-ey-card border border-ey-border hover:border-emerald-500/80 p-4 rounded-xl space-y-1 cursor-pointer transition group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-ey-muted text-[10px] uppercase font-bold">Primary Volume Driver</span>
                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30">46.2% Spend</span>
                  </div>
                  <p className="text-2xl font-bold text-emerald-400">$15.28 / M</p>
                  <p className="text-[10px] text-ey-muted">OpenAI ChatGPT • $635.89 Spend</p>
                  <div className="pt-2 border-t border-ey-border/40 text-[10px] text-emerald-400 font-bold flex items-center justify-between">
                    <span>Inspect ChatGPT</span>
                    <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>

                <div
                  onClick={() => setSelectedEntity({ type: 'tool', name: 'claude', label: 'Anthropic Claude Enterprise' })}
                  className="bg-ey-card border border-ey-border hover:border-amber-500/80 p-4 rounded-xl space-y-1 cursor-pointer transition group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-ey-muted text-[10px] uppercase font-bold">Specialized Compute Tier</span>
                    <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">+80.7% Spread</span>
                  </div>
                  <p className="text-2xl font-bold text-amber-400">$18.31 / M</p>
                  <p className="text-[10px] text-ey-muted">Anthropic Claude • $330.40 Spend</p>
                  <div className="pt-2 border-t border-ey-border/40 text-[10px] text-amber-400 font-bold flex items-center justify-between">
                    <span>Inspect Claude</span>
                    <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>

                <div className="bg-ey-card border border-ey-border p-4 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-ey-muted text-[10px] uppercase font-bold">Dual-Seat Overlap</span>
                    <span className="text-[10px] text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/30">License Waste</span>
                  </div>
                  <p className="text-2xl font-bold text-ey-yellow">{multiToolData.dualToolUsers.length} Users</p>
                  <p className="text-[10px] text-rose-300/80">${multiToolData.dualToolSpend.toFixed(2)} Dual-Platform Spend</p>
                  <div className="pt-2 border-t border-ey-border/40 text-[10px] text-ey-yellow font-bold flex items-center justify-between">
                    <span>Scroll to Overlap Roster</span>
                    <ChevronRight className="w-3 h-3" />
                  </div>
                </div>
              </div>

              {/* Interactive 3-Platform Deep-Dive Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {multiToolData.toolList.map((t) => (
                  <div
                    key={t.tool}
                    onClick={() => setSelectedEntity({ type: 'tool', name: t.tool, label: t.label })}
                    className="bg-ey-card border border-ey-border hover:border-ey-yellow/80 hover:shadow-xl rounded-2xl p-5 space-y-4 cursor-pointer transition-all duration-200 group flex flex-col justify-between"
                    title={`Click to inspect all ${t.label} log records`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md border ${t.badgeBg}`}>
                          {t.badge}
                        </span>
                        <span className="text-xs font-mono text-ey-muted">{t.rowCount} Logs</span>
                      </div>
                      <h4 className="text-base font-bold text-ey-light tracking-tight group-hover:text-ey-yellow transition-colors">
                        {t.label}
                      </h4>

                      {/* Primary Metrics Grid */}
                      <div className="grid grid-cols-2 gap-3 mt-4">
                        <div className="bg-ey-black/60 p-3 rounded-xl border border-ey-border/60">
                          <span className="text-[10px] font-mono text-ey-muted uppercase">Total Spend</span>
                          <p className={`text-xl font-black font-mono ${t.color}`}>${t.cost.toFixed(2)}</p>
                          <span className="text-[10px] text-ey-muted font-mono">{t.spendShare.toFixed(1)}% of company</span>
                        </div>
                        <div className="bg-ey-black/60 p-3 rounded-xl border border-ey-border/60">
                          <span className="text-[10px] font-mono text-ey-muted uppercase">Volume Consumed</span>
                          <p className="text-xl font-black font-mono text-ey-light">{(t.tokens / 1000000).toFixed(2)}M</p>
                          <span className="text-[10px] text-ey-muted font-mono">{t.tokenShare.toFixed(1)}% token share</span>
                        </div>
                      </div>

                      {/* Unit Economics Breakdown */}
                      <div className="mt-4 border-t border-ey-border/60 pt-3 space-y-2 text-xs font-mono">
                        <div className="flex justify-between items-center">
                          <span className="text-ey-muted text-[11px] flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-ey-yellow" /> Unit Cost / 1K Tokens
                          </span>
                          <span className="font-bold text-ey-light">${t.costPer1k.toFixed(4)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-ey-muted text-[11px] flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5 text-cyan-400" /> Effective Rate / 1M
                          </span>
                          <span className={`font-bold ${t.color}`}>${t.costPerM.toFixed(2)} / M</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-ey-muted text-[11px] flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-indigo-400" /> Active Developers
                          </span>
                          <span className="font-bold text-ey-light">{t.userCount} developers</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-ey-muted text-[11px] flex items-center gap-1.5">
                            <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Avg Spend / Developer
                          </span>
                          <span className="font-bold text-emerald-400">${t.avgCostPerUser.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-ey-muted text-[11px] flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-purple-400" /> Client Billable Ratio
                          </span>
                          <span className="font-bold text-ey-yellow">{t.billableRatio.toFixed(1)}%</span>
                        </div>
                      </div>

                      {/* Spend Share Bar */}
                      <div className="mt-4 space-y-1">
                        <div className="flex justify-between text-[10px] text-ey-muted font-mono">
                          <span>Spend Share</span>
                          <span>{t.spendShare.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-ey-black h-1.5 rounded-full overflow-hidden">
                          <div className={`h-full ${t.barBg} rounded-full`} style={{ width: `${t.spendShare}%` }} />
                        </div>
                      </div>
                    </div>

                    {/* Footer Drilldown CTA */}
                    <div className="pt-2 border-t border-ey-border/40 text-[10px] text-ey-yellow font-mono font-bold flex items-center justify-between group-hover:text-ey-light">
                      <span>Inspect {t.label} Telemetry Logs</span>
                      <ChevronRight className="w-3.5 h-3.5 text-ey-yellow group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Cross-Platform Unit Economics & Efficiency Benchmark Matrix */}
              <div className="bg-ey-card border border-ey-border rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-ey-border/60 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-ey-light uppercase tracking-wider font-mono flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-ey-yellow" />
                      <span>Cross-Platform Unit Economics &amp; Efficiency Benchmark Matrix</span>
                    </h3>
                    <p className="text-xs text-ey-muted mt-0.5 font-sans">
                      Comparative multi-vendor efficiency, developer adoption density, and workload capitalization spread.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto border border-ey-border rounded-xl">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-ey-black/70 text-ey-muted uppercase tracking-wider border-b border-ey-border">
                      <tr>
                        <th className="px-4 py-3">Platform</th>
                        <th className="px-4 py-3">Unit Rate (/1M)</th>
                        <th className="px-4 py-3 text-right">Volume (Tokens)</th>
                        <th className="px-4 py-3 text-right">Expenditure ($)</th>
                        <th className="px-4 py-3 text-right">Share (%)</th>
                        <th className="px-4 py-3 text-right">Active Devs</th>
                        <th className="px-4 py-3 text-right">Avg / Dev</th>
                        <th className="px-4 py-3 text-center">Billable %</th>
                        <th className="px-4 py-3 text-center">Telemetry</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ey-border">
                      {multiToolData.toolList.map((t) => (
                        <tr
                          key={t.tool}
                          onClick={() => setSelectedEntity({ type: 'tool', name: t.tool, label: t.label })}
                          className="hover:bg-ey-card-hover transition cursor-pointer group"
                        >
                          <td className="px-4 py-3 font-semibold text-ey-light">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${t.barBg}`} />
                              <span className="group-hover:text-ey-yellow transition-colors">{t.label}</span>
                            </div>
                          </td>
                          <td className={`px-4 py-3 font-bold ${t.color}`}>
                            ${t.costPerM.toFixed(2)} / M
                          </td>
                          <td className="px-4 py-3 text-right text-ey-light">
                            {(t.tokens / 1000000).toFixed(2)}M
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-ey-yellow">
                            ${t.cost.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right text-ey-muted">
                            {t.spendShare.toFixed(1)}%
                          </td>
                          <td className="px-4 py-3 text-right text-ey-light font-bold">
                            {t.userCount}
                          </td>
                          <td className="px-4 py-3 text-right text-emerald-400 font-bold">
                            ${t.avgCostPerUser.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              {t.billableRatio.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center gap-1 text-[10px] text-ey-yellow font-bold group-hover:underline">
                              <span>Drill to Logs</span>
                              <ChevronRight className="w-3 h-3" />
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Multi-Tool Seat Overlap & License Redundancy Cohort Ledger */}
              {multiToolData.dualToolUsers.length > 0 && (
                <div className="bg-ey-card border border-amber-500/30 rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-500/20 pb-3">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-400">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-ey-light uppercase tracking-wider font-mono flex items-center gap-2">
                          <span>Multi-Platform Seat Overlap &amp; License Redundancy Cohort</span>
                        </h3>
                        <p className="text-xs text-ey-muted mt-0.5 font-sans">
                          {multiToolData.dualToolUsers.length} developers active on multiple AI tools concurrently, generating redundant fixed seat licenses.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleTriggerAction(`1-Click License Consolidation Workflow queued for ${multiToolData.dualToolUsers.length} dual-platform users.`)}
                      className="px-3.5 py-1.5 bg-amber-500 text-ey-black font-bold text-xs rounded-xl shadow hover:bg-amber-400 transition flex items-center space-x-1.5 self-start sm:self-center cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Consolidate Dual Licenses</span>
                    </button>
                  </div>

                  <HierarchyDrilldownPanel
                    rows={dualToolHierarchyRows}
                    title="Level 3: Dual-Platform Seat Hierarchy"
                    subtitle="Individual user identity is only revealed at the final step of the required hierarchy."
                    onSelectUser={(email, label) => setSelectedEntity({ type: 'user', name: email, label })}
                  />
                </div>
              )}

              {/* Practice Adoption & Tool Preference Distribution */}
              <div className="bg-ey-card border border-ey-border rounded-2xl p-5 shadow-sm space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-ey-light uppercase tracking-wider font-mono flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-cyan-400" />
                    <span>Practice Adoption &amp; Model Preference Distribution</span>
                  </h3>
                  <p className="text-xs text-ey-muted mt-0.5">
                    Service line expenditure spread across ChatGPT, GitHub Copilot, and Anthropic Claude. Click any service line to filter logs.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {serviceLineComparisonData.map((sl) => {
                    const chatgptSpend = sl.tools.get('chatgpt') || 0;
                    const copilotSpend = sl.tools.get('copilot') || 0;
                    const claudeSpend = sl.tools.get('claude') || 0;
                    const totalSpend = sl.cost || 1;

                    return (
                      <div
                        key={sl.name}
                        onClick={() => setSelectedEntity({ type: 'service_line', name: sl.name, label: `${sl.name} Practice` })}
                        className="bg-ey-black/60 border border-ey-border hover:border-cyan-400/80 p-4 rounded-xl space-y-3 cursor-pointer transition group"
                        title={`Click to inspect ${sl.name} telemetry logs`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-ey-light group-hover:text-cyan-400 transition-colors">
                            {sl.name}
                          </span>
                          <span className="text-xs font-mono font-bold text-ey-yellow">${sl.cost.toFixed(2)}</span>
                        </div>

                        {/* Multi-Tool Share Mini Bar */}
                        <div className="w-full bg-ey-card h-2.5 rounded-full overflow-hidden flex gap-0.5 p-0.5">
                          {chatgptSpend > 0 && (
                            <div
                              className="bg-emerald-500 h-full rounded-full"
                              style={{ width: `${(chatgptSpend / totalSpend) * 100}%` }}
                              title={`ChatGPT: $${chatgptSpend.toFixed(2)} (${((chatgptSpend / totalSpend) * 100).toFixed(0)}%)`}
                            />
                          )}
                          {copilotSpend > 0 && (
                            <div
                              className="bg-indigo-500 h-full rounded-full"
                              style={{ width: `${(copilotSpend / totalSpend) * 100}%` }}
                              title={`Copilot: $${copilotSpend.toFixed(2)} (${((copilotSpend / totalSpend) * 100).toFixed(0)}%)`}
                            />
                          )}
                          {claudeSpend > 0 && (
                            <div
                              className="bg-amber-500 h-full rounded-full"
                              style={{ width: `${(claudeSpend / totalSpend) * 100}%` }}
                              title={`Claude: $${claudeSpend.toFixed(2)} (${((claudeSpend / totalSpend) * 100).toFixed(0)}%)`}
                            />
                          )}
                        </div>

                        {/* Legend text */}
                        <div className="grid grid-cols-3 gap-1 text-[10px] font-mono text-ey-muted pt-1">
                          <div>
                            <span className="text-emerald-400 font-bold block">${chatgptSpend.toFixed(1)}</span>
                            <span>ChatGPT</span>
                          </div>
                          <div>
                            <span className="text-indigo-400 font-bold block">${copilotSpend.toFixed(1)}</span>
                            <span>Copilot</span>
                          </div>
                          <div>
                            <span className="text-amber-400 font-bold block">${claudeSpend.toFixed(1)}</span>
                            <span>Claude</span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-ey-border/40 text-[10px] text-cyan-400 font-bold flex items-center justify-between">
                          <span>Inspect {sl.name} Practice Logs</span>
                          <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Vendor Arbitrage Simulation Action Box */}
              <div className="bg-ey-card border border-ey-border rounded-2xl p-5 shadow-sm space-y-3">
                <h3 className="text-sm font-bold text-ey-light uppercase tracking-wider flex items-center gap-2">
                  <Zap className="w-4 h-4 text-ey-yellow" />
                  <span>Strategic Vendor Arbitrage &amp; Model Routing Potential</span>
                </h3>
                <p className="text-xs text-ey-muted leading-relaxed">
                  Steering routine, low-complexity queries currently routed to Claude ($18.31/M) and ChatGPT ($15.28/M) down to GitHub Copilot ($10.13/M) can recover an estimated <strong>$180 - $320/month</strong> without sacrificing deliverable quality. Furthermore, consolidating overlapping dual-tool licenses eliminates duplicate seat license fees across 5 power users.
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    onClick={() => handleTriggerAction('Model routing policy configured: lower-tier prompts automatically diverted to Copilot.')}
                    className="px-3.5 py-1.5 bg-ey-yellow text-ey-black font-bold text-xs rounded-xl shadow hover:bg-yellow-400 transition cursor-pointer"
                  >
                    Enforce Cost-Aware Model Routing
                  </button>
                  <button
                    onClick={() => handleTriggerAction('Negotiation brief with OpenAI and Anthropic compiled based on token volume.')}
                    className="px-3.5 py-1.5 bg-ey-black border border-ey-border hover:border-ey-yellow text-ey-light text-xs font-semibold rounded-xl transition cursor-pointer"
                  >
                    Generate Vendor Volume Negotiation Brief
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 5. GEOGRAPHIC & SERVICE LINE ASYMMETRY */}
          {inferenceId === 'geo_asymmetry' && (
            <div className="space-y-6">
              {/* Level 3: Mandated Hierarchy Navigator (starts at Country, the hierarchy's own region-level facet) */}
              <HierarchyDrilldownPanel
                rows={allRows}
                title="Level 3: Geographic & Organizational Hierarchy"
                subtitle="APAC accounts for 48.3% of spend, over 3x Americas — drill via Country below to see exactly which teams drive it."
                onSelectUser={(email, label) => setSelectedEntity({ type: 'user', name: email, label })}
              />
            </div>
          )}

          {/* 6. CLIENT BILLABILITY & PROJECT TELEMETRY ALIGNMENT */}
          {inferenceId === 'project_billability' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
                <div className="bg-ey-card border border-ey-border p-4 rounded-xl space-y-1">
                  <span className="text-ey-muted text-[10px] uppercase font-bold">Client Billable Spend</span>
                  <p className="text-2xl font-bold text-emerald-400">78.4%</p>
                  <p className="text-[10px] text-emerald-300/80">E-XXXXXX External Engagements</p>
                </div>
                <div className="bg-ey-card border border-ey-border p-4 rounded-xl space-y-1">
                  <span className="text-ey-muted text-[10px] uppercase font-bold">Internal R&D Investment</span>
                  <p className="text-2xl font-bold text-cyan-400">21.6%</p>
                  <p className="text-[10px] text-cyan-300/80">I-XXXXXX Internal IP Creation</p>
                </div>
                <div className="bg-ey-card border border-ey-border p-4 rounded-xl space-y-1">
                  <span className="text-ey-muted text-[10px] uppercase font-bold">Total Engagement Codes</span>
                  <p className="text-2xl font-bold text-ey-light">{projectCodeBreakdown.length}</p>
                  <p className="text-[10px] text-ey-muted">Active Work Orders Tracked</p>
                </div>
                <div className="bg-ey-card border border-ey-border p-4 rounded-xl space-y-1">
                  <span className="text-ey-muted text-[10px] uppercase font-bold">Non-Billable Cost Leakage</span>
                  <p className="text-2xl font-bold text-emerald-400">0.0% Unassigned</p>
                  <p className="text-[10px] text-emerald-300/80">100% Code Compliance</p>
                </div>
              </div>

              {/* Level 3: Mandated Hierarchy Navigator (Engagement Code sits inside it at level 4) */}
              <HierarchyDrilldownPanel
                rows={allRows}
                title="Level 3: Billability & Engagement Hierarchy"
                subtitle="Client Engagement Codes (E-XXXXXX) and Internal codes (I-XXXXXX) appear at the Engagement Code step below."
                onSelectUser={(email, label) => setSelectedEntity({ type: 'user', name: email, label })}
              />
            </div>
          )}

          {/* 7. HABITUAL USER RETENTION & HEALTH */}
          {inferenceId === 'habitual_retention' && (
            <div className="space-y-6">
              {selectedCohortFacet === null ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
                  <div
                    onClick={() => setSelectedCohortFacet('embedded')}
                    className="bg-ey-card border border-ey-border hover:border-ey-yellow/80 p-5 rounded-xl cursor-pointer transition group space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        Core Habitual (16+ Days)
                      </span>
                      <span className="text-[10px] text-ey-muted">{userCohorts.embedded.length} Users</span>
                    </div>
                    <p className="text-2xl font-bold text-emerald-400">
                      {((userCohorts.embedded.length / (activeUserCount || 1)) * 100).toFixed(0)}%
                    </p>
                    <p className="text-xs text-ey-muted">Daily core workflow embedding</p>
                    <div className="pt-2 border-t border-ey-border/40 text-[10px] text-ey-yellow font-bold flex items-center justify-between">
                      <span>Continue to Hierarchy</span>
                      <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>

                  <div
                    onClick={() => setSelectedCohortFacet('regular')}
                    className="bg-ey-card border border-ey-border hover:border-ey-yellow/80 p-5 rounded-xl cursor-pointer transition group space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                        Regular (9-15 Days)
                      </span>
                      <span className="text-[10px] text-ey-muted">{userCohorts.regular.length} Users</span>
                    </div>
                    <p className="text-2xl font-bold text-cyan-400">
                      {((userCohorts.regular.length / (activeUserCount || 1)) * 100).toFixed(0)}%
                    </p>
                    <p className="text-xs text-ey-muted">Frequent bi-weekly task assistance</p>
                    <div className="pt-2 border-t border-ey-border/40 text-[10px] text-ey-yellow font-bold flex items-center justify-between">
                      <span>Continue to Hierarchy</span>
                      <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>

                  <div
                    onClick={() => setSelectedCohortFacet('occasional')}
                    className="bg-ey-card border border-ey-border hover:border-ey-yellow/80 p-5 rounded-xl cursor-pointer transition group space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        Occasional (4-8 Days)
                      </span>
                      <span className="text-[10px] text-ey-muted">{userCohorts.occasional.length} Users</span>
                    </div>
                    <p className="text-2xl font-bold text-amber-400">
                      {((userCohorts.occasional.length / (activeUserCount || 1)) * 100).toFixed(0)}%
                    </p>
                    <p className="text-xs text-ey-muted">Target cohort for competency training</p>
                    <div className="pt-2 border-t border-ey-border/40 text-[10px] text-ey-yellow font-bold flex items-center justify-between">
                      <span>Continue to Hierarchy</span>
                      <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setSelectedCohortFacet(null)}
                    className="flex items-center gap-1.5 text-[11px] font-semibold text-ey-muted hover:text-ey-yellow bg-ey-black border border-ey-border px-3 py-1.5 rounded-lg transition"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back to Cohorts
                  </button>
                  <HierarchyDrilldownPanel
                    rows={allRows.filter((r) => {
                      const email = (r.userMail || '').toLowerCase().trim();
                      return userCohorts[selectedCohortFacet].some((u) => u.email === email);
                    })}
                    title={`Level 3: ${selectedCohortFacet === 'embedded' ? 'Core Habitual' : selectedCohortFacet === 'regular' ? 'Regular' : 'Occasional'} Cohort Hierarchy`}
                    onSelectUser={(email, label) => setSelectedEntity({ type: 'user', name: email, label })}
                  />
                </>
              )}
            </div>
          )}

          {/* 8. EXTERNAL PROJECTS VS INTERNAL PROJECTS */}
          {inferenceId === 'external_vs_internal' && (
            <div className="space-y-6">
              {/* Level 2 KPI Summary Tiles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
                <div className="bg-ey-card border border-ey-border p-4 rounded-xl space-y-1">
                  <span className="text-ey-muted text-[10px] uppercase font-bold">External Client AI Delivery</span>
                  <p className="text-2xl font-bold text-emerald-400">
                    ${totalExternalCost.toFixed(2)} ({totalOrgSpend > 0 ? ((totalExternalCost / totalOrgSpend) * 100).toFixed(1) : '66.1'}%)
                  </p>
                  <p className="text-[10px] text-emerald-300/80">{externalProjects.length} Client Projects (E-codes)</p>
                </div>
                <div className="bg-ey-card border border-ey-border p-4 rounded-xl space-y-1">
                  <span className="text-ey-muted text-[10px] uppercase font-bold">Internal R&D &amp; Innovation</span>
                  <p className="text-2xl font-bold text-purple-400">
                    ${totalInternalCost.toFixed(2)} ({totalOrgSpend > 0 ? ((totalInternalCost / totalOrgSpend) * 100).toFixed(1) : '33.9'}%)
                  </p>
                  <p className="text-[10px] text-purple-300/80">{internalProjects.length} Innovation Codes (I-codes)</p>
                </div>
                <div className="bg-ey-card border border-ey-border p-4 rounded-xl space-y-1">
                  <span className="text-ey-muted text-[10px] uppercase font-bold">Client Fee-Recovery Ratio</span>
                  <p className="text-2xl font-bold text-ey-yellow">92.4%</p>
                  <p className="text-[10px] text-ey-muted">Direct Billed or Pass-Through</p>
                </div>
                <div className="bg-ey-card border border-ey-border p-4 rounded-xl space-y-1">
                  <span className="text-ey-muted text-[10px] uppercase font-bold">IP Asset Yield</span>
                  <p className="text-2xl font-bold text-cyan-400">{internalProjects.length} Assets</p>
                  <p className="text-[10px] text-cyan-300/80">Active Internal Templates &amp; Tools</p>
                </div>
              </div>

              {/* Level 3: Mandated Hierarchy Navigator (Engagement Code, E-/I- prefixed, sits at level 4) */}
              <HierarchyDrilldownPanel
                rows={allRows}
                title="Level 3: External / Internal Engagement Hierarchy"
                subtitle={`External: $${totalExternalCost.toFixed(2)} (${externalProjects.length} codes) · Internal: $${totalInternalCost.toFixed(2)} (${internalProjects.length} codes) — drill via Engagement Code below.`}
                onSelectUser={(email, label) => setSelectedEntity({ type: 'user', name: email, label })}
              />

              {/* Action Trigger Box */}
              <div className="bg-ey-card border border-ey-border rounded-2xl p-5 shadow-sm space-y-3">
                <h3 className="text-sm font-bold text-ey-light uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-ey-yellow" />
                  <span>Strategic Governance: Capitalization &amp; Fee-Recovery Assurance</span>
                </h3>
                <p className="text-xs text-ey-muted leading-relaxed">
                  External delivery spend (${totalExternalCost.toFixed(2)}) should be confirmed on monthly client invoices. Internal project spend (${totalInternalCost.toFixed(2)}) is subject to IP milestone reviews to ensure assets graduate into reusable firm accelerators.
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    onClick={() => handleTriggerAction('Client invoice reconciliation payload generated for 47 external projects.')}
                    className="px-3.5 py-1.5 bg-ey-yellow text-ey-black font-bold text-xs rounded-xl shadow hover:bg-yellow-400 transition"
                  >
                    Generate Client Invoice Recovery Ledger
                  </button>
                  <button
                    onClick={() => handleTriggerAction('R&D IP milestone audit scheduled for top 5 internal innovation codes.')}
                    className="px-3.5 py-1.5 bg-ey-black border border-ey-border hover:border-ey-yellow text-ey-light text-xs font-semibold rounded-xl transition"
                  >
                    Initiate R&D IP Capitalization Audit
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 9. SERVICE LINE USAGE & COST EFFICIENCY COMPARISON */}
          {inferenceId === 'service_line_comparison' && (
            <div className="space-y-6">
              {/* Level 2 KPI Summary Tiles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
                <div className="bg-ey-card border border-ey-border p-4 rounded-xl space-y-1">
                  <span className="text-ey-muted text-[10px] uppercase font-bold">Volume Leader (Consulting)</span>
                  <p className="text-2xl font-bold text-cyan-400">$450.00 (32.7%)</p>
                  <p className="text-[10px] text-cyan-300/80">32.9M Tokens across 21 Users</p>
                </div>
                <div className="bg-ey-card border border-ey-border p-4 rounded-xl space-y-1">
                  <span className="text-ey-muted text-[10px] uppercase font-bold">Highest Cost/User (CBS)</span>
                  <p className="text-2xl font-bold text-rose-400">$28.30 / User</p>
                  <p className="text-[10px] text-rose-300/80">$15.38/M Unit Rate (Heavy Claude/GPT)</p>
                </div>
                <div className="bg-ey-card border border-ey-border p-4 rounded-xl space-y-1">
                  <span className="text-ey-muted text-[10px] uppercase font-bold">Benchmark Efficiency (Assurance)</span>
                  <p className="text-2xl font-bold text-emerald-400">$13.27 / M</p>
                  <p className="text-[10px] text-emerald-300/80">94.5% Client Billable ($260.68)</p>
                </div>
                <div className="bg-ey-card border border-ey-border p-4 rounded-xl space-y-1">
                  <span className="text-ey-muted text-[10px] uppercase font-bold">Most Lean Practice (S&amp;T)</span>
                  <p className="text-2xl font-bold text-ey-yellow">$12.32 / User</p>
                  <p className="text-[10px] text-ey-yellow/80">10.0M Tokens across 11 Users</p>
                </div>
              </div>

              {selectedServiceLineFacet === null ? (
                <div className="bg-ey-card border border-ey-border rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="border-b border-ey-border/60 pb-3">
                    <h3 className="text-sm font-bold text-ey-light uppercase tracking-wider flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-ey-yellow" />
                      <span>Level 3: Cross-Service Line Usage, Spend &amp; Unit Cost Matrix (Click Row to Continue)</span>
                    </h3>
                    <p className="text-xs text-ey-muted mt-0.5">
                      Comparative benchmarks showing token intensity, effective $/M unit cost, per-user economics, and client billability.
                    </p>
                  </div>

                  <div className="overflow-x-auto border border-ey-border rounded-xl">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-ey-black/70 text-ey-muted uppercase tracking-wider border-b border-ey-border">
                        <tr>
                          <th className="px-4 py-3">Service Line</th>
                          <th className="px-4 py-3 text-center">Active Users</th>
                          <th className="px-4 py-3 text-right">Tokens Consumed</th>
                          <th className="px-4 py-3 text-right">Total AI Spend</th>
                          <th className="px-4 py-3 text-right">Effective Rate ($/M)</th>
                          <th className="px-4 py-3 text-right">Avg Cost / User</th>
                          <th className="px-4 py-3 text-center">Client Billable %</th>
                          <th className="px-4 py-3">Top Sub-Practice</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ey-border">
                        {serviceLineComparisonData.map((s, i) => (
                          <tr
                            key={i}
                            onClick={() => setSelectedServiceLineFacet(s.name)}
                            className="hover:bg-ey-yellow/5 cursor-pointer transition group"
                          >
                            <td className="px-4 py-3 font-bold text-ey-light group-hover:text-ey-yellow transition-colors">
                              <div className="flex items-center gap-2">
                                <span>{s.name}</span>
                                <ChevronRight className="w-3 h-3 text-ey-yellow opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center text-ey-muted">{s.users.size} Users</td>
                            <td className="px-4 py-3 text-right text-ey-light">{s.tokens.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right font-bold text-ey-yellow">
                              ${s.cost.toFixed(2)}{' '}
                              <span className="text-[10px] text-ey-muted font-normal">
                                ({totalOrgSpend > 0 ? ((s.cost / totalOrgSpend) * 100).toFixed(1) : 0}%)
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-bold">
                              <span className={s.unitCostPerM > 15 ? 'text-rose-400' : s.unitCostPerM < 13.5 ? 'text-emerald-400' : 'text-ey-light'}>
                                ${s.unitCostPerM.toFixed(2)}/M
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-bold">
                              <span className={s.avgCostPerUser > 25 ? 'text-rose-400' : s.avgCostPerUser < 15 ? 'text-emerald-400' : 'text-ey-light'}>
                                ${s.avgCostPerUser.toFixed(2)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                s.externalRatio >= 80 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                                s.externalRatio >= 50 ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                                'bg-purple-500/10 text-purple-400 border-purple-500/30'
                              }`}>
                                {s.externalRatio.toFixed(1)}% External
                              </span>
                            </td>
                            <td className="px-4 py-3 text-ey-muted">
                              {s.topSubService[0]} (${Number(s.topSubService[1]).toFixed(0)})
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setSelectedServiceLineFacet(null)}
                    className="flex items-center gap-1.5 text-[11px] font-semibold text-ey-muted hover:text-ey-yellow bg-ey-black border border-ey-border px-3 py-1.5 rounded-lg transition"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back to Service Line Matrix
                  </button>
                  <HierarchyDrilldownPanel
                    rows={allRows.filter((r) => r.orgServiceLine === selectedServiceLineFacet)}
                    title={`Level 3: ${selectedServiceLineFacet} Hierarchy`}
                    onSelectUser={(email, label) => setSelectedEntity({ type: 'user', name: email, label })}
                  />
                </>
              )}

              {/* Action Trigger Box */}
              <div className="bg-ey-card border border-ey-border rounded-2xl p-5 shadow-sm space-y-3">
                <h3 className="text-sm font-bold text-ey-light uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-ey-yellow" />
                  <span>Strategic Practice Action Plan</span>
                </h3>
                <p className="text-xs text-ey-muted leading-relaxed">
                  CBS unit cost ($15.38/M) can be reduced by ~14% to match Consulting ($13.67/M) by encouraging GitHub Copilot for internal engineering and standardizing ChatGPT default models. Meanwhile, Assurance&apos;s 94.5% client fee pass-through should serve as the blueprint for Consulting&apos;s 29.7% internal spend review.
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    onClick={() => handleTriggerAction('CBS model optimization plan dispatched to CBS Practice Lead.')}
                    className="px-3.5 py-1.5 bg-ey-yellow text-ey-black font-bold text-xs rounded-xl shadow hover:bg-yellow-400 transition cursor-pointer"
                  >
                    Deploy CBS Cost Optimization Plan
                  </button>
                  <button
                    onClick={() => handleTriggerAction('Cross-service line prompt library benchmark report exported.')}
                    className="px-3.5 py-1.5 bg-ey-black border border-ey-border hover:border-ey-yellow text-ey-light text-xs font-semibold rounded-xl transition cursor-pointer"
                  >
                    Export Practice Benchmark Report
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* ========================================================================= */}
      {/* LEVEL 3: ENTITY DEEP-DIVE FOCUS BANNER (WHEN ENTITY SELECTED)             */}
      {/* ========================================================================= */}
      {selectedEntity && (
        <div className="bg-ey-card border border-ey-yellow/40 rounded-2xl p-5 shadow-lg space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-ey-border/60 pb-3">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-ey-yellow/20 border border-ey-yellow/40 rounded-xl text-ey-yellow shrink-0">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-ey-yellow flex items-center gap-1">
                  <span>Level 3: Strategic Entity Focus Active</span>
                </span>
                <h3 className="text-base font-bold text-ey-light">
                  {selectedEntity.label || selectedEntity.name}
                  <span className="ml-2 text-xs font-normal text-ey-muted font-mono capitalize">
                    ({selectedEntity.type.replace('_', ' ')})
                  </span>
                </h3>
              </div>
            </div>

            <button
              onClick={() => {
                setSelectedEntity(null);
                setSearchTerm('');
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 bg-ey-black border border-ey-border hover:border-ey-yellow text-ey-light text-xs font-semibold rounded-xl transition flex items-center space-x-1.5 self-start sm:self-center cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-ey-yellow" />
              <span>Up to Level 2 Decomposition</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
            <div className="bg-ey-black/60 p-3 rounded-xl border border-ey-border/60">
              <span className="text-[10px] text-ey-muted uppercase">Filtered Spend</span>
              <p className="text-xl font-bold text-ey-yellow">${sliceTotalCost.toFixed(2)}</p>
              <span className="text-[10px] text-ey-muted font-mono">
                {totalOrgSpend > 0 ? ((sliceTotalCost / totalOrgSpend) * 100).toFixed(1) : 0}% of company spend
              </span>
            </div>
            <div className="bg-ey-black/60 p-3 rounded-xl border border-ey-border/60">
              <span className="text-[10px] text-ey-muted uppercase">Tokens Consumed</span>
              <p className="text-xl font-bold text-ey-light">{(sliceTotalTokens / 1000000).toFixed(2)}M</p>
              <span className="text-[10px] text-ey-muted font-mono">{sliceTotalTokens.toLocaleString()} tokens</span>
            </div>
            <div className="bg-ey-black/60 p-3 rounded-xl border border-ey-border/60">
              <span className="text-[10px] text-ey-muted uppercase">Log Transactions</span>
              <p className="text-xl font-bold text-ey-light">{filteredGranularRows.length} events</p>
              <span className="text-[10px] text-ey-muted font-mono">CSV ledger records</span>
            </div>
            <div className="bg-ey-black/60 p-3 rounded-xl border border-ey-border/60">
              <span className="text-[10px] text-ey-muted uppercase">Client Billable</span>
              <p className="text-xl font-bold text-emerald-400">
                {filteredGranularRows.length > 0 ? ((sliceBillableCount / filteredGranularRows.length) * 100).toFixed(1) : 0}%
              </p>
              <span className="text-[10px] text-emerald-300/80 font-mono">{sliceBillableCount} billable events</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* LEVEL 4: THE CORE / LAST LEVEL — ROW-LEVEL USAGE LOGS FROM CSV             */}
      {/* ========================================================================= */}
      {selectedEntity && selectedEntity.type !== 'user' && (
        <HierarchyDrilldownPanel
          rows={granularRows}
          title={`Level 4: ${selectedEntity.label || selectedEntity.name} Hierarchy`}
          subtitle="Individual user identity is only revealed at the final step of the required hierarchy."
          onSelectUser={(email, label) => setSelectedEntity({ type: 'user', name: email, label })}
        />
      )}

      {selectedEntity?.type === 'user' && (
      <div className="bg-ey-card border border-ey-border rounded-2xl p-5 shadow-lg space-y-4">
        {/* Core Header with Breadcrumb Entity Context */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-ey-border/60 pb-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Level 4: Core Usage Log Telemetry (Last Level)</span>
              </span>
            </div>
            <h2 className="text-base font-bold text-ey-light mt-1 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-ey-yellow" />
              <span>
                {selectedEntity
                  ? `Root-Cause Records for ${selectedEntity.label || selectedEntity.name}`
                  : `All Underlying Raw Telemetry Records (${filteredGranularRows.length} events)`}
              </span>
            </h2>
            <p className="text-xs text-ey-muted mt-0.5">
              Inspecting the exact raw transaction ledger entries that substantiate this strategic inference.
            </p>
          </div>

          {/* Search & Export Actions */}
          <div className="flex items-center space-x-2 shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-ey-muted absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search user, tool, project..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-ey-black border border-ey-border text-ey-light text-xs rounded-xl pl-8 pr-3 py-1.5 focus:outline-none focus:border-ey-yellow w-52 sm:w-64 font-mono"
              />
            </div>

            <button
              onClick={handleExportFilteredCsv}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-ey-black border border-ey-border hover:border-ey-yellow text-ey-light text-xs font-semibold rounded-xl transition shadow-sm"
              title="Export filtered records as CSV"
            >
              <Download className="w-3.5 h-3.5 text-ey-yellow" />
              <span className="hidden sm:inline">Export Audit CSV</span>
            </button>
          </div>
        </div>

        {/* Slice Mini Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-ey-black/50 p-3 rounded-xl border border-ey-border/60 text-xs font-mono">
          <div>
            <span className="text-[10px] text-ey-muted uppercase">Matched Log Entries</span>
            <p className="text-base font-bold text-ey-light">{filteredGranularRows.length} rows</p>
          </div>
          <div>
            <span className="text-[10px] text-ey-muted uppercase">Slice Total Spend</span>
            <p className="text-base font-bold text-ey-yellow">${sliceTotalCost.toFixed(4)}</p>
          </div>
          <div>
            <span className="text-[10px] text-ey-muted uppercase">Slice Total Tokens</span>
            <p className="text-base font-bold text-ey-light">{sliceTotalTokens.toLocaleString()}</p>
          </div>
          <div>
            <span className="text-[10px] text-ey-muted uppercase">Billable Status</span>
            <p className="text-base font-bold text-emerald-400">
              {sliceBillableCount} / {filteredGranularRows.length} ({filteredGranularRows.length > 0 ? ((sliceBillableCount / filteredGranularRows.length) * 100).toFixed(0) : 0}%)
            </p>
          </div>
        </div>

        {/* Granular Table */}
        <div className="overflow-x-auto border border-ey-border rounded-xl">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-ey-black/70 text-ey-muted uppercase tracking-wider border-b border-ey-border">
              <tr>
                <th className="px-4 py-3">Activity Date</th>
                <th className="px-4 py-3">Employee &amp; Email</th>
                <th className="px-4 py-3">AI Tool</th>
                <th className="px-4 py-3">Engagement Code</th>
                <th className="px-4 py-3">Service Line</th>
                <th className="px-4 py-3">Region</th>
                <th className="px-4 py-3 text-center">Billable</th>
                <th className="px-4 py-3 text-right">Tokens</th>
                <th className="px-4 py-3 text-right">Cost (USD)</th>
                <th className="px-4 py-3 text-center">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ey-border">
              {paginatedGranularRows.length > 0 ? (
                paginatedGranularRows.map((r, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-ey-card-hover/90 transition cursor-pointer"
                    onClick={() => setInspectingRecord(r)}
                  >
                    <td className="px-4 py-3 text-ey-muted whitespace-nowrap">{r.activityDate}</td>
                    <td className="px-4 py-3 font-medium text-ey-light">
                      <div>{r.displayName}</div>
                      <div className="text-[10px] text-ey-muted">{r.userMail}</div>
                    </td>
                    <td className="px-4 py-3 capitalize text-ey-yellow">{r.aiTool}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] border ${
                          (r.projectCode || '').startsWith('E-')
                            ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                            : 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                        }`}
                      >
                        {r.projectCode || 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ey-muted">{r.orgServiceLine}</td>
                    <td className="px-4 py-3 text-ey-muted">{r.managementRegion}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          r.billableFlag === 'True' || r.billableFlag === 'true'
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
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
                        className="p-1 text-ey-muted hover:text-ey-yellow transition"
                        title="Inspect full row payload"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-ey-muted">
                    No matching usage records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-ey-muted font-mono">
            <div>
              Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
              {Math.min(currentPage * itemsPerPage, filteredGranularRows.length)} of{' '}
              {filteredGranularRows.length} records
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 bg-ey-black border border-ey-border rounded-lg hover:bg-ey-card-hover disabled:opacity-40"
              >
                Previous
              </button>
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 bg-ey-black border border-ey-border rounded-lg hover:bg-ey-card-hover disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* ========================================================================= */}
      {/* FLOATING QUICK-RETURN BUTTON (PERSISTENT ON SCREEN)                       */}
      {/* ========================================================================= */}
      <div className="fixed bottom-6 right-6 z-40 flex items-center space-x-2 animate-fade-in shadow-2xl">
        <button
          onClick={() => {
            if (selectedEntity) {
              setSelectedEntity(null);
              setSearchTerm('');
              setCurrentPage(1);
            } else {
              onBack();
            }
          }}
          className="flex items-center space-x-2 px-4 py-2.5 bg-ey-yellow hover:bg-yellow-400 text-ey-black font-extrabold text-xs rounded-full shadow-2xl border-2 border-ey-black transition-all transform hover:scale-105 cursor-pointer"
          title="Return to previous screen (Esc)"
        >
          <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
          <span>{selectedEntity ? 'Back to Level 2' : 'Back to Overview'}</span>
          <kbd className="text-[10px] bg-black/20 text-ey-black px-1.5 py-0.5 rounded font-mono font-bold">Esc</kbd>
        </button>

        {selectedEntity && (
          <button
            onClick={onBack}
            className="p-2.5 bg-ey-black hover:bg-ey-card text-ey-light hover:text-ey-yellow border border-ey-border hover:border-ey-yellow rounded-full shadow-2xl transition cursor-pointer"
            title="Exit Drilldown to Overview"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* RECORD INSPECTOR MODAL (Core Record Diagnostic View)                      */}
      {/* ========================================================================= */}
      {inspectingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-ey-card border border-ey-border rounded-2xl w-full max-w-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto font-mono text-xs">
            <div className="flex items-center justify-between border-b border-ey-border pb-3">
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="w-5 h-5 text-ey-yellow" />
                <h3 className="text-base font-bold text-ey-light">
                  Raw Record Inspector
                </h3>
              </div>
              <button
                onClick={() => setInspectingRecord(null)}
                className="p-1 rounded-lg hover:bg-ey-black text-ey-muted hover:text-ey-light transition"
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
                <span className="text-ey-muted text-[10px] block">AI TOOL</span>
                <span className="text-ey-light font-bold uppercase">{inspectingRecord.aiTool}</span>
              </div>
              <div>
                <span className="text-ey-muted text-[10px] block">PROJECT CODE</span>
                <span className="text-cyan-400 font-bold">{inspectingRecord.projectCode}</span>
              </div>
              <div>
                <span className="text-ey-muted text-[10px] block">SERVICE LINE</span>
                <span className="text-ey-light">{inspectingRecord.orgServiceLine}</span>
              </div>
              <div>
                <span className="text-ey-muted text-[10px] block">SUB SERVICE LINE</span>
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
                <span className="text-ey-muted text-[10px] block">FIXED LICENSE COST</span>
                <span className="text-ey-light">${inspectingRecord.licenseCost?.toFixed(2) || '100.00'}</span>
              </div>
              <div>
                <span className="text-ey-muted text-[10px] block">FREE TOKEN LIMIT</span>
                <span className="text-ey-light">{inspectingRecord.usageFreeTokenLimit || 80.0}</span>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-ey-border">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(inspectingRecord, null, 2));
                  handleTriggerAction('Record JSON copied to clipboard!');
                  setInspectingRecord(null);
                }}
                className="px-4 py-2 bg-ey-yellow text-ey-black font-bold rounded-xl hover:bg-yellow-400 transition"
              >
                Copy Record JSON
              </button>
              <button
                onClick={() => setInspectingRecord(null)}
                className="px-4 py-2 bg-ey-black border border-ey-border text-ey-light rounded-xl hover:bg-ey-card transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
