'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  BookOpen,
  Search,
  Users,
  DollarSign,
  Copy,
  Check,
  Calculator,
  Database,
  ArrowRight,
  Zap,
  Building2,
  FileText,
  PieChart,
  Globe2,
  Bot,
  Wallet,
  FileSpreadsheet,
} from 'lucide-react';

// Derivation Data Item Interface
interface MetricDerivationItem {
  name: string;
  csvField: string;
  formula: string;
  sampleInput: string;
  workedCalculation: string;
  derivedOutput: string;
  notes: string;
  category: string;
}

// Ordered to match the raw ai_usage_data.csv column order exactly (see COL in
// src/lib/data/csvLoader.ts). Data is monthly-grained — there is no day-level
// Activity Date. Each (user, tool, month) can have a Calculation Method =
// 'License' row (flat seat fee, present every month regardless of usage)
// and/or a 'Usage' row (metered consumption/cost, present only when active).
const CSV_SCHEMA = [
  { column: 'User Email', fieldName: 'userMail', description: 'Developer email identifier (e.g. aditya.malik@enterprise-corp.com)', dataType: 'String' },
  { column: 'User Name', fieldName: 'displayName', description: 'Developer display name (e.g. Aditya Malik)', dataType: 'String' },
  { column: 'Year', fieldName: 'year', description: 'Calendar year of the row (e.g. 2026)', dataType: 'Numeric' },
  { column: 'Month', fieldName: 'month', description: 'Calendar month 1-12, or a month name (e.g. "March") — combined with Year to derive monthYear/monthId', dataType: 'Numeric' },
  { column: 'Product', fieldName: 'aiTool', description: 'AI Tool identity (e.g. github, chatgpt, claude, replit, factory, cursor)', dataType: 'String' },
  { column: 'Calculation Method', fieldName: 'calculationMethod', description: '"License" (flat seat fee, one row per held tool per month, tokenConsumption always 0) or "Usage" (metered consumption/cost, present only for active months)', dataType: 'String' },
  { column: 'GenAI Tool Consumption', fieldName: 'tokenConsumption', description: 'Metered consumption units for the month (0 on License rows) — the new unit of AI usage, replacing raw token counts', dataType: 'Numeric' },
  { column: 'Credits', fieldName: 'creditsLimit', description: 'Dollar-denominated free-tier credit actually applied this row — null, 0, or negative. Fully covers Cost USD while under the tool\'s free-dollar limit (Credits = -Cost USD), then pins at that limit once Cost USD exceeds it. The limit itself is derived per tool as max(|Credits|) across a tool\'s Usage rows — see Capacity Waste/Overage below', dataType: 'Numeric ($)' },
  { column: 'Cost USD', fieldName: 'costUsd', description: 'Gross metered cost before the Credits adjustment — Cost (in $) = Cost USD + Credits always holds exactly', dataType: 'Numeric ($)' },
  { column: 'Cost (in $)', fieldName: 'cost', description: 'Direct monetary amount in USD ($) for the row — a License row\'s flat seat fee, or a Usage row\'s net metered cost (Cost USD + Credits), depending on Calculation Method', dataType: 'Numeric ($)' },
  { column: 'CT/Non-CT', fieldName: 'ctNonCt', description: 'Chargeable Time flag distinguishing CT (client-chargeable) from Non-CT work — hierarchy level 1', dataType: 'String' },
  { column: 'Country', fieldName: 'country', description: 'Country location of user — hierarchy level 2', dataType: 'String' },
  { column: 'Super Region', fieldName: 'superRegion', description: 'Single regional grouping (e.g. Americas, EMEIA, Asia-Pacific) — replaces the old Region + Management Region pair', dataType: 'String' },
  { column: 'Service Line', fieldName: 'orgServiceLine', description: 'Internal delivery Service Line (e.g. Tax, Assurance, S&T, CBS, Consulting) — hierarchy level 3', dataType: 'String' },
  { column: 'Sub-Service Line 1', fieldName: 'subServiceLine1', description: 'First-level delivery sub-practice classification, derived from Service Line — hierarchy level 4; replaces the old Org Sub Service Line', dataType: 'String' },
  { column: 'Sub-Service Line 2', fieldName: 'subServiceLine2', description: 'Second-level delivery sub-practice classification, derived from Sub-Service Line 1 — hierarchy level 5', dataType: 'String' },
  { column: 'Engagement Code', fieldName: 'projectCode', description: 'Billing engagement code — E-XXXXXX for external/billable, I-XXXXXX for internal/non-billable. This prefix convention is the sole source of Billable/Non-Billable and ProjectType, both now derived rather than separate columns — hierarchy level 6', dataType: 'String' },
  { column: 'Engagement - Super Region', fieldName: 'engagementSuperRegion', description: 'Client engagement-side region grouping (e.g. EMEIA, Asia-Pacific, Americas) — hierarchy level 7', dataType: 'String' },
  { column: 'Engagement Service Line', fieldName: 'engagementServiceLine', description: 'Client engagement-side Global Service Line, derived from Engagement Super Region — hierarchy level 8', dataType: 'String' },
  { column: 'Engagement Sub-Service Line', fieldName: 'engagementSubServiceLine', description: 'Client engagement-side sub-practice, derived from Engagement Service Line — hierarchy level 9', dataType: 'String' },
  { column: 'Engagement Competency', fieldName: 'engagementCompetency', description: 'Skill/competency classification, derived from Engagement Sub-Service Line — hierarchy level 10 (leaf)', dataType: 'String' },
  { column: 'Engagement Invest Type', fieldName: 'engagementInvestType', description: 'Investment type classification — parsed and retained but not used in any insight', dataType: 'String (passthrough)' },
  { column: 'GDS Location', fieldName: 'gdsLocation', description: 'Global Delivery Services location fulfilling the work, or "Onshore" if not GDS-delivered — independent of the hierarchy chain', dataType: 'String' },
  { column: 'Cost Center', fieldName: 'costCenter', description: 'Internal accounting cost center code (e.g. CC-TAX-647) — independent of the hierarchy chain', dataType: 'String' },
  { column: 'Portfolio - CT Product Family', fieldName: 'portfolioCtProductFamily', description: 'Parsed and retained but not used in any insight', dataType: 'String (passthrough)' },
  { column: 'Portfolio - CT Product', fieldName: 'portfolioCtProduct', description: 'Parsed and retained but not used in any insight', dataType: 'String (passthrough)' },
  { column: 'Entity', fieldName: 'entity', description: 'Parsed and retained but not used in any insight', dataType: 'String (passthrough)' },
  { column: 'SL/SF', fieldName: 'slSf', description: 'Parsed and retained but not used in any insight', dataType: 'String (passthrough)' },
  { column: 'RS', fieldName: 'rs', description: 'Parsed and retained but not used in any insight', dataType: 'String (passthrough)' },
  { column: 'GDS', fieldName: 'gds', description: 'Parsed and retained but not used in any insight', dataType: 'String (passthrough)' },
  { column: '— (derived from Year + Month)', fieldName: 'monthYear / monthId', description: 'monthYear is a human-readable label (e.g. "March_2026") for chart axes; monthId is a sortable numeric key (e.g. 202603) used for date-range filtering and ordering — there is no day-level Activity Date in this schema', dataType: 'Derived' },
  { column: '— (derived from Engagement Code)', fieldName: 'billableFlag / projectType', description: 'billableFlag ("True"/"False") and projectType ("External"/"Internal") are derived from the Engagement Code prefix: E-XXXXXX → billable/External, I-XXXXXX → non-billable/Internal', dataType: 'Derived' },
];

