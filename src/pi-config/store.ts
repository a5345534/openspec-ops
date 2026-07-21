/**
 * Openspec-ops Pi config: session overrides + optional user-local preferences.
 * Precedence: session > user > env > default.
 * No repository project config files.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

export type ConfigSource = "session" | "user" | "env" | "default";

export type ConfigEntry = {
  key: string;
  value: string;
  source: ConfigSource;
};

const SESSION = new Map<string, string>();

export const SPEC_REVIEW_MAX_ROUNDS_KEY = "spec-review.max-rounds";
export const SPEC_REVIEW_MAX_ROUNDS_ENV = "OPENSPEC_OPS_SPEC_REVIEW_MAX_ROUNDS";
export const SPEC_REVIEW_MAX_ROUNDS_DEFAULT = 3;

export const IMPL_REVIEW_MAX_ROUNDS_KEY = "impl-review.max-rounds";
export const IMPL_REVIEW_MAX_ROUNDS_ENV = "OPENSPEC_OPS_IMPL_REVIEW_MAX_ROUNDS";
export const IMPL_REVIEW_MAX_ROUNDS_DEFAULT = 3;

export const FINISH_RETURN_TO_MAIN_KEY = "finish.return-to-main";
export const FINISH_RETURN_TO_MAIN_ENV = "OPENSPEC_OPS_FINISH_RETURN_TO_MAIN";
export const FINISH_RETURN_TO_MAIN_DEFAULT = "off" as const;
export type FinishReturnToMainPolicy = "off" | "required";

export const MAX_ROUNDS_MIN = 1;
export const MAX_ROUNDS_MAX = 10;

/** @deprecated use MAX_ROUNDS_MIN */
export const SPEC_REVIEW_MAX_ROUNDS_MIN = MAX_ROUNDS_MIN;
/** @deprecated use MAX_ROUNDS_MAX */
export const SPEC_REVIEW_MAX_ROUNDS_MAX = MAX_ROUNDS_MAX;

const ROOT_DIR = "openspec-ops";
const USER_CONFIG_FILE = "config.json";

const ROUND_KEYS: Record<
  string,
  { env: string; defaultValue: number }
> = {
  [SPEC_REVIEW_MAX_ROUNDS_KEY]: {
    env: SPEC_REVIEW_MAX_ROUNDS_ENV,
    defaultValue: SPEC_REVIEW_MAX_ROUNDS_DEFAULT,
  },
  [IMPL_REVIEW_MAX_ROUNDS_KEY]: {
    env: IMPL_REVIEW_MAX_ROUNDS_ENV,
    defaultValue: IMPL_REVIEW_MAX_ROUNDS_DEFAULT,
  },
};

const KNOWN_KEYS = new Set([
  ...Object.keys(ROUND_KEYS),
  FINISH_RETURN_TO_MAIN_KEY,
]);

export type ConfigResolveOptions = {
  env?: NodeJS.ProcessEnv;
  agentDir?: string | null;
};

function optionsFrom(
  envOrOpts?: NodeJS.ProcessEnv | ConfigResolveOptions,
  agentDir?: string | null,
): ConfigResolveOptions {
  if (
    envOrOpts != null &&
    typeof envOrOpts === "object" &&
    ("env" in envOrOpts || "agentDir" in envOrOpts)
  ) {
    return envOrOpts as ConfigResolveOptions;
  }
  return {
    env: (envOrOpts as NodeJS.ProcessEnv | undefined) ?? process.env,
    agentDir,
  };
}

export function resetSessionConfig(): void {
  SESSION.clear();
}

export function listKnownKeys(): string[] {
  return [...KNOWN_KEYS];
}

export function isKnownKey(key: string): boolean {
  return KNOWN_KEYS.has(key);
}

export function opsConfigRoot(agentDir: string): string {
  return join(agentDir, ROOT_DIR);
}

export function userConfigPath(agentDir: string): string {
  return join(opsConfigRoot(agentDir), USER_CONFIG_FILE);
}

