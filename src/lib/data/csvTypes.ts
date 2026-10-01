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

/**
 * Row shape for actuals-planned-overall-*.csv — a separate, supplementary data source
 * (not metered telemetry) reporting the productivity hours an AI tool is
 * estimated/approved to have saved on a given client engagement.
 *
 * The source file carries more columns than this feature uses (it's read by
 * HEADER NAME, not position — see hoursSavedLoader.ts — so extra fields are
 * simply ignored rather than breaking the parser). One of those extra
 * columns, Asset Type ("ai" | "non-ai"), is used as a filter at load time:
 * non-AI rows never make it into HoursSavedRow at all, so there's no
 * assetType field here to check later — by the time a row exists, it has
 * already passed that filter.
 *
 * Grain: one row per (Engagement Code, AI Tool/Asset). approvedTotalHrs is
 * the approved business-case TARGET, not a figure the monthly columns are
 * expected to sum to — the two are independently sourced. pendingApprovalHrs
 * is a separate, not-yet-approved figure (hours submitted for sign-off but
 * not locked into the business case yet) — it's never added into
 * approvedTotalHrs or used in realizationPercent, both of which stay based
 * on what's actually approved. Month columns are detected by name (any
 * header matching a month abbreviation, e.g. "jul"), wherever they fall in
 * the file, and are resolved to real calendar months via the current fiscal
 * year (see hoursSaved.ts's monthLabelToMonthId) — the relation to
 * ai_usage_data.csv is by (Engagement Code, AI Tool), at both the
 * consolidated and the monthly grain.
 */
export interface HoursSavedRow {
  engagementCode: string;              // Extracted from the "Engagement Code" column (which may carry a trailing description, e.g. "E-117775 - CYBER SECURITY") -- just the leading E-NNNNNN/I-NNNNNN is kept, since that's what joins to CsvUsageRow.projectCode
  assetName: string;                   // "Asset Name" column, as given in the source file (e.g. "Github")
  aiTool: string;                      // assetName.toLowerCase() — joins to CsvUsageRow.aiTool
  approvedTotalHrs: number;            // The approved-hours column (e.g. "Approved (Actual)") — a target, not a sum
  pendingApprovalHrs: number;          // "Pending Approval (Submitted)" column — submitted but not yet approved; informational only, 0 if the column is absent
  monthlyHours: Record<string, number>; // One entry per detected month column, keyed by its own header text, e.g. { jul: 62, aug: 58 }
  sumOfMonthlyHrs: number;             // Derived: sum of monthlyHours' values
  realizationPercent: number;          // Derived: sumOfMonthlyHrs / approvedTotalHrs * 100 (0 when approvedTotalHrs is 0) -- based on approved hours only, pendingApprovalHrs is never included
}
