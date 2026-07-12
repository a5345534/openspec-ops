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
      args.push("--json", "url,number");

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
      try {
        const parsed = JSON.parse(res.stdout.trim()) as {
          url?: string;
          number?: number;
        };
        if (!parsed.url || typeof parsed.number !== "number") {
          throw new Error("missing url/number");
        }
        return { url: parsed.url, number: parsed.number, alreadyExisted: false };
      } catch {
        throw new CliError("pr_failed", "gh pr create returned unparseable JSON", {
          backend: "gh",
          stdout: res.stdout.trim(),
        });
      }
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

/**
 * Evaluate PR checks via `gh pr checks`.
 * Fail closed: non-zero exit or any non-success state → not passing.
 * gh pr checks exits 0 when all pass; 1 if any pending/fail (typical).
 */
export function assertPullRequestChecksGreen(cwd: string, prNumber: number): void {
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
      // Empty checks: treat as fail closed (cannot prove green)
      if (checks.length === 0) {
        throw new CliError(
          "checks_failed",
          `PR #${prNumber} has no reported checks; refusing to merge (fail closed).`,
          { pr: prNumber },
        );
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
    throw new CliError(
      "checks_failed",
      plain.stderr.trim() ||
        plain.stdout.trim() ||
        `PR #${prNumber} checks not successful (gh pr checks exit ${plain.status}).`,
      { pr: prNumber, status: plain.status },
    );
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