/** Normalize and validate a value for storage; throws on invalid. */
export function normalizeConfigValue(key: string, value: string): string {
  if (!isKnownKey(key)) {
    throw new Error(`Unknown config key '${key}'. Known: ${listKnownKeys().join(", ")}`);
  }
  if (key in ROUND_KEYS) {
    return String(parseMaxRoundsStrict(value));
  }
  if (key === FINISH_RETURN_TO_MAIN_KEY) {
    return parseFinishReturnToMainStrict(value);
  }
  return value;
}

export function setSessionValue(key: string, value: string): void {
  SESSION.set(key, normalizeConfigValue(key, value));
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
      `max-rounds must be an integer ${MAX_ROUNDS_MIN}–${MAX_ROUNDS_MAX}`,
    );
  }
  const n = Number.parseInt(t, 10);
  if (n < MAX_ROUNDS_MIN || n > MAX_ROUNDS_MAX) {
    throw new Error(
      `max-rounds must be an integer ${MAX_ROUNDS_MIN}–${MAX_ROUNDS_MAX}`,
    );
  }
  return n;
}

export function parseFinishReturnToMainStrict(
  raw: string,
): FinishReturnToMainPolicy {
  const value = String(raw).trim().toLowerCase();
  if (value === "off" || value === "required") return value;
  throw new Error("finish.return-to-main must be 'off' or 'required'");
}

function parseFinishReturnToMainLoose(
  raw: string | undefined,
): FinishReturnToMainPolicy | undefined {
  if (raw == null || String(raw).trim() === "") return undefined;
  try {
    return parseFinishReturnToMainStrict(raw);
  } catch {
    return undefined;
  }
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

export function readUserPreferences(agentDir: string | null | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (agentDir == null || agentDir === "") return map;
  const path = userConfigPath(agentDir);
  if (!existsSync(path)) return map;
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return map;
    for (const [key, raw] of Object.entries(parsed as Record<string, unknown>)) {
      if (!isKnownKey(key) || typeof raw !== "string") continue;
      try {
        map.set(key, normalizeConfigValue(key, raw));
      } catch {
        // ignore invalid entries
      }
    }
  } catch {
    // corrupt file → empty
  }
  return map;
}

function writeUserPreferences(agentDir: string, map: Map<string, string>): void {
  mkdirSync(opsConfigRoot(agentDir), { recursive: true });
  const obj: Record<string, string> = {};
  for (const key of listKnownKeys()) {
    const value = map.get(key);
    if (value != null) obj[key] = value;
  }
  writeFileSync(userConfigPath(agentDir), `${JSON.stringify(obj, null, 2)}\n`, {
    mode: 0o600,
  });
}

export function getUserValue(
  agentDir: string | null | undefined,
  key: string,
): string | undefined {
  return readUserPreferences(agentDir).get(key);
}

export function setUserValue(agentDir: string, key: string, value: string): void {
  const normalized = normalizeConfigValue(key, value);
  const map = readUserPreferences(agentDir);
  map.set(key, normalized);
  writeUserPreferences(agentDir, map);
}

export function unsetUserValue(agentDir: string, key: string): boolean {
  const map = readUserPreferences(agentDir);
  const had = map.delete(key);
  if (had) writeUserPreferences(agentDir, map);
  return had;
}

export function resetUserPreferences(agentDir: string): void {
  writeUserPreferences(agentDir, new Map());
}

function getEffectiveRoundsForKey(
  key: string,
  opts: ConfigResolveOptions,
): { value: number; source: ConfigSource } {
  const meta = ROUND_KEYS[key];
  if (!meta) {
    throw new Error(`Unknown rounds key '${key}'`);
  }
  const env = opts.env ?? process.env;
  const session = SESSION.get(key);
  if (session != null) {
    return { value: parseMaxRoundsStrict(session), source: "session" };
  }
  const user = getUserValue(opts.agentDir, key);
  if (user != null) {
    return { value: parseMaxRoundsStrict(user), source: "user" };
  }
  const fromEnv = parseMaxRoundsLoose(env[meta.env]);
  if (fromEnv != null) {
    return { value: fromEnv, source: "env" };
  }
  return { value: meta.defaultValue, source: "default" };
}

