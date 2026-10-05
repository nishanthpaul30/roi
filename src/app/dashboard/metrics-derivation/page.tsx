'use client';

import { useState } from 'react';
import {
  BookOpen,
  Search,
  DollarSign,
  Copy,
  Check,
  Calculator,
  Database,
  Zap,
  Building2,
  Wallet,
  TrendingUp,
  Download,
  Clock3,
  Target,
  ChevronsUpDown,
  ChevronsDownUp,
  Layers,
} from 'lucide-react';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';

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
  { column: 'User Email', fieldName: 'userMail', description: 'Developer email identifier (e.g. aditya.malik@enterprise-corp.com) — hierarchy level 6 (leaf); the hierarchy keys on email rather than name because some display names are shared by more than one person', dataType: 'String' },
  { column: 'User Name', fieldName: 'displayName', description: 'Developer display name (e.g. Aditya Malik) — shown as a label only; not unique, so never used as a grouping key', dataType: 'String' },
  { column: 'Year', fieldName: 'fiscalYear', description: 'Fiscal-year label (e.g. "FY26") — not a calendar year, and never used in date math; kept only as a raw passthrough label', dataType: 'String' },
  { column: 'Month', fieldName: 'year / month', description: 'Full date-time in D/M/YYYY order (e.g. "1/6/2026 12:00:00 AM" = June 2026; time-of-day is always midnight and carries no meaning) — the sole source of the calendar year and month used everywhere below, including monthYear/monthId', dataType: 'Date' },
  { column: 'Product', fieldName: 'aiTool', description: 'AI Tool identity (e.g. github, chatgpt, claude, replit, factory, cursor)', dataType: 'String' },
  { column: 'Calculation Method', fieldName: 'calculationMethod', description: '"License" (flat seat fee, one row per held tool per month, tokenConsumption always 0) or "Usage" (metered consumption/cost, present only for active months)', dataType: 'String' },
  { column: 'GenAI Tool Consumption', fieldName: 'tokenConsumption', description: 'Metered consumption units for the month (0 on License rows) — the new unit of AI usage, replacing raw token counts', dataType: 'Numeric' },
  { column: 'Credits', fieldName: 'creditsLimit', description: 'Dollar-denominated free-tier credit actually applied this row — null, 0, or negative. Not used to derive the free-dollar limit (see Per-Tool Free-Dollar Limit below, which is hardcoded per tool rather than read from this column).', dataType: 'Numeric ($)' },
  { column: 'Cost USD', fieldName: 'costUsd', description: 'Gross metered cost before the Credits adjustment — Cost (in $) = Cost USD + Credits always holds exactly', dataType: 'Numeric ($)' },
  { column: 'Cost (in $)', fieldName: 'cost', description: 'Direct monetary amount in USD ($) for the row — a License row\'s flat seat fee, or a Usage row\'s net metered cost (Cost USD + Credits), depending on Calculation Method', dataType: 'Numeric ($)' },
  { column: 'CT/Non-CT', fieldName: 'ctNonCt', description: 'Chargeable Time flag distinguishing CT (client-chargeable) from Non-CT work — hierarchy level 1', dataType: 'String' },
  { column: 'Country', fieldName: 'country', description: 'Country location of user — hierarchy level 2', dataType: 'String' },
  { column: 'Super Region', fieldName: 'superRegion', description: 'Single regional grouping (e.g. Americas, EMEIA, Asia-Pacific) — replaces the old Region + Management Region pair', dataType: 'String' },
  { column: 'Service Line', fieldName: 'orgServiceLine', description: 'Internal delivery Service Line (e.g. Tax, Assurance, S&T, CBS, Consulting) — hierarchy level 3', dataType: 'String' },
  { column: 'Sub-Service Line 1', fieldName: 'subServiceLine1', description: 'First-level delivery sub-practice classification, derived from Service Line — hierarchy level 4; replaces the old Org Sub Service Line', dataType: 'String' },
  { column: 'Sub-Service Line 2', fieldName: 'subServiceLine2', description: 'Second-level delivery sub-practice classification, derived from Sub-Service Line 1 — hierarchy level 5', dataType: 'String' },
  { column: 'Engagement Code', fieldName: 'projectCode', description: 'Billing engagement code — E-XXXXXX for external/billable, I-XXXXXX for internal/non-billable. This prefix convention is the sole source of Billable/Non-Billable and ProjectType, both now derived rather than separate columns — not part of the drilldown hierarchy', dataType: 'String' },
  { column: 'Engagement - Super Region', fieldName: 'engagementSuperRegion', description: 'Client engagement-side region grouping (e.g. EMEIA, Asia-Pacific, Americas) — not part of the drilldown hierarchy', dataType: 'String' },
  { column: 'Engagement Service Line', fieldName: 'engagementServiceLine', description: 'Client engagement-side Global Service Line, derived from Engagement Super Region — not part of the drilldown hierarchy', dataType: 'String' },
  { column: 'Engagement Sub-Service Line', fieldName: 'engagementSubServiceLine', description: 'Client engagement-side sub-practice, derived from Engagement Service Line — not part of the drilldown hierarchy', dataType: 'String' },
  { column: 'Engagement Competency', fieldName: 'engagementCompetency', description: 'Skill/competency classification, derived from Engagement Sub-Service Line — not part of the drilldown hierarchy', dataType: 'String' },
  { column: 'Engagement Invest Type', fieldName: 'engagementInvestType', description: 'Investment type classification — parsed and retained but not used in any insight', dataType: 'String (passthrough)' },
  { column: 'GDS Location', fieldName: 'gdsLocation', description: 'Global Delivery Services location fulfilling the work, or "Onshore" if not GDS-delivered — independent of the hierarchy chain', dataType: 'String' },
  { column: 'Cost Center', fieldName: 'costCenter', description: 'Internal accounting cost center code (e.g. CC-TAX-647) — independent of the hierarchy chain', dataType: 'String' },
  { column: 'Portfolio - CT Product Family', fieldName: 'portfolioCtProductFamily', description: 'Parsed and retained but not used in any insight', dataType: 'String (passthrough)' },
  { column: 'Portfolio - CT Product', fieldName: 'portfolioCtProduct', description: 'Parsed and retained but not used in any insight', dataType: 'String (passthrough)' },
  { column: 'Entity', fieldName: 'entity', description: 'Parsed and retained but not used in any insight', dataType: 'String (passthrough)' },
  { column: 'SL/SF', fieldName: 'slSf', description: 'Parsed and retained but not used in any insight', dataType: 'String (passthrough)' },
  { column: 'RS', fieldName: 'rs', description: 'Parsed and retained but not used in any insight', dataType: 'String (passthrough)' },
  { column: 'GDS', fieldName: 'gds', description: 'Parsed and retained but not used in any insight', dataType: 'String (passthrough)' },
  { column: '— (derived from Month)', fieldName: 'monthYear / monthId', description: 'monthYear is a human-readable label (e.g. "March_2026") for chart axes; monthId is a sortable numeric key (e.g. 202603) used for date-range filtering and ordering — both come from the Month column\'s own date, not from Year', dataType: 'Derived' },
  { column: '— (derived from Engagement Code)', fieldName: 'billableFlag / projectType', description: 'billableFlag ("True"/"False") and projectType ("External"/"Internal") are derived from the Engagement Code prefix: E-XXXXXX → billable/External, I-XXXXXX → non-billable/Internal', dataType: 'Derived' },
];

