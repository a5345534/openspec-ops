import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(HERE, "../..");
const CLI_ENTRY = resolve(PROJECT_ROOT, "src/cli.ts");
const TSX_BIN = resolve(PROJECT_ROOT, "node_modules/tsx/dist/cli.mjs");

export interface FixtureRepo {
  root: string;
  cleanup: () => void;
  git: (...args: string[]) => string;
}

export function createFixtureRepo(): FixtureRepo {
  const root = mkdtempSync(join(tmpdir(), "openspec-ops-"));
  const git = (...args: string[]) => {
    const res = spawnSync("git", args, {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_CONFIG_GLOBAL: "/dev/null",
      },
    });
    if (res.status !== 0) {
      throw new Error(`git ${args.join(" ")} failed: ${res.stderr || res.stdout}`);
    }
    return (res.stdout || "").trim();
  };

  git("init");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test User");
  git("checkout", "-b", "main");
  writeFileSync(join(root, "README.md"), "# fixture\n");
  git("add", "README.md");
  git("commit", "-m", "init");

  return {
    root,
    git,
    cleanup: () => {
      try {
        const list = spawnSync("git", ["worktree", "list", "--porcelain"], {
          cwd: root,
          encoding: "utf8",
        });
        if (list.status === 0) {
          for (const line of list.stdout.split("\n")) {
            if (line.startsWith("worktree ") && line.slice("worktree ".length) !== root) {
              const p = line.slice("worktree ".length);
              spawnSync("git", ["worktree", "remove", "--force", p], { cwd: root });
            }
          }
        }
      } catch {
        // ignore
      }
      rmSync(root, { recursive: true, force: true });
    },
  };
}

export async function runCli(
  args: string[],
  cwd: string,
): Promise<{ code: number; stdout: string; stderr: string; json?: any }> {
  const res = spawnSync(process.execPath, [TSX_BIN, CLI_ENTRY, ...args], {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
    },
  });

  const code = res.status ?? 10;
  const stdout = res.stdout ?? "";
  const stderr = res.stderr ?? "";
  let json: any;
  if (args.includes("--json") && stdout.trim()) {
    try {
      json = JSON.parse(stdout);
    } catch {
      json = undefined;
    }
  }
  return { code, stdout, stderr, json };
}

export function mkdirp(path: string): void {
  mkdirSync(path, { recursive: true });
}
