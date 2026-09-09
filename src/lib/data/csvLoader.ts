import * as fs from 'fs';
import * as path from 'path';

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
  orgSubServiceLine: string;    // Org Sub Service Line: Banking, Strategy, etc.
  country: string;              // Country
  region: string;               // Region: Middle East, ANZ, Europe, etc.
  managementRegion: string;     // Management Region: EMEA | APAC | Americas
  projectCode: string;          // Project Investment Code: PRJ-XXX-XXXX
}

let _cache: CsvUsageRow[] | null = null;

function getCsvFilePath(): string {
  const possiblePaths = [
    path.join(process.cwd(), 'public', 'ai_usage_data.csv'),
    path.join(process.cwd(), 'ai_usage_data.csv'),
    path.join(process.cwd(), '.next', 'standalone', 'public', 'ai_usage_data.csv'),
    path.join(process.cwd(), '.next', 'standalone', 'ai_usage_data.csv'),
    path.join(__dirname, '..', '..', '..', 'public', 'ai_usage_data.csv'),
    path.join(__dirname, '..', '..', '..', 'ai_usage_data.csv'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(/*turbopackIgnore: true*/ p)) {
      return p;
    }
  }

  return path.join(process.cwd(), 'public', 'ai_usage_data.csv');
}

/**
 * Load and parse ai_usage_data.csv from the project root or public directory.
 * Results are cached in-memory for the lifetime of the server process.
 */
export function loadCsvData(): CsvUsageRow[] {
  if (_cache && process.env.NODE_ENV !== 'development') return _cache;

  const csvPath = getCsvFilePath();
  const raw = fs.readFileSync(/*turbopackIgnore: true*/ csvPath, 'utf-8');

  const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  // Skip the header row (line 0)
  const rows: CsvUsageRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 17) continue;

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
      projectCode: cols[16].trim(),
    });
  }

  _cache = rows;
  return rows;
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