// A second, separate data source (not metered telemetry): approved-vs-actual
// productivity hours per (Engagement Code, AI Tool), joined onto the dataset
// above rather than merged into it. Columns are matched by HEADER NAME, not
// position, so this schema documents the expected names, not fixed indices.
// Month columns ("jul", "aug", ...) are open-ended -- whatever the source
// file's header row contains -- and are resolved to a real calendar month via
// the current fiscal year (Jul-Jun), not listed as fixed columns here.
const HOURS_SAVED_CSV_SCHEMA = [
  { column: 'Engagement Code', fieldName: 'engagementCode', description: 'Joins to the dataset above\'s projectCode, and ai_usage_data.csv is the MASTER list of valid codes: a row whose code does not exist anywhere in ai_usage_data.csv is dropped. A code that does exist there but has no cost for a given tool still appears, with cost/tokens/$-per-hour shown as "—". The value may carry a trailing description (e.g. "E-117775 - CYBER SECURITY"); only the leading E-/I-NNNNNN is kept for the join', dataType: 'String' },
  { column: 'Asset Name', fieldName: 'assetName / aiTool', description: 'The AI tool name, e.g. "Github" — normalized to aiTool for the join: an exact (case-insensitive) match to one of the six canonical tool names first, otherwise a substring match (e.g. "GitHub Copilot" → github, "ChatGPT Enterprise" → chatgpt). A name matching neither is kept as-is and simply will not join to a cost', dataType: 'String' },
  { column: 'Asset Type', fieldName: '(filter only, not stored)', description: '"ai" or "non-ai". A "non-ai" row is dropped at load time and never reaches the rest of the app — this feature is AI-tool ROI only', dataType: 'String' },
  { column: 'Approved (Actual)', fieldName: 'approvedTotalHrs', description: 'The approved business-case TARGET for this (Engagement, Tool) pair — not a figure the month columns are expected to sum to; the two are independently sourced', dataType: 'Numeric' },
  { column: 'Pending Approval (Submitted)', fieldName: 'pendingApprovalHrs', description: 'Hours submitted for sign-off but not yet approved. Shown as its own pipeline figure — never added into approvedTotalHrs or used in Realization %', dataType: 'Numeric' },
  { column: 'jul, aug, sep, … (any month name)', fieldName: 'monthlyHours[label]', description: 'One column per month, detected by name wherever it falls in the header (not a fixed position) — so extra columns can sit anywhere without breaking the parser. A future month sits at 0 until it actually arrives', dataType: 'Numeric, 12 max (Jul–Jun)' },
];

// A third data source, but not an external export: a MOCK developer timesheet
// (hours clocked per engagement per month), generated from ai_usage_data.csv's
// own Engagement Codes by scripts/generateDevHoursCsv.js until a real timesheet
// feed exists. It supplies the human-effort half of Total Investment.
const DEV_HOURS_CSV_SCHEMA = [
  { column: 'Engagement Code', fieldName: 'engagementCode', description: 'Bare E-/I-NNNNNN code, taken verbatim from ai_usage_data.csv\'s Engagement Code column — so dev hours only ever exist for engagements the master dataset knows about. One row per distinct code (496 today)', dataType: 'String' },
  { column: 'jul, aug, sep, … (any month name)', fieldName: 'monthlyDevHours[label]', description: 'One column per fiscal month (Jul–Jun), detected by name like the Hours Saved file. MOCK values: 40–160 hrs per engagement-month from a seeded generator, so they are identical on every run', dataType: 'Numeric, 12 max (Jul–Jun)' },
  { column: '— (derived from the month columns)', fieldName: 'totalDevHours → devHoursSpent', description: 'Sum of the engagement\'s month columns. ENGAGEMENT-level only — the timesheet has no per-tool breakdown, so the same value is attached to every tool row of a multi-tool engagement and must be counted once per engagement, never once per tool row', dataType: 'Derived' },
];

const FORMULA_CATEGORIES = [
  {
    title: 'Core AI Consumption & Adoption Formulas',
    icon: Zap,
    color: 'text-ey-yellow',
    formulas: [
      { name: 'Total GenAI Tool Consumption', formula: 'Total Consumption = ∑ (tokenConsumption) over Usage rows only', example: '9,420,685 units across 3,750 Usage rows' },
      { name: 'AI Adoption Rate (%)', formula: 'Adoption % = (Active Users / Total Roster Users) × 100', example: '(399 / 496) × 100 = 80.4%' },
      { name: 'Billable Utilization Rate (%)', formula: 'Utilization % = (Consumption on billable/E- rows / Total Consumption) × 100', example: '(5,933,582 / 9,420,685) × 100 = 62.98%' },
    ],
  },
  {
    title: 'Financial & Capacity Formulas',
    icon: DollarSign,
    color: 'text-emerald-400',
    formulas: [
      { name: 'Total AI Investment ($)', formula: 'Total Spend = ∑ (cost) over Usage AND License rows', example: 'Usage $8,887.73 + License $227,810.00 = $236,697.73' },
      { name: 'Cost per Active User ($ / user)', formula: 'Cost per User = Total Spend (usage + license) / Unique Active Users', example: '$236,697.73 / 399 Users = $593.23 / user' },
      { name: 'Average Monthly Cost ($ / month)', formula: 'Avg Monthly = Total Spend / distinct months present', example: '$236,697.73 / 6 months = $39,449.62' },
      { name: 'Per-Tool Free-Dollar Limit', formula: 'Hardcoded per tool (monthly free-tier allowance) — a tool with no entry here is excluded entirely from Capacity Unused, not treated as a $0 limit', example: 'GitHub $70 · Replit $38 · Cursor $20 · Factory/ChatGPT/Claude $0' },
      { name: 'Capacity Unused ($)', formula: 'Unused = ∑ max(0, Limit(tool) - costUsd), per Usage row, summed — backs the License Reclamation "Below Free Limit" warning cohort', example: '$75,194.61 of free-dollar capacity left unconsumed across 307 seats' },
    ],
  },
  {
    title: 'Project Telemetry & Billability Formulas',
    icon: Building2,
    color: 'text-cyan-400',
    formulas: [
      { name: 'Billable AI Spend Share (%)', formula: 'Billable Spend % = (Billable Spend / Total AI Investment) × 100', example: '($146,297.04 / $236,697.73) × 100 = 61.8%' },
      { name: 'Engagement Code Consumption Ranking', formula: 'Engagement Cost = ∑ (cost) grouped by Engagement Code', example: 'Top of 496 codes — E-157049: 43,520 units | $1,350.58' },
      { name: 'Non-Billable Cost Overrun', formula: 'Flagged = Engagement Code (I- prefix) where SUM(cost) / COUNT(DISTINCT user) > $100/mo', example: '5 of 163 non-billable engagements flagged, $702.49/mo exposure' },
    ],
  },
  {
    title: 'License Governance & Retention Formulas',
    icon: Wallet,
    color: 'text-sky-400',
    formulas: [
      { name: 'Overall Utilization (%)', formula: 'Utilization % = (SUM(cost) on Usage rows / SUM(cost) on License rows) × 100', example: '($8,887.73 / $227,810.00) × 100 = 3.9%' },
      { name: 'License Cost (per user, per tool)', formula: 'License Cost = ∑ (cost) where calculationMethod = "License", grouped by user + tool', example: 'Seat fees run $10–$60/mo per tool, summed per user across held tools' },
      { name: 'License Reclamation (Dormant Seats)', formula: 'Recoverable = ∑ (licenseCost) where tokenConsumption = 0 and licenseCost > 0', example: '97 dormant seats, $20,670.00/mo fully recoverable' },
      { name: 'Monthly Spend Trend ($)', formula: 'Monthly Cost = ∑ (cost) grouped by monthId, sorted ascending', example: 'March 2026: $39,566.00 → August 2026: $39,352.96' },
      { name: 'Habitual Retention Cohort', formula: 'Active Month Ratio = distinct(monthId with activity) / distinct(monthId in window), per user', example: '233 Embedded (58.4%) · 113 Regular (28.3%) · 53 Occasional (13.3%) · 0 Dropout' },
    ],
  },
  {
    title: 'Strategic Risk & Leverage Formulas',
    icon: TrendingUp,
    color: 'text-fuchsia-400',
    formulas: [
      { name: 'Tool Overlap Cost', formula: 'Overlap = COUNT(DISTINCT user) with Cost USD > 0 on 2+ Products in the SAME month', example: '205 users, $6,695.98/mo ($80.4k annualised)' },
      { name: 'Pareto Cost Concentration (Top 10% / 20%)', formula: 'Top N% Share = (∑ actualCost of top N% users / Total Cost) × 100', example: 'Top 20% (99 users): $6,604.96 ÷ $8,732.25 × 100 = 75.6%' },
      { name: 'Zero-Consumption / High-Spend Users', formula: 'COUNT(DISTINCT user) with 0 GenAI Tool Consumption / with SUM(cost) > $100', example: '25 Zero-Consumption Users · 14 High-Spend Users' },
    ],
  },
  {
    title: 'Hours Saved & Cost Efficiency Formulas',
    icon: Clock3,
    color: 'text-amber-400',
    formulas: [
      { name: 'Hours Saved Realization (%)', formula: 'Realization % = SUM(monthly hours) / Approved (Actual) × 100', example: '78 ÷ 254 × 100 = 30.7% (E-157049 / GitHub Copilot)' },
      { name: 'Cost per Hour Saved ($)', formula: 'Tool Cost (same Engagement + Tool, from ai_usage_data.csv) / SUM(monthly hours)', example: '$213.85 ÷ 78 hrs = $2.74 / hour saved' },
      { name: 'Portfolio Blended Cost / Hour Saved', formula: 'SUM(Tool Cost, all rows) / SUM(Hours Saved, all rows) -- not an average of each row\'s own ratio', example: '$14,283.33 ÷ 4,817 hrs = $2.97 / hour saved, portfolio-wide' },
    ],
  },
  {
    title: 'Hours Saved ROI & Investment Formulas',
    icon: Calculator,
    color: 'text-lime-400',
    formulas: [
      { name: 'ROI-Eligible Hours', formula: 'min(SUM(monthly hours), Approved (Actual)) — capped per (Engagement, Tool) row, then summed', example: 'E-157049 / Factory: min(105, 72) = 72 hrs · portfolio: 4,402 of 4,817 recorded hrs' },
      { name: 'Value of Hours Saved ($)', formula: 'ROI-Eligible Hours × $/dev-hr (default $30, adjustable on Engagement Analytics)', example: '4,402 hrs × $30 = $132,060' },
      { name: 'Tool-Level ROI (%)', formula: '(Value of Hours Saved − Tool Cost) / Tool Cost × 100, per (Engagement, Tool) row — tool cost only', example: 'E-120166 / Factory: ($3,270 − $63.25) ÷ $63.25 × 100 = +5,070%' },
      { name: 'Dev Hours & Dev Cost', formula: 'Dev Cost = Dev Hours (timesheet, counted once per engagement) × $/dev-hr', example: 'E-117775: 1,238 hrs × $30 = $37,140 · portfolio: 19,790 hrs (17 engagements) = $593,700' },
      { name: 'Total Investment ($)', formula: 'Total Investment = Tool Cost + Dev Cost, at engagement level', example: 'E-117775: $976.30 + $37,140 = $38,116.30' },
      { name: 'Total Investment ROI (%)', formula: '(Value of Hours Saved − Total Investment) / Total Investment × 100 — engagement rollup, portfolio, and the Executive Overview card', example: 'E-117775: ($8,250 − $38,116.30) ÷ $38,116.30 × 100 = −78.4% · portfolio: −78.3%' },
    ],
  },
  {
    title: 'Engagement Scoring Formulas',
    icon: Target,
    color: 'text-orange-400',
    formulas: [
      { name: 'Financial Value (/40)', formula: 'Benefit-to-Cost = Value of Hours Saved / Tool Cost (tracked tools); points = 40 × min(ratio / 3, 1)', example: 'E-117775: $8,250 ÷ $976.30 = 8.5× → 40.0 pts (full points at 3×)' },
      { name: 'Productivity Gain (/30)', formula: 'points = 30 × min(SUM(hours saved) / SUM(approved hours), 1)', example: 'E-117775: 294 ÷ 642 = 46% → 13.7 pts' },
      { name: 'Adoption & Utilization (/30)', formula: 'points = 30 × (0.5 × active seats / licensed seats + 0.5 × average of months-used / months-licensed per seat)', example: 'E-117775: 4 of 4 seats active, 63% of licensed months used → 30 × (0.5 × 1.00 + 0.5 × 0.63) ≈ 24.4 pts' },
      { name: 'Total Score & Tier', formula: 'Total = SUM(scored dimensions); Available = SUM(max of scored dimensions); % = Total / Available × 100; ≥80 Leading · ≥60 Performing · ≥40 Developing · else At Risk', example: 'E-117775: 78.1 / 100 = 78% → Performing' },
    ],
  },
];