const FORMULA_CATEGORIES = [
  {
    title: 'Core AI Consumption & Utilization Formulas',
    icon: Zap,
    color: 'text-ey-yellow',
    formulas: [
      { name: 'Total GenAI Tool Consumption', formula: 'Total Consumption = ∑ (tokenConsumption) over Usage rows only', example: '18,500 + 32,000 + 15,200 = 65,700 units' },
      { name: 'Billable Utilization Rate (%)', formula: 'Utilization % = (Consumption on billable/E- rows / Total Consumption) × 100', example: '(51,200 / 65,700) × 100 = 77.9%' },
    ],
  },
  {
    title: 'Financial & Capacity Waste Formulas',
    icon: DollarSign,
    color: 'text-emerald-400',
    formulas: [
      { name: 'Total AI Investment ($)', formula: 'Total Spend = ∑ (cost) over Usage rows only', example: '$18.68 + $48.96 + $16.72 = $84.36' },
      { name: 'Cost per Active User ($ / user)', formula: 'Cost per User = Total Spend / Unique Active Users', example: '$1,750.00 / 70 Users = $25.00 / user' },
      { name: 'Per-Tool Free-Dollar Limit', formula: 'Limit(tool) = max(|Credits|) across that tool\'s Usage rows', example: 'GitHub Copilot: largest Credits ever applied is -70.00 → $70.00 free limit' },
      { name: 'Capacity Waste ($)', formula: 'Waste = ∑ max(0, Limit(tool) - costUsd), per Usage row, summed', example: '$70.00 limit - $42.31 gross cost = $27.69 wasted that month' },
      { name: 'Overage Cost ($)', formula: 'Overage = ∑ max(0, costUsd - Limit(tool)), per Usage row, summed', example: '$70.08 gross cost - $70.00 limit = $0.08 overage that month' },
      { name: 'Hard Ceiling (dynamic)', formula: 'Ceiling = 3 × average per-user free-dollar limit (summed across held tools) in the current period', example: 'avg $2.67/user × 3 = $8.00 ceiling (placeholder pending real-data guidance)' },
    ],
  },
  {
    title: 'Project Telemetry & Billability Formulas',
    icon: Building2,
    color: 'text-cyan-400',
    formulas: [
      { name: 'Billable AI Spend Share (%)', formula: 'Billable Spend % = (Billable Spend / Total Spend) × 100', example: '($1,372.40 / $1,750.00) × 100 = 78.4%' },
      { name: 'Engagement Code Consumption Ranking', formula: 'Engagement Cost = ∑ (cost) grouped by Engagement Code', example: 'E-301461: 325,000 units | $48.20' },
    ],
  },
  {
    title: 'License ROI & Adoption Formulas',
    icon: Wallet,
    color: 'text-sky-400',
    formulas: [
      { name: 'License Investment ROI (%)', formula: 'License ROI % = (Total Usage Cost / Total License Cost) × 100', example: '($1,376.51 / $2,177.61) × 100 = 63.2%' },
      { name: 'License Cost (per user, per tool)', formula: 'License Cost = ∑ (cost) where calculationMethod = "License", grouped by user + tool', example: '3 License rows @ $35.00/mo = $105.00' },
      { name: 'License Underutilized Spend ($)', formula: 'Underutilized = ∑ max(0, licenseCost - actualUsageCost) per seat', example: '$105.00 license − $56.04 actual = $48.96 unconsumed' },
      { name: 'Monthly Spend Trend ($)', formula: 'Monthly Cost = ∑ (cost) grouped by monthId, sorted ascending', example: 'June_2026: $182.75 | August_2026: $277.58' },
      { name: 'Habitual Retention Cohort', formula: 'Active Month Ratio = distinct(monthId with activity) / distinct(monthId in window), per user', example: '4 active months ÷ 6-month window = 0.67 → Regular (≥0.6)' },
    ],
  },
];

