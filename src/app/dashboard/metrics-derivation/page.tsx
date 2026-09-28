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
];

export default function MetricsDerivationPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedFormula, setCopiedFormula] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = ['All', 'Tokens', 'Cost', 'Projects', 'Breakdowns', 'License & Adoption', 'Governance'];

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

  const handleExportSchemaToCsv = () => {
    const escapeCsvValue = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
    const headers = ['CSV Column Name', 'Internal Field', 'Data Type', 'Description & Usage'];
    const rows = CSV_SCHEMA.map((row) => [row.column, row.fieldName, row.dataType, row.description].map(escapeCsvValue));
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'ai_usage_data_schema.csv');
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
            <span className="text-[11px] text-ey-muted font-mono">{CSV_SCHEMA.filter((c) => !c.column.startsWith('—')).length} CSV Columns + {CSV_SCHEMA.filter((c) => c.column.startsWith('—')).length} Derived Fields • Single Source of Truth</span>
            <button
              onClick={handleExportSchemaToCsv}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-ey-black bg-ey-yellow hover:bg-ey-yellow-hover px-2.5 py-1.5 rounded-lg transition shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Export to CSV
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
