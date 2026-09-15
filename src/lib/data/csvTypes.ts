/**
 * Row shape for ai_usage_data.csv, kept separate from csvLoader.ts so Client
 * Components can type raw rows they receive from /api/metrics/raw-rows without
 * importing the loader itself — the loader is server-only (it pulls in the
 * embedded CSV string, which has no business being in a client bundle).
 *
 * The data source is monthly-grained (no day-level Activity Date). Each
 * (user, tool, month) can have a 'License' row (the flat seat fee for that
 * month, present whether or not the seat was used) and/or a 'Usage' row (the
 * actual metered consumption/cost for that month, present only when active).
 */
export type CalculationMethod = 'License' | 'Usage' | string;

export interface CsvUsageRow {
  userMail: string;             // User Email
  displayName: string;          // User Name
  year: number;                  // Calendar year, derived from the Month column's date (not the Year column — see fiscalYear)
  month: number;                 // Calendar month 1-12, derived from the Month column's date
  fiscalYear: string;            // Year column's raw value, e.g. "FY26" — a fiscal-year label, not a calendar year; kept for display only, never used in date math
  monthYear: string;             // Derived: "March_2026" — kept for chart labels
  monthId: number;               // Derived: 202603 — kept for sorting/filtering
  aiTool: string;                // Product: chatgpt | github | claude | replit | factory | cursor
  calculationMethod: CalculationMethod; // Calculation Method: 'License' | 'Usage'
  tokenConsumption: number;      // GenAI Tool Consumption (0 on License rows)
  creditsLimit: number;          // Credits — dollar-denominated free-tier adjustment; can be null/0/negative
  costUsd: number;               // Cost USD — gross cost before the Credits adjustment
  cost: number;                  // Cost (in $) — net cost; Cost (in $) = Cost USD + Credits
  ctNonCt: string;               // CT/Non-CT
  country: string;               // Country
  superRegion: string;           // Super Region — replaces the old Region/Management Region pair
  orgServiceLine: string;        // Service Line: Consulting, Tax, Assurance, CBS, S&T
  subServiceLine1: string;       // Sub-Service Line 1
  subServiceLine2: string;       // Sub-Service Line 2
  projectCode: string;           // Engagement Code: billing code, E-XXXXXX (External) | I-XXXXXX (Internal)
  engagementSuperRegion: string; // Engagement - Super Region
  engagementServiceLine: string; // Engagement Service Line
  engagementSubServiceLine: string; // Engagement Sub-Service Line
  engagementCompetency: string;  // Engagement Competency
  gdsLocation: string;           // GDS Location
  costCenter: string;            // Cost Center
  billableFlag: string;          // Derived from Engagement Code prefix: 'True' | 'False'
  projectType: string;           // Derived from Engagement Code prefix: 'External' | 'Internal'
  // Parsed and stored but not used in any breakdown, filter, or KPI — kept only
  // so the field is available if a future insight needs it.
  engagementInvestType: string;      // Engagement Invest Type
  portfolioCtProductFamily: string;  // Portfolio - CT Product Family
  portfolioCtProduct: string;        // Portfolio - CT Product
  entity: string;                    // Entity
  slSf: string;                      // SL/SF
  rs: string;                        // RS
  gds: string;                       // GDS
}