const METRICS_DERIVATION_LIST: MetricDerivationItem[] = [
  {
    name: 'Total GenAI Tool Consumption',
    csvField: 'tokenConsumption (Calculation Method = "Usage" rows only, tokenConsumption > 0)',
    formula: 'Sum of tokenConsumption across active Usage rows matching filters',
    sampleInput: '3,750 Usage rows across Mar-Aug 2026',
    workedCalculation: '∑ tokenConsumption over Usage rows with consumption > 0',
    derivedOutput: '9,420,685 units',
    notes: 'License rows always carry tokenConsumption = 0 by design and are excluded — only metered Usage rows count toward consumption',
    category: 'Tokens',
  },
  {
    name: 'AI Adoption Rate (%)',
    csvField: 'distinct userMail (any row) vs distinct userMail (Usage row, tokenConsumption > 0)',
    formula: '(Active Users / Total Roster Users) × 100',
    sampleInput: 'Active Users = 399, Total Roster = 496',
    workedCalculation: '(399 ÷ 496) × 100',
    derivedOutput: '80.4%',
    notes: 'Total Roster is every distinct user appearing in ANY row (License or Usage) this period — a held seat counts toward the roster whether or not it was used. Powers the Executive Overview "AI Adoption" KPI card',
    category: 'Tokens',
  },
  {
    name: 'Billable Consumption (units)',
    csvField: 'tokenConsumption filtered by billableFlag',
    formula: 'Sum of tokenConsumption where billableFlag == "True"',
    sampleInput: 'Usage rows split by Engagement Code prefix (E- vs I-)',
    workedCalculation: '∑ tokenConsumption where projectCode starts with E-',
    derivedOutput: '5,933,582 of 9,420,685 units',
    notes: 'billableFlag is derived from the Engagement Code prefix (E-XXXXXX = billable, I-XXXXXX = non-billable) — there is no separate billability column in the source data',
    category: 'Tokens',
  },
  {
    name: 'Total AI Investment ($)',
    csvField: 'cost (Usage AND License rows, every row regardless of Calculation Method)',
    formula: 'Sum of cost across every row matching filters',
    sampleInput: 'Usage rows $8,887.73 (all Usage rows), License rows $227,810.00',
    workedCalculation: '$8,887.73 + $227,810.00',
    derivedOutput: '$236,697.73',
    notes: 'Counts both cost pools — metered usage (including $0-consumption Usage rows) and the flat seat fees on License rows. Token metrics and Cost per 1K Units stay Usage-only with consumption > 0, since a licence fee has no token denominator and a $0-consumption row skews the unit rate',
    category: 'Cost',
  },
  {
    name: 'Billable Utilization Rate (%)',
    csvField: 'tokenConsumption filtered by billableFlag (derived from Engagement Code)',
    formula: '(Consumption on billable/E- rows / Total Consumption) × 100',
    sampleInput: 'Billable = 5,933,582, Total = 9,420,685',
    workedCalculation: '(5,933,582 ÷ 9,420,685) × 100',
    derivedOutput: '62.98%',
    notes: 'Redefined for the new schema: since there is no separate "billable tokens" column, this splits total consumption by the Engagement Code E-/I- prefix instead',
    category: 'Tokens',
  },
  {
    name: 'Cost per 1K Consumption Units',
    csvField: 'cost ÷ (tokenConsumption / 1000), Usage rows with consumption > 0',
    formula: 'Total Usage Cost / (Total Consumption / 1000)',
    sampleInput: 'Total Usage Cost = $8,732.25, Total Consumption = 9,420,685',
    workedCalculation: '$8,732.25 ÷ 9,420.685',
    derivedOutput: '$0.9269 / 1k units',
    notes: 'Deliberately Usage-only, unlike Total AI Investment: licence fees carry no consumption, so folding them in would stop this being comparable to a vendor’s metered price',
    category: 'Cost',
  },
  {
    name: 'Average Monthly Cost ($ / month)',
    csvField: 'cost ÷ count(distinct monthId)',
    formula: 'Total AI Investment / Count of Unique Months',
    sampleInput: 'Total AI Investment = $236,697.73, Unique Months = 6',
    workedCalculation: '$236,697.73 ÷ 6',
    derivedOutput: '$39,449.62 / month',
    notes: 'Uses the same usage + licence pool as Total AI Investment, so the two reconcile. Average Daily Cost divides the same total by the 184 calendar days those six months contain (~$1,286.40/day)',
    category: 'Cost',
  },
  {
    name: 'Cost per Active User ($ / user)',
    csvField: 'cost (Usage AND License rows) ÷ distinct active userMail',
    formula: 'Total AI Investment / count(distinct userMail with tokenConsumption > 0)',
    sampleInput: 'Total AI Investment = $236,697.73, Active Users = 399',
    workedCalculation: '$236,697.73 ÷ 399',
    derivedOutput: '$593.23 / active user',
    notes: 'The numerator is the full usage + licence spend, but "active" is still decided from Usage rows with real consumption — a License row records a held seat, not activity. So this reads as the all-in cost of each person who actually used the tools; the 25 zero-consumption seats inflate it rather than diluting it',
    category: 'Cost',
  },
  {
    name: 'Tool Spend Breakdown',
    csvField: 'group_by(aiTool) -> sum(cost)',
    formula: 'Sum of cost grouped by AI Tool Flag',
    sampleInput: 'Usage + License rows grouped by Product across 6 tools',
    workedCalculation: 'Cursor AI: $60,350.35 from 1,502,088 units across 154 active users',
    derivedOutput: 'Cursor AI leads at 25.5% of Total AI Investment ($0.63 / 1k units metered)',
    notes: 'Distribution of spend across all six AI platforms: GitHub Copilot, ChatGPT, Claude, Replit, Factory AI, Cursor AI',
    category: 'Breakdowns',
  },
  {
    name: 'Service Line Token Distribution',
    csvField: 'group_by(orgServiceLine) -> sum(token_consumption)',
    formula: 'Sum of token_consumption grouped by Service Line',
    sampleInput: 'Usage + License rows grouped by Service Line (6 distinct)',
    workedCalculation: 'Tax: 2,055,474 units | $38,940.46 | 65 active users',
    derivedOutput: 'Tax leads the six service lines by consumption',
    notes: 'Organizational usage distribution across Service Lines (Tax, Assurance, CBS, Consulting, ES, Penon)',
    category: 'Breakdowns',
  },
  {
    name: 'Billable AI Spend Share (%)',
    csvField: 'group_by(billableFlag) -> sum(cost)',
    formula: '(Sum of cost where billableFlag == True / Total AI Investment) × 100',
    sampleInput: 'Billable Spend = $146,297.04, Total AI Investment = $236,697.73',
    workedCalculation: '($146,297.04 ÷ $236,697.73) × 100',
    derivedOutput: '61.8% Billable ($90,400.69 non-billable)',
    notes: 'Measures proportion of AI investment tied directly to billable client work',
    category: 'Projects',
  },
  {
    name: 'Engagement Code Spend & Token Rankings',
    csvField: 'group_by(projectCode) -> sum(token_consumption), sum(cost)',
    formula: 'Aggregate token consumption and cost per unique Engagement Code',
    sampleInput: 'Engagement Code: E-157049 (top of 496 codes by cost)',
    workedCalculation: 'Tokens: 43,520 | Cost: $1,350.58 | Active users: 1',
    derivedOutput: 'Ranked list of all 496 engagement codes',
    notes: 'Ranks all engagement codes by AI consumption, billable and non-billable alike. This chain — Engagement Code → Super Region → Service Line → Sub-Service Line → Competency — is the Engagement Analytics page, reached from any user row',
    category: 'Projects',
  },
  {
    name: 'Non-Billable Cost Overrun (Flagged Engagements)',
    csvField: 'group_by(projectCode) -> sum(cost), count(distinct userMail), Usage rows with an I- prefix',
    formula: 'Flag engagements where SUM(cost) / COUNT(DISTINCT userMail) > $100/mo',
    sampleInput: '163 non-billable (I-prefix) engagements this period',
    workedCalculation: 'I-733960: $198.06 ÷ 1 user = $198.06/user (flagged, > $100 threshold)',
    derivedOutput: '5 of 163 engagements flagged, $702.49/mo total exposure',
    notes: 'Pure margin drag — none of this spend is offset by client billing. Reached from the Executive Overview\'s "Non-Billable Cost Overrun" suggestion, which drills into the mandated CT/Non-CT → Country → Service Line → Sub-Service Line 1 → Sub-Service Line 2 → User hierarchy scoped to just the flagged engagements\' rows',
    category: 'Projects',
  },
  {
    name: 'User Spend & Token Ranking',
    csvField: 'group_by(userMail) -> sum(token_consumption), sum(cost)',
    formula: 'Sum of tokens and cost per userMail',
    sampleInput: 'Top user of 399: Isla Fischer',
    workedCalculation: 'Tokens: 134,683 | Cost: $198.06',
    derivedOutput: 'Ranked list of all 399 active users',
    notes: 'Ranks all enterprise users by metered consumption and usage spend. Deliberately Usage-only, unlike the dimension breakdowns above: this powers "Top Power Spenders", and a licence-inclusive ranking would put dormant seats — which consumed nothing — at the top',
    category: 'Breakdowns',
  },
  {
    name: 'Overall Utilization (%)',
    csvField: 'cost where calculationMethod = "Usage" vs cost where calculationMethod = "License" (every row, regardless of tokenConsumption)',
    formula: '(SUM(cost) on Usage rows / SUM(cost) on License rows) × 100',
    sampleInput: 'Usage row cost = $8,887.73, License row cost = $227,810.00',
    workedCalculation: '$8,887.73 ÷ $227,810.00 × 100',
    derivedOutput: '3.9%',
    notes: 'Not a return on investment — both sides are costs. A low percentage means many licensed seats aren\'t being used enough to justify the cost. Powers the ROI page "Overall Utilization" KPI card, distinct from Cost per 1K Consumption Units above (which excludes $0-consumption rows and licence fees entirely)',
    category: 'License & Adoption',
  },
  {
    name: 'License Cost (per user, per tool)',
    csvField: 'cost where calculationMethod = "License", grouped by user + distinct tool',
    formula: 'License Cost = ∑ (cost) where calculationMethod = "License", grouped by user + tool',
    sampleInput: 'A user holding GitHub Copilot + Claude licenses across the period',
    workedCalculation: 'Sum each held tool\'s License-row costs separately, then sum across tools',
    derivedOutput: '$227,810.00 total license cost across the roster',
    notes: 'Seat fees run $10–$60/mo per tool. Backs the per-user License Reclamation and Habitual Retention "at-risk license spend" figures',
    category: 'License & Adoption',
  },
  {
    name: 'License Reclamation (Dormant Seats)',
    csvField: 'licenseCost (per user, from License rows) vs tokenConsumption (per user, from Usage rows)',
    formula: 'Recoverable = ∑ (licenseCost) where tokenConsumption = 0 and licenseCost > 0, per seat',
    sampleInput: '97 seats recorded 0 usage against a paid license fee',
    workedCalculation: '∑ licenseCost over those 97 seats',
    derivedOutput: '$20,670.00/mo fully recoverable ($248,040/yr annualised)',
    notes: 'A separate, milder "Below Free Limit" warning (not reclaimed) also fires for seats using less than their Per-Tool Free-Dollar Limit — 307 seats, $75,194.61/mo of prepaid capacity left unconsumed. Powers the Executive Overview\'s #1-ranked "License Reclamation Intelligence" suggestion',
    category: 'License & Adoption',
  },
  {
    name: 'Monthly Spend & Consumption Trend',
    csvField: 'group_by(monthId) -> sum(cost) [Usage + License], sum(tokenConsumption) [Usage only]',
    formula: 'Aggregate cost and consumption per monthId, sorted ascending, split further by AI Tool',
    sampleInput: 'monthYear: March_2026 through August_2026',
    workedCalculation: 'March: $39,566.00 (1,578,958 units) | August: $39,352.96 (1,536,098 units)',
    derivedOutput: 'Monthly Cost Trend chart, Monthly Spend by AI Tool chart',
    notes: 'Powers the ROI page monthly trend charts',
    category: 'License & Adoption',
  },
  {
    name: 'Pareto Cost Concentration (Top 10% / 20%)',
    csvField: 'userCapacityBreakdown, sorted by actualCost desc',
    formula: 'Top N% Share = (∑ actualCost of top N% users / Total Usage Cost) × 100',
    sampleInput: '496 users sorted by spend, Total Usage Cost = $8,732.25',
    workedCalculation: 'Top 99 users (20%): $6,604.96 ÷ $8,732.25 × 100',
    derivedOutput: '75.6% of spend from top 20% (top 10% = 51.8%)',
    notes: 'Identifies concentration risk — whether cost is broadly distributed or driven by a small set of power users. Powers the Executive Overview\'s "Pareto Cost Concentration (80/20 Risk)" suggestion',
    category: 'License & Adoption',
  },
  {
    name: 'Habitual User Retention Cohorts',
    csvField: 'monthId grouped by userMail (Usage rows, tokenConsumption > 0)',
    formula: 'Active Month Ratio = count(distinct monthId with usage) / count(distinct monthId in the filtered window), per user; bucketed Embedded (≥0.9), Regular (≥0.6), Occasional (≥0.25), Dropout (<0.25)',
    sampleInput: 'User active in 4 of 6 distinct monthId values in the current window',
    workedCalculation: '4 ÷ 6 = 0.67 active month ratio → Regular',
    derivedOutput: '233 Embedded (58.4%), 113 Regular (28.3%), 53 Occasional (13.3%), 0 Dropout',
    notes: 'Since there is no day-level Activity Date, "habitual" is measured as the share of months in the filtered window a user was active in, rather than active days per month',
    category: 'License & Adoption',
  },
  {
    name: 'Zero-Consumption Users',
    csvField: 'tokenConsumption (Calculation Method = "Usage" rows), userMail (all rows)',
    formula: 'Total Roster − Active Licenses, i.e. COUNT(DISTINCT userMail) whose SUM(tokenConsumption) over all their Usage rows in the period is 0 (including users with no Usage row at all)',
    sampleInput: 'Every user in the filtered period, summed Usage-row consumption per user',
    workedCalculation: 'Filter to users whose period-wide total is exactly 0 — a user active in one month and idle in another does NOT count, since their total is positive',
    derivedOutput: '25 users',
    notes: 'User-level aggregate qualification, matching inactiveUserCount everywhere else in the app (Total AI Investment card, License Reclamation Dormant Seats). Powers the ROI page "Zero-Consumption Users" KPI card and its drilldown table',
    category: 'Governance',
  },
  {
    name: 'High-Spend Users',
    csvField: 'cost (Calculation Method = "Usage" rows only), summed per userMail',
    formula: 'COUNT(DISTINCT userMail) where SUM(cost) over all their Usage rows > $100',
    sampleInput: '399 active users, Usage-row cost summed per user across the whole period',
    workedCalculation: 'Filter to users whose total exceeds the $100 threshold',
    derivedOutput: '14 users',
    notes: 'User-level aggregate qualification (same style as Zero-Consumption Users) — the whole period\'s cost must exceed the threshold, not any single row. Powers the ROI page "High-Spend Users" KPI card and its drilldown table',
    category: 'Governance',
  },
  {
    name: 'Tool Overlap Cost (Same-Month Concurrency)',
    csvField: 'aiTool + cost (Calculation Method = "Usage", cost > 0), grouped by userMail + monthId',
    formula: 'COUNT(DISTINCT userMail) with Cost USD > 0 on 2+ Products within the SAME monthId',
    sampleInput: 'Usage rows grouped by (user, month) pair, tools set per pair',
    workedCalculation: 'Flag a user\'s email when any one (user, month) group has 2+ distinct tools',
    derivedOutput: '205 users, $6,695.98/mo ($80.4k annualised)',
    notes: 'Stricter than Multi-Tool License Overlap below: requires concurrent paid usage in the SAME month, not merely at some point across the whole filtered period. Powers the Executive Overview\'s "Tool Overlap Cost" suggestion headline figure',
    category: 'Governance',
  },
  {
    name: 'Multi-Tool License Overlap (Period-Wide)',
    csvField: 'aiTool + cost (Calculation Method = "Usage"), grouped by userMail across the whole period',
    formula: 'COUNT(DISTINCT userMail) with 2+ distinct aiTool values anywhere in the filtered period',
    sampleInput: 'Usage rows grouped by user, tools accumulated across all matching rows',
    workedCalculation: 'Flag users whose accumulated tool set has size ≥ 2',
    derivedOutput: '287 users, $7,615.25/mo redundant spend',
    notes: 'Looser than Tool Overlap Cost above (no same-month requirement), so this count is always ≥ it. Backs the "Multi-Tool License Overlap & License Consolidation Alert" box shown inside the Tool Overlap Cost drilldown',
    category: 'Governance',
  },
  {
    name: 'Hours Saved Realization (%)',
    csvField: 'monthlyHours (every month column, actuals-planned-overall-*.csv) vs approvedTotalHrs (Approved (Actual) column)',
    formula: 'Realization % = SUM(monthlyHours across all month columns) / approvedTotalHrs × 100',
    sampleInput: 'E-157049 / GitHub Copilot: jul=45, aug=25, sep=8, oct..jun=0, Approved (Actual)=254',
    workedCalculation: '(45 + 25 + 8) ÷ 254 × 100',
    derivedOutput: '30.7%',
    notes: 'A trailing month at 0 is not missing data — it is a future fiscal-year month that has not arrived yet, so it correctly contributes nothing to the sum rather than being excluded or treated as a gap. Pending Approval (Submitted) is never added to approvedTotalHrs here, so hours still awaiting sign-off cannot inflate this number. Powers the status badge (On/Above Target ≥100%, On Track ≥75%, Behind Target <75%) on both the Matrix and Grouped Table views',
    category: 'Hours Saved',
  },
  {
    name: 'Cost per Hour Saved ($)',
    csvField: 'cost (ai_usage_data.csv, summed for the SAME Engagement Code + AI Tool pair) ÷ sumOfMonthlyHrs',
    formula: 'Tool Cost / SUM(monthlyHours) — joined by (Engagement Code, AI Tool), not Engagement Code alone',
    sampleInput: 'E-157049 / GitHub Copilot: Tool Cost = $213.85, Hours Saved = 78',
    workedCalculation: '$213.85 ÷ 78',
    derivedOutput: '$2.74 / hour saved',
    notes: 'The join is deliberately scoped to (Engagement, Tool), not just Engagement — an engagement using 6 different tools gets 6 separate cost figures, one per tool, never one tool\'s hours compared against the whole engagement\'s combined spend. The same formula also runs per month (monthlyCostPerHourSaved) wherever that month\'s cost has arrived in ai_usage_data.csv; a month with hours saved but no cost yet correctly shows "—" rather than a wrong $0 or a crash',
    category: 'Hours Saved',
  },
  {
    name: 'Portfolio Blended Cost per Hour Saved',
    csvField: 'cost and monthlyHours, summed across every tracked (Engagement, Tool) pair',
    formula: 'SUM(Tool Cost, all rows) / SUM(Hours Saved, all rows)',
    sampleInput: '61 tracked Engagement × Tool pairs, Total Tool Cost = $14,283.33, Total Hours Saved = 4,817',
    workedCalculation: '$14,283.33 ÷ 4,817',
    derivedOutput: '$2.97 / hour saved, portfolio-wide',
    notes: 'Deliberately NOT an average of each row\'s own Cost per Hour Saved — averaging 61 separate ratios would let a tiny, cheap engagement count exactly as much as a large, expensive one. Summing dollars and hours first and dividing once weights the result by actual dollars at stake. Overall Realization % (SUM hours saved ÷ SUM approved hours = 4,817 ÷ 10,014 = 48.1%) follows the same sum-then-divide rule. Powers the Hours Saved Executive Summary strip on Engagement Analytics',
    category: 'Hours Saved',
  },
  {
    name: 'Engagement Code Validation (ai_usage_data.csv as Master)',
    csvField: 'engagementCode (actuals-planned-overall-*.csv) vs every distinct projectCode in ai_usage_data.csv (unfiltered)',
    formula: 'Keep a Hours Saved row only if its Engagement Code exists in ai_usage_data.csv',
    sampleInput: '17 engagement codes in actuals-planned-overall-2026-09-30.csv; 496 in ai_usage_data.csv',
    workedCalculation: 'Every Hours Saved code is found in the master set',
    derivedOutput: '61 of 61 Engagement × Tool rows kept (the 2 "non-ai" rows were already dropped by the Asset Type filter)',
    notes: 'The master set is the full unfiltered roster, not the date-range-filtered rows, so a code does not flicker in and out as the date filter changes. A code that is valid but has no cost for a given tool in the selected period is kept and shows "—" for cost. The same rule decides which engagement codes the dev-hours timesheet is generated for',
    category: 'Hours Saved',
  },
  {
    name: 'ROI-Eligible Hours (Approved-Capped)',
    csvField: 'monthlyHours (sum of every month column) vs approvedTotalHrs (Approved (Actual)), per (Engagement, Tool) row',
    formula: 'ROI-Eligible Hours = min(SUM(monthlyHours), approvedTotalHrs) per row, then summed',
    sampleInput: 'E-157049 / Factory: 105 hrs recorded, Approved (Actual) = 72',
    workedCalculation: 'min(105, 72)',
    derivedOutput: '72 hrs count toward value (portfolio: 4,402 of 4,817 recorded hrs count)',
    notes: 'Hours recorded beyond what has been approved are not yet locked into the business case, so they earn no value. The cap is applied per row — never on an already-summed engagement or portfolio total — so one tool overshooting its own target cannot borrow headroom from another that undershot. Approved = 0 means nothing counts. Realization %, Cost per Hour Saved and the Hours Saved column keep using the raw recorded hours; only the ROI value uses the capped figure',
    category: 'Hours Saved ROI',
  },
  {
    name: 'Value of Hours Saved ($)',
    csvField: 'ROI-Eligible Hours × the blended $/dev-hr rate (default $30)',
    formula: 'Value = ROI-Eligible Hours × $/dev-hr',
    sampleInput: 'ROI-Eligible Hours = 4,402 (portfolio), rate = $30/hr',
    workedCalculation: '4,402 × $30',
    derivedOutput: '$132,060',
    notes: 'The $30 rate is a business assumption, not sourced from the data — one flat blended rate for every role and region. It is adjustable via the "$ / dev-hr" input on Engagement Analytics (and inside the Hours Saved ROI drilldown), and every ROI figure there recomputes live. The Executive Overview card and Engagement Scoring always use the $30 default',
    category: 'Hours Saved ROI',
  },
  {
    name: 'Tool-Level ROI (%)',
    csvField: 'Value of Hours Saved and cost (ai_usage_data.csv, same Engagement + Tool), per row',
    formula: 'ROI % = (Value of Hours Saved − Tool Cost) / Tool Cost × 100',
    sampleInput: 'E-120166 / Factory: 109 hrs saved (Approved 201), Tool Cost = $63.25',
    workedCalculation: '(109 × $30 − $63.25) ÷ $63.25 × 100 = ($3,270 − $63.25) ÷ $63.25 × 100',
    derivedOutput: '+5,070%',
    notes: 'Weighs value only against the tool\'s own usage + licence cost — dev hours are engagement-level, so they are not part of this per-tool figure (see Total Investment ROI). Extreme percentages are a property of the denominator: sample tool costs are tens of dollars against thousands of dollars of hours value. Null (shown "—") when there is no cost to divide by. The approved cap applies: E-157049 / Factory records 105 hrs against 72 approved → value $2,160 → +3,411.6%. Shown as the "ROI %" column on tool rows and as a Matrix cell metric',
    category: 'Hours Saved ROI',
  },
  {
    name: 'Dev Hours Invested & Dev Cost',
    csvField: 'monthlyDevHours (dev-hours-timesheet.csv) summed per Engagement Code',
    formula: 'Dev Cost = Dev Hours × $/dev-hr, with Dev Hours counted once per engagement (not per tool row)',
    sampleInput: 'E-117775: 12 monthly values summing to 1,238 hrs; 4 tracked tool rows',
    workedCalculation: '1,238 × $30',
    derivedOutput: '$37,140 (portfolio: 19,790 hrs across 17 engagements = $593,700)',
    notes: 'The timesheet is engagement-level, so devHoursSpent is repeated on each tool row of a multi-tool engagement. Every rollup dedupes by Engagement Code before summing — E-117775 has 4 tool rows but contributes its 1,238 hrs once, not 4,952. MOCK data from a seeded generator (see the dev-hours schema above), a stand-in until a real timesheet feed exists',
    category: 'Hours Saved ROI',
  },
  {
    name: 'Total Investment ($)',
    csvField: 'cost (the engagement\'s tracked tool rows) + Dev Cost, per engagement',
    formula: 'Total Investment = SUM(Tool Cost across the engagement\'s tracked tools) + Dev Cost',
    sampleInput: 'E-117775: Claude $245.01 + Cursor $361.62 + Factory $62.82 + Replit $306.85 = $976.30 tool cost; Dev Cost = $37,140',
    workedCalculation: '$976.30 + $37,140',
    derivedOutput: '$38,116.30 (portfolio: $14,283.33 + $593,700 = $607,983.33)',
    notes: 'Engagement-level only. The tool cost covers just the tool rows that have Hours Saved data, so it is far smaller than the org-wide Total AI Investment ($236,697.73 — usage + licence across all 496 engagements). Different populations, not a mismatch',
    category: 'Hours Saved ROI',
  },
  {
    name: 'Total Investment ROI (%)',
    csvField: 'Value of Hours Saved vs Total Investment, at engagement and portfolio level',
    formula: 'ROI % = (Value of Hours Saved − Total Investment) / Total Investment × 100',
    sampleInput: 'E-117775: eligible hours = 79 (Claude) + 53 (Cursor, capped from 72) + 100 (Factory) + 43 (Replit) = 275 → Value $8,250; Total Investment = $38,116.30',
    workedCalculation: '($8,250 − $38,116.30) ÷ $38,116.30 × 100',
    derivedOutput: '−78.4% (portfolio: ($132,060 − $607,983.33) ÷ $607,983.33 × 100 = −78.3%)',
    notes: 'Negative means developer-hour cost outweighs the value of hours saved so far. Used on the engagement rollup row, the Executive Summary ROI card, the engagement drilldown panel and the Executive Overview card; per-tool rows and Matrix cells stay tool-cost-only. Null when Total Investment is 0',
    category: 'Hours Saved ROI',
  },
  {
    name: 'Hours Saved ROI (Executive Overview Card)',
    csvField: 'summary.hoursSavedByEngagement — the same joined rows as Engagement Analytics',
    formula: 'Portfolio Total Investment ROI at the default $30/dev-hr; pinned as the #2 card, after License Reclamation',
    sampleInput: '17 tracked engagements: value $132,060 vs Total Investment $607,983.33 ($14,283.33 tool cost + $593,700 dev cost)',
    workedCalculation: '($132,060 − $607,983.33) ÷ $607,983.33 × 100',
    derivedOutput: '−78.3% ROI; net impact −$475,923.33',
    notes: 'The "$14.3K AI tool cost" in the card is scoped to the 17 tracked engagements only — not the org-wide Total AI Investment ($236.7K across all 496 engagements, licences included). Clicking the card opens the same Matrix / Table / Executive Summary view inline, with its own $/dev-hr control, rather than navigating away',
    category: 'Hours Saved ROI',
  },
  {
    name: 'Engagement Score Framework (Dimensions, Weights & Blanks)',
    csvField: 'ai_usage_data.csv rows (filtered) + the Hours Saved join, scored per Engagement Code',
    formula: 'Three dimensions, 100 pts: Financial Value 40 · Productivity Gain 30 · Adoption & Utilization 30. A dimension with no data is null (blank), never 0',
    sampleInput: '496 engagements, all months, no filters',
    workedCalculation: 'Adoption scores for all 496; Financial and Productivity only for the 17 with Hours Saved',
    derivedOutput: '30 points available to 479 engagements, 100 points to 17',
    notes: 'Page: Engagement Scoring (/dashboard/scoring), served by /api/metrics/scoring. Weights and thresholds live in one config (scoringConfig.ts) so the page and the server score against the same numbers. Uses the default $30/dev-hr. Other dimensions (revenue, quality & risk, strategic importance) were dropped because the data sources have no data for them',
    category: 'Engagement Scoring',
  },
  {
    name: 'Financial Value (/40)',
    csvField: 'Hours Saved rows (hours, approved hours) and cost, for the engagement\'s tracked tools',
    formula: 'Benefit-to-Cost = Value of Hours Saved / Tool Cost; points = 40 × min(ratio / 3, 1)',
    sampleInput: 'E-117775: Value = $8,250 (275 eligible hrs × $30), Tool Cost = $976.30',
    workedCalculation: '$8,250 ÷ $976.30 = 8.5×; 40 × min(8.5 / 3, 1)',
    derivedOutput: '40.0 of 40',
    notes: 'The 3× target is configurable. Blank when the engagement has no Hours Saved row or no tool cost to compare against. Tool cost only — dev hours are not part of this dimension. Every tracked engagement in the sample data reaches full points because sample tool costs are tiny',
    category: 'Engagement Scoring',
  },
  {
    name: 'Productivity Gain (/30)',
    csvField: 'monthlyHours and approvedTotalHrs, summed across the engagement\'s tracked tools',
    formula: 'points = 30 × min(SUM(hours saved) / SUM(approved hours), 1)',
    sampleInput: 'E-117775: 294 hrs saved against 642 approved',
    workedCalculation: '294 ÷ 642 = 46%; 30 × 0.46',
    derivedOutput: '13.7 of 30',
    notes: 'Uses the raw recorded hours (not the approved-capped figure), capped at 100% realization. Blank with no Hours Saved row or no approved target',
    category: 'Engagement Scoring',
  },
  {
    name: 'Adoption & Utilization (/30)',
    csvField: 'calculationMethod = "License" rows (seats, licensed months) vs "Usage" rows with tokenConsumption > 0 (active months), per (user, tool) seat',
    formula: 'points = 30 × (0.5 × Activation + 0.5 × Consistency); Activation = active seats / licensed seats; Consistency = average over seats of (months used / months licensed)',
    sampleInput: 'E-117775: 4 licensed seats, all 4 used at least once; seats used in 63% of their licensed months on average',
    workedCalculation: '30 × (0.5 × 1.00 + 0.5 × 0.63)',
    derivedOutput: '24.4 of 30',
    notes: 'A seat is one (user, tool) licence. An engagement with licences but no usage scores 0 — a real signal, not a blank. Blank only when there are no licence rows at all in the selected period. Scored for all 496 engagements',
    category: 'Engagement Scoring',
  },
  {
    name: 'Total Score, Available Points & Tier',
    csvField: 'The three dimension scores per engagement',
    formula: 'Total = SUM(scored dimensions); Available = SUM(max points of scored dimensions); % = Total / Available × 100; ≥ 80% Leading, ≥ 60% Performing, ≥ 40% Developing, else At Risk',
    sampleInput: 'E-117775: 40.0 + 13.7 + 24.4 scored, all three dimensions available',
    workedCalculation: 'Total 78.1; Available 40 + 30 + 30 = 100; 78.1 ÷ 100 × 100',
    derivedOutput: '78% → Performing (portfolio, all months: 246 Leading · 153 Performing · 0 Developing · 97 At Risk)',
    notes: 'The tier uses the percentage of available points, so a blank dimension never counts against an engagement. The flip side: 479 engagements are tiered on Adoption alone (30 points) — lower confidence, flagged by the "Scored n/3" column. The tier filter and the Tier Distribution drilldown apply after scoring, so the engagements listed under a tier are exactly those tiered that way',
    category: 'Engagement Scoring',
  },
];

