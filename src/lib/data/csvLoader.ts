import { RAW_CSV_DATA } from './rawCsvData';

// Lazy load Node.js fs and path modules on server side to prevent browser bundling errors
const getFs = () => {
  try {
    return typeof window === 'undefined' ? require('fs') : null;
  } catch (_e) {
    return null;
  }
};

const getPath = () => {
  try {
    return typeof window === 'undefined' ? require('path') : null;
  } catch (_e) {
    return null;
  }
};

// The data source is monthly-grained (no day-level Activity Date). Each
// (user, tool, month) can have a 'License' row (the flat seat fee for that
// month, present whether or not the seat was used) and/or a 'Usage' row (the
// actual metered consumption/cost for that month, present only when active).
export type CalculationMethod = 'License' | 'Usage' | string;

export interface CsvUsageRow {
  userMail: string;             // User Email
  displayName: string;          // User Name
  year: number;                 // Year: 2026
  month: number;                // Month: 1-12
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

let _cache: CsvUsageRow[] | null = null;
let _customOverrideRaw: string | null = null;
let _isCustomActive: boolean = false;
let _customFileName: string = 'ai_usage_data.csv';

function getCsvFilePath(): string {
  if (typeof window !== 'undefined') return '';
  const fs = getFs();
  const path = getPath();
  if (!fs || !path) return '';

  const possiblePaths = [
    path.join(process.cwd(), 'public', 'ai_usage_data.csv'),
    path.join(process.cwd(), 'ai_usage_data.csv'),
    path.join(process.cwd(), '.next', 'standalone', 'public', 'ai_usage_data.csv'),
    path.join(process.cwd(), '.next', 'standalone', 'ai_usage_data.csv'),
    path.join(__dirname, '..', '..', '..', 'public', 'ai_usage_data.csv'),
    path.join(__dirname, '..', '..', '..', 'ai_usage_data.csv'),
  ];

  for (const p of possiblePaths) {
    try {
      if (fs.existsSync && fs.existsSync(p)) {
        return p;
      }
    } catch (_err) {
      // Ignore fs permission/absence errors in edge runtime
    }
  }

  return path.join(process.cwd(), 'public', 'ai_usage_data.csv');
}

// Column order matches the current ai_usage_data.csv header exactly. Cost USD
// sits between Credits and Cost (in $) — placeholder position pending the
// real file's actual column order, which isn't known yet.
const COL = {
  userMail: 0, displayName: 1, year: 2, month: 3, aiTool: 4, calculationMethod: 5,
  tokenConsumption: 6, creditsLimit: 7, costUsd: 8, cost: 9,
  ctNonCt: 10, country: 11, superRegion: 12, orgServiceLine: 13,
  subServiceLine1: 14, subServiceLine2: 15, projectCode: 16,
  engagementSuperRegion: 17, engagementServiceLine: 18, engagementSubServiceLine: 19,
  engagementCompetency: 20, engagementInvestType: 21, gdsLocation: 22, costCenter: 23,
  portfolioCtProductFamily: 24, portfolioCtProduct: 25, entity: 26, slSf: 27, rs: 28, gds: 29,
};

const MONTH_NAME_TO_NUMBER: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};
const MONTH_NUMBER_TO_NAME = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/** Parses either a month name ("March") or a numeric month (3 / "03") into 1-12. */
function parseMonth(value: string): number {
  const trimmed = value.trim();
  const named = MONTH_NAME_TO_NUMBER[trimmed.toLowerCase()];
  if (named) return named;
  const num = parseInt(trimmed, 10);
  return Number.isNaN(num) ? 0 : num;
}

// parseFloat(x) || fallback silently replaces a legitimate 0 (falsy in JS)
// with fallback — some tools genuinely have a $0.00 free-credit allowance by
// design. Only fall back when the field is truly unparseable (NaN).
function parseNumOrDefault(value: string, fallback: number): number {
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function parseRawCsvText(raw: string): CsvUsageRow[] {
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const rows: CsvUsageRow[] = [];

  // Skip header line (0)
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 20) continue;

    const get = (idx: number, fallback = '') => (cols[idx] !== undefined ? cols[idx].trim() : fallback);

    const year = parseInt(get(COL.year), 10) || 0;
    const month = parseMonth(get(COL.month));
    const projectCode = get(COL.projectCode);
    // Billability is a convention on the Engagement Code itself, not a
    // separate source column: E-XXXXXX is an external/billable engagement,
    // I-XXXXXX is internal/non-billable.
    const isBillable = projectCode.trim().toUpperCase().startsWith('E-');

    rows.push({
      userMail: get(COL.userMail),
      displayName: get(COL.displayName),
      year,
      month,
      monthYear: month >= 1 && month <= 12 ? `${MONTH_NUMBER_TO_NAME[month - 1]}_${year}` : '',
      monthId: year * 100 + month,
      aiTool: get(COL.aiTool).toLowerCase(),
      calculationMethod: get(COL.calculationMethod),
      tokenConsumption: parseFloat(get(COL.tokenConsumption)) || 0,
      // Dollar-denominated and can legitimately be null, 0, or negative
      // (e.g. -70) — parseNumOrDefault only falls back to 0 on a truly
      // unparseable (NaN) value, never on a real negative number.
      creditsLimit: parseNumOrDefault(get(COL.creditsLimit), 0),
      costUsd: parseFloat(get(COL.costUsd)) || 0,
      cost: parseFloat(get(COL.cost)) || 0,
      ctNonCt: get(COL.ctNonCt),
      country: get(COL.country),
      superRegion: get(COL.superRegion),
      orgServiceLine: get(COL.orgServiceLine),
      subServiceLine1: get(COL.subServiceLine1),
      subServiceLine2: get(COL.subServiceLine2),
      projectCode,
      engagementSuperRegion: get(COL.engagementSuperRegion),
      engagementServiceLine: get(COL.engagementServiceLine),
      engagementSubServiceLine: get(COL.engagementSubServiceLine),
      engagementCompetency: get(COL.engagementCompetency),
      gdsLocation: get(COL.gdsLocation),
      costCenter: get(COL.costCenter),
      billableFlag: isBillable ? 'True' : 'False',
      projectType: isBillable ? 'External' : 'Internal',
      engagementInvestType: get(COL.engagementInvestType),
      portfolioCtProductFamily: get(COL.portfolioCtProductFamily),
      portfolioCtProduct: get(COL.portfolioCtProduct),
      entity: get(COL.entity),
      slSf: get(COL.slSf),
      rs: get(COL.rs),
      gds: get(COL.gds),
    });
  }

  return rows;
}

