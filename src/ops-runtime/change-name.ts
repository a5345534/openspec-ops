/** Kebab-case OpenSpec change name */
export const CHANGE_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isKebabChangeName(name: string): boolean {
  return CHANGE_NAME_RE.test(name);
}

/** Parse first kebab token + remainder of slash args (e.g. ops-deliver). */
export function parseSlashChangeAndRest(args: string | undefined): {
  change: string | null;
  rest: string;
} {
  const trimmed = (args ?? "").trim();
  if (!trimmed) return { change: null, rest: "" };
  const m = trimmed.match(/^(\S+)(?:\s+(.*))?$/s);
  const first = m?.[1] ?? "";
  const rest = (m?.[2] ?? "").trim();
  if (first && CHANGE_NAME_RE.test(first)) {
    return { change: first, rest };
  }
  return { change: null, rest: trimmed };
}
