/**
 * generateDevHoursCsv.js
 *
 * Synthesizes a mock "developer timesheet" CSV -- how many hours developers
 * clocked per engagement per month -- since no real system for this exists
 * yet. Hours Saved ROI needs this to weigh the dollar value of hours saved
 * against the FULL cost of an engagement's AI adoption (AI tool spend + the
 * human effort behind it), not tool spend alone. Replace this generator
 * with a real timesheet feed once one exists; until then this keeps that
 * side of the ROI math populated with a plausible, deterministic figure
 * instead of silently absent.
 *
 * Extracts every distinct Engagement Code straight from ai_usage_data.csv
 * (so dev hours only ever exist for engagements the rest of the app already
 * knows about) and mocks FY Jul-Jun monthly hours for each. Run manually
 * whenever ai_usage_data.csv is updated (same convention as embed-csv.js --
 * NOT wired into the build, since ai_usage_data.csv's source file can change
 * independently of a code build, and re-running on every build would
 * silently regenerate mock data against a source that hasn't actually
 * changed). Writes both:
 *   - public/dev-hours-timesheet.csv (human-readable)
 *   - src/lib/data/rawDevHoursData.ts (embedded fallback for edge runtimes
 *     with no reliable filesystem read at request time, mirroring
 *     embedCsv.js's output shape)
 *
 * Usage:
 *   node scripts/generateDevHoursCsv.js
 *   (or: npm run generate-dev-hours)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCE_CSV = path.join(ROOT, 'public', 'ai_usage_data.csv');
const OUTPUT_CSV = path.join(ROOT, 'public', 'dev-hours-timesheet.csv');
const OUTPUT_TS = path.join(ROOT, 'src', 'lib', 'data', 'rawDevHoursData.ts');

const FY_MONTHS = ['jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar', 'apr', 'may', 'jun'];
const MIN_HRS_PER_MONTH = 40;
const MAX_HRS_PER_MONTH = 160;

// Quote-aware CSV field split, matching src/lib/data/csvParse.ts -- duplicated
// here since this script runs standalone under plain Node, outside the app's
// TS module graph.
function splitCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = false; }
      } else { current += char; }
    } else if (char === '"') { inQuotes = true; }
    else if (char === ',') { fields.push(current); current = ''; }
    else { current += char; }
  }
  fields.push(current);
  return fields;
}

// Simple seeded LCG -- deterministic across builds, so the mock data doesn't
// change (and silently move ROI figures) between builds with no real data
// update.
function createRng(seed) {
  let state = seed;
  return function () {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

if (!fs.existsSync(SOURCE_CSV)) {
  console.error(`❌ No source file at ${SOURCE_CSV} -- skipping dev hours generation.`);
  process.exit(0);
}

const raw = fs.readFileSync(SOURCE_CSV, 'utf-8');
const lines = raw.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
const header = splitCsvLine(lines[0]).map((h) => h.trim());
const engagementCodeIdx = header.findIndex((h) => h.toLowerCase() === 'engagement code');

if (engagementCodeIdx === -1) {
  console.error('❌ No "Engagement Code" column found in ai_usage_data.csv -- skipping dev hours generation.');
  process.exit(0);
}

const engagementCodes = new Set();
for (let i = 1; i < lines.length; i++) {
  const cols = splitCsvLine(lines[i]);
  const code = (cols[engagementCodeIdx] || '').trim();
  if (code) engagementCodes.add(code);
}

const sortedCodes = Array.from(engagementCodes).sort();
const rand = createRng(42);

const rows = sortedCodes.map((code) => {
  const monthValues = FY_MONTHS.map(() =>
    Math.round(MIN_HRS_PER_MONTH + rand() * (MAX_HRS_PER_MONTH - MIN_HRS_PER_MONTH))
  );
  return [code, ...monthValues];
});

const csvLines = [['Engagement Code', ...FY_MONTHS].join(','), ...rows.map((r) => r.join(','))];
const csvOutput = csvLines.join('\n') + '\n';

fs.writeFileSync(OUTPUT_CSV, csvOutput, 'utf-8');

const escaped = csvOutput
  .replace(/\\/g, '\\\\')
  .replace(/`/g, '\\`')
  .replace(/\$\{/g, '\\${');

const tsOutput = `// AUTO-GENERATED — do not edit manually.
// Re-generate by running: node scripts/generateDevHoursCsv.js
// Mock developer-timesheet data for ${sortedCodes.length} engagements, generated ${new Date().toISOString()}.
// Deterministic (seeded) mock data, since no real timesheet source exists
// yet -- see this script's header comment for why.
export const RAW_DEV_HOURS_DATA = \`${escaped}\`;
`;

fs.writeFileSync(OUTPUT_TS, tsOutput, 'utf-8');

console.log(`✅ Generated mock dev hours timesheet for ${sortedCodes.length} engagements.`);
console.log(`   CSV   : public/dev-hours-timesheet.csv`);
console.log(`   Output: src/lib/data/rawDevHoursData.ts`);
