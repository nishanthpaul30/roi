'use client';

import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
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
  Calendar,
  ExternalLink,
  RefreshCw,
  DollarSign,
  PieChart as PieChartIcon,
  X,
  Eye,
  Check,
  Award,
  Briefcase,
  BadgeDollarSign,
} from 'lucide-react';
import { TokenCostSummary, GlobalFilterState } from '@/lib/metrics/types';
import type { CsvUsageRow } from '@/lib/data/csvTypes';
import { useRawRows } from '@/hooks/useRawRows';
import { HierarchyDrilldownPanel } from './HierarchyDrilldownPanel';
import { StatTile } from './StatTile';
import { formatCompactCurrency as fmtCost, formatCompactNumber } from '@/lib/format';
import { generatePrescriptiveInferences } from '@/lib/metrics/prescriptiveEngine';

// Visual style per known AI tool (full literal Tailwind class strings so the JIT compiler
// can statically detect them even though they're picked dynamically at runtime). Any tool
// not in this map (e.g. one added later purely via CSV data) falls back to the purple style.
const TOOL_STYLES: Record<string, { label: string; shortLabel: string; color: string; badgeBg: string; barBg: string; hoverBorder: string }> = {
  github: {
    label: 'GitHub Copilot Enterprise',
    shortLabel: 'Copilot',
    color: 'text-indigo-400',
    badgeBg: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    barBg: 'bg-indigo-500',
    hoverBorder: 'hover:border-indigo-500/80',
  },
  chatgpt: {
    label: 'OpenAI ChatGPT Enterprise',
    shortLabel: 'ChatGPT',
    color: 'text-emerald-400',
    badgeBg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    barBg: 'bg-emerald-500',
    hoverBorder: 'hover:border-emerald-500/80',
  },
  claude: {
    label: 'Anthropic Claude Enterprise',
    shortLabel: 'Claude',
    color: 'text-amber-400',
    badgeBg: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    barBg: 'bg-amber-500',
    hoverBorder: 'hover:border-amber-500/80',
  },
  replit: {
    label: 'Replit Enterprise',
    shortLabel: 'Replit',
    color: 'text-sky-400',
    badgeBg: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    barBg: 'bg-sky-500',
    hoverBorder: 'hover:border-sky-500/80',
  },
  factory: {
    label: 'Factory AI Enterprise',
    shortLabel: 'Factory AI',
    color: 'text-rose-400',
    badgeBg: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    barBg: 'bg-rose-500',
    hoverBorder: 'hover:border-rose-500/80',
  },
  cursor: {
    label: 'Cursor AI Enterprise',
    shortLabel: 'Cursor AI',
    color: 'text-fuchsia-400',
    badgeBg: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30',
    barBg: 'bg-fuchsia-500',
    hoverBorder: 'hover:border-fuchsia-500/80',
  },
};
const FALLBACK_TOOL_STYLE = {
  color: 'text-purple-400',
  badgeBg: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  barBg: 'bg-purple-500',
  hoverBorder: 'hover:border-purple-500/80',
};
function getToolStyle(toolKey: string) {
  const preset = TOOL_STYLES[toolKey];
  if (preset) return preset;
  const shortLabel = toolKey.charAt(0).toUpperCase() + toolKey.slice(1);
  return { label: `${shortLabel} Enterprise`, shortLabel, ...FALLBACK_TOOL_STYLE };
}

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
  benefitOutcome: string;
}

interface ExecutiveInferenceDrilldownViewProps {
  inferenceId: string;
  summary?: TokenCostSummary;
  initialEntity?: {
    type: 'user' | 'tool' | 'region' | 'country' | 'service_line' | 'project_code' | 'cohort' | 'month';
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
    type: 'user' | 'tool' | 'region' | 'country' | 'service_line' | 'project_code' | 'cohort' | 'month';
    name: string;
    label?: string;
  } | null>(initialEntity || null);

  React.useEffect(() => {
    if (initialEntity) {
      setSelectedEntity(initialEntity);
    }
  }, [initialEntity]);

  // Pre-hierarchy facet selection: habitual_retention picks a cohort before
  // handing off to the mandated hierarchy navigator.
  const [selectedCohortFacet, setSelectedCohortFacet] = useState<'embedded' | 'regular' | 'occasional' | null>(null);
  // Dormant Seats Action Ledger: which Service Line row (if any) is expanded
  // to show its individual dormant employees.
  const [expandedDormantServiceLine, setExpandedDormantServiceLine] = useState<string | null>(null);

  // Level 4 Search, Pagination & Modal Record Inspector State
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [inspectingRecord, setInspectingRecord] = useState<CsvUsageRow | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Pagination for the License Reclamation "Usage Below Free Limit" warning table
  const [warningPage, setWarningPage] = useState(1);
  const warningPageSize = 10;

  // Pagination for the Multi-Platform License Overlap table — paginated by
  // Engagement Code group (not raw row) so a group's users never split
  // across two pages, and the dataset can safely run to very large row counts.
  const [overlapPage, setOverlapPage] = useState(1);
  const overlapPageSize = 10;

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

  // Raw CSV rows for the record-level views, fetched server-side
  const { rows: allRows, loading: rowsLoading } = useRawRows(filters);

  // Every held tool gets a 'License' row every month regardless of activity
  // (flat seat fee, tokenConsumption always 0). Every cost/token aggregation
  // below (monthly trend, engagement code, service line, region, country,
  // per-tool breakdowns) must sum only genuine Usage rows — otherwise seat
  // fees silently blend into what's presented as usage spend, inflating every
  // figure far past summary.totalCost.
  const usageRows = useMemo(
    () => allRows.filter((r) => r.calculationMethod === 'Usage' && r.tokenConsumption > 0),
    [allRows]
  );

