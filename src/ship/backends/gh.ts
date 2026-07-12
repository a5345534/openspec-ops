import { spawnSync } from "node:child_process";
import { CliError } from "../../types.js";
import type {
  CreateOrReusePrInput,
  CreateOrReusePrResult,
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
