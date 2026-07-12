import { existsSync, readFileSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { resolveOpsBin } from "../ops-runtime/run-ops.js";

import type { DoctorIssue } from "../types.js";

export type EnvCheckIssue = DoctorIssue;

function safeRealpath(p: string): string | null {
  try {
    return realpathSync(p);
  } catch {
    return null;
  }
}

function which(cmd: string): string | null {
  const r = spawnSync("sh", ["-c", `command -v ${cmd}`], { encoding: "utf8" });
  if (r.status !== 0) return null;
  const p = r.stdout.trim();
  return p || null;
}

/**
 * Env/PATH checks for doctor (ops bin, intercept, consumer propose markers).
 *
 * Does NOT require package-local openspec-propose (package no longer ships it).
 * Marker check only when consumer project has that skill file.
 */
export function collectEnvDoctorIssues(options: {
  primaryPath: string;
  packageRoot?: string;
  env?: NodeJS.ProcessEnv;
  whichOpenspec?: string | null;
}): EnvCheckIssue[] {
  const env = options.env ?? process.env;
  const issues: EnvCheckIssue[] = [];
  const packageRoot = options.packageRoot ?? options.primaryPath;
  const projectRoot = options.primaryPath;

  const opsBin = resolveOpsBin({
    envBin: env.OPENSPEC_OPS_BIN,
    projectRoot: packageRoot,
  });
  if (!opsBin) {
    issues.push({
      id: "ops_bin_missing",
      severity: "warning",
      path: packageRoot,
      message: "openspec-ops CLI not resolvable (OPENSPEC_OPS_BIN / PATH / package bin)",
      hint: "npm link from openspec-ops repo or set OPENSPEC_OPS_BIN",
    });
  }

  const openspec =
    options.whichOpenspec !== undefined ? options.whichOpenspec : which("openspec");

  if (openspec) {
    const real = safeRealpath(openspec) ?? openspec;
    const looksIntercept =
      real.includes("openspec-ops-intercept") || openspec.includes("openspec-ops-intercept");
    if (!looksIntercept) {
      issues.push({
        id: "openspec_not_intercept",
        severity: "info",
        path: openspec,
        message:
          "PATH openspec does not appear to be openspec-ops-intercept (ensure-before-new-change inactive unless aliased)",
        hint: "alias openspec=openspec-ops-intercept and set OPENSPEC_REAL_BIN to stock openspec",
      });
    } else if (!env.OPENSPEC_REAL_BIN) {
      issues.push({
        id: "openspec_real_bin_unset",
        severity: "warning",
        path: openspec,
        message:
          "Intercept appears active but OPENSPEC_REAL_BIN is unset (risk of recursion/mis-resolve)",
        hint: "export OPENSPEC_REAL_BIN to the absolute stock @fission-ai/openspec binary",
      });
    }
  }

  // Consumer project propose skill only (not package tree as OpenSpec distribution)
  const consumerPropose = join(projectRoot, ".pi/skills/openspec-propose/SKILL.md");
  if (existsSync(consumerPropose)) {
    const body = readFileSync(consumerPropose, "utf8");
    if (!body.includes("openspec-ops:worktree-alignment BEGIN")) {
      issues.push({
        id: "propose_skill_alignment_markers_missing",
        severity: "info",
        path: consumerPropose,
        message:
          "Consumer propose skill lacks openspec-ops:worktree-alignment markers (optional paste from docs/snippets)",
        hint: "See docs/snippets/worktree-alignment-block.md after openspec update",
      });
    }
  }

  return issues;
}
