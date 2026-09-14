export type ComparisonPeriod = 'doD' | 'woW' | 'moM' | 'rolling7d' | 'rolling28d';

export interface GlobalFilterState {
  startDate: string;
  endDate: string;
  comparisonPeriod: ComparisonPeriod;
  // CSV-derived filter dimensions
  aiTool: string;           // 'all' | 'chatgpt' | 'github' | 'claude' | 'replit' | 'factory' | 'cursor'
  managementRegion: string; // 'all' | 'EMEA' | 'APAC' | 'Americas'
  serviceLine: string;      // 'all' | 'Consulting' | 'Power' | 'Financial Services' | 'Technology'
  userMail: string;         // 'all' or specific user email
  country: string;          // 'all' or specific country
  // Legacy fields kept for compatibility (not used in CSV filtering)
  organization: string;
  team: string;
  user: string;
  repository: string;
  feature: string;
  model: string;
  language: string;
  ide: string;
  agent: string;
}

export interface MetricDelta {
  current: number;
  previous: number;
  absoluteDelta: number;
  percentageDelta: number;
  percentagePointDelta?: number; // populated for rate / % metrics
  trend: 'up' | 'down' | 'neutral';
  isRateMetric?: boolean;
  // False when the computed comparison window falls entirely outside the
  // dataset's real date coverage — a genuine absence of prior data, distinct
  // from a covered period that simply totals to zero.
  previousDataAvailable?: boolean;
}

export interface TimeSeriesPoint {
  date: string;
  value: number;
  previousValue?: number;
  [key: string]: any;
}

export interface MetricResult {
  metricId: string;
  metricName: string;
  summary: MetricDelta;
  series: TimeSeriesPoint[];
}

export interface TokenCostSummary {
  // Totals from CSV fields: GenAI Tool Consumption, Cost (in $) — Usage rows only
  totalTokenConsumption: number;
  totalCost: number;
  // Derived insights
  costPer1kTokens: number;
  costPerActiveUser?: number;
  // % of consumption on billable (Engagement Code E-XXXXXX) rows — there is no
  // separate "billable tokens" field in the new source, so this is derived
  // from the same Engagement Code convention as billableSpendPercent below.
  billableUtilizationRate: number;
  // Previous period (for delta comparisons)
  prevTotalCost: number;
  prevTotalTokenConsumption: number;
  // False when the previous-period window falls entirely outside the
  // dataset's real date coverage (see MetricDelta.previousDataAvailable)
  previousDataAvailable: boolean;
  // Dimension breakdowns
  byAiTool: {
    tool: string;
    tokens: number;
    cost: number;
    userCount: number;
    avgCostPerUser: number;
    costPer1kTokens: number;
    spendSharePercent: number;
    tokenSharePercent: number;
  }[];
  multiToolOverlap?: {
    dualToolUserCount: number;
    totalDualToolSpend: number;
    multiToolUserList: {
      userMail: string;
      displayName?: string;
      tools: string[];
      totalCost: number;
      totalTokens: number;
    }[];
  };
  byCtNonCt: { ctNonCt: string; tokens: number; cost: number; userCount?: number; uniqueMonths?: number }[];
  byManagementRegion: { region: string; tokens: number; cost: number; userCount?: number; countries?: string[] }[];
  byCountry: { country: string; tokens: number; cost: number; userCount?: number; superRegion?: string }[];
  byServiceLine: { serviceLine: string; tokens: number; cost: number; userCount?: number; subServiceLines?: string[] }[];
  bySubServiceLine?: { subServiceLine: string; serviceLine: string; tokens: number; cost: number; userCount: number }[];
  topUsers: { displayName: string; userMail: string; tokens: number; cost: number; aiTools?: string[] }[];
  // Financial ROI Governance & Capacity Waste metrics
  totalWasteCost: number;
  totalOverageCost: number;
  licenseEfficiencyRate: number;
  ceilingRiskCount: number;
  hardCeiling: number;
  userCapacityBreakdown: UserCapacityRow[];
  // License Cost ROI (actual usage cost vs real per-seat License Cost in USD from CSV)
  totalLicenseCost: number;
  licenseRoiPercent: number;
  licenseUnderutilizedCost: number;
  licenseOverutilizedValue: number;
  // Previous period (for delta comparisons on the Zone 1/Zone 2/License ROI KPI cards)
  prevTotalWasteCost: number;
  prevTotalOverageCost: number;
  prevCeilingRiskCount: number;
  prevLicenseRoiPercent: number;
  // Previous-period cost by Service Line / Management Region / Sub-Service
  // Line, and previous distinct sub-practice count — for the Service Line
  // Analytics KPI cards
  prevByServiceLine: { serviceLine: string; cost: number }[];
  prevByManagementRegion: { region: string; cost: number }[];
  prevBySubServiceLine: { serviceLine: string; subServiceLine: string; cost: number }[];
  prevSubServiceLineCount: number;
  // Project & Billability Telemetry Insights
  billableSpend: number;
  nonBillableSpend: number;
  billableSpendPercent: number;
  byProjectCode?: {
    projectCode: string;
    tokens: number;
    cost: number;
    userCount: number;
  }[];
  // Monthly Trend Insights (derived from Month_Year / Month Id CSV columns)
  monthlyTrend: MonthlyTrendPoint[];
  // User Engagement Cohorts (avg distinct active days per active month, per user)
  userEngagementCohorts: {
    embeddedCount: number;
    regularCount: number;
    occasionalCount: number;
    dropoutCount: number;
    totalUsers: number;
    embeddedPercent: number;
    regularPercent: number;
    occasionalPercent: number;
    dropoutPercent: number;
  };
  // Seat Utilization: users with an AI Tool license (a CSV row) split by whether
  // they've used at least 1 token (active) or recorded 0 usage (inactive).
  totalRosterUserCount: number;
  activeUserCount: number;
  inactiveUserCount: number;
}

export interface MonthlyTrendPoint {
  monthId: number;
  monthLabel: string;
  tokens: number;
  cost: number;
  userCount: number;
  costPer1kTokens: number;
  // Dynamic per-AI-tool cost breakdown, e.g. { chatgpt: 12.3, copilot: 4.5, claude: 8.1 }
  [key: string]: number | string;
}

export interface UserCapacityRow {
  userMail: string;
  displayName: string;
  aiTools: string[];
  actualCost: number;
  usageFreeTokenLimit: number;
  usageLimit: number;
  wasteCost: number;
  overageCost: number;
  tokenConsumption: number;
  ceilingPercent: number;
  zone: 'zone1_under' | 'zone2_over' | 'zone_balanced';
  // License Cost ROI (actual usage cost vs real per-seat License Cost in USD from CSV)
  licenseCost: number;
  licenseRoiPercent: number;
  licenseRoiZone: 'underutilized' | 'overutilized' | 'aligned';
}