const METRICS_DERIVATION_LIST: MetricDerivationItem[] = [
  {
    name: 'Total GenAI Tool Consumption',
    csvField: 'tokenConsumption (Calculation Method = "Usage" rows only)',
    formula: 'Sum of tokenConsumption across Usage rows matching filters',
    sampleInput: 'tokenConsumption array: [18500, 32000, 15200]',
    workedCalculation: '18,500 + 32,000 + 15,200',
    derivedOutput: '65,700 units',
    notes: 'License rows always carry tokenConsumption = 0 by design and are excluded — only metered Usage rows count toward consumption',
    category: 'Tokens',
  },
  {
    name: 'Billable Consumption (units)',
    csvField: 'tokenConsumption filtered by billableFlag',
    formula: 'Sum of tokenConsumption where billableFlag == "True"',
    sampleInput: 'billable rows: [18500, 32000], non-billable rows: [15200]',
    workedCalculation: '18,500 + 32,000',
    derivedOutput: '50,500 units',
    notes: 'billableFlag is derived from the Engagement Code prefix (E-XXXXXX = billable, I-XXXXXX = non-billable) — there is no separate billability column in the source data',
    category: 'Tokens',
  },
  {
    name: 'Total AI Investment ($)',
    csvField: 'cost (Calculation Method = "Usage" rows only)',
    formula: 'Sum of cost across Usage rows matching filters',
    sampleInput: 'cost array: [$18.68, $48.96, $16.72]',
    workedCalculation: '$18.68 + $48.96 + $16.72',
    derivedOutput: '$84.36',
    notes: 'License row costs are tracked separately as License Cost, not blended into this figure',
    category: 'Cost',
  },
  {
    name: 'Billable Utilization Rate (%)',
    csvField: 'tokenConsumption filtered by billableFlag (derived from Engagement Code)',
    formula: '(Consumption on billable/E- rows / Total Consumption) × 100',
    sampleInput: 'Billable = 50,500, Total = 65,700',
    workedCalculation: '(50,500 ÷ 65,700) × 100',
    derivedOutput: '76.9%',
    notes: 'Redefined for the new schema: since there is no separate "billable tokens" column, this splits total consumption by the Engagement Code E-/I- prefix instead',
    category: 'Tokens',
  },
  {
    name: 'Cost per 1K Consumption Units',
    csvField: 'cost ÷ (tokenConsumption / 1000)',
    formula: 'Total Cost / (Total Consumption / 1000)',
    sampleInput: 'Total Cost = $84.36, Total Consumption = 65,700',
    workedCalculation: '$84.36 ÷ 65.7',
    derivedOutput: '$1.2840 / 1k units',
    notes: 'Effective blended rate per thousand consumption units across all tools in the filtered set',
    category: 'Cost',
  },
  {
    name: 'Average Monthly Cost ($ / month)',
    csvField: 'cost ÷ count(distinct monthId)',
    formula: 'Total Cost / Count of Unique Months',
    sampleInput: 'Total Cost = $507.00, Unique Months = 6',
    workedCalculation: '$507.00 ÷ 6',
    derivedOutput: '$84.50 / month',
    notes: 'This schema is monthly-grained only — there is no day-level Activity Date, so spend is averaged per distinct month rather than per calendar day',
    category: 'Cost',
  },
  {
    name: 'Tool Spend Breakdown',
    csvField: 'group_by(aiTool) -> sum(cost)',
    formula: 'Sum of cost grouped by AI Tool Flag',
    sampleInput: 'copilot rows = [$0.3474, $0.1998], chatgpt rows = [$0.4627]',
    workedCalculation: 'copilot: $0.5472 | chatgpt: $0.4627',
    derivedOutput: 'copilot ($0.5472) vs chatgpt ($0.4627)',
    notes: 'Distribution of spend across all six AI platforms: Copilot, ChatGPT, Claude, Replit, Factory AI, Cursor AI',
    category: 'Breakdowns',
  },
  {
    name: 'Service Line Token Distribution',
    csvField: 'group_by(orgServiceLine) -> sum(token_consumption)',
    formula: 'Sum of token_consumption grouped by Service Line',
    sampleInput: 'Tax = 102,889, Assurance = 186,020, CBS = 145,000',
    workedCalculation: 'Tax: 102,889 | Assurance: 186,020 | CBS: 145,000',
    derivedOutput: 'Service line totals',
    notes: 'Organizational usage distribution across Service Lines (Tax, Assurance, S&T, CBS, Consulting)',
    category: 'Breakdowns',
  },
  {
    name: 'Billable AI Spend Share (%)',
    csvField: 'group_by(billableFlag) -> sum(cost)',
    formula: '(Sum of cost where billableFlag == True / Total Cost) × 100',
    sampleInput: 'Billable Spend = $1,372.40, Total Cost = $1,750.00',
    workedCalculation: '($1,372.40 ÷ $1,750.00) × 100',
    derivedOutput: '78.4% Billable',
    notes: 'Measures proportion of AI investment tied directly to billable client work',
    category: 'Projects',
  },
  {
    name: 'Engagement Code Spend & Token Rankings',
    csvField: 'group_by(projectCode) -> sum(token_consumption), sum(cost)',
    formula: 'Aggregate token consumption and cost per unique Engagement Code',
    sampleInput: 'Engagement Code: E-301461',
    workedCalculation: 'Tokens: 325,000 | Cost: $48.20 | Users: 4',
    derivedOutput: 'Ranked engagement code list',
    notes: 'Ranks all engagement codes by AI consumption, billable and non-billable alike',
    category: 'Projects',
  },
  {
    name: 'User Spend & Token Ranking',
    csvField: 'group_by(userMail) -> sum(token_consumption), sum(cost)',
    formula: 'Sum of tokens and cost per userMail',
    sampleInput: 'userMail: aditya.malik@enterprise-corp.com',
    workedCalculation: 'Tokens: 257,880 | Cost: $3.9620',
    derivedOutput: 'Ranked user list',
    notes: 'Ranks all enterprise users in the dataset by total token consumption and spend',
    category: 'Breakdowns',
  },
  {
    name: 'License Investment ROI (%)',
    csvField: 'cost where calculationMethod = "License"',
    formula: '(Total Usage Cost / Total License Cost) × 100',
    sampleInput: 'Total Usage Cost = $1,376.51, Total License Cost = $2,177.61',
    workedCalculation: '$1,376.51 ÷ $2,177.61 × 100',
    derivedOutput: '63.2% License ROI',
    notes: 'Total License Cost is now summed directly from each user\'s actual Calculation Method = "License" row costs per distinct tool, rather than a fixed per-tool constant',
    category: 'License & Adoption',
  },
  {
    name: 'License Underutilized / Overutilized Spend ($)',
    csvField: 'licenseCost (summed from License rows) vs actualUsageCost, per user seat',
    formula: 'Underutilized = ∑ max(0, licenseCost − actualUsageCost); Overutilized = ∑ max(0, actualUsageCost − licenseCost)',
    sampleInput: 'Seat A: licenseCost $105.00 (3 License rows), actualUsageCost $56.04',
    workedCalculation: '$105.00 − $56.04 = $48.96 unconsumed',
    derivedOutput: '$904.65 total unconsumed across all seats',
    notes: 'A seat can be simultaneously "under license ROI" and "over its Credits limit" — the two waste metrics measure different baselines (License Cost vs Credits)',
    category: 'License & Adoption',
  },
  {
    name: 'Monthly Spend & Consumption Trend',
    csvField: 'group_by(monthId) -> sum(cost), sum(tokenConsumption), Usage rows only',
    formula: 'Aggregate cost and consumption per monthId, sorted ascending, split further by AI Tool',
    sampleInput: 'monthYear: March_2026 through August_2026',
    workedCalculation: 'March: $302.62 | June: $182.75 | August: $277.58',
    derivedOutput: 'Monthly Cost Trend chart, Monthly Spend by AI Tool chart',
    notes: 'Powers the ROI page monthly trend charts',
    category: 'License & Adoption',
  },
  {
    name: 'Pareto Cost Concentration (Top 10% / 20%)',
    csvField: 'userCapacityBreakdown, sorted by actualCost desc',
    formula: 'Top N% Share = (∑ actualCost of top N% users / Total Cost) × 100',
    sampleInput: '70 active users sorted by spend, Total Cost = $1,376.51',
    workedCalculation: 'Top 14 users (20%): $951.78 ÷ $1,376.51 × 100',
    derivedOutput: '69.1% of spend from top 20% of users',
    notes: 'Identifies concentration risk — whether cost is broadly distributed or driven by a small set of power users',
    category: 'License & Adoption',
  },
  {
    name: 'Habitual User Retention Cohorts',
    csvField: 'monthId grouped by userMail (Usage rows)',
    formula: 'Active Month Ratio = count(distinct monthId with usage) / count(distinct monthId in the filtered window), per user; bucketed Embedded (≥0.9), Regular (≥0.6), Occasional (≥0.25), Dropout (<0.25)',
    sampleInput: 'User active in 4 of 6 distinct monthId values in the current window',
    workedCalculation: '4 ÷ 6 = 0.67 active month ratio',
    derivedOutput: 'Regular cohort (≥0.6 threshold)',
    notes: 'Redesigned for the new schema: since there is no day-level Activity Date, "habitual" is now measured as the share of months in the filtered window a user was active in, rather than active days per month',
    category: 'License & Adoption',
  },
];

