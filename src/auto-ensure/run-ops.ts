import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

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

/**
 * Binary resolution (same order as ops-* skills):
 * 1. OPENSPEC_OPS_BIN
 * 2. PATH via `command -v` equivalent — caller may pass which lookup
 * 3. projectRoot/bin/openspec-ops
 */
export function resolveOpsBin(options: {
  envBin?: string | undefined;
  pathLookup?: () => string | undefined;
  projectRoot?: string;
}): string | null {
  const envBin = options.envBin ?? process.env.OPENSPEC_OPS_BIN;
  if (envBin && existsSync(envBin)) return envBin;

  if (options.pathLookup) {
    const fromPath = options.pathLookup();
    if (fromPath && existsSync(fromPath)) return fromPath;
  } else {
    const which = spawnSync("sh", ["-c", "command -v openspec-ops"], {
      encoding: "utf8",
    });
    if (which.status === 0) {
      const p = which.stdout.trim();
      if (p && existsSync(p)) return p;
    }
  }

  if (options.projectRoot) {
    const local = resolve(options.projectRoot, "bin/openspec-ops");
    if (existsSync(local)) return local;
  }

  return null;
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
