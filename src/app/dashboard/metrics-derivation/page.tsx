'use client';

import { useState } from 'react';
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

// Ordered per the required application-wide hierarchy:
// CT/Non-CT -> Country -> Service Line -> Sub-Service Line 1 -> Sub-Service Line 2 ->
// Engagement Code -> Engagement Super Region -> Engagement Service Line ->
// Engagement Sub Service Line -> Engagement Competency. Remaining columns follow.
const CSV_SCHEMA = [
  { column: 'AI Tool Flag', fieldName: 'aiTool', description: 'AI Tool classification flag (e.g. copilot, chatgpt, claude, replit, factoryai, cursor)', dataType: 'String' },
  { column: 'User Mail', fieldName: 'userMail', description: 'Developer email identifier (e.g. aditya.malik@enterprise-corp.com)', dataType: 'String' },
  { column: 'Display Name', fieldName: 'displayName', description: 'Developer display name (e.g. Aditya Malik)', dataType: 'String' },
  { column: 'Activity Date', fieldName: 'activityDate', description: 'Date of usage formatted as YYYY-MM-DD (e.g. 2026-03-09)', dataType: 'Date' },
  { column: 'Token Consumption', fieldName: 'tokenConsumption', description: 'Total raw tokens generated and processed (Prompt + Completion)', dataType: 'Numeric' },
  { column: 'Daily Billable Tokens', fieldName: 'dailyBillableTokens', description: 'Tokens charged toward billable quota', dataType: 'Numeric' },
  { column: 'Cost in USD', fieldName: 'cost', description: 'Direct monetary expenditure incurred in USD ($)', dataType: 'Numeric ($)' },
  { column: 'CT/Non-CT', fieldName: 'ctNonCt', description: 'Chargeable Time flag distinguishing CT (client-chargeable) from Non-CT work — hierarchy level 1', dataType: 'String' },
  { column: 'Country', fieldName: 'country', description: 'Country location of user — hierarchy level 2', dataType: 'String' },
  { column: 'Service Line', fieldName: 'orgServiceLine', description: 'Internal delivery Service Line (e.g. Tax, Assurance, S&T, CBS, Consulting) — hierarchy level 3', dataType: 'String' },
  { column: 'Org Sub Service Line', fieldName: 'orgSubServiceLine', description: 'Internal delivery sub-practice under Service Line (e.g. Reporting, Strategy)', dataType: 'String' },
  { column: 'Sub-Service Line 1', fieldName: 'subServiceLine1', description: 'First-level delivery sub-practice classification, derived from Service Line — hierarchy level 4', dataType: 'String' },
  { column: 'Sub-Service Line 2', fieldName: 'subServiceLine2', description: 'Second-level delivery sub-practice classification, derived from Sub-Service Line 1 — hierarchy level 5', dataType: 'String' },
  { column: 'Engagement Code', fieldName: 'projectCode', description: 'Billing engagement code (E-XXXXXX for external, I-XXXXXX for internal) — formerly labeled ProjectCode; hierarchy level 6', dataType: 'String' },
  { column: 'Engagement Super Region', fieldName: 'engagementSuperRegion', description: 'Client engagement-side region grouping (e.g. EMEIA, Asia-Pacific, Americas) — hierarchy level 7', dataType: 'String' },
  { column: 'Engagement Service Line', fieldName: 'engagementServiceLine', description: 'Client engagement-side Global Service Line, derived from Engagement Super Region — hierarchy level 8', dataType: 'String' },
  { column: 'Engagement Sub Service Line', fieldName: 'engagementSubServiceLine', description: 'Client engagement-side sub-practice, derived from Engagement Service Line — hierarchy level 9', dataType: 'String' },
  { column: 'Engagement Competency', fieldName: 'engagementCompetency', description: 'Skill/competency classification, derived from Engagement Sub Service Line — hierarchy level 10 (leaf)', dataType: 'String' },
  { column: 'Region', fieldName: 'region', description: 'Finer-grained region than Management Region (e.g. ANZ, Middle East, North America)', dataType: 'String' },
  { column: 'Management Region', fieldName: 'managementRegion', description: 'Regional management division (e.g. EMEA, APAC, Americas)', dataType: 'String' },
  { column: 'License Cost in USD', fieldName: 'licenseCost', description: 'Set per AI Tool — Copilot: $35, ChatGPT: $25, Claude: $40, Replit: $50, Factory AI: $10, Cursor AI: $60 flat seat license. Summed per distinct tool a user has — basis for License Investment ROI', dataType: 'Numeric ($)' },
  { column: 'Usage Free Token Limit', fieldName: 'usageFreeTokenLimit', description: 'Set per AI Tool — Copilot: $20 free allowance; ChatGPT: $20 free allowance; Cursor AI: $40 free allowance; Claude/Replit/Factory AI: $0 (fully usage-based). Summed per distinct tool a user has, used for Zone 1/2 Capacity Waste & Overage (distinct from License Cost)', dataType: 'Numeric' },
  { column: 'Billable/Non-Billable', fieldName: 'billableFlag', description: 'Client billability flag, derived from Project Type: True for External (E-XXXXXX) engagements, False for Internal (I-XXXXXX) projects', dataType: 'Boolean' },
  { column: 'ProjectType', fieldName: 'projectType', description: 'Project classification (External for client, Internal for R&D)', dataType: 'String' },
  { column: 'GDS Location', fieldName: 'gdsLocation', description: 'Global Delivery Services location fulfilling the work, or "Onshore" if not GDS-delivered — independent of the hierarchy chain', dataType: 'String' },
  { column: 'Cost Center', fieldName: 'costCenter', description: 'Internal accounting cost center code (e.g. CC-TAX-647) — independent of the hierarchy chain', dataType: 'String' },
  { column: 'Month_Year', fieldName: 'monthYear', description: 'Human-readable calendar month label (e.g. March_2026) — basis for Monthly Trend charts', dataType: 'String' },
  { column: 'Month Id', fieldName: 'monthId', description: 'Sortable numeric month key (e.g. 202603) used to order Monthly Trend series', dataType: 'Numeric' },
];

