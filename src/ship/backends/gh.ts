import { spawnSync } from "node:child_process";
import { CliError } from "../../types.js";
import type {
  CreateOrReusePrInput,
  CreateOrReusePrResult,
  MergedPullRequest,
  MergeStatusBackend,
  PrBackend,
} from "../pr-backend.js";

function runGh(
  args: string[],
  cwd: string,
): { status: number; stdout: string; stderr: string } {
  const res = spawnSync("gh", args, {
    cwd,
    encoding: "utf8",
    env: process.env,
  });
  if (res.error) {
    const msg = res.error.message;
    if ((res.error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new CliError(
        "pr_backend_unavailable",
        "GitHub CLI `gh` not found on PATH. Install: https://cli.github.com/",
        { backend: "gh" },
      );
    }
    throw new CliError("pr_failed", `Failed to spawn gh: ${msg}`, { backend: "gh" });
  }
  return {
    status: res.status ?? 10,
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? "",
  };
}

function ensureGhAvailable(cwd: string): void {
  const res = runGh(["--version"], cwd);
  if (res.status !== 0) {
    throw new CliError(
      "pr_backend_unavailable",
      "GitHub CLI `gh` is not usable. Install/auth: https://cli.github.com/",
      { backend: "gh", stderr: res.stderr.trim() },
    );
  }
}

function findExistingPr(
  cwd: string,
  head: string,
): CreateOrReusePrResult | null {
  const res = runGh(
    ["pr", "list", "--head", head, "--state", "open", "--json", "url,number", "--limit", "1"],
    cwd,
  );
  if (res.status !== 0) {
    return null;
  }
  try {
    const arr = JSON.parse(res.stdout.trim() || "[]") as Array<{
      url?: string;
      number?: number;
    }>;
    const first = arr[0];
    if (first?.url && typeof first.number === "number") {
      return { url: first.url, number: first.number, alreadyExisted: true };
    }
  } catch {
    return null;
  }
  return null;
}

export function createGhBackend(): PrBackend {
  return {
    id: "gh",
    createOrReusePullRequest(input: CreateOrReusePrInput): CreateOrReusePrResult {
      ensureGhAvailable(input.cwd);

      const existing = findExistingPr(input.cwd, input.head);
      if (existing) return existing;

      const args = [
        "pr",
        "create",
        "--base",
        input.base,
        "--head",
        input.head,
        "--title",
        input.title,
        "--body",
        input.body || "",
      ];
      if (input.draft) args.push("--draft");
      // Note: older gh (e.g. 2.45) does not support `pr create --json`

      const res = runGh(args, input.cwd);
      if (res.status !== 0) {
        // Race: PR created elsewhere
        const again = findExistingPr(input.cwd, input.head);
        if (again) return again;
        throw new CliError(
          "pr_failed",
          res.stderr.trim() || res.stdout.trim() || "gh pr create failed",
          {
            backend: "gh",
            status: res.status,
            hint: "Branch may already be pushed; fix auth/base and re-run ship (no new commit if clean).",
          },
        );
      }
      const url = res.stdout.trim().split(/\s+/).find((t) => t.startsWith("http")) ?? res.stdout.trim();
      if (!url.startsWith("http")) {
        // Prefer list lookup for number/url
        const listed = findExistingPr(input.cwd, input.head);
        if (listed) return { ...listed, alreadyExisted: false };
        throw new CliError("pr_failed", "gh pr create did not print a PR URL", {
          backend: "gh",
          stdout: res.stdout.trim(),
        });
      }
      const numMatch = url.match(/\/pull\/(\d+)/);
      const number = numMatch ? Number.parseInt(numMatch[1]!, 10) : 0;
      if (!number) {
        const listed = findExistingPr(input.cwd, input.head);
        if (listed) return { ...listed, alreadyExisted: false };
      }
      return { url, number: number || 0, alreadyExisted: false };
    },
  };
}

export function resolvePrBackend(id: string): PrBackend {
  if (id === "gh") return createGhBackend();
  throw new CliError("usage", `Unknown PR backend '${id}' (v1 supports: gh)`, {
    backend: id,
  });
}

export function createGhMergeStatusBackend(): MergeStatusBackend {
  return {
    id: "gh",
    findMergedPullRequest(input: { cwd: string; head: string }): MergedPullRequest | null {
      ensureGhAvailable(input.cwd);
      const res = runGh(
        [
          "pr",
          "list",
          "--head",
          input.head,
          "--state",
          "merged",
          "--json",
          "number,url,baseRefName,mergedAt",
          "--limit",
          "1",
        ],
        input.cwd,
      );
      if (res.status !== 0) {
        throw new CliError(
          "pr_failed",
          res.stderr.trim() || res.stdout.trim() || "gh pr list (merged) failed",
          { backend: "gh", status: res.status },
        );
      }
      try {
        const arr = JSON.parse(res.stdout.trim() || "[]") as Array<{
          number?: number;
          url?: string;
          baseRefName?: string;
        }>;
        const first = arr[0];
        if (first?.url && typeof first.number === "number") {
          return {
            number: first.number,
            url: first.url,
            baseRefName: first.baseRefName,
          };
        }
      } catch {
        throw new CliError("pr_failed", "gh pr list returned unparseable JSON", {
          backend: "gh",
          stdout: res.stdout.trim(),
        });
      }
      return null;
    },
  };
}

export function resolveMergeStatusBackend(id: string): MergeStatusBackend {
  if (id === "gh") return createGhMergeStatusBackend();
  throw new CliError("usage", `Unknown merge-status backend '${id}' (v1 supports: gh)`, {
    backend: id,
  });
}

export type OpenPullRequest = { number: number; url: string; state?: string };

/** Open PR for head branch, or null if none. */
export function findOpenPullRequest(cwd: string, head: string): OpenPullRequest | null {
  ensureGhAvailable(cwd);
  const res = runGh(
    ["pr", "list", "--head", head, "--state", "open", "--json", "number,url,state", "--limit", "1"],
    cwd,
  );
  if (res.status !== 0) {
    throw new CliError(
      "pr_failed",
      res.stderr.trim() || res.stdout.trim() || "gh pr list (open) failed",
      { backend: "gh", status: res.status },
    );
  }
  try {
    const arr = JSON.parse(res.stdout.trim() || "[]") as Array<{
      number?: number;
      url?: string;
      state?: string;
    }>;
    const first = arr[0];
    if (first?.url && typeof first.number === "number") {
      return { number: first.number, url: first.url, state: first.state };
    }
  } catch {
    throw new CliError("pr_failed", "gh pr list (open) returned unparseable JSON", {
      backend: "gh",
      stdout: res.stdout.trim(),
    });
  }
  return null;
}

/** How to treat PRs with zero reported status checks. */
export type EmptyChecksPolicy = "allow" | "refuse";

/**
 * Parse OPENSPEC_OPS_MERGE_EMPTY_CHECKS.
 * Default **allow** (no CI configured ⇒ no gate).
 * Set `refuse` / `strict` / `fail` for fail-closed empty checks.
 */
export function parseEmptyChecksPolicy(
  raw: string | undefined = process.env.OPENSPEC_OPS_MERGE_EMPTY_CHECKS,
): EmptyChecksPolicy {
  if (raw == null || raw.trim() === "") return "allow";
  const v = raw.trim().toLowerCase();
  if (v === "refuse" || v === "strict" || v === "fail" || v === "off") {
    return "refuse";
  }
  // on, allow, true, yes, …
  return "allow";
}

/** Detect gh messaging when the PR has no status checks at all. */
export function isNoChecksReportedMessage(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("no checks reported") ||
    m.includes("no checks") ||
    m.includes("without any checks") ||
    m.includes("found 0 checks")
  );
}

