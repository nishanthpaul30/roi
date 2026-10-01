// Importing this module pulls in RAW_HOURS_SAVED_DATA (an embedded copy of
// actuals-planned-overall-*.csv). Client Components should go through an API route
// instead, the same way csvLoader.ts's data is only ever reached via
// /api/metrics/raw-rows — this guard turns an accidental client import into
// a build error rather than a silent bundle regression.
import 'server-only';

import { RAW_HOURS_SAVED_DATA } from './rawHoursSavedData';
import type { HoursSavedRow } from './csvTypes';

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
      if (!fs.existsSync || !fs.existsSync(dir)) continue;
      const matches = (fs.readdirSync(dir) as string[])
        .filter((f) => f.startsWith(HOURS_SAVED_FILENAME_PREFIX) && f.endsWith(HOURS_SAVED_FILENAME_SUFFIX))
        .sort();
      if (matches.length > 0) {
        // Lexicographically last -- an ISO date (YYYY-MM-DD) in the filename
        // sorts correctly that way, so the newest dated file wins.
        return path.join(dir, matches[matches.length - 1]);
      }
    } catch (_err) {
      // Ignore fs permission/absence errors in edge runtimes
    }
  }

  // No dated file found on disk -- loadHoursSavedData()'s caller falls back
  // to the embedded RAW_HOURS_SAVED_DATA constant when this is empty.
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
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) return [];

  const header = lines[0].split(',').map(h => h.trim());

  const engagementCodeIdx = findColumnIndex(header, 'Engagement Code', 'EngagementCode');
  const assetNameIdx = findColumnIndex(header, 'Asset Name', 'AssetName');
  const assetTypeIdx = findColumnIndex(header, 'Asset Type', 'AssetType');
  const approvedIdx = findColumnIndex(header, 'Approved (Actual)', 'ApprovedTotalHrs', 'Approved Total Hrs', 'Approved');
  const pendingApprovalIdx = findColumnIndex(header, 'Pending Approval (Submitted)', 'Pending Approval', 'PendingApproval', 'Pending');

  if (engagementCodeIdx === -1 || assetNameIdx === -1) {
    // The two columns this data is keyed by are missing entirely -- nothing
    // downstream can be trusted, so fail loudly instead of silently
    // returning empty/garbage rows.
    console.error('actuals-planned-overall-*.csv is missing an "Engagement Code" or "Asset Name" column — got headers:', header);
    return [];
  }

  // Month columns: by name, wherever they fall, in header order.
  const monthColumns = header
    .map((label, idx) => ({ label, idx }))
    .filter(({ label }) => isMonthColumn(label));

  const rows: HoursSavedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const get = (idx: number) => (idx >= 0 && cols[idx] !== undefined ? cols[idx].trim() : '');

    if (assetTypeIdx !== -1 && get(assetTypeIdx).toLowerCase() !== 'ai') continue;

    // The real source file can carry a compound value here, e.g.
    // "E-117775 - CYBER SECURITY" (code + a trailing description) instead of
    // the bare code ai_usage_data.csv's projectCode uses. Extracting just the
    // leading E-NNNNNN / I-NNNNNN pattern keeps the join exact-match; a value
    // that doesn't start with that pattern is left as-is (trimmed) rather
    // than silently emptied.
    const rawEngagementCode = get(engagementCodeIdx);
    const engagementCodeMatch = rawEngagementCode.match(/^[A-Za-z]-\d+/);
    const engagementCode = engagementCodeMatch ? engagementCodeMatch[0] : rawEngagementCode;
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

    rows.push({
      engagementCode,
      assetName,
      aiTool: normalizeAiTool(assetName),
      approvedTotalHrs,
      pendingApprovalHrs,
      monthlyHours,
      sumOfMonthlyHrs,
      realizationPercent: approvedTotalHrs > 0 ? Number(((sumOfMonthlyHrs / approvedTotalHrs) * 100).toFixed(1)) : 0,
    });
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
  if (_cache) return _cache;

  let raw = '';
  try {
    const fsModule = getFs();
    const csvPath = getHoursSavedFilePath();
    if (fsModule && fsModule.readFileSync) {
      raw = fsModule.readFileSync(/*turbopackIgnore: true*/ csvPath, 'utf-8');
    }
  } catch (_err) {
    // Cloudflare Pages / Workers Edge runtime fallback
    raw = RAW_HOURS_SAVED_DATA;
  }

  if (!raw || raw.trim().length === 0) {
    raw = RAW_HOURS_SAVED_DATA;
  }

  _cache = parseRawHoursSavedText(raw);
  return _cache;
}

export function clearHoursSavedCache() {
  _cache = null;
}
