/**
 * embedCsv.js
 *
 * Embeds the CSV data sources into src/lib/data/*.ts as TypeScript string
 * constants, so they're available on Cloudflare Pages/Workers edge runtimes
 * that don't have a reliable filesystem read at request time.
 * Run this script whenever a source CSV is updated, before deploying.
 *
 * Usage:
 *   node scripts/embedCsv.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/**
 * Resolves a CSV filename that may contain a '*' wildcard (e.g. a dated
 * export like "actuals-planned-overall-2026-09-30.csv", which gets replaced
 * by a newer-dated file each time it's refreshed). When the pattern matches
 * more than one file, the lexicographically last name wins -- an ISO date
 * (YYYY-MM-DD) sorts correctly that way, so the newest dated file is picked
 * automatically without editing this script again next month.
 */
function findCsv(filenamePattern) {
  for (const dir of [path.join(ROOT, 'public'), ROOT]) {
    if (!filenamePattern.includes('*')) {
      const exact = path.join(dir, filenamePattern);
      if (fs.existsSync(exact)) return exact;
      continue;
    }
    if (!fs.existsSync(dir)) continue;
    const regex = new RegExp('^' + filenamePattern.split('*').map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
    const matches = fs.readdirSync(dir).filter(f => regex.test(f)).sort();
    if (matches.length > 0) return path.join(dir, matches[matches.length - 1]);
  }
  return null;
}

function embed({ csvFilenamePattern, constantName, outFilename }) {
  const csvPath = findCsv(csvFilenamePattern);
  const outPath = path.join(ROOT, 'src', 'lib', 'data', outFilename);

  if (!csvPath) {
    console.error(`❌ No CSV file matching "${csvFilenamePattern}" found.`);
    process.exit(1);
  }

  const resolvedFilename = path.basename(csvPath);
  const csv = fs.readFileSync(csvPath, 'utf-8');
  const lines = csv.split('\n').filter(l => l.trim().length > 0);
  const rowCount = lines.length - 1; // subtract header

  // Escape backticks and template literal syntax for safe embedding in a TS template string
  const escaped = csv
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');

  const output = `// AUTO-GENERATED — do not edit manually.
// Re-generate by running: node scripts/embedCsv.js
// Source: ${resolvedFilename} (${rowCount} data rows, generated ${new Date().toISOString()})
export const ${constantName} = \`${escaped}\`;
`;

  fs.writeFileSync(outPath, output, 'utf-8');

  console.log(`✅ ${outFilename} updated successfully.`);
  console.log(`   Source : ${resolvedFilename}`);
  console.log(`   Rows   : ${rowCount}`);
  console.log(`   Output : src/lib/data/${outFilename}`);
  console.log(`   Size   : ${(Buffer.byteLength(output, 'utf-8') / 1024).toFixed(1)} KB`);
}

embed({ csvFilenamePattern: 'ai_usage_data.csv', constantName: 'RAW_CSV_DATA', outFilename: 'rawCsvData.ts' });
embed({ csvFilenamePattern: 'actuals-planned-overall-*.csv', constantName: 'RAW_HOURS_SAVED_DATA', outFilename: 'rawHoursSavedData.ts' });