/**
 * Load and parse ai_usage_data.csv from memory override, file system, or embedded string fallback.
 * Results are cached in-memory for the lifetime of the server process.
 */
export function loadCsvData(): CsvUsageRow[] {
  if (_cache && process.env.NODE_ENV !== 'development' && !_isCustomActive) return _cache;

  if (_isCustomActive && _customOverrideRaw) {
    _cache = parseRawCsvText(_customOverrideRaw);
    return _cache;
  }

  let raw = '';
  try {
    const fsModule = getFs();
    const csvPath = getCsvFilePath();
    if (fsModule && fsModule.readFileSync) {
      raw = fsModule.readFileSync(/*turbopackIgnore: true*/ csvPath, 'utf-8');
    }
  } catch (_err) {
    // Cloudflare Pages / Workers Edge runtime fallback
    raw = RAW_CSV_DATA;
  }

  if (!raw || raw.trim().length === 0) {
    raw = RAW_CSV_DATA;
  }

  _cache = parseRawCsvText(raw);
  return _cache;
}

/** Set custom raw CSV content dynamically */
export function setCustomCsvData(raw: string, fileName = 'custom_uploaded.csv'): { success: boolean; rowsParsed: number } {
  const parsed = parseRawCsvText(raw);
  if (parsed.length === 0) {
    return { success: false, rowsParsed: 0 };
  }
  _customOverrideRaw = raw;
  _isCustomActive = true;
  _customFileName = fileName;
  _cache = parsed;
  return { success: true, rowsParsed: parsed.length };
}

/** Reset to default embedded CSV dataset */
export function resetCustomCsvData() {
  _customOverrideRaw = null;
  _isCustomActive = false;
  _customFileName = 'ai_usage_data.csv';
  _cache = null;
}

/** Converts a "YYYY-MM-DD" filter boundary string into a comparable monthId (YYYYMM). */
export function dateStringToMonthId(dateStr: string): number {
  const [y, m] = dateStr.split('-');
  return (parseInt(y, 10) || 0) * 100 + (parseInt(m, 10) || 0);
}

/**
 * Earliest/latest monthId present anywhere in the loaded dataset (unfiltered).
 * Used to tell a genuinely absent prior comparison period (outside the dataset
 * entirely) apart from a real period that simply has zero matching rows for the
 * current filter selection.
 */
export function getDatasetMonthIdBounds(): { minMonthId: number; maxMonthId: number } | null {
  const rows = loadCsvData();
  if (rows.length === 0) return null;
  let minMonthId = rows[0].monthId;
  let maxMonthId = rows[0].monthId;
  for (const r of rows) {
    if (r.monthId < minMonthId) minMonthId = r.monthId;
    if (r.monthId > maxMonthId) maxMonthId = r.monthId;
  }
  return { minMonthId, maxMonthId };
}

/** Get metadata about active dataset */
export function getDatasetMetadata() {
  const rows = loadCsvData();
  const usageRows = rows.filter(r => r.calculationMethod === 'Usage');
  return {
    isCustom: _isCustomActive,
    fileName: _customFileName,
    rowCount: rows.length,
    totalCost: Number(usageRows.reduce((sum, r) => sum + r.cost, 0).toFixed(2)),
    totalTokens: Math.round(usageRows.reduce((sum, r) => sum + r.tokenConsumption, 0)),
  };
}

/** Return distinct values for a given dimension — used to populate filter dropdowns */
export function getDistinctValues(field: keyof CsvUsageRow): string[] {
  const rows = loadCsvData();
  const vals = new Set<string>();
  for (const row of rows) {
    const v = String(row[field]).trim();
    if (v) vals.add(v);
  }
  return Array.from(vals).sort();
}

/** Bust the in-memory cache (useful in dev when the CSV changes) */
export function clearCsvCache() {
  _cache = null;
}