const FORMULA_CATEGORIES = [
  {
    title: 'Core AI Token & Utilization Formulas',
    icon: Zap,
    color: 'text-ey-yellow',
    formulas: [
      { name: 'Total Token Consumption', formula: 'Total Tokens = ∑ (token_consumption)', example: '32,378 + 31,509 + 39,002 = 102,889 Tokens' },
      { name: 'Total Billable Tokens', formula: 'Billable Tokens = ∑ (daily_billable_tokens)', example: '32,378 + 31,509 + 39,002 = 102,889 Tokens' },
      { name: 'Billable Utilization Rate (%)', formula: 'Utilization % = (Total Billable Tokens / Total Token Consumption) × 100', example: '(102,889 / 102,889) × 100 = 100.0%' },
    ],
  },
  {
    title: 'Financial & Capacity Waste Formulas',
    icon: DollarSign,
    color: 'text-emerald-400',
    formulas: [
      { name: 'Total AI Investment ($)', formula: 'Total Spend = ∑ (cost)', example: '$0.4627 + $0.5055 + $0.6155 = $1.5837' },
      { name: 'Cost per Active User ($ / user)', formula: 'Cost per User = Total Spend / Unique Active Users', example: '$1,750.00 / 70 Users = $25.00 / user' },
      { name: 'Capacity Waste ($)', formula: 'Waste = ∑ max(0, usageFreeTokenLimit - actualCost)', example: 'Copilot user: $20.00 limit - $13.44 cost = $6.56 wasted capacity' },
      { name: 'Overage Cost ($)', formula: 'Overage = ∑ max(0, actualCost - usageFreeTokenLimit)', example: 'ChatGPT user: $35.20 cost - $20.00 limit = $15.20 overage' },
    ],
  },
  {
    title: 'Project Telemetry & Billability Formulas',
    icon: Building2,
    color: 'text-cyan-400',
    formulas: [
      { name: 'Billable AI Spend Share (%)', formula: 'Billable Spend % = (Billable Spend / Total Spend) × 100', example: '($1,372.40 / $1,750.00) × 100 = 78.4%' },
      { name: 'Engagement Code Token Ranking', formula: 'Engagement Cost = ∑ (cost) grouped by Engagement Code', example: 'E-301461: 325,000 tokens | $48.20' },
    ],
  },
  {
    title: 'License ROI & Adoption Formulas',
    icon: Wallet,
    color: 'text-sky-400',
    formulas: [
      { name: 'License Investment ROI (%)', formula: 'License ROI % = (Total Cost / Total License Cost) × 100', example: '($1,376.51 / $2,177.61) × 100 = 63.2%' },
      { name: 'License Underutilized Spend ($)', formula: 'Underutilized = ∑ max(0, licenseCost - actualCost) per seat', example: '$235.31 license − $103.44 actual = $131.87 unconsumed' },
      { name: 'Monthly Spend Trend ($)', formula: 'Monthly Cost = ∑ (cost) grouped by Month Id, sorted ascending', example: 'June_2026: $182.75 | August_2026: $277.58' },
      { name: 'Habitual Retention Cohort', formula: 'Avg Active Days/Month = distinct(activityDate) / distinct(monthId), per user', example: '3 active days ÷ 2 active months = 1.5/mo → Trial-only (<4)' },
    ],
  },
];

