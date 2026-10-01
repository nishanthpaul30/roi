/**
 * Splits one CSV line into fields, honoring RFC4180-style quoting: a field
 * wrapped in "..." can itself contain commas, and a literal quote inside it
 * is written as "" (doubled). Shared by every loader that parses a raw CSV
 * string by hand (hoursSavedLoader.ts, devHoursLoader.ts) instead of each
 * keeping its own copy. Does not handle a quoted field spanning multiple
 * physical lines (an embedded newline) -- not seen in this data so far.
 */
export function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}