export default function MetricsDerivationPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedFormula, setCopiedFormula] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = ['All', 'Tokens', 'Cost', 'Projects', 'Breakdowns', 'License & Adoption'];

  const filteredMetrics = METRICS_DERIVATION_LIST.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.csvField.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.formula.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.notes.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFormula(text);
    setTimeout(() => setCopiedFormula(null), 2000);
  };

  const handleExportSchemaToExcel = () => {
    const worksheetData = CSV_SCHEMA.map((row) => ({
      'CSV Column Name': row.column,
      'Internal Field': row.fieldName,
      'Data Type': row.dataType,
      'Description & Usage': row.description,
    }));
    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    worksheet['!cols'] = [{ wch: 26 }, { wch: 22 }, { wch: 12 }, { wch: 90 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'CSV Schema');
    XLSX.writeFile(workbook, 'ai_usage_data_schema.xlsx');
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto text-ey-light">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-ey-card via-ey-card to-ey-black p-6 rounded-2xl border border-ey-border shadow-xl space-y-3 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <BookOpen className="w-48 h-48 text-ey-yellow" />
        </div>
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-ey-yellow/20 border border-ey-yellow/40 rounded-xl text-ey-yellow">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-ey-light">
              GitHub Copilot Metrics Derivation Guide
            </h1>
            <p className="text-xs text-ey-muted mt-0.5">
              Complete catalog of exact formulas, CSV input field mappings, and step-by-step worked calculations for all metrics
            </p>
          </div>
        </div>

        {/* Quick Data Badges */}
        <div className="flex flex-wrap gap-2 pt-2">
          <span className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-ey-black/60 border border-ey-border text-ey-yellow flex items-center gap-1.5">
            <Database className="w-3 h-3" /> Input Dataset: ai_usage_data.csv (monthly-grained)
          </span>
          <span className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-ey-black/60 border border-ey-border text-cyan-400">
            Consumption Field: GenAI Tool Consumption (Usage rows only)
          </span>
          <span className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-ey-black/60 border border-ey-border text-emerald-400">
            Cost Field: Cost (in $)
          </span>
        </div>
      </div>

      {/* CSV Input Schema Reference Section */}
      <div className="bg-ey-card border border-ey-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Database className="w-4 h-4 text-ey-yellow" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-ey-light">
              CSV Input Data Schema Mapping (`ai_usage_data.csv`)
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-ey-muted font-mono">{CSV_SCHEMA.length} Columns Mapped • Single Source of Truth</span>
            <button
              onClick={handleExportSchemaToExcel}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-ey-black bg-ey-yellow hover:bg-ey-yellow-hover px-2.5 py-1.5 rounded-lg transition shrink-0"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Export to Excel
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-ey-border/80 text-ey-muted bg-ey-black/40">
                <th className="p-2.5 font-semibold">CSV Column Name</th>
                <th className="p-2.5 font-semibold">Internal Field</th>
                <th className="p-2.5 font-semibold">Data Type</th>
                <th className="p-2.5 font-semibold">Description & Usage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ey-border/40 text-ey-light font-mono text-[11px]">
              {CSV_SCHEMA.map((row) => (
                <tr key={row.fieldName} className="hover:bg-ey-black/30 transition">
                  <td className="p-2.5 text-ey-yellow font-medium">{row.column}</td>
                  <td className="p-2.5 text-cyan-300">{row.fieldName}</td>
                  <td className="p-2.5 text-ey-muted">{row.dataType}</td>
                  <td className="p-2.5 text-ey-muted font-sans text-xs">{row.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Formula Category Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {FORMULA_CATEGORIES.map((cat) => {
          const IconComp = cat.icon;
          return (
            <div key={cat.title} className="bg-ey-card border border-ey-border rounded-xl p-5 space-y-3">
              <div className="flex items-center space-x-2">
                <IconComp className={`w-4 h-4 ${cat.color}`} />
                <h3 className="text-xs font-bold text-ey-light uppercase tracking-wider">{cat.title}</h3>
              </div>
              <div className="space-y-2">
                {cat.formulas.map((f) => (
                  <div key={f.name} className="p-2.5 bg-ey-black/60 rounded-lg border border-ey-border/60 text-xs">
                    <div className="font-semibold text-ey-light mb-1">{f.name}</div>
                    <div className="font-mono text-[11px] text-ey-yellow bg-ey-black p-1.5 rounded border border-ey-border/40 overflow-x-auto">
                      {f.formula}
                    </div>
                    <div className="text-[10px] text-ey-muted mt-1 font-mono">Ex: {f.example}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Catalog Section */}
      <div className="bg-ey-card border border-ey-border rounded-xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-ey-light flex items-center gap-2">
              <Calculator className="w-4 h-4 text-ey-yellow" />
              Detailed Metric Derivation Catalog
            </h2>
            <p className="text-xs text-ey-muted mt-0.5">
              Filter by category or search by CSV field, formula, or metric name
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Category Filter Pills */}
            <div className="flex items-center bg-ey-black/80 p-0.5 rounded-lg border border-ey-border/80">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${
                    selectedCategory === cat
                      ? 'bg-ey-yellow text-ey-black font-bold shadow-sm'
                      : 'text-ey-muted hover:text-ey-light'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-56">
              <Search className="w-3.5 h-3.5 text-ey-muted absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search formulas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-ey-black border border-ey-border text-ey-light text-xs rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:border-ey-yellow"
              />
            </div>
          </div>
        </div>

        {/* Metric Derivation List */}
        <div className="space-y-3">
          {filteredMetrics.length === 0 ? (
            <div className="text-center py-10 text-ey-muted text-xs">
              No metric derivations found matching "{searchTerm}".
            </div>
          ) : (
            filteredMetrics.map((item) => (
              <div
                key={item.name}
                className="bg-ey-black/60 border border-ey-border/80 rounded-xl p-4 space-y-3 hover:border-ey-yellow/40 transition"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-ey-light">{item.name}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-ey-yellow/10 text-ey-yellow border border-ey-yellow/30">
                      {item.category}
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopy(item.formula)}
                    className="flex items-center space-x-1 text-[11px] text-ey-muted hover:text-ey-yellow transition"
                    title="Copy Formula"
                  >
                    {copiedFormula === item.formula ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400 font-semibold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Formula</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-ey-muted uppercase">CSV Input Field</span>
                    <div className="font-mono text-[11px] text-cyan-300 bg-ey-card p-2 rounded border border-ey-border/60">
                      {item.csvField}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-ey-muted uppercase">Mathematical Formula</span>
                    <div className="font-mono text-[11px] text-ey-yellow bg-ey-card p-2 rounded border border-ey-border/60">
                      {item.formula}
                    </div>
                  </div>
                </div>

                {/* Worked Calculation Details */}
                <div className="bg-ey-card/80 p-3 rounded-lg border border-ey-border/60 space-y-2 text-xs">
                  <div className="flex items-center space-x-1.5 text-[11px] font-semibold text-ey-light">
                    <Calculator className="w-3.5 h-3.5 text-ey-yellow" />
                    <span>Worked Calculation Example</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] font-mono">
                    <div>
                      <span className="text-ey-muted block text-[10px]">Sample Input:</span>
                      <span className="text-ey-light">{item.sampleInput}</span>
                    </div>
                    <div>
                      <span className="text-ey-muted block text-[10px]">Calculation:</span>
                      <span className="text-cyan-300">{item.workedCalculation}</span>
                    </div>
                    <div>
                      <span className="text-ey-muted block text-[10px]">Derived Output:</span>
                      <span className="text-emerald-400 font-bold">{item.derivedOutput}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-ey-muted italic border-t border-ey-border/40 pt-1.5 mt-1">
                    Note: {item.notes}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
