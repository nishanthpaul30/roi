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

export interface CsvUsageRow {
  aiTool: string;               // AI Tool Flag: chatgpt | copilot | claude
  userMail: string;             // User Mail
  displayName: string;          // Display Name
  activityDate: string;         // Activity Date: YYYY-MM-DD
  monthYear: string;            // Month_Year: March_2026
  monthId: number;              // Month Id: 202603
  periodStartDate: string;      // Period Start Date: DD/MM/YYYY
  periodEndDate: string;        // Period End Date: DD/MM/YYYY
  tokenConsumption: number;     // Token Consumption
  dailyBillableTokens: number;  // Daily Billable Tokens
  cost: number;                 // Cost in USD
  orgServiceLine: string;       // Service Line: Consulting, Tax, Assurance, CBS, S&T
  orgSubServiceLine: string;    // Org Sub Service Line: Reporting, Strategy, etc.
  country: string;              // Country
  region: string;               // Region: Middle East, ANZ, Europe, etc.
  managementRegion: string;     // Management Region: EMEA | APAC | Americas
  projectCode: string;          // Engagement Code: billing code, E-XXXXXX (External) | I-XXXXXX (Internal)
  licenseCost: number;          // License Cost in USD
  usageFreeTokenLimit: number;  // Usage Free Token Limit
  usageLimit?: number;          // Backward-compatible alias
  billableFlag: string;         // Billable/Non-Billable: 'True' | 'False'
  projectType: string;          // ProjectType: 'External' | 'Internal'
  ctNonCt: string;              // CT/Non-CT
  subServiceLine1: string;      // Sub-Service Line 1
  subServiceLine2: string;      // Sub-Service Line 2
  engagementSuperRegion: string; // Engagement Super Region
  engagementServiceLine: string; // Engagement Service Line
  engagementSubServiceLine: string; // Engagement Sub Service Line
  engagementCompetency: string; // Engagement Competency
  gdsLocation: string;          // GDS Location
  costCenter: string;           // Cost Center
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

// Column order matches the current ai_usage_data.csv header exactly, which follows
// the required hierarchy: CT/Non-CT -> Country -> Service Line -> (Sub-Service Line 1,
// Sub-Service Line 2, Engagement Code) -> Engagement Super Region -> (Engagement Service
// Line, Engagement Sub Service Line) -> Engagement Competency.
const COL = {
  aiTool: 0, userMail: 1, displayName: 2, activityDate: 3, monthYear: 4, monthId: 5,
  periodStartDate: 6, periodEndDate: 7, tokenConsumption: 8, dailyBillableTokens: 9, cost: 10,
  ctNonCt: 11, country: 12, orgServiceLine: 13, orgSubServiceLine: 14,
  subServiceLine1: 15, subServiceLine2: 16, projectCode: 17,
  engagementSuperRegion: 18, engagementServiceLine: 19, engagementSubServiceLine: 20, engagementCompetency: 21,
  region: 22, managementRegion: 23, licenseCost: 24, usageFreeTokenLimit: 25,
  billableFlag: 26, projectType: 27, gdsLocation: 28, costCenter: 29,
};

export function parseRawCsvText(raw: string): CsvUsageRow[] {
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const rows: CsvUsageRow[] = [];

  // Skip header line (0)
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 21) continue;

    const get = (idx: number, fallback = '') => (cols[idx] !== undefined ? cols[idx].trim() : fallback);
    const usageFreeTokenLimit = parseFloat(get(COL.usageFreeTokenLimit)) || 80.0;

    rows.push({
      aiTool: get(COL.aiTool).toLowerCase(),
      userMail: get(COL.userMail),
      displayName: get(COL.displayName),
      activityDate: get(COL.activityDate),  // YYYY-MM-DD
      monthYear: get(COL.monthYear),
      monthId: parseInt(get(COL.monthId), 10) || 0,
      periodStartDate: get(COL.periodStartDate),
      periodEndDate: get(COL.periodEndDate),
      tokenConsumption: parseFloat(get(COL.tokenConsumption)) || 0,
      dailyBillableTokens: parseFloat(get(COL.dailyBillableTokens)) || 0,
      cost: parseFloat(get(COL.cost)) || 0,
      orgServiceLine: get(COL.orgServiceLine),
      orgSubServiceLine: get(COL.orgSubServiceLine),
      country: get(COL.country),
      region: get(COL.region),
      managementRegion: get(COL.managementRegion),
      projectCode: get(COL.projectCode),
      licenseCost: parseFloat(get(COL.licenseCost)) || 100.0,
      usageFreeTokenLimit,
      usageLimit: usageFreeTokenLimit,
      billableFlag: get(COL.billableFlag, 'True'),
      projectType: get(COL.projectType, 'External'),
      ctNonCt: get(COL.ctNonCt),
      subServiceLine1: get(COL.subServiceLine1),
      subServiceLine2: get(COL.subServiceLine2),
      engagementSuperRegion: get(COL.engagementSuperRegion),
      engagementServiceLine: get(COL.engagementServiceLine),
      engagementSubServiceLine: get(COL.engagementSubServiceLine),
      engagementCompetency: get(COL.engagementCompetency),
      gdsLocation: get(COL.gdsLocation),
      costCenter: get(COL.costCenter),
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

/** Get metadata about active dataset */
export function getDatasetMetadata() {
  const rows = loadCsvData();
  return {
    isCustom: _isCustomActive,
    fileName: _customFileName,
    rowCount: rows.length,
    totalCost: Number(rows.reduce((sum, r) => sum + r.cost, 0).toFixed(2)),
    totalTokens: Math.round(rows.reduce((sum, r) => sum + r.tokenConsumption, 0)),
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

