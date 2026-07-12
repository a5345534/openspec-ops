/**
 * Session-scoped openspec-ops config for Pi (no project config files).
 * Precedence: session override > env > default.
 */

export type ConfigSource = "session" | "env" | "default";

export type ConfigEntry = {
  key: string;
  value: string;
  source: ConfigSource;
};

const SESSION = new Map<string, string>();

export const SPEC_REVIEW_MAX_ROUNDS_KEY = "spec-review.max-rounds";
export const SPEC_REVIEW_MAX_ROUNDS_ENV = "OPENSPEC_OPS_SPEC_REVIEW_MAX_ROUNDS";
export const SPEC_REVIEW_MAX_ROUNDS_DEFAULT = 3;
export const SPEC_REVIEW_MAX_ROUNDS_MIN = 1;
export const SPEC_REVIEW_MAX_ROUNDS_MAX = 10;

const KNOWN_KEYS = new Set([SPEC_REVIEW_MAX_ROUNDS_KEY]);

export function resetSessionConfig(): void {
  SESSION.clear();
}

export function listKnownKeys(): string[] {
  return [...KNOWN_KEYS];
}

export function isKnownKey(key: string): boolean {
  return KNOWN_KEYS.has(key);
}

export function setSessionValue(key: string, value: string): void {
  if (!isKnownKey(key)) {
    throw new Error(`Unknown config key '${key}'. Known: ${listKnownKeys().join(", ")}`);
  }
  if (key === SPEC_REVIEW_MAX_ROUNDS_KEY) {
    SESSION.set(key, String(parseMaxRoundsStrict(value)));
    return;
  }
  SESSION.set(key, value);
}

export function unsetSessionValue(key: string): boolean {
  return SESSION.delete(key);
}

export function getSessionValue(key: string): string | undefined {
  return SESSION.get(key);
}

/** Parse max-rounds; throws on invalid for set path. */
export function parseMaxRoundsStrict(raw: string): number {
  const t = String(raw).trim();
  if (!/^\d+$/.test(t)) {
    throw new Error(
      `spec-review.max-rounds must be an integer ${SPEC_REVIEW_MAX_ROUNDS_MIN}–${SPEC_REVIEW_MAX_ROUNDS_MAX}`,
    );
  }
  const n = Number.parseInt(t, 10);
  if (n < SPEC_REVIEW_MAX_ROUNDS_MIN || n > SPEC_REVIEW_MAX_ROUNDS_MAX) {
    throw new Error(
      `spec-review.max-rounds must be an integer ${SPEC_REVIEW_MAX_ROUNDS_MIN}–${SPEC_REVIEW_MAX_ROUNDS_MAX}`,
    );
  }
  return n;
}

/** Soft parse env/default path: invalid env → ignore. */
export function parseMaxRoundsLoose(raw: string | undefined): number | undefined {
  if (raw == null || String(raw).trim() === "") return undefined;
  try {
    return parseMaxRoundsStrict(String(raw).trim());
  } catch {
    return undefined;
  }
}

export function getEffectiveMaxRounds(
  env: NodeJS.ProcessEnv = process.env,
): { value: number; source: ConfigSource } {
  const session = SESSION.get(SPEC_REVIEW_MAX_ROUNDS_KEY);
  if (session != null) {
    return { value: parseMaxRoundsStrict(session), source: "session" };
  }
  const fromEnv = parseMaxRoundsLoose(env[SPEC_REVIEW_MAX_ROUNDS_ENV]);
  if (fromEnv != null) {
    return { value: fromEnv, source: "env" };
  }
  return { value: SPEC_REVIEW_MAX_ROUNDS_DEFAULT, source: "default" };
}

export function getEffectiveEntry(
  key: string,
  env: NodeJS.ProcessEnv = process.env,
): ConfigEntry {
  if (key === SPEC_REVIEW_MAX_ROUNDS_KEY) {
    const { value, source } = getEffectiveMaxRounds(env);
    return { key, value: String(value), source };
  }
  if (!isKnownKey(key)) {
    throw new Error(`Unknown config key '${key}'`);
  }
  return { key, value: "", source: "default" };
}

export function showAll(env: NodeJS.ProcessEnv = process.env): ConfigEntry[] {
  return listKnownKeys().map((k) => getEffectiveEntry(k, env));
}

/** Human lines for agent injection. */
export function formatConfigInjection(env: NodeJS.ProcessEnv = process.env): string {
  const lines = showAll(env).map(
    (e) => `${e.key}=${e.value} (source=${e.source})`,
  );
  return [
    "openspec-ops config (effective for this Pi session; not a project file):",
    ...lines.map((l) => `  ${l}`),
    "Change with /ops-config set|get|show|unset|reset. Session values reset when Pi restarts.",
  ].join("\n");
}