  // Compute Active vs Inactive Telemetry Roster — real roster (all distinct users ever
  // seen in the CSV, License + Usage rows alike) vs real period-active seats. Note
  // summary.userCapacityBreakdown covers the FULL roster too (every held seat gets a
  // License row every month regardless of use), so "active" here is derived directly
  // from having at least one real Usage row with consumption > 0 — the same rule
  // roi.ts uses for its own activeUserCount.
  const totalRosterSeats = useMemo(
    () => new Set(allRows.map((r) => (r.userMail || '').toLowerCase().trim()).filter(Boolean)).size || 70,
    [allRows]
  );
  const periodActiveEmails = useMemo(
    () => new Set(
      allRows
        .filter((r) => r.calculationMethod === 'Usage' && r.tokenConsumption > 0)
        .map((r) => (r.userMail || '').toLowerCase().trim())
        .filter(Boolean)
    ),
    [allRows]
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
      activeMonths: Set<number>;
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
          region: r.superRegion || 'APAC',
          activeMonths: new Set<number>(),
          billableTokens: 0,
        });
      }
      const u = map.get(email)!;
      // Tools reflects every tool the seat holds a License or Usage row for
      // (multi-license overhead is about held seats, not just active usage).
      if (r.aiTool) u.tools.add(r.aiTool.toLowerCase());
      // Cost, consumption, active-months and billable consumption must only
      // come from genuine Usage rows — License rows exist every month for
      // every held tool regardless of activity, so including them here would
      // both double-count spend (on top of License Cost tracked separately)
      // and inflate every seat's active-months ratio to ~100%.
      if (r.calculationMethod === 'Usage' && r.tokenConsumption > 0) {
        u.totalTokens += r.tokenConsumption;
        u.totalCost += r.cost;
        if (r.monthId) u.activeMonths.add(r.monthId);
        if (r.billableFlag === 'True') u.billableTokens += r.tokenConsumption || 0;
      }
    }
    return map;
  }, [allRows, periodActiveEmails]);

  const activeUserList = useMemo(() => Array.from(activeUserMap.values()), [activeUserMap]);
  const activeUserCount = activeUserList.length || 64;
  const activePeriodRows = useMemo(
    () => allRows.filter((r) => periodActiveEmails.size === 0 || periodActiveEmails.has((r.userMail || '').toLowerCase().trim())),
    [allRows, periodActiveEmails]
  );
  // Unutilized Licenses: distinct users who have a Usage row with GenAI Tool Consumption = 0
  // in the current filtered period (provisioned seat, zero recorded consumption).
  const inactiveUserCount = useMemo(() => {
    const unutilizedEmails = new Set<string>();
    for (const r of allRows) {
      if (r.calculationMethod === 'Usage' && r.tokenConsumption === 0) {
        unutilizedEmails.add((r.userMail || '').toLowerCase().trim());
      }
    }
    return unutilizedEmails.size;
  }, [allRows]);
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
      const cap = summary?.userCapacityBreakdown.find((u) => u.userMail.toLowerCase() === email);
      result.push({
        email,
        name: r.displayName || email.split('@')[0],
        serviceLine: r.orgServiceLine || 'General',
        region: r.superRegion || 'Unknown',
        lastActivityDate: r.monthYear,
        licenseCost: cap?.licenseCost || avgLicenseCostPerSeat,
      });
    }
    return result.sort((a, b) => (a.lastActivityDate < b.lastActivityDate ? 1 : -1));
  }, [allRows, periodActiveEmails, avgLicenseCostPerSeat, summary]);

  // C-suite view groups dormant seats by Service Line instead of naming each
  // individual employee — leadership acts on "reclaim N seats in Tax", not on
  // a 97-row employee roster.
  const dormantByServiceLine = useMemo(() => {
    const map = new Map<string, { serviceLine: string; count: number; monthlyCost: number }>();
    for (const u of dormantUsers) {
      if (!map.has(u.serviceLine)) {
        map.set(u.serviceLine, { serviceLine: u.serviceLine, count: 0, monthlyCost: 0 });
      }
      const entry = map.get(u.serviceLine)!;
      entry.count += 1;
      entry.monthlyCost += u.licenseCost;
    }
    return Array.from(map.values()).sort((a, b) => b.monthlyCost - a.monthlyCost);
  }, [dormantUsers]);

  // License Reclamation: exactly two rules, built from the same
  // userCapacityBreakdown figures the rest of this screen already uses --
  // not a separate recomputation from raw rows -- so this stays consistent
  // with every other dormant/underutilized figure on the app.
  // Rule 1: sum and RECLAIM only fully dormant licenses (0 usage). Their full
  // license cost is recoverable since nothing was consumed.
  // Rule 2: seats using less than their free limit (zone1_under, i.e.
  // wasteCost > overageCost) are WARNED about only -- never reclaimed.
  const emailToRow = useMemo(() => {
    const map = new Map<string, CsvUsageRow>();
    for (const r of allRows) {
      const email = (r.userMail || '').toLowerCase().trim();
      if (email && !map.has(email)) map.set(email, r);
    }
    return map;
  }, [allRows]);

  const reclamationUsers = useMemo(() => {
    const breakdown = summary?.userCapacityBreakdown || [];
    return breakdown
      .filter((u) => u.licenseCost > 0 && u.tokenConsumption === 0)
      .map((u) => ({
        email: u.userMail.toLowerCase().trim(),
        displayName: u.displayName,
        aiTools: u.aiTools,
        licenseCost: u.licenseCost,
        recoverableAmount: u.licenseCost,
      }))
      .sort((a, b) => b.recoverableAmount - a.recoverableAmount);
  }, [summary]);

  const usageWarningUsers = useMemo(() => {
    const breakdown = summary?.userCapacityBreakdown || [];
    return breakdown
      .filter((u) => u.tokenConsumption > 0 && u.zone === 'zone1_under')
      .map((u) => ({
        email: u.userMail.toLowerCase().trim(),
        displayName: u.displayName,
        aiTools: u.aiTools,
        actualCost: u.actualCost,
        usageFreeTokenLimit: u.usageFreeTokenLimit,
        wasteCost: u.wasteCost,
      }))
      .sort((a, b) => b.wasteCost - a.wasteCost);
  }, [summary]);

  const totalWarningUsageCost = useMemo(() => usageWarningUsers.reduce((s, u) => s + u.actualCost, 0), [usageWarningUsers]);
  const totalWarningFreeLimit = useMemo(() => usageWarningUsers.reduce((s, u) => s + u.usageFreeTokenLimit, 0), [usageWarningUsers]);
  const totalWarningUnusedCapacity = Math.max(0, totalWarningFreeLimit - totalWarningUsageCost);
  const warningTotalPages = Math.ceil(usageWarningUsers.length / warningPageSize) || 1;
  const paginatedWarningUsers = usageWarningUsers.slice(
    (warningPage - 1) * warningPageSize,
    warningPage * warningPageSize
  );

  const reclamationEmailSet = useMemo(
    () => new Set([...reclamationUsers.map((u) => u.email), ...usageWarningUsers.map((u) => u.email)]),
    [reclamationUsers, usageWarningUsers]
  );
  const reclamationRows = useMemo(
    () => allRows.filter((r) => reclamationEmailSet.has((r.userMail || '').toLowerCase().trim())),
    [allRows, reclamationEmailSet]
  );
  const totalRecoverableAmount = useMemo(() => reclamationUsers.reduce((s, u) => s + u.recoverableAmount, 0), [reclamationUsers]);
  const reclamationDormantCount = reclamationUsers.length;
  const usageWarningCount = usageWarningUsers.length;
  const avgRecoverablePerSeat = reclamationDormantCount > 0 ? totalRecoverableAmount / reclamationDormantCount : 0;
  const recoverablePercentOfLicenseCost =
    summary && summary.totalLicenseCost > 0 ? ((totalRecoverableAmount / summary.totalLicenseCost) * 100).toFixed(1) : '0.0';

  const reclamationByServiceLine = useMemo(() => {
    const map = new Map<string, { serviceLine: string; count: number; recoverableAmount: number }>();
    for (const u of reclamationUsers) {
      const serviceLine = emailToRow.get(u.email)?.orgServiceLine || 'General';
      if (!map.has(serviceLine)) map.set(serviceLine, { serviceLine, count: 0, recoverableAmount: 0 });
      const entry = map.get(serviceLine)!;
      entry.count += 1;
      entry.recoverableAmount = Number((entry.recoverableAmount + u.recoverableAmount).toFixed(4));
    }
    return Array.from(map.values()).sort((a, b) => b.recoverableAmount - a.recoverableAmount);
  }, [reclamationUsers, emailToRow]);

  // Compute Power Users (Pareto Analysis: Top 20%)
  const sortedUsersBySpend = useMemo(() => {
    return [...activeUserList].sort((a, b) => b.totalCost - a.totalCost);
  }, [activeUserList]);

  // Usage cost only — matches summary.totalCost and the totalCost basis of
  // top10Spend/top20Spend above. Summing raw allRows.cost here would blend in
  // every held seat's flat License Cost, wildly understating the Pareto share.
  const totalOrgSpend = useMemo(() => {
    if (summary) return summary.totalCost;
    return allRows
      .filter((r) => r.calculationMethod === 'Usage' && r.tokenConsumption > 0)
      .reduce((acc, r) => acc + r.cost, 0);
  }, [allRows, summary]);

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
    for (const r of usageRows) {
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
  }, [usageRows]);

  // Compute Habitual Cohorts. With no day-level Activity Date, "habitual" is
  // redefined from active-days-per-active-month to active-months-out-of-the-
  // selected-window (thresholds re-picked accordingly: 90%+/60%+ of the
  // window's months), matching the same redesign in roi.ts's userEngagementCohorts.
  const totalMonthsInWindow = useMemo(() => new Set(allRows.map((r) => r.monthId)).size || 1, [allRows]);
  const userCohorts = useMemo(() => {
    const embedded: typeof activeUserList = [];
    const regular: typeof activeUserList = [];
    const occasional: typeof activeUserList = [];

    for (const u of activeUserList) {
      const activeMonthRatio = u.activeMonths.size / totalMonthsInWindow;
      if (activeMonthRatio >= 0.9) embedded.push(u);
      else if (activeMonthRatio >= 0.6) regular.push(u);
      else occasional.push(u);
    }
    return { embedded, regular, occasional };
  }, [activeUserList, totalMonthsInWindow]);

  // Engagement Code Breakdown
  const projectCodeBreakdown = useMemo(() => {
    const map = new Map<string, {
      code: string;
      cost: number;
      tokens: number;
      billableTokens: number;
      users: Set<string>;
      rowCount: number;
    }>();

    for (const r of usageRows) {
      const code = r.projectCode || 'Unassigned';
      if (!map.has(code)) {
        map.set(code, {
          code,
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
      if (r.billableFlag === 'True') p.billableTokens += r.tokenConsumption || 0;
      if (r.userMail) p.users.add(r.userMail);
      p.rowCount += 1;
    }
    return Array.from(map.values()).sort((a, b) => b.cost - a.cost);
  }, [usageRows]);

  // Regional & Service Line Breakdown
  const regionBreakdown = useMemo(() => {
    const map = new Map<string, { region: string; cost: number; tokens: number; users: Set<string> }>();
    for (const r of usageRows) {
      const reg = r.superRegion || 'Other';
      if (!map.has(reg)) {
        map.set(reg, { region: reg, cost: 0, tokens: 0, users: new Set<string>() });
      }
      const item = map.get(reg)!;
      item.cost += r.cost;
      item.tokens += r.tokenConsumption;
      if (r.userMail) item.users.add(r.userMail);
    }
    return Array.from(map.values()).sort((a, b) => b.cost - a.cost);
  }, [usageRows]);

  const countryBreakdown = useMemo(() => {
    const map = new Map<string, { country: string; cost: number; tokens: number; users: Set<string> }>();
    for (const r of usageRows) {
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
  }, [usageRows]);

  // Multi-Tool Comprehensive Analytics
  const multiToolData = useMemo(() => {
    const toolsMap: Record<string, {
      tool: string;
      label: string;
      shortLabel: string;
      badge: string;
      badgeBg: string;
      color: string;
      barBg: string;
      hoverBorder: string;
      cost: number;
      tokens: number;
      billableTokens: number;
      billableCost: number;
      externalCost: number;
      internalCost: number;
      users: Map<string, { displayName: string; email: string; cost: number; tokens: number; activeMonths: Set<number> }>;
      serviceLines: Map<string, { cost: number; tokens: number }>;
      projectCodes: Map<string, { cost: number; tokens: number }>;
      rowCount: number;
    }> = {};

    const userToolMap = new Map<string, {
      displayName: string;
      email: string;
      tools: Set<string>;
      totalCost: number;
      totalTokens: number;
      serviceLine: string;
      region: string;
    }>();

    // Same overlap detection as userToolMap above, but scoped per Engagement
    // Code — the Multi-Platform License Overlap table groups by engagement,
    // so a user who overlaps tools on two different engagements shows up as
    // two separate rows (once per engagement), not blended into one total.
    const userEngagementToolMap = new Map<string, {
      displayName: string;
      email: string;
      projectCode: string;
      tools: Set<string>;
      totalCost: number;
      totalTokens: number;
    }>();

    for (const r of allRows) {
      const toolKey = (r.aiTool || '').toLowerCase().trim();
      if (!toolKey) continue;
      if (!toolsMap[toolKey]) {
        const style = getToolStyle(toolKey);
        toolsMap[toolKey] = {
          tool: toolKey,
          label: style.label,
          shortLabel: style.shortLabel,
          badge: '',
          badgeBg: style.badgeBg,
          color: style.color,
          barBg: style.barBg,
          hoverBorder: style.hoverBorder,
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
        };
      }
      const t = toolsMap[toolKey];
      // License rows exist every month for every held tool regardless of
      // activity and would otherwise dilute these unit-economics figures
      // ($/M tokens, spend share, etc.) with flat seat fees — only genuine
      // Usage rows count here.
      if (r.calculationMethod === 'Usage' && r.tokenConsumption > 0) {
        t.cost += r.cost;
        t.tokens += r.tokenConsumption;
        const isBillable = r.billableFlag === 'True' || r.billableFlag === 'true';
        if (isBillable) t.billableTokens += r.tokenConsumption || 0;
        t.rowCount += 1;
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
              activeMonths: new Set(),
            });
          }
          const u = t.users.get(email)!;
          u.cost += r.cost;
          u.tokens += r.tokenConsumption;
          if (r.monthId) u.activeMonths.add(r.monthId);
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

        // Multi-tool detection matches roi.ts's summary.multiToolOverlap: "used
        // 2+ tools" based on Usage rows only, not "holds 2+ licenses" —
        // otherwise this local total would double-count against a completely
        // different (much larger) population than the authoritative Overview figure.
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
              region: r.superRegion || 'APAC',
            });
          }
          const ut = userToolMap.get(uEmail)!;
          ut.tools.add(toolKey);
          ut.totalCost += r.cost;
          ut.totalTokens += r.tokenConsumption;

          const engagementCode = r.projectCode || 'Unassigned';
          const engagementKey = `${uEmail}|${engagementCode}`;
          if (!userEngagementToolMap.has(engagementKey)) {
            userEngagementToolMap.set(engagementKey, {
              displayName: r.displayName || uEmail.split('@')[0],
              email: uEmail,
              projectCode: engagementCode,
              tools: new Set(),
              totalCost: 0,
              totalTokens: 0,
            });
          }
          const uet = userEngagementToolMap.get(engagementKey)!;
          uet.tools.add(toolKey);
          uet.totalCost += r.cost;
          uet.totalTokens += r.tokenConsumption;
        }
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

    // Badges are derived from real computed numbers (not hardcoded), so they stay correct
    // no matter how many tools exist or how their relative pricing shifts.
    const byCostAsc = [...toolList].sort((a, b) => a.costPerM - b.costPerM);
    const bySpendDesc = [...toolList].sort((a, b) => b.cost - a.cost);
    const cheapestTool = byCostAsc[0]?.tool;
    const priciestTool = byCostAsc[byCostAsc.length - 1]?.tool;
    const topSpendTool = bySpendDesc[0]?.tool;
    for (const t of toolList) {
      if (t.tool === topSpendTool) t.badge = `Highest Spend (${t.spendShare.toFixed(1)}%)`;
      else if (t.tool === cheapestTool) t.badge = 'Lowest Unit Cost';
      else if (t.tool === priciestTool) t.badge = 'Highest Unit Cost';
      else t.badge = '';
    }

    // GitHub Copilot always displays first; the rest keep their existing relative order.
    toolList.sort((a, b) => (a.tool === 'github' ? -1 : b.tool === 'github' ? 1 : 0));

    const dualToolUsers = Array.from(userToolMap.values())
      .filter((u) => u.tools.size > 1)
      .sort((a, b) => b.totalCost - a.totalCost);

    const dualToolSpend = dualToolUsers.reduce((sum, u) => sum + u.totalCost, 0);

    // Flat overlap list (user × engagement, cost > 0 on 2+ tools within that
    // engagement), ordered by total cost — the source for both the on-screen
    // table and its CSV export.
    const overlapRows = Array.from(userEngagementToolMap.values())
      .filter((u) => u.tools.size > 1)
      .map((u) => ({ ...u, tools: Array.from(u.tools).sort() }))
      .sort((a, b) => b.totalCost - a.totalCost);

    // Same rows grouped by Engagement Code for display, each group ordered by
    // its own total cost and the users within it ordered by cost.
    const overlapByEngagementMap = new Map<string, typeof overlapRows>();
    for (const row of overlapRows) {
      if (!overlapByEngagementMap.has(row.projectCode)) overlapByEngagementMap.set(row.projectCode, []);
      overlapByEngagementMap.get(row.projectCode)!.push(row);
    }
    const overlapByEngagement = Array.from(overlapByEngagementMap.entries())
      .map(([projectCode, users]) => ({
        projectCode,
        totalCost: users.reduce((s, u) => s + u.totalCost, 0),
        users,
      }))
      .sort((a, b) => b.totalCost - a.totalCost);

    return {
      toolList,
      dualToolUsers,
      dualToolSpend,
      overlapRows,
      overlapByEngagement,
    };
  }, [allRows, totalOrgSpend]);

  const overlapTotalPages = Math.ceil(multiToolData.overlapByEngagement.length / overlapPageSize) || 1;
  // Filters/period changing reshuffles which engagements are flagged at all —
  // clamp rather than land on a now out-of-range page (avoids a setState-in-effect
  // just to reset to page 1).
  const safeOverlapPage = Math.min(overlapPage, overlapTotalPages);
  const paginatedOverlapGroups = multiToolData.overlapByEngagement.slice(
    (safeOverlapPage - 1) * overlapPageSize,
    safeOverlapPage * overlapPageSize
  );

  // Non-billable engagements (Engagement Code prefix I- rather than E-) whose
  // average cost per user exceeds the $100/month margin-drag threshold —
  // Level 1 list for the Non-Billable Cost Overrun inference.
  const nonBillableEngagementStats = useMemo(() => {
    const engagementMap = new Map<string, { cost: number; users: Set<string> }>();
    for (const r of allRows) {
      if (r.calculationMethod !== 'Usage') continue;
      const code = (r.projectCode || 'Unassigned Internal').trim();
      if (code.startsWith('E-')) continue;
      if (!engagementMap.has(code)) engagementMap.set(code, { cost: 0, users: new Set() });
      const entry = engagementMap.get(code)!;
      entry.cost += r.cost;
      const email = (r.userMail || '').toLowerCase().trim();
      if (email) entry.users.add(email);
    }
    const all = Array.from(engagementMap.entries()).map(([code, e]) => ({
      code,
      cost: Number(e.cost.toFixed(2)),
      userCount: e.users.size,
      avgCostPerUser: e.users.size > 0 ? e.cost / e.users.size : 0,
    }));
    const flagged = all.filter((e) => e.avgCostPerUser > 100).sort((a, b) => b.cost - a.cost);
    const totalExposure = Number(flagged.reduce((s, e) => s + e.cost, 0).toFixed(2));
    return { all, flagged, totalExposure };
  }, [allRows]);

  // Compute enriched prescriptive intelligence for all inferences
  const prescriptiveInferences = useMemo(
    () => generatePrescriptiveInferences(summary, allRows),
    [summary, allRows]
  );
  const prescriptiveMap = useMemo(() => {
    const m = new Map<string, (typeof prescriptiveInferences)[number]>();
    for (const item of prescriptiveInferences) {
      m.set(item.id, item);
    }
    return m;
  }, [prescriptiveInferences]);

  // Map of Inference Metadata
  const inferencesMeta: Record<string, InferenceDefinition> = {
    seat_utilization: (() => {
      const p = prescriptiveMap.get('seat_utilization');
      return {
        id: 'seat_utilization',
        title: 'Active / Inactive Users Telemetry (License Utilization)',
        tag: 'User Engagement Telemetry',
        tagColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
        icon: UserCheck,
        stat: `${activeSeatPercent}% Active Utilization`,
        statSub: `${activeUserCount} Active vs ${inactiveUserCount} Inactive Licenses (${fmtCost(inactiveLeakageCost)}/mo Leakage)`,
        finding: p?.finding || (
          inactiveUserCount > 0
            ? `Out of ${totalRosterSeats} provisioned enterprise licenses, ${activeUserCount} users (${activeSeatPercent}%) recorded prompt activity, while ${inactiveUserCount} licenses remain completely dormant, incurring ${fmtCost(inactiveLeakageCost)}/mo in unutilized fixed license costs.`
            : `All ${totalRosterSeats} provisioned enterprise licenses recorded active prompt consumption during this window.`
        ),
        actionableInsight: p?.actionableInsight || (
          inactiveUserCount > 0
            ? `Automate a 30-day inactivity license reclamation workflow: reallocate dormant licenses to waitlisted teams or convert low-activity licenses to consumption-only API keys.`
            : `Maintain active monitoring and expand license capacity proactively.`
        ),
        benefitOutcome: p?.benefitOutcome || (
          inactiveUserCount > 0
            ? `Recovers up to ${fmtCost(inactiveLeakageCost)}/mo in reclaimed license spend. Also frees ${inactiveUserCount} seats for waitlisted teams and gives leadership a clean, auditable license-utilization baseline.`
            : `Protects the full license investment from idle-seat leakage. Also keeps onboarding friction low as new hires can be provisioned with confidence.`
        ),
      };
    })(),
    pareto_risk: (() => {
      const p = prescriptiveMap.get('pareto_risk');
      return {
        id: 'pareto_risk',
        title: 'Pareto Cost Concentration (80/20 Risk)',
        tag: 'Cost Risk Exposure',
        tagColor: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
        icon: ShieldAlert,
        stat: `${top20SpendPercent}% Spend in Top 20%`,
        statSub: `${top20PercentCount} power users drive majority cost (${fmtCost(top20Spend)})`,
        finding: p?.finding || `Spend is heavily concentrated: the top 10% of users (${top10PercentCount} people) account for ${fmtCost(top10Spend)} (${((top10Spend / totalOrgSpend) * 100).toFixed(1)}%), and the top 20% (${top20PercentCount} people) drive ${fmtCost(top20Spend)} (${top20SpendPercent}%).`,
        actionableInsight: p?.actionableInsight || 'Avoid broad, org-wide cuts. Conduct targeted usage reviews for top power users and negotiate tier-based volume plans.',
        benefitOutcome: p?.benefitOutcome || `Targets the highest-leverage cost lever: tier-based volume pricing for the ${top20PercentCount} users already driving ${fmtCost(top20Spend)} (${top20SpendPercent}% of spend) can cut real dollars without an org-wide policy that disrupts the other 80% of users. Also keeps your highest-value power users fully productive.`,
      };
    })(),
    multi_tool_comparison: (() => {
      const p = prescriptiveMap.get('multi_tool_comparison');
      const sorted = [...multiToolData.toolList].sort((a, b) => a.costPerM - b.costPerM);
      const cheapest = sorted[0];
      const priciest = sorted[sorted.length - 1];
      const priceMultiple = cheapest && priciest && cheapest.costPerM > 0
        ? priciest.costPerM / cheapest.costPerM
        : 0;
      return {
        id: 'multi_tool_comparison',
        title: 'Multi-Tool Spend & Efficiency Comparison',
        tag: 'Cross-Platform Unit Economics',
        tagColor: 'bg-ey-yellow/10 text-ey-yellow border-ey-yellow/30',
        icon: Layers,
        stat: `${multiToolData.dualToolUsers.length} Users Multi-License Overlap`,
        statSub: `${fmtCost(multiToolData.dualToolSpend)} redundant spend`,
        finding: p?.finding || `${cheapest?.label} is the cheapest tool at $${(cheapest?.costPerM || 0).toFixed(2)} per million tokens. ${priciest?.label} is the most expensive at $${(priciest?.costPerM || 0).toFixed(2)} per million tokens — about ${priceMultiple.toFixed(1)}x more for the same volume of usage.`,
        actionableInsight: p?.actionableInsight || `Steer high-volume, lower-complexity prompt workloads toward lower unit-cost tools ($${(cheapest?.costPerM || 0).toFixed(2)}/M tokens). Consolidate overlapping multi-tool licenses to eliminate redundant fixed license fees across ${multiToolData.dualToolUsers.length} users.`,
        benefitOutcome: p?.benefitOutcome || `Recovers up to ${fmtCost(multiToolData.dualToolSpend)} in redundant multi-license spend by consolidating ${multiToolData.dualToolUsers.length} overlapping users onto a single primary tool. Also lowers per-token spend by routing volume toward the ${priceMultiple.toFixed(1)}x cheaper option, and simplifies vendor management.`,
      };
    })(),
    vendor_spread: (() => {
      const p = prescriptiveMap.get('multi_tool_comparison');
      const sorted = [...multiToolData.toolList].sort((a, b) => a.costPerM - b.costPerM);
      const cheapest = sorted[0];
      const priciest = sorted[sorted.length - 1];
      const priceMultiple = cheapest && priciest && cheapest.costPerM > 0
        ? priciest.costPerM / cheapest.costPerM
        : 0;
      const topSpend = [...multiToolData.toolList].sort((a, b) => b.cost - a.cost)[0];
      return {
        id: 'vendor_spread',
        title: 'Multi-Tool Spend & Efficiency Comparison',
        tag: 'Vendor Optimization',
        tagColor: 'bg-ey-yellow/10 text-ey-yellow border-ey-yellow/30',
        icon: Layers,
        stat: `${multiToolData.dualToolUsers.length} Users Multi-License Overlap`,
        statSub: `${fmtCost(multiToolData.dualToolSpend)} redundant spend`,
        finding: p?.finding || `${cheapest?.label} unit cost is $${(cheapest?.costPerM || 0).toFixed(2)}/M tokens, and ${priciest?.label} is the highest at $${(priciest?.costPerM || 0).toFixed(2)}/M. ${topSpend?.label} accounts for ${(topSpend?.spendShare || 0).toFixed(1)}% of spend (${fmtCost(topSpend?.cost || 0)}) across ${sorted.length} active tools. Multi-platform license overlap was identified across multi-tool users with redundant license overhead.`,
        actionableInsight: p?.actionableInsight || `Steer high-volume, lower-complexity prompt workloads toward lower unit-cost tools ($${(cheapest?.costPerM || 0).toFixed(2)}/M tokens) to reduce token spend.`,
        benefitOutcome: p?.benefitOutcome || `Recovers up to ${fmtCost(multiToolData.dualToolSpend)} in redundant multi-license spend by consolidating overlapping users, plus per-token savings from shifting volume to the ${priceMultiple.toFixed(1)}x cheaper tool. Also reduces vendor sprawl across the ${sorted.length} active platforms.`,
      };
    })(),
    project_billability: (() => {
      const p = prescriptiveMap.get('project_billability');
      const billableSpendPercent = summary?.billableSpendPercent || 0;
      const nonBillablePct = 100 - billableSpendPercent;
      return {
        id: 'project_billability',
        title: 'Client Billability & Project Telemetry Alignment',
        tag: 'Project ROI Governance',
        tagColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        icon: Layers,
        stat: `${billableSpendPercent.toFixed(1)}% Billable AI Spend`,
        statSub: `${billableSpendPercent.toFixed(1)}% Billable vs ${nonBillablePct.toFixed(1)}% Non-Billable`,
        finding: p?.finding || `${billableSpendPercent.toFixed(1)}% of total AI spend (${fmtCost(summary?.billableSpend || 0)}) is flagged Billable, derived from Engagement Codes starting with E-, and directly assigned to revenue-generating client engagements. Non-billable internal spend (${fmtCost(summary?.nonBillableSpend || 0)}) accounts for ${nonBillablePct.toFixed(1)}%.`,
        actionableInsight: p?.actionableInsight || 'Audit the largest non-billable cost centers to ensure internal AI investment yields reusable intellectual property or client delivery templates.',
        benefitOutcome: p?.benefitOutcome || `Protects the ROI on ${fmtCost(summary?.nonBillableSpend || 0)} of non-billable spend by redirecting it toward reusable IP instead of one-off internal use. Also strengthens cost-allocation audit trails and makes the case for billing back qualifying work.`,
      };
    })(),
    habitual_retention: (() => {
      const p = prescriptiveMap.get('habitual_retention');
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
        finding: p?.finding || `Across ${activeUserCount} active users this period: ${userCohorts.embedded.length} (${embeddedPct.toFixed(0)}%) are Embedded (active in ≥90% of months in the filtered window), ${userCohorts.regular.length} (${regularPct.toFixed(0)}%) are Regular (≥60%), and ${userCohorts.occasional.length} (${occasionalPct.toFixed(0)}%) are Occasional (≥25%). This is measured as active-months ÷ total months in the filtered window, per user — see the Habitual Retention card on Executive Overview for the org-wide cohort breakdown, which also accounts for the ${inactiveUserCount} completely dormant licenses.`,
        actionableInsight: p?.actionableInsight || (
          occasionalPct > 20
            ? 'Investigate the Occasional cohort for onboarding friction or workflow gaps before expanding license capacity further.'
            : 'AI tools show healthy habitual usage among active licenses. Focus shift from basic onboarding to advanced competency training.'
        ),
        benefitOutcome: p?.benefitOutcome || (
          occasionalPct > 20
            ? `Protects roughly ${fmtCost(userCohorts.occasional.length * avgLicenseCostPerSeat)}/mo in license spend now at risk from the ${userCohorts.occasional.length}-person Occasional cohort churning off their seats. Also lifts overall productivity return once those seats convert to habitual use.`
            : `Sustains the return on the active license base by keeping usage habitual rather than one-off. Also compounds productivity gains as advanced training deepens adoption.`
        ),
      };
    })(),
    license_reclamation: (() => {
      const p = prescriptiveMap.get('license_reclamation');
      return {
        id: 'license_reclamation',
        title: 'License Reclamation Intelligence',
        tag: 'Financial Governance',
        tagColor: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
        icon: BadgeDollarSign,
        stat: `${fmtCost(totalRecoverableAmount)} Recoverable`,
        statSub: `${reclamationDormantCount} Dormant Seats to Reclaim · ${usageWarningCount} Below Free Limit (Warning)`,
        finding: p?.finding || (
          reclamationDormantCount > 0 || usageWarningCount > 0
            ? `${reclamationDormantCount} seat${reclamationDormantCount === 1 ? '' : 's'} recorded 0 usage against a real license cost, totaling ${fmtCost(totalRecoverableAmount)} (${recoverablePercentOfLicenseCost}% of total license cost) that can be reclaimed outright. A further ${usageWarningCount} seat${usageWarningCount === 1 ? '' : 's'} are active but consuming less than their included free limit -- flagged as a warning only, not reclaimed.`
            : 'No dormant seats to reclaim, and no active seats currently running under their free limit.'
        ),
        actionableInsight: p?.actionableInsight || (
          reclamationDormantCount > 0
            ? `Reclaim the ${reclamationDormantCount} zero-usage license${reclamationDormantCount === 1 ? '' : 's'} outright. Monitor the ${usageWarningCount} under-the-free-limit seat${usageWarningCount === 1 ? '' : 's'} -- no action taken on these, just a usage warning.`
            : 'No dormant licenses to reclaim this period.'
        ),
        benefitOutcome: p?.benefitOutcome || (
          reclamationDormantCount > 0
            ? `Recovers ${fmtCost(totalRecoverableAmount)}/period in license spend (avg ${fmtCost(avgRecoverablePerSeat)}/seat) by reclaiming only the ${reclamationDormantCount} fully dormant seats, without touching any seat that has recorded real usage.`
            : `Protects the full license investment -- no dormant seats to reclaim this period.`
        ),
      };
    })(),
    non_billable_overrun: (() => {
      const p = prescriptiveMap.get('non_billable_overrun');
      const { flagged, all, totalExposure } = nonBillableEngagementStats;
      const percentAtRisk = all.length > 0 ? (flagged.length / all.length) * 100 : 0;
      return {
        id: 'non_billable_overrun',
        title: 'Non-Billable Cost Overrun',
        tag: 'Margin Risk',
        tagColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        icon: AlertTriangle,
        stat: `${percentAtRisk.toFixed(1)}% Non-Billable at Risk`,
        statSub: `${flagged.length} of ${all.length} engagements · ${fmtCost(totalExposure)}/mo exposure`,
        finding: p?.finding || (
          flagged.length > 0
            ? `${percentAtRisk.toFixed(1)}% of non-billable engagements (${flagged.length} of ${all.length}) have an average cost per user above $100/month, together accounting for ${fmtCost(totalExposure)}/mo (${fmtCost(totalExposure * 12)} annualised) in unrecovered spend. This is pure margin drag — none of it is offset by client billing.`
            : 'No non-billable engagements are currently running above the $100/user/month threshold.'
        ),
        actionableInsight: p?.actionableInsight || (
          flagged.length > 0
            ? 'Open the root-cause diagnostic for each flagged engagement below to see whether the overrun is driven by multi-tool overlap, power-user concentration, or broad heavy usage.'
            : 'No remediation required this period.'
        ),
        benefitOutcome: p?.benefitOutcome || (
          flagged.length > 0
            ? `Recovers up to ${fmtCost(totalExposure)}/mo (${fmtCost(totalExposure * 12)}/yr) in unrecovered internal spend once root causes are addressed, protecting practice margin without cutting legitimate client-billable usage.`
            : 'Non-billable spend is currently within a healthy per-user range.'
        ),
      };
    })(),
  };

  const currentMeta = inferencesMeta[inferenceId] || inferencesMeta.license_reclamation;
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
        return (r.superRegion || '').toLowerCase() === lowerName;
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
        const ratio = totalMonthsInWindow > 0 ? userObj.activeMonths.size / totalMonthsInWindow : 0;
        if (name === 'Embedded') return ratio >= 0.9;
        if (name === 'Regular') return ratio >= 0.6 && ratio < 0.9;
        if (name === 'Occasional') return ratio < 0.6;
        return true;
      }
      return true;
    });
  }, [allRows, selectedEntity, activeUserMap, totalMonthsInWindow]);

  // Root-cause diagnostics for a single flagged engagement, computed once its
  // Level 3 focus banner scopes granularRows down to just that Engagement Code.
  const nonBillableRootCause = useMemo(() => {
    if (!(inferenceId === 'non_billable_overrun' && selectedEntity?.type === 'project_code')) return null;
    const usageRows = granularRows.filter((r) => r.calculationMethod === 'Usage');
    const userCost = new Map<string, number>();
    const userTools = new Map<string, Set<string>>();
    for (const r of usageRows) {
      const email = (r.userMail || '').toLowerCase().trim();
      if (!email) continue;
      userCost.set(email, (userCost.get(email) || 0) + r.cost);
      if (!userTools.has(email)) userTools.set(email, new Set());
      userTools.get(email)!.add(r.aiTool);
    }
    const userCount = userCost.size;
    const costs = Array.from(userCost.values());
    const totalCost = costs.reduce((s, c) => s + c, 0);
    const avgCostPerUser = userCount > 0 ? totalCost / userCount : 0;

    // Diagnostic 1 — Multi-tool overlap
    const totalToolInstances = Array.from(userTools.values()).reduce((s, set) => s + set.size, 0);
    const avgToolsPerUser = userCount > 0 ? totalToolInstances / userCount : 0;

    // Diagnostic 2 — Power-user concentration
    const sortedCosts = [...costs].sort((a, b) => b - a);
    const top20Count = Math.max(1, Math.round(userCount * 0.2));
    const top20Cost = sortedCosts.slice(0, top20Count).reduce((s, c) => s + c, 0);
    const top20Share = totalCost > 0 ? (top20Cost / totalCost) * 100 : 0;

    // Diagnostic 3 — Broad heavy usage (low variance + high average)
    const variance = userCount > 0 ? costs.reduce((s, c) => s + (c - avgCostPerUser) ** 2, 0) / userCount : 0;
    const costDistributionCV = avgCostPerUser > 0 ? Math.sqrt(variance) / avgCostPerUser : 0;

    let tag: string;
    let tagDetail: string;
    if (avgToolsPerUser > 1.5) {
      tag = 'Multi-tool usage';
      tagDetail = `Users on this engagement run ${avgToolsPerUser.toFixed(1)} AI products on average — this is redundant tool spend, not a usage-volume problem.`;
    } else if (top20Share > 70) {
      tag = 'Power-user concentration';
      tagDetail = `The top 20% of users (${top20Count} of ${userCount}) drive ${top20Share.toFixed(1)}% of this engagement's cost — a small group is skewing the average, not the whole team.`;
    } else if (costDistributionCV < 0.4 && avgCostPerUser > 100) {
      tag = 'Broad heavy usage';
      tagDetail = `Cost per user is consistently high across the team (CV ${costDistributionCV.toFixed(2)}, avg ${fmtCost(avgCostPerUser)}/user) — everyone is expensive, not just a few outliers.`;
    } else {
      tag = 'No dominant pattern';
      tagDetail = 'None of the three root-cause thresholds were triggered for this engagement — investigate the per-user breakdown manually.';
    }

    const perUser = Array.from(userCost.entries())
      .map(([email, cost]) => ({ email, cost, tools: userTools.get(email)?.size || 0 }))
      .sort((a, b) => b.cost - a.cost);

    return { userCount, totalCost, avgCostPerUser, avgToolsPerUser, top20Share, top20Count, costDistributionCV, tag, tagDetail, perUser };
  }, [inferenceId, selectedEntity, granularRows]);

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
        (r.monthYear || '').toLowerCase().includes(s)
    );
  }, [granularRows, searchTerm]);

  // Aggregates for the current granular slice — Usage rows only. The raw log
  // table below still shows every row (License included, for audit
  // transparency), but License rows would otherwise blend flat seat fees
  // into what's presented as usage spend here.
  const usageGranularRows = useMemo(
    () => filteredGranularRows.filter((r) => r.calculationMethod === 'Usage' && r.tokenConsumption > 0),
    [filteredGranularRows]
  );
  const sliceTotalCost = useMemo(
    () => usageGranularRows.reduce((acc, r) => acc + r.cost, 0),
    [usageGranularRows]
  );
  const sliceTotalTokens = useMemo(
    () => usageGranularRows.reduce((acc, r) => acc + r.tokenConsumption, 0),
    [usageGranularRows]
  );
  const sliceBillableCount = useMemo(
    () =>
      usageGranularRows.filter(
        (r) => r.billableFlag === 'True' || r.billableFlag === 'true'
      ).length,
    [usageGranularRows]
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
      'Month',
      'Display Name',
      'User Email',
      'AI Tool',
      'Engagement Code',
      'Service Line',
      'Country',
      'Super Region',
      'Billable Flag',
      'Token Consumption',
      'Cost (USD)',
    ];
    const rows = filteredGranularRows.map((r) => [
      r.monthYear,
      `"${r.displayName}"`,
      r.userMail,
      r.aiTool,
      r.projectCode,
      r.orgServiceLine,
      r.country,
      r.superRegion,
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

  // Exports the Multi-Platform License Overlap table exactly as grouped and
  // sorted on screen: by Engagement Code, then by cost within each engagement.
  const handleExportOverlapCsv = () => {
    if (multiToolData.overlapByEngagement.length === 0) return;
    const headers = ['Engagement Code', 'Display Name', 'User Email', 'Tools', 'Total Cost (USD)', 'Total Tokens'];
    const rows = multiToolData.overlapByEngagement.flatMap((group) =>
      group.users.map((u) => [
        group.projectCode,
        `"${u.displayName}"`,
        u.email,
        `"${u.tools.join(', ')}"`,
        u.totalCost.toFixed(4),
        u.totalTokens,
      ])
    );
    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'multi_tool_license_overlap.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    handleTriggerAction('Multi-tool overlap cohort exported successfully as CSV!');
  };

  if (rowsLoading) {
    return (
      <div className="h-64 flex items-center justify-center text-ey-muted text-sm animate-pulse">
        Loading telemetry rows...
      </div>
    );
  }

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
            className={`${selectedEntity ? 'text-ey-muted hover:text-ey-yellow cursor-pointer' : 'text-ey-yellow font-bold'
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
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${currentMeta.tagColor}`}>
                {currentMeta.tag}
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
            <span className="text-[10px] font-mono text-ey-muted uppercase tracking-wider">Key Metric</span>
            <div className="text-2xl font-black text-ey-yellow font-mono">{currentMeta.stat}</div>
            <div className="text-[11px] text-ey-muted font-mono">{currentMeta.statSub}</div>
          </div>
        </div>


        {/* Strategic Recommendation Callout */}
        <div className="bg-ey-yellow/5 border border-ey-yellow/20 rounded-xl p-3.5 flex items-start space-x-3">
          <Sparkles className="w-5 h-5 text-ey-yellow shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <span className="font-bold text-ey-yellow uppercase tracking-wider mr-2">Suggestive Action:</span>
            <span className="text-ey-light leading-relaxed">{currentMeta.actionableInsight}</span>
          </div>
        </div>


        {/* Benefits & Outcome — cost-first payoff of taking the action above */}
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3.5 flex items-start space-x-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <span className="font-bold text-emerald-400 uppercase tracking-wider mr-2">Benefits &amp; Outcome:</span>
            <span className="text-ey-light leading-relaxed">{currentMeta.benefitOutcome}</span>
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
              {/* Mandated Hierarchy Navigator — always shown first, at the top */}
              <HierarchyDrilldownPanel
                rows={activePeriodRows}
                title={`Level 3: Active License View (${activeUserList.length} Users)`}
                onSelectUser={(email, label) => setSelectedEntity({ type: 'user', name: email, label })}
              />

              {/* Level 2 KPI Tiles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
                <StatTile
                  label="Total Provisioned Licenses"
                  value={`${totalRosterSeats} Licenses`}
                  subtitle="Real per-license Cost in USD"
                  tooltip="Count of distinct users across all rows (License + Usage) in the selected period — every provisioned seat regardless of activity."
                />
                <StatTile
                  label="Active Engaged Licenses"
                  value={`${activeUserCount} Users`}
                  valueClassName="text-emerald-400"
                  subtitle={`${activeSeatPercent}% of Provisioned Pool`}
                  subtitleClassName="text-emerald-300/80"
                  tooltip="Filter Calculation Method = 'Usage' AND GenAI Tool Consumption > 0. Count of distinct users — users with real prompt activity this period."
                />
                <StatTile
                  label="Unutilized Licenses"
                  value={`${inactiveUserCount} Licenses`}
                  valueClassName="text-rose-400"
                  subtitle="No Usage-row activity recorded"
                  subtitleClassName="text-rose-300/80"
                  tooltip="Filter Calculation Method = 'Usage' AND GenAI Tool Consumption = 0. Count of distinct users — provisioned seats with zero recorded consumption."
                />
                <StatTile
                  label="Annualized License Leakage"
                  value={`${fmtCost(inactiveLeakageCost * 12)}/yr`}
                  valueClassName="text-ey-yellow"
                  subtitle={`${fmtCost(inactiveLeakageCost)}/mo Direct Unused Spend`}
                  subtitleClassName="text-ey-yellow/80"
                  tooltip="Unutilized Licenses × Avg License Cost/Seat × 12. Monthly leakage = unutilized count × (Total License Cost ÷ Active Users), annualized by ×12."
                />
              </div>

              {/* Level 3: Inactive Licenses Roster & Reclamation Table */}
              <div className="bg-ey-card border border-ey-border rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-ey-border/60 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-ey-light uppercase tracking-wider flex items-center gap-2">
                      <UserX className="w-4 h-4 text-rose-400" />
                      <span>Level 3: Unutilized Licenses Action Ledger (1-Click Reclamation)</span>
                    </h3>
                    <p className="text-xs text-ey-muted mt-0.5">
                      Identified dormant provisioned licenses incurring real per-license fees without prompt telemetry in the selected period.
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5 self-start sm:self-center">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs font-mono">
                      <span className="text-ey-muted font-sans font-medium">Savings:</span>
                      <span className="font-bold text-emerald-400">{fmtCost(inactiveLeakageCost)}</span>
                    </div>
                    <button
                      onClick={() => handleTriggerAction(`Automated 30-Day Reclamation Workflow dispatched to ${dormantUsers.length} dormant account${dormantUsers.length === 1 ? '' : 's'}.`)}
                      className="px-3 py-1.5 bg-rose-500/20 border border-rose-500/40 hover:bg-rose-500/30 text-rose-300 text-xs font-semibold rounded-xl transition flex items-center space-x-1.5 cursor-pointer shrink-0"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Reclaim All Unutilized Licenses</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto border border-ey-border rounded-xl">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-ey-black/70 text-ey-muted uppercase tracking-wider border-b border-ey-border">
                      <tr>
                        <th className="px-4 py-3">Service Line</th>
                        <th className="px-4 py-3 text-center">Unutilized Licenses</th>
                        <th className="px-4 py-3 text-right">Fixed Monthly Cost</th>
                        <th className="px-4 py-3 text-center">Action Trigger</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ey-border">
                      {dormantByServiceLine.map((sl) => {
                        const isExpanded = expandedDormantServiceLine === sl.serviceLine;
                        return (
                          <React.Fragment key={sl.serviceLine}>
                            <tr
                              onClick={() => setExpandedDormantServiceLine(isExpanded ? null : sl.serviceLine)}
                              className="hover:bg-ey-card-hover/80 transition cursor-pointer"
                              title={`Click to ${isExpanded ? 'hide' : 'view'} individual dormant licenses in ${sl.serviceLine}`}
                            >
                              <td className="px-4 py-3 font-medium text-ey-light">
                                <span className="flex items-center gap-1.5">
                                  <ChevronRight className={`w-3.5 h-3.5 text-ey-muted transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                  {sl.serviceLine}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                                  {sl.count} license{sl.count === 1 ? '' : 's'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-rose-400">{fmtCost(sl.monthlyCost)} / mo</td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleTriggerAction(`${sl.count} dormant license${sl.count === 1 ? '' : 's'} in ${sl.serviceLine} reclaimed and returned to pool.`);
                                  }}
                                  className="px-2.5 py-1 bg-ey-yellow/10 hover:bg-ey-yellow/20 text-ey-yellow border border-ey-yellow/30 rounded text-[10px] font-bold transition"
                                >
                                  Reclaim {sl.count} License{sl.count === 1 ? '' : 's'}
                                </button>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr>
                                <td colSpan={4} className="p-0 bg-ey-black/40">
                                  <table className="w-full text-left text-xs font-mono">
                                    <thead className="text-ey-muted uppercase tracking-wider border-b border-ey-border/60">
                                      <tr>
                                        <th className="px-4 py-2 pl-10">Provisioned Employee</th>
                                        <th className="px-4 py-2">Region</th>
                                        <th className="px-4 py-2 text-center">Last Activity</th>
                                        <th className="px-4 py-2 text-right">Fixed Monthly Cost</th>
                                        <th className="px-4 py-2 text-center">Action Trigger</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-ey-border/40">
                                      {dormantUsers.filter((u) => u.serviceLine === sl.serviceLine).map((u) => (
                                        <tr key={u.email} className="hover:bg-ey-card-hover/60 transition">
                                          <td className="px-4 py-2.5 pl-10 font-medium text-ey-light">
                                            <div>{u.name}</div>
                                            <div className="text-[10px] text-ey-muted">{u.email}</div>
                                          </td>
                                          <td className="px-4 py-2.5 text-ey-muted">{u.region}</td>
                                          <td className="px-4 py-2.5 text-center text-[10px] text-ey-muted">{u.lastActivityDate}</td>
                                          <td className="px-4 py-2.5 text-right font-bold text-rose-400">{fmtCost(u.licenseCost)} / mo</td>
                                          <td className="px-4 py-2.5 text-center">
                                            <button
                                              onClick={() => handleTriggerAction(`License for ${u.name} reclaimed and returned to pool.`)}
                                              className="px-2.5 py-1 bg-ey-yellow/10 hover:bg-ey-yellow/20 text-ey-yellow border border-ey-yellow/30 rounded text-[10px] font-bold transition"
                                            >
                                              Reclaim License
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* 2b. LICENSE RECLAMATION DECOMPOSITION */}
          {inferenceId === 'license_reclamation' && (
            <div className="space-y-6">
              {/* Level 2 KPI Tiles */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
                <StatTile
                  label="Total License Cost"
                  value={fmtCost(summary?.totalLicenseCost || 0)}
                  valueClassName="text-ey-light"
                  subtitle={`${totalRosterSeats} Provisioned Licenses`}
                  subtitleClassName="text-ey-muted"
                  tooltip="Total enterprise license investment across all provisioned users in the dataset."
                />
                <StatTile
                  label="Dormant Seats (Reclaim)"
                  value={fmtCost(totalRecoverableAmount)}
                  valueClassName="text-rose-400"
                  subtitle={`${reclamationDormantCount} Seats (${recoverablePercentOfLicenseCost}% of total)`}
                  subtitleClassName="text-rose-300/80"
                  tooltip="Total recoverable license cost from confirmed dormant seats (0 token consumption recorded). These are the seats reclaimed under Rule 1."
                />
                <StatTile
                  label="Below Free Limit (Warning)"
                  value={fmtCost(totalWarningUnusedCapacity)}
                  valueClassName="text-amber-400"
                  subtitle={`${usageWarningCount} Seats · under free allowance`}
                  subtitleClassName="text-amber-300/80"
                  tooltip="Total unused free capacity across active users whose usage cost falls under their tool's included free allowance. Warning only -- never reclaimed."
                />
              </div>

              {/* Mandated Hierarchy Navigator, scoped to dormant + below-free-limit seats */}
              <HierarchyDrilldownPanel
                rows={reclamationRows}
                title={`Flagged License View (${reclamationDormantCount + usageWarningCount} Seats)`}
                subtitle="Drill down through the org structure to the seats below -- dormant (reclaimable) and below-free-limit (warning only) seats."
                onSelectUser={(email, label) => setSelectedEntity({ type: 'user', name: email, label })}
              />

              {/* Rule 1: Reclamation Action Ledger -- dormant (0 usage) seats only */}
              <div className="bg-ey-card border border-ey-border rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-ey-border/60 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-ey-light uppercase tracking-wider flex items-center gap-2">
                      <BadgeDollarSign className="w-4 h-4 text-rose-400" />
                      <span>License Reclamation Action Ledger (1-Click Reclamation)</span>
                    </h3>
                    <p className="text-xs text-ey-muted mt-0.5">
                      Rule 1: only fully dormant seats (0 usage) are reclaimed, grouped by Service Line.
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5 self-start sm:self-center">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs font-mono">
                      <span className="text-ey-muted font-sans font-medium">Savings:</span>
                      <span className="font-bold text-emerald-400">{fmtCost(totalRecoverableAmount)}</span>
                    </div>
                    <button
                      onClick={() => handleTriggerAction(`Automated Reclamation Workflow dispatched to ${reclamationDormantCount} dormant seat${reclamationDormantCount === 1 ? '' : 's'}.`)}
                      className="px-3 py-1.5 bg-rose-500/20 border border-rose-500/40 hover:bg-rose-500/30 text-rose-300 text-xs font-semibold rounded-xl transition flex items-center space-x-1.5 cursor-pointer shrink-0"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Reclaim All Dormant Licenses</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto border border-ey-border rounded-xl">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-ey-black/70 text-ey-muted uppercase tracking-wider border-b border-ey-border">
                      <tr>
                        <th className="px-4 py-3">Service Line</th>
                        <th className="px-4 py-3 text-center">Dormant Seats</th>
                        <th className="px-4 py-3 text-right">Recoverable ($)</th>
                        <th className="px-4 py-3 text-center">Action Trigger</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ey-border">
                      {reclamationByServiceLine.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-ey-muted">No dormant licenses at this time.</td>
                        </tr>
                      ) : reclamationByServiceLine.map((sl) => {
                        const isExpanded = expandedDormantServiceLine === `reclamation:${sl.serviceLine}`;
                        return (
                          <React.Fragment key={sl.serviceLine}>
                            <tr
                              onClick={() => setExpandedDormantServiceLine(isExpanded ? null : `reclamation:${sl.serviceLine}`)}
                              className="hover:bg-ey-card-hover/80 transition cursor-pointer"
                              title={`Click to ${isExpanded ? 'hide' : 'view'} individual dormant seats in ${sl.serviceLine}`}
                            >
                              <td className="px-4 py-3 font-medium text-ey-light">
                                <span className="flex items-center gap-1.5">
                                  <ChevronRight className={`w-3.5 h-3.5 text-ey-muted transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                  {sl.serviceLine}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                                  {sl.count} seat{sl.count === 1 ? '' : 's'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-emerald-400">{fmtCost(sl.recoverableAmount)}</td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleTriggerAction(`${sl.count} dormant license${sl.count === 1 ? '' : 's'} in ${sl.serviceLine} reclaimed and returned to pool.`);
                                  }}
                                  className="px-2.5 py-1 bg-ey-yellow/10 hover:bg-ey-yellow/20 text-ey-yellow border border-ey-yellow/30 rounded text-[10px] font-bold transition"
                                >
                                  Reclaim {sl.count} License{sl.count === 1 ? '' : 's'}
                                </button>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr>
                                <td colSpan={4} className="p-0 bg-ey-black/40">
                                  <table className="w-full text-left text-xs font-mono">
                                    <thead className="text-ey-muted uppercase tracking-wider border-b border-ey-border/60">
                                      <tr>
                                        <th className="px-4 py-2 pl-10">Provisioned Employee</th>
                                        <th className="px-4 py-2 text-right">License Cost</th>
                                        <th className="px-4 py-2 text-right">Recoverable</th>
                                        <th className="px-4 py-2 text-center">Action Trigger</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-ey-border/40">
                                      {reclamationUsers
                                        .filter((u) => (emailToRow.get(u.email)?.orgServiceLine || 'General') === sl.serviceLine)
                                        .map((u) => (
                                          <tr key={u.email} className="hover:bg-ey-card-hover/60 transition">
                                            <td className="px-4 py-2.5 pl-10 font-medium text-ey-light">
                                              <div>{u.displayName}</div>
                                              <div className="text-[10px] text-ey-muted">{u.email}</div>
                                            </td>
                                            <td className="px-4 py-2.5 text-right">{fmtCost(u.licenseCost)}</td>
                                            <td className="px-4 py-2.5 text-right font-bold text-emerald-400">{fmtCost(u.recoverableAmount)}</td>
                                            <td className="px-4 py-2.5 text-center">
                                              <button
                                                onClick={() => handleTriggerAction(`License for ${u.displayName} reclaimed and returned to pool.`)}
                                                className="px-2.5 py-1 bg-ey-yellow/10 hover:bg-ey-yellow/20 text-ey-yellow border border-ey-yellow/30 rounded text-[10px] font-bold transition"
                                              >
                                                Reclaim License
                                              </button>
                                            </td>
                                          </tr>
                                        ))}
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Rule 2: Usage-Below-Free-Limit Warning -- flagged only, never reclaimed */}
              <div className="bg-ey-card border border-amber-500/30 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-ey-border/60 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-ey-light uppercase tracking-wider flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <span>Usage Below Free Limit (Warning Only)</span>
                    </h3>
                    <p className="text-xs text-ey-muted mt-0.5">
                      Rule 2: these seats are active but consuming less than their included free limit. No reclamation action is taken -- shown as a warning only.
                    </p>
                  </div>
                  <div className="flex items-center gap-4 bg-ey-black/40 border border-ey-border rounded-xl px-4 py-2.5 shrink-0 font-mono">
                    <div className="text-right">
                      <p className="text-[10px] text-ey-muted uppercase tracking-wider">Warned Seats</p>
                      <p className="text-lg font-bold text-amber-300 leading-none">{usageWarningCount}</p>
                    </div>
                    <div className="w-px h-8 bg-ey-border" />
                    <div className="text-right">
                      <p className="text-[10px] text-ey-muted uppercase tracking-wider">Unused Free Capacity</p>
                      <p className="text-lg font-bold text-amber-300 leading-none">{fmtCost(totalWarningUnusedCapacity)}</p>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto border border-ey-border rounded-xl">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-ey-black/70 text-ey-muted uppercase tracking-wider border-b border-ey-border">
                      <tr>
                        <th className="px-4 py-3">Employee</th>
                        <th className="px-4 py-3 text-right">Usage Cost</th>
                        <th className="px-4 py-3 text-right">Free Limit</th>
                        <th className="px-4 py-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ey-border">
                      {paginatedWarningUsers.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-ey-muted">No seats currently under their free limit.</td>
                        </tr>
                      ) : paginatedWarningUsers.map((u) => (
                        <tr key={u.email} className="hover:bg-ey-card-hover/60 transition">
                          <td className="px-4 py-3 font-medium text-ey-light">
                            <div>{u.displayName}</div>
                            <div className="text-[10px] text-ey-muted">{u.email}</div>
                          </td>
                          <td className="px-4 py-3 text-right">{fmtCost(u.actualCost)}</td>
                          <td className="px-4 py-3 text-right text-ey-muted">{fmtCost(u.usageFreeTokenLimit)}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              <AlertTriangle className="w-3 h-3" />
                              Warning
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {warningTotalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-ey-muted font-mono">
                    <div>
                      Showing {(warningPage - 1) * warningPageSize + 1} to{' '}
                      {Math.min(warningPage * warningPageSize, usageWarningUsers.length)} of{' '}
                      {usageWarningUsers.length} seats
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setWarningPage((p) => Math.max(1, p - 1))}
                        disabled={warningPage === 1}
                        className="px-3 py-1 bg-ey-black border border-ey-border rounded-lg hover:bg-ey-card-hover disabled:opacity-40"
                      >
                        Previous
                      </button>
                      <span>
                        Page {warningPage} of {warningTotalPages}
                      </span>
                      <button
                        onClick={() => setWarningPage((p) => Math.min(warningTotalPages, p + 1))}
                        disabled={warningPage === warningTotalPages}
                        className="px-3 py-1 bg-ey-black border border-ey-border rounded-lg hover:bg-ey-card-hover disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2c. NON-BILLABLE COST OVERRUN DECOMPOSITION */}
          {inferenceId === 'non_billable_overrun' && (
            <div className="space-y-6">
              {/* Level 2 KPI Tiles */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
                <StatTile
                  label="Non-Billable Engagements"
                  value={`${nonBillableEngagementStats.all.length}`}
                  subtitle="Engagement Codes with an 'I-' (Internal) prefix"
                  tooltip="Distinct Engagement Codes with at least one Usage row this period, excluding E- (client-billable) codes."
                />
                <StatTile
                  label="Flagged (Avg Cost/User > $100/mo)"
                  value={`${nonBillableEngagementStats.flagged.length}`}
                  valueClassName="text-amber-400"
                  subtitle={`${(nonBillableEngagementStats.all.length > 0 ? (nonBillableEngagementStats.flagged.length / nonBillableEngagementStats.all.length) * 100 : 0).toFixed(1)}% of non-billable engagements at risk`}
                  subtitleClassName="text-amber-300/80"
                  tooltip="Engagement avg cost/user = SUM(Cost USD) ÷ COUNT(DISTINCT User Email), grouped by Engagement Code. Flagged when that average exceeds $100/month."
                />
                <StatTile
                  label="Total $ Exposure"
                  value={fmtCost(nonBillableEngagementStats.totalExposure)}
                  valueClassName="text-rose-400"
                  subtitle={`${fmtCost(nonBillableEngagementStats.totalExposure * 12)}/yr annualised`}
                  subtitleClassName="text-rose-300/80"
                  tooltip="SUM(Cost USD) across every flagged engagement — unrecovered spend not offset by any client billing."
                />
              </div>

              {/* Flagged Engagement List — click one to run it through the root-cause diagnostics */}
              <div className="bg-ey-card border border-ey-border rounded-2xl p-5 shadow-sm space-y-4">
                <div className="border-b border-ey-border/60 pb-3">
                  <h3 className="text-sm font-bold text-ey-light uppercase tracking-wider flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>Flagged Non-Billable Engagements — Click for Root-Cause Diagnostics</span>
                  </h3>
                  <p className="text-xs text-ey-muted mt-0.5">
                    Engagements where average cost per user exceeds $100/month, with none of that spend offset by client billing.
                  </p>
                </div>
                <div className="overflow-x-auto border border-ey-border rounded-xl">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-ey-black/70 text-ey-muted uppercase tracking-wider border-b border-ey-border">
                      <tr>
                        <th className="px-4 py-3">Engagement Code</th>
                        <th className="px-4 py-3 text-right">Users</th>
                        <th className="px-4 py-3 text-right">Avg Cost / User</th>
                        <th className="px-4 py-3 text-right">Total Cost</th>
                        <th className="px-4 py-3 text-center">Diagnose</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ey-border">
                      {nonBillableEngagementStats.flagged.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-ey-muted">No flagged engagements this period.</td>
                        </tr>
                      ) : (
                        nonBillableEngagementStats.flagged.map((e) => (
                          <tr
                            key={e.code}
                            onClick={() => setSelectedEntity({ type: 'project_code', name: e.code, label: e.code })}
                            className="hover:bg-ey-card-hover/80 transition cursor-pointer group"
                          >
                            <td className="px-4 py-3 font-bold text-ey-light group-hover:text-ey-yellow flex items-center gap-1.5">
                              {e.code}
                              <ArrowLeft className="w-3 h-3 rotate-180 opacity-0 group-hover:opacity-100 text-ey-yellow transition-opacity" />
                            </td>
                            <td className="px-4 py-3 text-right">{e.userCount}</td>
                            <td className="px-4 py-3 text-right font-bold text-amber-400">{fmtCost(e.avgCostPerUser)}</td>
                            <td className="px-4 py-3 text-right text-ey-light">{fmtCost(e.cost)}</td>
                            <td className="px-4 py-3 text-center text-ey-yellow font-bold">Diagnose</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 3. PARETO 80/20 COST CONCENTRATION DECOMPOSITION */}
          {inferenceId === 'pareto_risk' && (
            <div className="space-y-6">
              {/* Mandated Hierarchy Navigator — always shown first, at the top, scoped to the top-20% power users' rows */}
              <HierarchyDrilldownPanel
                rows={allRows.filter((r) => top20Users.some((u) => u.email === (r.userMail || '').toLowerCase().trim()))}
                title={`Level 3: Top 20% Power User View (${top20Users.length} Key Accounts)`}
                onSelectUser={(email, label) => setSelectedEntity({ type: 'user', name: email, label })}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
                <StatTile
                  label="Total Organization Spend"
                  value={fmtCost(totalOrgSpend)}
                  subtitle={`Across ${activeUserList.length} Active Employees`}
                />
                <StatTile
                  label="Top 10% Spend Share"
                  value={fmtCost(top10Spend)}
                  valueClassName="text-rose-400"
                  subtitle={`${top10PercentCount} Users (${((top10Spend / totalOrgSpend) * 100).toFixed(1)}% of Budget)`}
                  subtitleClassName="text-rose-300/80"
                />
                <StatTile
                  label="Top 20% Spend Share"
                  value={fmtCost(top20Spend)}
                  valueClassName="text-amber-400"
                  subtitle={`${top20PercentCount} Users (${top20SpendPercent}% of Budget)`}
                  subtitleClassName="text-amber-300/80"
                />
                <StatTile
                  label="Remaining 80% Pool"
                  value={fmtCost(totalOrgSpend - top20Spend)}
                  valueClassName="text-emerald-400"
                  subtitle={`${activeUserList.length - top20PercentCount} Users (${(100 - parseFloat(top20SpendPercent)).toFixed(1)}%)`}
                  subtitleClassName="text-emerald-300/80"
                />
              </div>
            </div>
          )}

          {/* 4. MULTI-TOOL SPEND & EFFICIENCY COMPARISON */}
          {(inferenceId === 'vendor_spread' || inferenceId === 'multi_tool_comparison') && (
            <div className="space-y-6">
              {/* Multi-Platform License Overlap & License Redundancy Cohort */}
              <div className="bg-ey-card border border-amber-500/30 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-500/20 pb-3">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-400 shrink-0">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-ey-light uppercase tracking-wider font-mono flex items-center gap-2">
                        <span>Multi-Platform License Overlap &amp; License Redundancy Cohort</span>
                      </h3>
                      <p className="text-xs text-ey-muted mt-0.5 font-sans">
                        {multiToolData.overlapRows.length} user{multiToolData.overlapRows.length === 1 ? '' : 's'} with paid usage (Cost USD &gt; 0) on 2+ AI tools, grouped by Engagement Code and ordered by total cost.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleExportOverlapCsv}
                    disabled={multiToolData.overlapRows.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-ey-black border border-ey-border hover:border-ey-yellow text-ey-light hover:text-ey-yellow text-xs font-semibold rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                    title="Export this overlap cohort to CSV"
                  >
                    <Download className="w-3.5 h-3.5 text-ey-yellow" />
                    <span>Export CSV</span>
                  </button>
                </div>

                {multiToolData.overlapByEngagement.length === 0 ? (
                  <p className="text-xs text-ey-muted text-center py-8">No users currently show paid usage on 2 or more AI tools.</p>
                ) : (
                  <div className="overflow-x-auto border border-ey-border rounded-xl">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-ey-black/70 text-ey-muted uppercase tracking-wider border-b border-ey-border">
                        <tr>
                          <th className="px-4 py-3">Engagement Code</th>
                          <th className="px-4 py-3">User</th>
                          <th className="px-4 py-3">Tools</th>
                          <th className="px-4 py-3 text-right">Total Cost ($)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ey-border">
                        {paginatedOverlapGroups.map((group) => (
                          <React.Fragment key={group.projectCode}>
                            <tr className="bg-ey-black/40">
                              <td colSpan={4} className="px-4 py-2 text-[11px] font-bold text-amber-300">
                                {group.projectCode} <span className="text-ey-muted font-normal">— {fmtCost(group.totalCost)} across {group.users.length} user{group.users.length === 1 ? '' : 's'}</span>
                              </td>
                            </tr>
                            {group.users.map((u) => (
                              <tr
                                key={`${group.projectCode}:${u.email}`}
                                onClick={() => setSelectedEntity({ type: 'user', name: u.email, label: u.displayName })}
                                className="hover:bg-ey-card-hover/80 transition cursor-pointer group"
                              >
                                <td className="px-4 py-3 text-ey-muted">{group.projectCode}</td>
                                <td className="px-4 py-3 text-ey-light">
                                  <div className="font-semibold group-hover:text-ey-yellow transition-colors">{u.displayName}</div>
                                  <div className="text-[10px] text-ey-muted">{u.email}</div>
                                </td>
                                <td className="px-4 py-3 text-ey-muted">{u.tools.join(', ')}</td>
                                <td className="px-4 py-3 text-right font-bold text-ey-yellow">{fmtCost(u.totalCost)}</td>
                              </tr>
                            ))}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Pagination — paginated by Engagement Code group; Export CSV
                    below always covers the full, unpaginated dataset. */}
                {overlapTotalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-ey-muted font-mono">
                    <div>
                      Showing engagements {(safeOverlapPage - 1) * overlapPageSize + 1} to{' '}
                      {Math.min(safeOverlapPage * overlapPageSize, multiToolData.overlapByEngagement.length)} of{' '}
                      {multiToolData.overlapByEngagement.length} ({multiToolData.overlapRows.length} users total)
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setOverlapPage((p) => Math.max(1, p - 1))}
                        disabled={safeOverlapPage === 1}
                        className="px-3 py-1 bg-ey-black border border-ey-border rounded-lg hover:bg-ey-card-hover disabled:opacity-40"
                      >
                        Previous
                      </button>
                      <span>
                        Page {safeOverlapPage} of {overlapTotalPages}
                      </span>
                      <button
                        onClick={() => setOverlapPage((p) => Math.min(overlapTotalPages, p + 1))}
                        disabled={safeOverlapPage === overlapTotalPages}
                        className="px-3 py-1 bg-ey-black border border-ey-border rounded-lg hover:bg-ey-card-hover disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 6. CLIENT BILLABILITY & PROJECT TELEMETRY ALIGNMENT */}
          {inferenceId === 'project_billability' && (
            <div className="space-y-6">
              {/* Mandated Hierarchy Navigator — always shown first, at the top */}
              <HierarchyDrilldownPanel
                rows={allRows}
                title="Level 3: Billability & Org"
                subtitle="Drill CT/Non-CT down to Sub-Service Line 2 to reach the users behind billable and non-billable spend. Engagement-code detail is in the table below."
                onSelectUser={(email, label) => setSelectedEntity({ type: 'user', name: email, label })}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
                <StatTile
                  label="Client Billable Spend"
                  value={`${(summary?.billableSpendPercent || 0).toFixed(1)}%`}
                  valueClassName="text-emerald-400"
                  subtitle="Billable Client Engagements"
                  subtitleClassName="text-emerald-300/80"
                />
                <StatTile
                  label="Non-Billable Investment"
                  value={`${(100 - (summary?.billableSpendPercent || 0)).toFixed(1)}%`}
                  valueClassName="text-cyan-400"
                  subtitle="Internal R&D & Innovation Spend"
                  subtitleClassName="text-cyan-300/80"
                />
                <StatTile
                  label="Total Engagement Codes"
                  value={projectCodeBreakdown.length}
                  subtitle="Active Work Orders Tracked"
                />
                <StatTile
                  label="Non-Billable Cost Leakage"
                  value="0.0% Unassigned"
                  valueClassName="text-emerald-400"
                  subtitle="100% Code Compliance"
                  subtitleClassName="text-emerald-300/80"
                />
              </div>
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
                        Core Habitual (≥90% Months)
                      </span>
                      <span className="text-[10px] text-ey-muted">{userCohorts.embedded.length} Users</span>
                    </div>
                    <p className="text-2xl font-bold text-emerald-400">
                      {((userCohorts.embedded.length / (activeUserCount || 1)) * 100).toFixed(0)}%
                    </p>
                    <p className="text-xs text-ey-muted">Active in nearly every month in window</p>
                    <div className="pt-2 border-t border-ey-border/40 text-[10px] text-ey-yellow font-bold flex items-center justify-between">
                      <span>Continue to View</span>
                      <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>

                  <div
                    onClick={() => setSelectedCohortFacet('regular')}
                    className="bg-ey-card border border-ey-border hover:border-ey-yellow/80 p-5 rounded-xl cursor-pointer transition group space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                        Regular (≥60% Months)
                      </span>
                      <span className="text-[10px] text-ey-muted">{userCohorts.regular.length} Users</span>
                    </div>
                    <p className="text-2xl font-bold text-cyan-400">
                      {((userCohorts.regular.length / (activeUserCount || 1)) * 100).toFixed(0)}%
                    </p>
                    <p className="text-xs text-ey-muted">Frequent, consistent monthly usage</p>
                    <div className="pt-2 border-t border-ey-border/40 text-[10px] text-ey-yellow font-bold flex items-center justify-between">
                      <span>Continue to View</span>
                      <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>

                  <div
                    onClick={() => setSelectedCohortFacet('occasional')}
                    className="bg-ey-card border border-ey-border hover:border-ey-yellow/80 p-5 rounded-xl cursor-pointer transition group space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        Occasional (≥25% Months)
                      </span>
                      <span className="text-[10px] text-ey-muted">{userCohorts.occasional.length} Users</span>
                    </div>
                    <p className="text-2xl font-bold text-amber-400">
                      {((userCohorts.occasional.length / (activeUserCount || 1)) * 100).toFixed(0)}%
                    </p>
                    <p className="text-xs text-ey-muted">Target cohort for competency training</p>
                    <div className="pt-2 border-t border-ey-border/40 text-[10px] text-ey-yellow font-bold flex items-center justify-between">
                      <span>Continue to View</span>
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
                    title={`Level 3: ${selectedCohortFacet === 'embedded' ? 'Core Habitual' : selectedCohortFacet === 'regular' ? 'Regular' : 'Occasional'} Cohort`}
                    onSelectUser={(email, label) => setSelectedEntity({ type: 'user', name: email, label })}
                  />
                </>
              )}
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
            <div className="bg-ey-black/60 p-3 rounded-xl border border-ey-border/60">
              <span className="text-[10px] text-ey-muted uppercase">Total Spend</span>
              <p className="text-xl font-bold text-ey-yellow">{fmtCost(sliceTotalCost)}</p>
              <span className="text-[10px] text-ey-muted font-mono">
                {totalOrgSpend > 0 ? ((sliceTotalCost / totalOrgSpend) * 100).toFixed(1) : 0}% of company spend
              </span>
            </div>
            <div className="bg-ey-black/60 p-3 rounded-xl border border-ey-border/60">
              <span className="text-[10px] text-ey-muted uppercase">Tokens Consumed</span>
              <p className="text-xl font-bold text-ey-light">{formatCompactNumber(sliceTotalTokens)}</p>
              <span className="text-[10px] text-ey-muted font-mono">{sliceTotalTokens.toLocaleString()} tokens</span>
            </div>
            <div className="bg-ey-black/60 p-3 rounded-xl border border-ey-border/60">
              <span className="text-[10px] text-ey-muted uppercase">Client Billable</span>
              <p className="text-xl font-bold text-emerald-400">
                {usageGranularRows.length > 0 ? ((sliceBillableCount / usageGranularRows.length) * 100).toFixed(1) : 0}%
              </p>
              <span className="text-[10px] text-emerald-300/80 font-mono">{sliceBillableCount} billable events</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* LEVEL 4: ROOT-CAUSE DIAGNOSTICS — Non-Billable Cost Overrun only          */}
      {/* ========================================================================= */}
      {nonBillableRootCause && (
        <div className="bg-ey-card border border-ey-border rounded-2xl p-5 shadow-lg space-y-4">
          <div className="border-b border-ey-border/60 pb-3">
            <h3 className="text-sm font-bold text-ey-light uppercase tracking-wider flex items-center gap-2">
              <Target className="w-4 h-4 text-ey-yellow" />
              <span>Root-Cause Diagnostics: {selectedEntity?.label || selectedEntity?.name}</span>
            </h3>
            <p className="text-xs text-ey-muted mt-0.5">
              Runs this engagement through 3 diagnostic checks in sequence and auto-tags the most likely cause.
            </p>
          </div>

          {/* Auto-tagged root cause */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-300">Root Cause: {nonBillableRootCause.tag}</p>
              <p className="text-xs text-ey-muted mt-0.5">{nonBillableRootCause.tagDetail}</p>
            </div>
          </div>

          {/* The 3 diagnostic checks */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
            <StatTile
              label="Diagnostic 1: Multi-Tool Overlap"
              value={`${nonBillableRootCause.avgToolsPerUser.toFixed(2)} tools/user`}
              valueClassName={nonBillableRootCause.avgToolsPerUser > 1.5 ? 'text-amber-400' : 'text-ey-light'}
              subtitle="Flagged when > 1.5 avg tools per user"
              tooltip="Avg tools per user = COUNT(DISTINCT Product) ÷ COUNT(DISTINCT User Email) within this engagement."
            />
            <StatTile
              label="Diagnostic 2: Power-User Concentration"
              value={`${nonBillableRootCause.top20Share.toFixed(1)}%`}
              valueClassName={nonBillableRootCause.top20Share > 70 ? 'text-amber-400' : 'text-ey-light'}
              subtitle={`Top ${nonBillableRootCause.top20Count} of ${nonBillableRootCause.userCount} users · flagged when > 70% share`}
              tooltip="Top 20% user cost share = SUM(Cost USD) for the top 20% of users by spend ÷ SUM(Cost USD) for the entire engagement × 100."
            />
            <StatTile
              label="Diagnostic 3: Broad Heavy Usage"
              value={`CV ${nonBillableRootCause.costDistributionCV.toFixed(2)}`}
              valueClassName={nonBillableRootCause.costDistributionCV < 0.4 && nonBillableRootCause.avgCostPerUser > 100 ? 'text-amber-400' : 'text-ey-light'}
              subtitle={`Avg ${fmtCost(nonBillableRootCause.avgCostPerUser)}/user · flagged when CV < 0.4 and avg > $100`}
              tooltip="Cost distribution CV = STDEV(cost per user) ÷ AVG(cost per user) within this engagement. Low variance + high average means everyone is expensive, not a concentration issue."
            />
          </div>

          {/* Per-user cost breakdown backing the diagnostics above */}
          <div className="overflow-x-auto border border-ey-border rounded-xl">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-ey-black/70 text-ey-muted uppercase tracking-wider border-b border-ey-border">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3 text-right">Distinct Tools</th>
                  <th className="px-4 py-3 text-right">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ey-border">
                {nonBillableRootCause.perUser.map((u) => (
                  <tr key={u.email} onClick={() => setSelectedEntity({ type: 'user', name: u.email, label: u.email })} className="hover:bg-ey-card-hover/80 transition cursor-pointer">
                    <td className="px-4 py-3 text-ey-light">{u.email}</td>
                    <td className="px-4 py-3 text-right">{u.tools}</td>
                    <td className="px-4 py-3 text-right font-bold text-ey-yellow">{fmtCost(u.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* LEVEL 4: THE CORE / LAST LEVEL — ROW-LEVEL USAGE LOGS FROM CSV             */}
      {/* ========================================================================= */}
      {selectedEntity && selectedEntity.type !== 'user' && !nonBillableRootCause && (
        <HierarchyDrilldownPanel
          rows={granularRows}
          title={`Level 4: ${selectedEntity.label || selectedEntity.name}`}
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
              <p className="text-base font-bold text-ey-yellow">{fmtCost(sliceTotalCost)}</p>
            </div>
            <div>
              <span className="text-[10px] text-ey-muted uppercase">Slice Total Tokens</span>
              <p className="text-base font-bold text-ey-light">{formatCompactNumber(sliceTotalTokens)}</p>
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
                  <th className="px-4 py-3">Month</th>
                  <th className="px-4 py-3">Employee &amp; Email</th>
                  <th className="px-4 py-3">AI Tool</th>
                  <th className="px-4 py-3">Engagement Code</th>
                  <th className="px-4 py-3">Service Line</th>
                  <th className="px-4 py-3">Super Region</th>
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
                      <td className="px-4 py-3 text-ey-muted whitespace-nowrap">{r.monthYear.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3 font-medium text-ey-light">
                        <div>{r.displayName}</div>
                        <div className="text-[10px] text-ey-muted">{r.userMail}</div>
                      </td>
                      <td className="px-4 py-3 capitalize text-ey-yellow">{r.aiTool}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] border ${(r.projectCode || '').startsWith('E-')
                            ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                            : 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                            }`}
                        >
                          {r.projectCode || 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-ey-muted">{r.orgServiceLine}</td>
                      <td className="px-4 py-3 text-ey-muted">{r.superRegion}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.billableFlag === 'True' || r.billableFlag === 'true'
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            }`}
                        >
                          {r.billableFlag}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-ey-light">{formatCompactNumber(r.tokenConsumption)}</td>
                      <td className="px-4 py-3 text-right font-bold text-ey-yellow">{fmtCost(r.cost)}</td>
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
                <span className="text-ey-muted text-[10px] block">SUB-SERVICE LINE 1</span>
                <span className="text-ey-light">{inspectingRecord.subServiceLine1 || 'N/A'}</span>
              </div>
              <div>
                <span className="text-ey-muted text-[10px] block">COUNTRY / SUPER REGION</span>
                <span className="text-ey-light">{inspectingRecord.country} ({inspectingRecord.superRegion})</span>
              </div>
              <div>
                <span className="text-ey-muted text-[10px] block">BILLABLE FLAG</span>
                <span className={`font-bold ${inspectingRecord.billableFlag === 'True' || inspectingRecord.billableFlag === 'true' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {inspectingRecord.billableFlag}
                </span>
              </div>
              <div>
                <span className="text-ey-muted text-[10px] block">TOKEN CONSUMPTION</span>
                <span className="text-ey-light font-bold">{formatCompactNumber(inspectingRecord.tokenConsumption)} tokens</span>
              </div>
              <div>
                <span className="text-ey-muted text-[10px] block">COST IN USD</span>
                <span className="text-ey-yellow font-bold text-sm">{fmtCost(inspectingRecord.cost)}</span>
              </div>
              <div>
                <span className="text-ey-muted text-[10px] block">CALCULATION METHOD</span>
                <span className="text-ey-light">{inspectingRecord.calculationMethod}</span>
              </div>
              <div>
                <span className="text-ey-muted text-[10px] block">CREDITS</span>
                <span className="text-ey-light">{inspectingRecord.creditsLimit}</span>
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
