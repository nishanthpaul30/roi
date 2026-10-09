// Importing this module pulls in RAW_HOURS_SAVED_DATA (an embedded copy of
// actuals-planned-overall-*.csv). Client Components should go through an API route
// instead, the same way csvLoader.ts's data is only ever reached via
// /api/metrics/raw-rows — this guard turns an accidental client import into
// a build error rather than a silent bundle regression.
import 'server-only';

import { RAW_HOURS_SAVED_DATA } from './rawHoursSavedData';
import type { HoursSavedRow } from './csvTypes';
import { splitCsvLine } from './csvParse';
import { anonymizeEngagementCode, anonymizeEnabled } from './anonymize';

export type { HoursSavedRow } from './csvTypes';

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

let _cache: HoursSavedRow[] | null = null;

// The source file is a dated export (e.g. "actuals-planned-overall-2026-09-30.csv")
// that gets replaced by a newer-dated file each refresh -- matched by prefix
// rather than an exact name, so a new date doesn't need a code change here.
const HOURS_SAVED_FILENAME_PREFIX = 'actuals-planned-overall-';
const HOURS_SAVED_FILENAME_SUFFIX = '.csv';

function getHoursSavedFilePath(): string {
  if (typeof window !== 'undefined') return '';
  const fs = getFs();
  const path = getPath();
  if (!fs || !path) return '';

  const possibleDirs = [
    path.join(process.cwd(), 'public'),
    process.cwd(),
    path.join(process.cwd(), '.next', 'standalone', 'public'),
    path.join(process.cwd(), '.next', 'standalone'),
    path.join(__dirname, '..', '..', '..', 'public'),
    path.join(__dirname, '..', '..', '..'),
  ];

  for (const dir of possibleDirs) {
    try {
      if (!fs.existsSync || !fs.existsSync(dir)) {
        console.log(`[HoursSaved] directory does not exist, skipping: ${dir}`);
        continue;
      }
      const allFiles = fs.readdirSync(dir) as string[];
      const matches = allFiles
        .filter((f) => f.startsWith(HOURS_SAVED_FILENAME_PREFIX) && f.endsWith(HOURS_SAVED_FILENAME_SUFFIX))
        .sort();
      console.log(`[HoursSaved] checked dir: ${dir} — ${allFiles.length} files, ${matches.length} matching "${HOURS_SAVED_FILENAME_PREFIX}*${HOURS_SAVED_FILENAME_SUFFIX}"`);
      if (matches.length > 0) {
        // Lexicographically last -- an ISO date (YYYY-MM-DD) in the filename
        // sorts correctly that way, so the newest dated file wins.
        const resolved = path.join(dir, matches[matches.length - 1]);
        console.log(`[HoursSaved] using file: ${resolved}${matches.length > 1 ? ` (picked newest of ${matches.length} matches: ${matches.join(', ')})` : ''}`);
        return resolved;
      }
    } catch (err) {
      // Ignore fs permission/absence errors in edge runtimes
      console.log(`[HoursSaved] error reading dir ${dir}:`, err);
    }
  }

  // No dated file found on disk -- loadHoursSavedData()'s caller falls back
  // to the embedded RAW_HOURS_SAVED_DATA constant when this is empty.
  console.log('[HoursSaved] no file matching the expected name found in any candidate directory — will fall back to the embedded sample data');
  return '';
}

const MONTH_ABBREVIATIONS = new Set([
  'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
]);

/** True when a header label names a month, in any case/length ("Jul", "jul", "July"). */
function isMonthColumn(header: string): boolean {
  return MONTH_ABBREVIATIONS.has(header.trim().toLowerCase().slice(0, 3));
}

/** Finds a column by trying each candidate header name, case-insensitively. Returns -1 if none match. */
function findColumnIndex(header: string[], ...candidates: string[]): number {
  const lowered = candidates.map((c) => c.toLowerCase());
  return header.findIndex((h) => lowered.includes(h.toLowerCase()));
}

// The six AI tools ai_usage_data.csv's Product column actually uses -- the
// join key both files must agree on.
const CANONICAL_AI_TOOLS = ['chatgpt', 'github', 'claude', 'replit', 'factory', 'cursor'];

