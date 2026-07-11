import { resolve, sep } from "node:path";

export const CHANGE_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const PROPOSE_PREFIXES = [/^\/opsx-propose(?:\s+|$)/i, /^\/opsx:propose(?:\s+|$)/i];
const APPLY_PREFIXES = [/^\/opsx-apply(?:\s+|$)/i, /^\/opsx:apply(?:\s+|$)/i];
const ARCHIVE_PREFIXES = [/^\/opsx-archive(?:\s+|$)/i, /^\/opsx:archive(?:\s+|$)/i];

function matchesAny(text: string, prefixes: RegExp[]): boolean {
  const t = text.trim();
  return prefixes.some((re) => re.test(t));
}

function parseNameAfterPrefixes(text: string, prefixes: RegExp[]): string | null {
  const t = text.trim();
  let rest: string | null = null;
  for (const re of prefixes) {
    const m = t.match(re);
    if (m) {
      rest = t.slice(m[0].length).trim();
      break;
    }
  }
  if (rest == null || !rest) return null;
  const first = rest.split(/\s+/)[0] ?? "";
  if (!CHANGE_NAME_RE.test(first)) return null;
  return first;
}

export function isProposeIntent(text: string): boolean {
  return matchesAny(text, PROPOSE_PREFIXES);
}

export function parseProposeChangeName(text: string): string | null {
  return parseNameAfterPrefixes(text, PROPOSE_PREFIXES);
}

export function isApplyIntent(text: string): boolean {
  return matchesAny(text, APPLY_PREFIXES);
}

export function parseApplyChangeName(text: string): string | null {
  return parseNameAfterPrefixes(text, APPLY_PREFIXES);
}

export function isOpsxArchiveIntent(text: string): boolean {
  return matchesAny(text, ARCHIVE_PREFIXES);
}

export function parseOpsxArchiveChangeName(text: string): string | null {
  return parseNameAfterPrefixes(text, ARCHIVE_PREFIXES);
}

/** True if path is the same as or nested under root (after resolve). */
export function isPathInside(root: string, maybeChild: string): boolean {
  const r = resolve(root);
  const c = resolve(maybeChild);
  if (c === r) return true;
  const p = r.endsWith(sep) ? r : r + sep;
  return c.startsWith(p);
}