export function getEffectiveFinishReturnToMain(
  envOrOpts: NodeJS.ProcessEnv | ConfigResolveOptions = process.env,
  agentDir?: string | null,
): { value: FinishReturnToMainPolicy; source: ConfigSource } {
  const opts = optionsFrom(envOrOpts, agentDir);
  const env = opts.env ?? process.env;
  const session = SESSION.get(FINISH_RETURN_TO_MAIN_KEY);
  if (session != null) {
    return { value: parseFinishReturnToMainStrict(session), source: "session" };
  }
  const user = getUserValue(opts.agentDir, FINISH_RETURN_TO_MAIN_KEY);
  if (user != null) {
    return { value: parseFinishReturnToMainStrict(user), source: "user" };
  }
  const fromEnv = parseFinishReturnToMainLoose(env[FINISH_RETURN_TO_MAIN_ENV]);
  if (fromEnv != null) return { value: fromEnv, source: "env" };
  return { value: FINISH_RETURN_TO_MAIN_DEFAULT, source: "default" };
}

/** Spec-review max rounds (back-compat helper). */
export function getEffectiveMaxRounds(
  envOrOpts: NodeJS.ProcessEnv | ConfigResolveOptions = process.env,
  agentDir?: string | null,
): { value: number; source: ConfigSource } {
  return getEffectiveRoundsForKey(
    SPEC_REVIEW_MAX_ROUNDS_KEY,
    optionsFrom(envOrOpts, agentDir),
  );
}

export function getEffectiveImplReviewMaxRounds(
  envOrOpts: NodeJS.ProcessEnv | ConfigResolveOptions = process.env,
  agentDir?: string | null,
): { value: number; source: ConfigSource } {
  return getEffectiveRoundsForKey(
    IMPL_REVIEW_MAX_ROUNDS_KEY,
    optionsFrom(envOrOpts, agentDir),
  );
}

export function getEffectiveEntry(
  key: string,
  envOrOpts: NodeJS.ProcessEnv | ConfigResolveOptions = process.env,
  agentDir?: string | null,
): ConfigEntry {
  const opts = optionsFrom(envOrOpts, agentDir);
  if (key in ROUND_KEYS) {
    const { value, source } = getEffectiveRoundsForKey(key, opts);
    return { key, value: String(value), source };
  }
  if (key === FINISH_RETURN_TO_MAIN_KEY) {
    const { value, source } = getEffectiveFinishReturnToMain(opts);
    return { key, value, source };
  }
  if (!isKnownKey(key)) {
    throw new Error(`Unknown config key '${key}'`);
  }
  return { key, value: "", source: "default" };
}

export function showAll(
  envOrOpts: NodeJS.ProcessEnv | ConfigResolveOptions = process.env,
  agentDir?: string | null,
): ConfigEntry[] {
  const opts = optionsFrom(envOrOpts, agentDir);
  return listKnownKeys().map((k) => getEffectiveEntry(k, opts));
}

/** Human lines for agent injection. */
export function formatConfigInjection(
  envOrOpts: NodeJS.ProcessEnv | ConfigResolveOptions = process.env,
  agentDir?: string | null,
): string {
  const opts = optionsFrom(envOrOpts, agentDir);
  const lines = showAll(opts).map(
    (e) => `${e.key}=${e.value} (source=${e.source})`,
  );
  const impl = getEffectiveImplReviewMaxRounds(opts);
  const spec = getEffectiveMaxRounds(opts);
  const closeout = getEffectiveFinishReturnToMain(opts);
  return [
    "openspec-ops config (effective for this Pi session; not a project file):",
    ...lines.map((l) => `  ${l}`),
    "Change with /ops-config set|get|show|unset|reset (optional --user). Session overrides reset when Pi restarts; user preferences persist under the agent directory.",
    `For /ops-spec-review: use max rounds = ${spec.value} (source=${spec.source}).`,
    `For /ops-impl-review: use max rounds = ${impl.value} (source=${impl.source}).`,
    closeout.value === "required"
      ? "For /ops-deliver final finish: REQUIRED use --return-to-main; hard-stop on return_to_main_needs_human."
      : "For /ops-deliver final finish: do not pass --return-to-main or primary sync flags unless explicitly requested.",
  ].join("\n");
}
