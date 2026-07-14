import {
  accessSync,
  constants,
  existsSync,
  realpathSync,
  statSync,
} from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export interface OpsJsonEnvelope {
  schemaVersion?: number;
  ok?: boolean;
  command?: string;
  result?: Record<string, unknown>;
  error?: {
    code?: string;
    message?: string;
    details?: Record<string, unknown>;
  };
}

export interface RunOpsResult {
  code: number;
  stdout: string;
  stderr: string;
  json?: OpsJsonEnvelope;
}

export type OpsBinSource = "explicit" | "package" | "path" | "module";

export type OpsBinCandidateFailure = {
  source: OpsBinSource;
  path: string;
  reason: "missing" | "not_file" | "not_executable" | "unresolvable";
};

export type OpsBinResolution =
  | { ok: true; path: string; source: OpsBinSource }
  | {
      ok: false;
      code: "explicit_invalid" | "not_found";
      message: string;
      candidates: OpsBinCandidateFailure[];
    };

export type ResolveOpsBinOptions = {
  envBin?: string | undefined;
  pathLookup?: () => string | undefined;
  projectRoot?: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  moduleFallback?: boolean;
};

function validateCandidate(
  candidate: string,
  source: OpsBinSource,
  cwd: string,
): { ok: true; path: string; source: OpsBinSource } | { ok: false; failure: OpsBinCandidateFailure } {
  const absolute = isAbsolute(candidate) ? candidate : resolve(cwd, candidate);
  if (!existsSync(absolute)) {
    return {
      ok: false,
      failure: { source, path: absolute, reason: "missing" },
    };
  }
  try {
    if (!statSync(absolute).isFile()) {
      return {
        ok: false,
        failure: { source, path: absolute, reason: "not_file" },
      };
    }
    accessSync(absolute, constants.X_OK);
    return { ok: true, path: realpathSync(absolute), source };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return {
      ok: false,
      failure: {
        source,
        path: absolute,
        reason: code === "EACCES" ? "not_executable" : "unresolvable",
      },
    };
  }
}

function pathCandidate(options: ResolveOpsBinOptions): string | undefined {
  if (options.pathLookup) return options.pathLookup();
  const which = spawnSync("sh", ["-c", "command -v openspec-ops"], {
    encoding: "utf8",
    env: options.env ?? process.env,
  });
  if (which.status !== 0) return undefined;
  return which.stdout.trim() || undefined;
}

function moduleCandidates(): string[] {
  try {
    const here = resolve(fileURLToPath(import.meta.url), "..");
    // src/ops-runtime or dist/ops-runtime → package root
    return [
      resolve(here, "../../bin/openspec-ops"),
      resolve(here, "../bin/openspec-ops"),
    ];
  } catch {
    return [];
  }
}

/**
 * Resolve a CLI runtime with provenance.
 *
 * With loaded package context: explicit override → package bin → PATH →
 * module-relative fallback. An explicit but invalid override fails closed.
 */
export function resolveOpsBinDetailed(
  options: ResolveOpsBinOptions = {},
): OpsBinResolution {
  const cwd = options.cwd ?? process.cwd();
  const failures: OpsBinCandidateFailure[] = [];
  const explicit = Object.prototype.hasOwnProperty.call(options, "envBin")
    ? options.envBin
    : process.env.OPENSPEC_OPS_BIN;

  if (explicit?.trim()) {
    const checked = validateCandidate(explicit.trim(), "explicit", cwd);
    if (checked.ok) return checked;
    return {
      ok: false,
      code: "explicit_invalid",
      message: `Explicit OPENSPEC_OPS_BIN is unusable (${checked.failure.reason}): ${checked.failure.path}`,
      candidates: [checked.failure],
    };
  }

  if (options.projectRoot) {
    const checked = validateCandidate(
      resolve(options.projectRoot, "bin/openspec-ops"),
      "package",
      cwd,
    );
    if (checked.ok) return checked;
    failures.push(checked.failure);
  }

  const fromPath = pathCandidate(options);
  if (fromPath) {
    const checked = validateCandidate(fromPath, "path", cwd);
    if (checked.ok) return checked;
    failures.push(checked.failure);
  }

  if (options.moduleFallback !== false) {
    for (const candidate of moduleCandidates()) {
      const checked = validateCandidate(candidate, "module", cwd);
      if (checked.ok) return checked;
      if (!failures.some((failure) => failure.path === checked.failure.path)) {
        failures.push(checked.failure);
      }
    }
  }

  const packageFailure = failures.find((failure) => failure.source === "package");
  return {
    ok: false,
    code: "not_found",
    message: packageFailure
      ? `Package-local openspec-ops CLI is unusable (${packageFailure.reason}) and no executable override/PATH fallback was found: ${packageFailure.path}`
      : "openspec-ops CLI not found in explicit override, loaded package, PATH, or module fallback",
    candidates: failures,
  };
}

/** Compatibility wrapper for existing extension/doctor callers. */
export function resolveOpsBin(options: ResolveOpsBinOptions = {}): string | null {
  const result = resolveOpsBinDetailed(options);
  return result.ok ? result.path : null;
}

export function runOps(
  bin: string,
  args: string[],
  options: { cwd?: string } = {},
): RunOpsResult {
  const fullArgs = args.includes("--json") ? args : [...args, "--json"];
  const res = spawnSync(bin, fullArgs, {
    cwd: options.cwd,
    encoding: "utf8",
    env: { ...process.env },
  });
  if (res.error) {
    return {
      code: 10,
      stdout: res.stdout ?? "",
      stderr: `Failed to execute openspec-ops (${(res.error as NodeJS.ErrnoException).code ?? "spawn_error"}): ${res.error.message}`,
    };
  }
  const code = res.status ?? 10;
  const stdout = res.stdout ?? "";
  const stderr = res.stderr ?? "";
  let json: OpsJsonEnvelope | undefined;
  if (stdout.trim()) {
    try {
      json = JSON.parse(stdout) as OpsJsonEnvelope;
    } catch {
      json = undefined;
    }
  }
  return { code, stdout, stderr, json };
}