/**
 * Maps an Asset Name to one of CANONICAL_AI_TOOLS. Tries an exact match
 * first ("Github" -> "github"); if that fails, falls back to substring
 * containment -- e.g. "GitHub Copilot" or "Cursor AI" both contain a
 * canonical tool name, so they still join correctly without needing an
 * exhaustive alias table for every real-world product name variant. If
 * NEITHER matches, the lowercased value is kept as-is (visible for
 * debugging) rather than silently becoming "unknown" -- it just won't join,
 * exactly as an unrecognized value would without this function at all.
 */
function normalizeAiTool(assetName: string): string {
  const lower = assetName.trim().toLowerCase();
  if (CANONICAL_AI_TOOLS.includes(lower)) return lower;
  const match = CANONICAL_AI_TOOLS.find((tool) => lower.includes(tool));
  return match || lower;
}

/**
 * Parses actuals-planned-overall-*.csv by HEADER NAME, not column position — the real
 * source file carries more fields than this feature uses, so each needed
 * column (Engagement Code, Asset Name, the approved-hours figure, Asset
 * Type) is located by its header text, wherever it falls, and anything else
 * is ignored rather than misread. Month columns are detected the same way:
 * any header matching a month name/abbreviation, regardless of position, so
 * unrelated columns can sit before, after, or between them.
 *
 * Asset Type ("ai" | "non-ai") is a filter, not a stored field: a "non-ai"
 * row is dropped here and never reaches the rest of the app, since this
 * feature is AI-tool ROI only.
 */
export function parseRawHoursSavedText(raw: string): HoursSavedRow[] {
  console.log(`[HoursSaved] parseRawHoursSavedText called with ${raw.length} raw characters`);
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  console.log(`[HoursSaved] ${lines.length} non-empty lines (including header)`);
  if (lines.length < 2) {
    console.log('[HoursSaved] fewer than 2 lines (header + at least 1 data row expected) — returning 0 rows');
    return [];
  }

  const header = splitCsvLine(lines[0]).map(h => h.trim());
  console.log('[HoursSaved] header row:', header);

  const engagementCodeIdx = findColumnIndex(header, 'Engagement Code', 'EngagementCode');
  const assetNameIdx = findColumnIndex(header, 'Asset Name', 'AssetName');
  const assetTypeIdx = findColumnIndex(header, 'Asset Type', 'AssetType');
  const approvedIdx = findColumnIndex(header, 'Approved (Actual)', 'ApprovedTotalHrs', 'Approved Total Hrs', 'Approved');
  const pendingApprovalIdx = findColumnIndex(header, 'Pending Approval (Submitted)', 'Pending Approval', 'PendingApproval', 'Pending');
  console.log('[HoursSaved] resolved column indices:', {
    engagementCodeIdx, assetNameIdx, assetTypeIdx, approvedIdx, pendingApprovalIdx,
  });

  if (engagementCodeIdx === -1 || assetNameIdx === -1) {
    // The two columns this data is keyed by are missing entirely -- nothing
    // downstream can be trusted, so fail loudly instead of silently
    // returning empty/garbage rows.
    console.error('[HoursSaved] FATAL: missing "Engagement Code" or "Asset Name" column — got headers:', header);
    return [];
  }

  // Month columns: by name, wherever they fall, in header order.
  const monthColumns = header
    .map((label, idx) => ({ label, idx }))
    .filter(({ label }) => isMonthColumn(label));
  console.log(`[HoursSaved] detected ${monthColumns.length} month columns:`, monthColumns.map((m) => m.label));
  if (monthColumns.length === 0) {
    console.log('[HoursSaved] WARNING: no month columns detected — every row will show 0 hours saved. Check that month headers match a 3-letter abbreviation (jan/feb/mar/.../dec).');
  }

  const rows: HoursSavedRow[] = [];
  const skippedByAssetType: string[] = [];
  const seenAssetTypeValues = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const get = (idx: number) => (idx >= 0 && cols[idx] !== undefined ? cols[idx].trim() : '');

    if (assetTypeIdx !== -1) {
      const rawAssetType = get(assetTypeIdx);
      seenAssetTypeValues.add(JSON.stringify(rawAssetType)); // JSON.stringify surfaces hidden whitespace/case
      if (rawAssetType.toLowerCase() !== 'ai') {
        skippedByAssetType.push(rawAssetType);
        continue;
      }
    }

    // The real source file can carry a compound value here, e.g.
    // "E-117775 - CYBER SECURITY" (code + a trailing description) instead of
    // the bare code ai_usage_data.csv's projectCode uses. Extracting just the
    // leading E-NNNNNN / I-NNNNNN pattern keeps the join exact-match; a value
    // that doesn't start with that pattern is left as-is (trimmed) rather
    // than silently emptied.
    const rawEngagementCode = get(engagementCodeIdx);
    const engagementCodeMatch = rawEngagementCode.match(/^[A-Za-z]-\d+/);
    const engagementCode = anonymizeEngagementCode(engagementCodeMatch ? engagementCodeMatch[0] : rawEngagementCode);
    const assetName = get(assetNameIdx);
    const approvedTotalHrs = parseFloat(get(approvedIdx)) || 0;
    const pendingApprovalHrs = parseFloat(get(pendingApprovalIdx)) || 0;

    const monthlyHours: Record<string, number> = {};
    let sumOfMonthlyHrs = 0;
    for (const { label, idx } of monthColumns) {
      const hrs = parseFloat(get(idx)) || 0;
      monthlyHours[label] = hrs;
      sumOfMonthlyHrs += hrs;
    }

    const aiTool = normalizeAiTool(assetName);
    if (rows.length < 3) {
      // Log the first few rows in full so you can see exactly how each raw
      // value got transformed -- compare engagementCode/aiTool here against
      // what you'd expect to join against in ai_usage_data.csv.
      console.log(`[HoursSaved] row ${i}: raw Engagement Code="${anonymizeEnabled ? '(hidden: anonymized)' : rawEngagementCode}" -> engagementCode="${engagementCode}" | raw Asset Name="${assetName}" -> aiTool="${aiTool}" | approvedTotalHrs=${approvedTotalHrs}`);
    }

    rows.push({
      engagementCode,
      assetName,
      aiTool,
      approvedTotalHrs,
      pendingApprovalHrs,
      monthlyHours,
      sumOfMonthlyHrs,
    });
  }

  console.log(`[HoursSaved] SUMMARY: ${lines.length - 1} data rows seen, ${skippedByAssetType.length} skipped by Asset Type filter, ${rows.length} rows returned`);
  if (assetTypeIdx !== -1) {
    console.log('[HoursSaved] distinct raw Asset Type values seen (JSON-quoted to reveal hidden whitespace):', Array.from(seenAssetTypeValues));
  }
  if (rows.length === 0 && lines.length > 1) {
    console.log('[HoursSaved] WARNING: 0 rows returned despite data lines being present. Most likely cause: every row\'s Asset Type value failed the exact "ai" check above, OR the delimiter in this file is not a comma (check the header row logged above -- if it looks like one long unsplit string, that\'s the problem).');
  }

  return rows;
}