// Catalog groups, in reading order. Each is one collapsible group in the catalog.
const CATALOG_CATEGORIES = [
  'Tokens',
  'Cost',
  'Projects',
  'Breakdowns',
  'License & Adoption',
  'Governance',
  'Hours Saved',
  'Hours Saved ROI',
  'Engagement Scoring',
];

// Titles contain spaces and "&", which are not valid in an HTML id, so every
// section id is built from a slug of its title.
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Every collapsible block on the page, so "Expand all" can open them in one go.
const ALL_COLLAPSIBLE_IDS = [
  'section-sources',
  'section-reference',
  'section-catalog',
  'schema-usage',
  'schema-hours',
  'schema-dev',
  ...FORMULA_CATEGORIES.map((c) => `ref-${slug(c.title)}`),
  ...CATALOG_CATEGORIES.map((c) => `cat-${slug(c)}`),
];

// Open on first load: the three sections and the Quick Reference cards. The big
// schema tables and the catalog groups start collapsed so the page opens as a
// scannable outline rather than one long scroll.
const DEFAULT_OPEN_IDS = ['section-sources', 'section-reference', 'section-catalog', ...FORMULA_CATEGORIES.map((c) => `ref-${slug(c.title)}`)];

function matchesTerm(item: MetricDerivationItem, term: string): boolean {
  const t = term.trim().toLowerCase();
  if (!t) return true;
  return (
    item.name.toLowerCase().includes(t) ||
    item.csvField.toLowerCase().includes(t) ||
    item.formula.toLowerCase().includes(t) ||
    item.notes.toLowerCase().includes(t)
  );
}

