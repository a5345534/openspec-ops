import { CHANGE_NAME_RE } from "../auto-ensure/parse.js";

export { CHANGE_NAME_RE };

const ARCHIVE_PREFIXES = [/^\/opsx-archive(?:\s+|$)/i, /^\/opsx:archive(?:\s+|$)/i];

export function isArchiveIntent(text: string): boolean {
  const t = text.trim();
  return ARCHIVE_PREFIXES.some((re) => re.test(t));
}

/**
 * Extract kebab-case change name as first argument after archive slash command.
 * Returns null if missing/invalid (caller must not arm watch).
 */
export function parseArchiveChangeName(text: string): string | null {
  const t = text.trim();
  let rest: string | null = null;
  for (const re of ARCHIVE_PREFIXES) {
    const m = t.match(re);
    if (m) {
      rest = t.slice(m[0].length).trim();
      break;
    }
  }
  if (rest == null) return null;
  if (!rest) return null;
  const first = rest.split(/\s+/)[0] ?? "";
  if (!CHANGE_NAME_RE.test(first)) return null;
  return first;
}