/**
 * Load and parse actuals-planned-overall-*.csv from the file system, or the embedded
 * string fallback when a filesystem read isn't available (e.g. edge
 * runtimes). Results are cached in-memory for the lifetime of the server
 * process.
 */
export function loadHoursSavedData(): HoursSavedRow[] {
  if (_cache) {
    console.log(`[HoursSaved] returning cached result: ${_cache.length} rows`);
    return _cache;
  }

  console.log('[HoursSaved] loadHoursSavedData() called, no cache yet — resolving file path...');
  let raw = '';
  try {
    const fsModule = getFs();
    const csvPath = getHoursSavedFilePath();
    if (fsModule && fsModule.readFileSync) {
      raw = fsModule.readFileSync(/*turbopackIgnore: true*/ csvPath, 'utf-8');
      console.log(`[HoursSaved] read ${raw.length} characters from disk: ${csvPath}`);
    } else {
      console.log('[HoursSaved] fs module unavailable in this runtime — will use embedded fallback');
    }
  } catch (err) {
    // Cloudflare Pages / Workers Edge runtime fallback
    console.log('[HoursSaved] fs read threw, falling back to embedded data:', err);
    raw = RAW_HOURS_SAVED_DATA;
  }

  if (!raw || raw.trim().length === 0) {
    console.log('[HoursSaved] disk read was empty — using embedded RAW_HOURS_SAVED_DATA instead (this is the OLD data baked in at the last `node scripts/embedCsv.js` run, not necessarily your current file!)');
    raw = RAW_HOURS_SAVED_DATA;
  }

  _cache = parseRawHoursSavedText(raw);
  return _cache;
}

export function clearHoursSavedCache() {
  _cache = null;
}