function withIds(prev: Set<string>, ids: string[]): Set<string> {
  const next = new Set(prev);
  ids.forEach((id) => next.add(id));
  return next;
}

function SchemaTable({
  rows,
  accentClass,
}: {
  rows: { column: string; fieldName: string; description: string; dataType: string }[];
  accentClass: string;
}) {
  return (
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
          {rows.map((row) => (
            <tr key={row.fieldName} className="hover:bg-ey-black/30 transition">
              <td className={`p-2.5 font-medium ${accentClass}`}>{row.column}</td>
              <td className="p-2.5 text-cyan-300">{row.fieldName}</td>
              <td className="p-2.5 text-ey-muted">{row.dataType}</td>
              <td className="p-2.5 text-ey-muted font-sans text-xs">{row.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExportSchemaButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-[11px] font-semibold text-ey-black bg-ey-yellow hover:bg-ey-yellow-hover px-2.5 py-1.5 rounded-lg transition shrink-0"
    >
      <Download className="w-3.5 h-3.5" />
      Export to CSV
    </button>
  );
}

function MetricCard({
  item,
  copied,
  onCopy,
}: {
  item: MetricDerivationItem;
  copied: boolean;
  onCopy: (text: string) => void;
}) {
  return (
    <div className="bg-ey-black/60 border border-ey-border/80 rounded-xl p-4 space-y-3 hover:border-ey-yellow/40 transition">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-bold text-ey-light">{item.name}</span>
        <button
          onClick={() => onCopy(item.formula)}
          className="flex items-center space-x-1 text-[11px] text-ey-muted hover:text-ey-yellow transition"
          title="Copy Formula"
        >
          {copied ? (
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
          <div className="font-mono text-[11px] text-cyan-300 bg-ey-card p-2 rounded border border-ey-border/60">{item.csvField}</div>
        </div>
        <div className="space-y-1">
          <span className="text-[10px] font-semibold text-ey-muted uppercase">Mathematical Formula</span>
          <div className="font-mono text-[11px] text-ey-yellow bg-ey-card p-2 rounded border border-ey-border/60">{item.formula}</div>
        </div>
      </div>

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
        <p className="text-[11px] text-ey-muted italic border-t border-ey-border/40 pt-1.5 mt-1">Note: {item.notes}</p>
      </div>
    </div>
  );
}

export default function MetricsDerivationPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedFormula, setCopiedFormula] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set(DEFAULT_OPEN_IDS));

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const expandAll = () => setOpenIds(new Set(ALL_COLLAPSIBLE_IDS));
  const collapseAll = () => setOpenIds(new Set());

  // Opens the section (if closed) and brings it into view.
  const jumpTo = (id: string) => {
    setOpenIds((prev) => withIds(prev, [id]));
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  // Searching or picking a category opens the catalog groups that have results,
  // so matches are visible without clicking each group open.
  const openMatchingGroups = (term: string, category: string) => {
    if (!term.trim() && category === 'All') return;
    const ids = CATALOG_CATEGORIES.filter(
      (c) => (category === 'All' || c === category) && METRICS_DERIVATION_LIST.some((i) => i.category === c && matchesTerm(i, term))
    ).map((c) => `cat-${slug(c)}`);
    setOpenIds((prev) => withIds(prev, ['section-catalog', ...ids]));
  };
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    openMatchingGroups(value, selectedCategory);
  };
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    openMatchingGroups(searchTerm, category);
  };

  const catalogGroups = CATALOG_CATEGORIES.filter((c) => selectedCategory === 'All' || c === selectedCategory)
    .map((category) => ({
      category,
      items: METRICS_DERIVATION_LIST.filter((i) => i.category === category && matchesTerm(i, searchTerm)),
    }))
    .filter((g) => g.items.length > 0);
  const matchCount = catalogGroups.reduce((n, g) => n + g.items.length, 0);

  const formulaCount = FORMULA_CATEGORIES.reduce((n, c) => n + c.formulas.length, 0);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFormula(text);
    setTimeout(() => setCopiedFormula(null), 2000);
  };

  const exportSchemaToCsv = (schema: typeof CSV_SCHEMA, filename: string) => {
    const escapeCsvValue = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
    const headers = ['CSV Column Name', 'Internal Field', 'Data Type', 'Description & Usage'];
    const rows = schema.map((row) => [row.column, row.fieldName, row.dataType, row.description].map(escapeCsvValue));
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6 w-full text-ey-light">
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
            <h1 className="text-xl font-bold tracking-tight text-ey-light">GitHub Copilot Metrics Derivation Guide</h1>
            <p className="text-xs text-ey-muted mt-0.5">
              Complete catalog of exact formulas, CSV input field mappings, and step-by-step worked calculations for all metrics
            </p>
          </div>
        </div>

        {/* Quick Data Badges */}
        <div className="flex flex-wrap gap-2 pt-2">
          <span className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-ey-black/60 border border-ey-border text-ey-yellow flex items-center gap-1.5">
            <Database className="w-3 h-3" /> Input Dataset: ai_usage_data.csv (monthly-grained, master)
          </span>
          <span className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-ey-black/60 border border-ey-border text-cyan-400">
            Consumption Field: GenAI Tool Consumption (Usage rows only)
          </span>
          <span className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-ey-black/60 border border-ey-border text-emerald-400">
            Cost Field: Cost (in $)
          </span>
          <span className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-ey-black/60 border border-ey-border text-amber-400 flex items-center gap-1.5">
            <Clock3 className="w-3 h-3" /> Input Dataset: actuals-planned-overall-*.csv (Engagement × Tool-grained)
          </span>
          <span className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-ey-black/60 border border-ey-border text-lime-400 flex items-center gap-1.5">
            <Layers className="w-3 h-3" /> Input Dataset: dev-hours-timesheet.csv (mock, Engagement-grained)
          </span>
          <span className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-ey-black/60 border border-ey-border text-orange-400 flex items-center gap-1.5">
            <Target className="w-3 h-3" /> Engagement Scoring: 3 dimensions, 100 pts
          </span>
        </div>
      </div>

      {/* Section navigation + expand / collapse everything */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-ey-card border border-ey-border rounded-xl px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-ey-muted">Jump to</span>
          {[
            { id: 'section-sources', label: 'Data Sources' },
            { id: 'section-reference', label: 'Formula Quick Reference' },
            { id: 'section-catalog', label: 'Metric Catalog' },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => jumpTo(s.id)}
              className="px-2.5 py-1 text-xs font-medium rounded-md bg-ey-black/60 border border-ey-border text-ey-muted hover:text-ey-yellow hover:border-ey-yellow/50 transition"
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-ey-black/60 border border-ey-border text-ey-light hover:border-ey-yellow/50 transition"
          >
            <ChevronsUpDown className="w-3.5 h-3.5 text-ey-yellow" />
            Expand all
          </button>
          <button
            onClick={collapseAll}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-ey-black/60 border border-ey-border text-ey-light hover:border-ey-yellow/50 transition"
          >
            <ChevronsDownUp className="w-3.5 h-3.5 text-ey-yellow" />
            Collapse all
          </button>
        </div>
      </div>

      {/* Section 1: Data Sources & Input Schemas */}
      <CollapsibleSection
        id="section-sources"
        title="Data Sources & Input Schemas"
        icon={Database}
        meta="3 datasets"
        open={openIds.has('section-sources')}
        onToggle={() => toggle('section-sources')}
      >
        <p className="text-[11px] text-ey-muted">
          Everything on this page is derived from three inputs. <span className="text-ey-light font-semibold">ai_usage_data.csv</span> is the master: it
          supplies usage, licences and cost, and it is the list of valid Engagement Codes. The Hours Saved file and the dev-hours timesheet are joined onto it
          by Engagement Code, never merged into it.
        </p>

        <CollapsibleSection
          variant="sub"
          id="schema-usage"
          title="ai_usage_data.csv — Metered Usage & Licences (master)"
          icon={Database}
          meta={`${CSV_SCHEMA.filter((c) => !c.column.startsWith('—')).length} columns + ${CSV_SCHEMA.filter((c) => c.column.startsWith('—')).length} derived`}
          actions={<ExportSchemaButton onClick={() => exportSchemaToCsv(CSV_SCHEMA, 'ai_usage_data_schema.csv')} />}
          open={openIds.has('schema-usage')}
          onToggle={() => toggle('schema-usage')}
        >
          <SchemaTable rows={CSV_SCHEMA} accentClass="text-ey-yellow" />
        </CollapsibleSection>

        <CollapsibleSection
          variant="sub"
          id="schema-hours"
          title="actuals-planned-overall-*.csv — Hours Saved"
          icon={Clock3}
          iconClassName="text-amber-400"
          meta={`${HOURS_SAVED_CSV_SCHEMA.length} named columns + open-ended months`}
          actions={<ExportSchemaButton onClick={() => exportSchemaToCsv(HOURS_SAVED_CSV_SCHEMA, 'hours_saved_schema.csv')} />}
          open={openIds.has('schema-hours')}
          onToggle={() => toggle('schema-hours')}
        >
          <p className="text-[11px] text-ey-muted">
            A separate, supplementary data source — not metered telemetry — joined by (Engagement Code, AI Tool). Columns are matched by header NAME, not
            position, so extra fields in the real file are simply ignored. Quoted (RFC 4180) fields, including embedded commas, are parsed correctly.
          </p>
          <SchemaTable rows={HOURS_SAVED_CSV_SCHEMA} accentClass="text-amber-400" />
        </CollapsibleSection>

        <CollapsibleSection
          variant="sub"
          id="schema-dev"
          title="dev-hours-timesheet.csv — Developer Hours (mock)"
          icon={Layers}
          iconClassName="text-lime-400"
          meta={`${DEV_HOURS_CSV_SCHEMA.length} fields • generated, not an export`}
          actions={<ExportSchemaButton onClick={() => exportSchemaToCsv(DEV_HOURS_CSV_SCHEMA, 'dev_hours_schema.csv')} />}
          open={openIds.has('schema-dev')}
          onToggle={() => toggle('schema-dev')}
        >
          <p className="text-[11px] text-ey-muted">
            Not an external export: generated by <span className="font-mono text-ey-light">scripts/generateDevHoursCsv.js</span> (run automatically before{' '}
            <span className="font-mono">dev</span> and <span className="font-mono">build</span>, or via <span className="font-mono">npm run generate-dev-hours</span>)
            from ai_usage_data.csv&apos;s own Engagement Codes. It is a stand-in until a real developer-timesheet feed exists, and supplies the human-effort half of
            Total Investment.
          </p>
          <SchemaTable rows={DEV_HOURS_CSV_SCHEMA} accentClass="text-lime-400" />
        </CollapsibleSection>
      </CollapsibleSection>

      {/* Section 2: Formula Quick Reference */}
      <CollapsibleSection
        id="section-reference"
        title="Formula Quick Reference"
        icon={Calculator}
        meta={`${FORMULA_CATEGORIES.length} groups • ${formulaCount} formulas`}
        open={openIds.has('section-reference')}
        onToggle={() => toggle('section-reference')}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
          {FORMULA_CATEGORIES.map((cat) => {
            const id = `ref-${slug(cat.title)}`;
            return (
              <CollapsibleSection
                key={cat.title}
                variant="sub"
                id={id}
                title={cat.title}
                icon={cat.icon}
                iconClassName={cat.color}
                meta={`${cat.formulas.length}`}
                open={openIds.has(id)}
                onToggle={() => toggle(id)}
              >
                <div className="space-y-2">
                  {cat.formulas.map((f) => (
                    <div key={f.name} className="p-2.5 bg-ey-black/60 rounded-lg border border-ey-border/60 text-xs">
                      <div className="font-semibold text-ey-light mb-1">{f.name}</div>
                      <div className="font-mono text-[11px] text-ey-yellow bg-ey-black p-1.5 rounded border border-ey-border/40 overflow-x-auto">{f.formula}</div>
                      <div className="text-[10px] text-ey-muted mt-1 font-mono">Ex: {f.example}</div>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            );
          })}
        </div>
      </CollapsibleSection>

      {/* Section 3: Detailed Metric Derivation Catalog */}
      <CollapsibleSection
        id="section-catalog"
        title="Detailed Metric Derivation Catalog"
        icon={Calculator}
        meta={`${CATALOG_CATEGORIES.length} groups • ${METRICS_DERIVATION_LIST.length} metrics`}
        open={openIds.has('section-catalog')}
        onToggle={() => toggle('section-catalog')}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <p className="text-xs text-ey-muted">
            Filter by group or search by CSV field, formula, or metric name
            {(searchTerm.trim() || selectedCategory !== 'All') && (
              <span className="text-ey-yellow font-semibold"> — {matchCount} match{matchCount === 1 ? '' : 'es'}</span>
            )}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center bg-ey-black/80 p-0.5 rounded-lg border border-ey-border/80">
              {['All', ...CATALOG_CATEGORIES].map((cat) => (
                <button
                  key={cat}
                  onClick={() => handleCategoryChange(cat)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${
                    selectedCategory === cat ? 'bg-ey-yellow text-ey-black font-bold shadow-sm' : 'text-ey-muted hover:text-ey-light'
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
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full bg-ey-black border border-ey-border text-ey-light text-xs rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:border-ey-yellow"
              />
            </div>
          </div>
        </div>

        {catalogGroups.length === 0 ? (
          <div className="text-center py-10 text-ey-muted text-xs">No metric derivations found matching &quot;{searchTerm}&quot;.</div>
        ) : (
          <div className="space-y-3">
            {catalogGroups.map(({ category, items }) => {
              const id = `cat-${slug(category)}`;
              return (
                <CollapsibleSection
                  key={category}
                  variant="sub"
                  id={id}
                  title={category}
                  icon={Layers}
                  meta={`${items.length} metric${items.length === 1 ? '' : 's'}`}
                  open={openIds.has(id)}
                  onToggle={() => toggle(id)}
                >
                  <div className="space-y-3">
                    {items.map((item) => (
                      <MetricCard key={item.name} item={item} copied={copiedFormula === item.formula} onCopy={handleCopy} />
                    ))}
                  </div>
                </CollapsibleSection>
              );
            })}
          </div>
        )}
      </CollapsibleSection>
    </div>
  );
}
