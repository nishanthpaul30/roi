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

const CSV_SCHEMA = [
  { column: 'AI Tool Flag', fieldName: 'aiTool', description: 'AI Tool classification flag (e.g. copilot, chatgpt, claude)', dataType: 'String' },
  { column: 'User Mail', fieldName: 'userMail', description: 'Developer email identifier (e.g. aditya.malik@enterprise-corp.com)', dataType: 'String' },
  { column: 'Display Name', fieldName: 'displayName', description: 'Developer display name (e.g. Aditya Malik)', dataType: 'String' },
  { column: 'Activity Date', fieldName: 'activityDate', description: 'Date of usage formatted as YYYY-MM-DD (e.g. 2026-03-09)', dataType: 'Date' },
  { column: 'Token Consumption', fieldName: 'tokenConsumption', description: 'Total raw tokens generated and processed (Prompt + Completion)', dataType: 'Numeric' },
  { column: 'Daily Billable Tokens', fieldName: 'dailyBillableTokens', description: 'Tokens charged toward billable quota', dataType: 'Numeric' },
  { column: 'Cost in USD', fieldName: 'cost', description: 'Direct monetary expenditure incurred in USD ($)', dataType: 'Numeric ($)' },
  { column: 'Org Service Line', fieldName: 'orgServiceLine', description: 'Organizational unit / Service line (e.g. Power, Financial Services)', dataType: 'String' },
  { column: 'Management Region', fieldName: 'managementRegion', description: 'Regional management division (e.g. EMEA, APAC, Americas)', dataType: 'String' },
  { column: 'Country', fieldName: 'country', description: 'Country location of user', dataType: 'String' },
];

const FORMULA_CATEGORIES = [
  {
    title: 'Core Copilot Token Formulas',
    icon: Zap,
    color: 'text-ey-yellow',
    formulas: [
      { name: 'Total Token Consumption', formula: 'Total Tokens = ∑ (token_consumption)', example: '32,378 + 31,509 + 39,002 = 102,889 Tokens' },
      { name: 'Total Billable Tokens', formula: 'Billable Tokens = ∑ (daily_billable_tokens)', example: '32,378 + 31,509 + 39,002 = 102,889 Tokens' },
      { name: 'Billable Utilization Rate (%)', formula: 'Utilization % = (Total Billable Tokens / Total Token Consumption) × 100', example: '(102,889 / 102,889) × 100 = 100.0%' },
    ],
  },
  {
    title: 'Financial & Spend Efficiency Formulas',
    icon: DollarSign,
    color: 'text-emerald-400',
    formulas: [
      { name: 'Total API Spend ($)', formula: 'Total Spend = ∑ (cost)', example: '$0.4627 + $0.5055 + $0.6155 = $1.5837' },
      { name: 'Cost per 1K Tokens ($ / 1k)', formula: 'Cost per 1k = (Total Spend / (Total Billable Tokens / 1000))', example: '($1.5837 / (102,889 / 1000)) = $0.015392 / 1k' },
      { name: 'Average Daily Cost ($ / day)', formula: 'Avg Daily Spend = Total Spend / Unique Activity Days', example: '$1.5837 / 3 days = $0.5279 / day' },
    ],
  },
  {
    title: 'Organizational & User Breakdown Formulas',
    icon: Building2,
    color: 'text-cyan-400',
    formulas: [
      { name: 'Tool Spend Share (%)', formula: 'Tool Spend % = (Tool Cost / Total Spend) × 100', example: '($1,240.50 / $2,500.00) × 100 = 49.62%' },
      { name: 'Service Line Token Share (%)', formula: 'Service Line Share % = (Service Line Tokens / Total Tokens) × 100', example: '(450,000 / 1,500,000) × 100 = 30.0%' },
      { name: 'User Token Contribution', formula: 'User Token Share % = (User Tokens / Total Tokens) × 100', example: '(257,880 / 7,761,876) × 100 = 3.32%' },
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
    name: 'Total API Spend ($)',
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
    formula: 'Sum of token_consumption grouped by Org Service Line',
    sampleInput: 'Power = 102,889, Financial Services = 186,020',
    workedCalculation: 'Power: 102,889 | Financial Services: 186,020',
    derivedOutput: 'Service line totals',
    notes: 'Organizational usage distribution by service line',
    category: 'Breakdowns',
  },
  {
    name: 'User Spend & Token Ranking',
    csvField: 'group_by(userMail) -> sum(token_consumption), sum(cost)',
    formula: 'Sum of tokens and cost per userMail',
    sampleInput: 'userMail: steven.krishnan@enterprise-corp.com',
    workedCalculation: 'Tokens: 7,761,876 | Cost: $119.0022',
    derivedOutput: 'Ranked user list',
    notes: 'Ranks all 70 enterprise users by total token consumption and spend',
    category: 'Breakdowns',
  },
];

export default function MetricsDerivationPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedFormula, setCopiedFormula] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = ['All', 'Tokens', 'Cost', 'Breakdowns'];

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
          <span className="text-[11px] text-ey-muted font-mono">10 Columns • Single Source of Truth</span>
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
