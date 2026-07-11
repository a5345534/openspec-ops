import { CHANGE_NAME_RE } from "../auto-ensure/parse.js";

export type NewChangeIntercept =
  | { kind: "new_change"; name: string }
  | { kind: "new_change_invalid_or_missing" }
  | { kind: "passthrough" };

/** Flags that never take a separate value token */
const BOOLEAN_FLAGS = new Set([
  "--json",
  "--yes",
  "-y",
  "--help",
  "-h",
  "--version",
  "-V",
  "--no-color",
]);

/**
 * Collect positional args, skipping flags and their values.
 */
export function positionalArgs(argv: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i]!;
    if (t === "--") continue;
    if (t.startsWith("-")) {
      if (t.includes("=") || BOOLEAN_FLAGS.has(t)) continue;
      // --schema foo / -s foo
      if (i + 1 < argv.length && !argv[i + 1]!.startsWith("-")) {
        i += 1;
      }
      continue;
    }
    out.push(t);
  }
  return out;
}

/**
 * Detect `openspec new change <name>` amid flags.
 * Args should be process.argv.slice(2) style (no node/script).
 */
export function parseOpenspecArgv(argv: string[]): NewChangeIntercept {
  const pos = positionalArgs(argv);
  if (pos[0] !== "new" || pos[1] !== "change") {
    return { kind: "passthrough" };
  }
  const name = pos[2];
  if (name == null || name === "") {
    return { kind: "new_change_invalid_or_missing" };
  }
  if (!CHANGE_NAME_RE.test(name)) {
    return { kind: "new_change_invalid_or_missing" };
  }
  return { kind: "new_change", name };
}
