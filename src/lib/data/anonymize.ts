/**
 * Engagement Code anonymization for local development.
 *
 * When enabled, every Engagement Code read from the three CSV sources
 * (ai_usage_data, Hours Saved, dev-hours timesheet) is replaced as it is
 * parsed, so the files on disk are never touched. The replacement is a salted,
 * deterministic hash of the code, so the same code maps to the same value in
 * every source (the cross-file joins keep working) and across restarts, with no
 * mapping file to keep around. The original E-/I- prefix is preserved because
 * the app reads it as the billable/internal marker.
 *
 * On by default under `npm run dev` only (NODE_ENV === 'development'); builds
 * and production are untouched. To turn it off in dev, set ANONYMIZE_IN_DEV to
 * false below, or run with ANONYMIZE_ENGAGEMENT_CODES=false.
 */

const ANONYMIZE_IN_DEV = true;
/** Change the salt to get a different (equally stable) set of anonymous codes. */
const SALT = 'roi-engagement-code-v1';

export const anonymizeEnabled =
  ANONYMIZE_IN_DEV && process.env.NODE_ENV === 'development' && process.env.ANONYMIZE_ENGAGEMENT_CODES !== 'false';

/** cyrb53: small, fast, well-distributed 53-bit string hash (pure JS, runs in any runtime). */
function hash53(str: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

const cache = new Map<string, string>();

/** Returns the code unchanged unless anonymization is on. Same input always gives the same output. */
export function anonymizeEngagementCode(code: string): string {
  if (!anonymizeEnabled) return code;
  const trimmed = code.trim();
  if (!trimmed) return code;

  const cached = cache.get(trimmed);
  if (cached) return cached;

  const prefix = (trimmed.toUpperCase().match(/^[A-Z]+-/) || [''])[0];
  // 9 digits: ~500 codes collide with probability well under 0.1%.
  const digits = String(hash53(`${SALT}|${trimmed.toUpperCase()}`) % 1_000_000_000).padStart(9, '0');
  const anon = `${prefix}${digits}`;
  cache.set(trimmed, anon);
  return anon;
}
