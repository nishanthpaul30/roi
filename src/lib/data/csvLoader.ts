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
  orgServiceLine: string;       // Org Service Line: Consulting, Power, Financial Services, Technology
  orgSubServiceLine: string;    // Org Sub Service Line: Reporting, Strategy, etc.
  country: string;              // Country
  region: string;               // Region: Middle East, ANZ, Europe, etc.
  managementRegion: string;     // Management Region: EMEA | APAC | Americas
  projectCode: string;          // Project Investment Code: PRJ-XXX-XXXX
  licenseCost: number;          // License Cost in USD
  usageFreeTokenLimit: number;  // Usage Free Token Limit
  usageLimit?: number;          // Backward-compatible alias
  billableFlag: string;         // Billable/Non-Billable: 'True' | 'False'
  projectType: string;          // ProjectType: 'External' | 'Internal'
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

export function parseRawCsvText(raw: string): CsvUsageRow[] {
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const rows: CsvUsageRow[] = [];

  // Skip header line (0)
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 17) continue;

    const billableFlag = cols.length >= 20 ? cols[19].trim() : 'True';
    const projectType = cols.length >= 21 ? cols[20].trim() : 'External';
    const pCode = cols.length >= 22 ? cols[21].trim() : cols[16].trim();

    rows.push({
      aiTool: cols[0].trim().toLowerCase(),
      userMail: cols[1].trim(),
      displayName: cols[2].trim(),
      activityDate: cols[3].trim(),  // YYYY-MM-DD
      monthYear: cols[4].trim(),
      monthId: parseInt(cols[5].trim(), 10) || 0,
      periodStartDate: cols[6].trim(),
      periodEndDate: cols[7].trim(),
      tokenConsumption: parseFloat(cols[8].trim()) || 0,
      dailyBillableTokens: parseFloat(cols[9].trim()) || 0,
      cost: parseFloat(cols[10].trim()) || 0,
      orgServiceLine: cols[11].trim(),
      orgSubServiceLine: cols[12].trim(),
      country: cols[13].trim(),
      region: cols[14].trim(),
      managementRegion: cols[15].trim(),
      projectCode: pCode,
      licenseCost: cols.length >= 18 ? (parseFloat(cols[17].trim()) || 100.0) : 100.0,
      usageFreeTokenLimit: cols.length >= 19 ? (parseFloat(cols[18].trim()) || 80.0) : 80.0,
      usageLimit: cols.length >= 19 ? (parseFloat(cols[18].trim()) || 80.0) : 80.0,
      billableFlag,
      projectType,
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

