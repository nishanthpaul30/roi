/**
 * embedCsv.js
 *
 * Embeds ai_usage_data.csv into src/lib/data/rawCsvData.ts as a TypeScript string constant.
 * Run this script whenever ai_usage_data.csv is updated before deploying to Cloudflare Pages.
 *
 * Usage:
 *   node scripts/embedCsv.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let CSV_PATH = path.join(ROOT, 'ai_usage_data.csv');
if (!fs.existsSync(CSV_PATH)) {
  CSV_PATH = path.join(ROOT, 'public', 'ai_usage_data.csv');
}
const OUT_PATH = path.join(ROOT, 'src', 'lib', 'data', 'rawCsvData.ts');

if (!fs.existsSync(CSV_PATH)) {
  console.error(`❌ CSV file not found at: ${CSV_PATH}`);
  process.exit(1);
}

const csv = fs.readFileSync(CSV_PATH, 'utf-8');
const lines = csv.split('\n').filter(l => l.trim().length > 0);
const rowCount = lines.length - 1; // subtract header

// Escape backticks and template literal syntax for safe embedding in a TS template string
const escaped = csv
  .replace(/\\/g, '\\\\')
  .replace(/`/g, '\\`')
  .replace(/\$\{/g, '\\${');

const output = `// AUTO-GENERATED — do not edit manually.
// Re-generate by running: node scripts/embedCsv.js
// Source: ai_usage_data.csv (${rowCount} data rows, generated ${new Date().toISOString()})
export const RAW_CSV_DATA = \`${escaped}\`;
`;

fs.writeFileSync(OUT_PATH, output, 'utf-8');

console.log(`✅ rawCsvData.ts updated successfully.`);
console.log(`   Source : ai_usage_data.csv`);
console.log(`   Rows   : ${rowCount}`);
console.log(`   Output : src/lib/data/rawCsvData.ts`);
console.log(`   Size   : ${(Buffer.byteLength(output, 'utf-8') / 1024).toFixed(1)} KB`);
