export const CHANGE_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const PROPOSE_PREFIXES = [/^\/opsx-propose(?:\s+|$)/i, /^\/opsx:propose(?:\s+|$)/i];

export function isProposeIntent(text: string): boolean {
  const t = text.trim();
  return PROPOSE_PREFIXES.some((re) => re.test(t));
}

/**
 * Extract kebab-case change name as first argument after propose slash command.
 * Returns null if missing/invalid (caller must skip ensure).
 */
export function parseProposeChangeName(text: string): string | null {
  const t = text.trim();
  let rest: string | null = null;
  for (const re of PROPOSE_PREFIXES) {
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