function refuseEmptyChecks(prNumber: number): never {
  throw new CliError(
    "checks_failed",
    `PR #${prNumber} has no reported checks; refusing to merge ` +
      `(set OPENSPEC_OPS_MERGE_EMPTY_CHECKS=allow or leave unset to allow).`,
    { pr: prNumber, emptyChecks: true },
  );
}

/**
 * Evaluate PR checks via `gh pr checks`.
 * - Non-success / pending checks → checks_failed (always).
 * - Zero checks → allow by default; refuse if OPENSPEC_OPS_MERGE_EMPTY_CHECKS=refuse.
 * gh pr checks exits 0 when all pass; 1 if any pending/fail (typical);
 * often 1 with "no checks reported" when none are configured.
 */
export function assertPullRequestChecksGreen(
  cwd: string,
  prNumber: number,
  emptyPolicy: EmptyChecksPolicy = parseEmptyChecksPolicy(),
): void {
  ensureGhAvailable(cwd);
  // JSON state per check when supported
  const jsonRes = runGh(
    ["pr", "checks", String(prNumber), "--json", "name,state,bucket"],
    cwd,
  );
  if (jsonRes.status === 0 && jsonRes.stdout.trim()) {
    try {
      const checks = JSON.parse(jsonRes.stdout.trim() || "[]") as Array<{
        name?: string;
        state?: string;
        bucket?: string;
      }>;
      if (!Array.isArray(checks)) {
        throw new Error("not array");
      }
      // Empty checks: no CI configured — default allow
      if (checks.length === 0) {
        if (emptyPolicy === "refuse") refuseEmptyChecks(prNumber);
        return;
      }
      const bad = checks.filter((c) => {
        const state = (c.state ?? "").toUpperCase();
        const bucket = (c.bucket ?? "").toLowerCase();
        // success / pass / skip often ok; pending/fail/cancel block
        if (bucket === "pass" || bucket === "skipping") return false;
        if (state === "SUCCESS" || state === "SKIPPED" || state === "NEUTRAL") return false;
        return true;
      });
      if (bad.length > 0) {
        throw new CliError(
          "checks_failed",
          `PR #${prNumber} checks not all successful (${bad.length} incomplete/failed).`,
          {
            pr: prNumber,
            failed: bad.map((c) => c.name ?? c.state).slice(0, 20),
          },
        );
      }
      return;
    } catch (err) {
      if (err instanceof CliError) throw err;
      // fall through to plain checks
    }
  }

  const plain = runGh(["pr", "checks", String(prNumber)], cwd);
  if (plain.status !== 0) {
    const detail =
      plain.stderr.trim() ||
      plain.stdout.trim() ||
      `PR #${prNumber} checks not successful (gh pr checks exit ${plain.status}).`;
    if (isNoChecksReportedMessage(detail)) {
      if (emptyPolicy === "refuse") refuseEmptyChecks(prNumber);
      return;
    }
    throw new CliError("checks_failed", detail, {
      pr: prNumber,
      status: plain.status,
    });
  }
}

export type GhMergeMethod = "squash" | "merge" | "rebase";

export function mergePullRequest(
  cwd: string,
  prNumber: number,
  method: GhMergeMethod,
): void {
  ensureGhAvailable(cwd);
  const flag =
    method === "squash" ? "--squash" : method === "rebase" ? "--rebase" : "--merge";
  const res = runGh(["pr", "merge", String(prNumber), flag], cwd);
  if (res.status !== 0) {
    throw new CliError(
      "pr_failed",
      res.stderr.trim() || res.stdout.trim() || `gh pr merge #${prNumber} failed`,
      { backend: "gh", pr: prNumber, method, status: res.status },
    );
  }
}