const METRICS_DERIVATION_LIST: MetricDerivationItem[] = [
  {
    name: 'Total Token Consumption',
    csvField: 'token_consumption',
    formula: 'Sum of all token_consumption rows matching filters',
    sampleInput: 'token_consumption array: [32378, 31509, 39002]',
    workedCalculation: '32,378 + 31,509 + 39,002',
    derivedOutput: '102,889 Tokens',
    notes: 'Total tokens generated across prompt and completion turns',
    category: 'Tokens',
  },
  {
    name: 'Total Billable Tokens',
    csvField: 'daily_billable_tokens',
    formula: 'Sum of all daily_billable_tokens rows matching filters',
    sampleInput: 'daily_billable_tokens array: [32378, 31509, 39002]',
    workedCalculation: '32,378 + 31,509 + 39,002',
    derivedOutput: '102,889 Tokens',
    notes: 'Tokens counted towards billing allocation',
    category: 'Tokens',
  },
  {
    name: 'Total AI Investment ($)',
    csvField: 'cost',
    formula: 'Sum of all cost rows matching filters',
    sampleInput: 'cost array: [$0.4627, $0.5055, $0.6155]',
    workedCalculation: '$0.4627 + $0.5055 + $0.6155',
    derivedOutput: '$1.5837',
    notes: 'Direct dollar cost in USD recorded in the input CSV',
    category: 'Cost',
  },
  {
    name: 'Billable Utilization Rate (%)',
    csvField: 'daily_billable_tokens ÷ token_consumption',
    formula: '(Total Billable Tokens / Total Token Consumption) × 100',
    sampleInput: 'Billable = 102,889, Total = 102,889',
    workedCalculation: '(102,889 ÷ 102,889) × 100',
    derivedOutput: '100.0%',
    notes: 'Percentage of total tokens that incurred billable usage',
    category: 'Tokens',
  },
  {
    name: 'Cost per 1K Tokens',
    csvField: 'cost ÷ (daily_billable_tokens / 1000)',
    formula: 'Total Cost / (Total Billable Tokens / 1000)',
    sampleInput: 'Total Cost = $1.5837, Billable = 102,889',
    workedCalculation: '$1.5837 ÷ 102.889',
    derivedOutput: '$0.015392 / 1k tokens',
    notes: 'Effective rate per thousand billable tokens',
    category: 'Cost',
  },
  {
    name: 'Average Daily Cost ($ / day)',
    csvField: 'cost ÷ count(distinct activityDate)',
    formula: 'Total Cost / Count of Unique Activity Dates',
    sampleInput: 'Total Cost = $1.5837, Unique Dates = 3',
    workedCalculation: '$1.5837 ÷ 3',
    derivedOutput: '$0.5279 / day',
    notes: 'Average spend per active calendar day',
    category: 'Cost',
  },
  {
    name: 'Tool Spend Breakdown',
    csvField: 'group_by(aiTool) -> sum(cost)',
    formula: 'Sum of cost grouped by AI Tool Flag',
    sampleInput: 'copilot rows = [$0.3474, $0.1998], chatgpt rows = [$0.4627]',
    workedCalculation: 'copilot: $0.5472 | chatgpt: $0.4627',
    derivedOutput: 'copilot ($0.5472) vs chatgpt ($0.4627)',
    notes: 'Distribution between Copilot Chat, Coding Assistant, and other tools',
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
    notes: 'Ranks all 70 enterprise users by total token consumption and spend',
    category: 'Breakdowns',
  },
  {
    name: 'License Investment ROI (%)',
    csvField: 'License Cost in USD',
    formula: '(Total Cost / Total License Cost) × 100',
    sampleInput: 'Total Cost = $1,376.51, Total License Cost = $2,177.61',
    workedCalculation: '$1,376.51 ÷ $2,177.61 × 100',
    derivedOutput: '63.2% License ROI',
    notes: 'Measures actual usage cost against the real per-seat License Cost in USD — independent of the Usage Free Token Limit used for Capacity Waste/Overage above',
    category: 'License & Adoption',
  },
  {
    name: 'License Underutilized / Overutilized Spend ($)',
    csvField: 'licenseCost vs actualCost, per user seat',
    formula: 'Underutilized = ∑ max(0, licenseCost − actualCost); Overutilized = ∑ max(0, actualCost − licenseCost)',
    sampleInput: 'Seat A: licenseCost $235.31, actualCost $103.44',
    workedCalculation: '$235.31 − $103.44 = $131.87 unconsumed',
    derivedOutput: '$904.65 total unconsumed across all seats',
    notes: 'A seat can be simultaneously "under license ROI" and "over its token free-limit" — the two waste metrics measure different baselines',
    category: 'License & Adoption',
  },
  {
    name: 'Monthly Spend & Token Trend',
    csvField: 'group_by(monthId) -> sum(cost), sum(token_consumption)',
    formula: 'Aggregate cost and tokens per Month Id, sorted ascending, split further by AI Tool',
    sampleInput: 'Month_Year: March_2026 through August_2026',
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
    csvField: 'activityDate, monthId grouped by userMail',
    formula: 'Avg Active Days/Month = count(distinct activityDate) / count(distinct monthId), per user; bucketed Embedded (16+), Regular (9-15), Occasional (4-8), Trial-only (<4)',
    sampleInput: 'User with 3 activityDate rows across 2 distinct monthId values',
    workedCalculation: '3 ÷ 2 = 1.5 avg active days/month',
    derivedOutput: 'Trial-only cohort (below 4 days/month threshold)',
    notes: 'Replaces a previously hardcoded "100% retention" claim — now computed per user from the raw filtered rows',
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
            <Database className="w-3 h-3" /> Input Dataset: ai_usage_data.csv
          </span>
          <span className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-ey-black/60 border border-ey-border text-cyan-400">
            Token Fields: token_consumption, daily_billable_tokens
          </span>
          <span className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-ey-black/60 border border-ey-border text-emerald-400">
            Cost Field: Cost in USD ($)
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
          <span className="text-[11px] text-ey-muted font-mono">{CSV_SCHEMA.length} Columns Mapped • Single Source of Truth</span>
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
