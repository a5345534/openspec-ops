import { describe, expect, it, vi } from "vitest";
import {
  attachSubmodulesToMainIfSafe,
  syncPrimaryCheckout,
  syncPrimarySubmodules,
  type FinishSyncDeps,
} from "../src/commands/finish-sync.js";
import { runFinish, type FinishDeps } from "../src/commands/finish.js";
import { CliError } from "../src/types.js";
import type { WhereResult } from "../src/types.js";

function syncDeps(over: Partial<FinishSyncDeps> = {}): FinishSyncDeps {
  return {
    isDirty: () => false,
    resolveBase: () => "origin/main",
    revParse: () => "newhead",
    refExists: () => true,
    runGit: () => ({ status: 0, stdout: "ok\n", stderr: "" }),
    probe: () => [],
    ...over,
  };
}

describe("syncPrimaryCheckout", () => {
  it("ff-only pull on clean primary", () => {
    const calls: string[][] = [];
    const r = syncPrimaryCheckout(
      "/repo",
      {},
      syncDeps({
        runGit: (args) => {
          calls.push(args);
          if (args[0] === "symbolic-ref") {
            return { status: 0, stdout: "refs/heads/main\n", stderr: "" };
          }
          return { status: 0, stdout: "", stderr: "" };
        },
      }),
    );
    expect(r.ok).toBe(true);
    expect(r.baseBranch).toBe("main");
    expect(calls.some((a) => a[0] === "pull" && a.includes("--ff-only"))).toBe(true);
  });

  it("refuses dirty primary", () => {
    try {
      syncPrimaryCheckout("/repo", { worktreeRemoved: true }, syncDeps({ isDirty: () => true }));
      expect.fail("throw");
    } catch (e) {
      expect((e as CliError).code).toBe("primary_dirty");
      expect((e as CliError).details.worktreeRemoved).toBe(true);
    }
  });

  it("refuses diverged non-ff pull", () => {
    try {
      syncPrimaryCheckout(
        "/repo",
        {},
        syncDeps({
          runGit: (args) => {
            if (args[0] === "symbolic-ref") {
              return { status: 0, stdout: "refs/heads/main\n", stderr: "" };
            }
            if (args[0] === "pull") {
              return {
                status: 1,
                stdout: "",
                stderr: "Not possible to fast-forward, aborting.",
              };
            }
            return { status: 0, stdout: "", stderr: "" };
          },
        }),
      );
      expect.fail("throw");
    } catch (e) {
      expect((e as CliError).code).toBe("primary_diverged");
    }
  });
});

describe("syncPrimarySubmodules", () => {
  it("runs submodule update --init --recursive", () => {
    const runGit = vi.fn(() => ({ status: 0, stdout: "", stderr: "" }));
    syncPrimarySubmodules("/repo", {}, syncDeps({ runGit }));
    expect(runGit).toHaveBeenCalledWith(
      ["submodule", "update", "--init", "--recursive"],
      expect.objectContaining({ cwd: "/repo" }),
    );
  });
});

describe("attachSubmodulesToMainIfSafe", () => {
  it("attaches when main tip equals gitlink", () => {
    const r = attachSubmodulesToMainIfSafe(
      "/repo",
      {},
      syncDeps({
        probe: () => [
          {
            path: "aos-core",
            detached: true,
            dirty: false,
            branch: null,
            head: "pin",
          },
        ],
        refExists: () => true,
        runGit: (args, opts) => {
          if (args[0] === "rev-parse" && args[1] === "HEAD:aos-core") {
            return { status: 0, stdout: "pin\n", stderr: "" };
          }
          if (args[0] === "rev-parse" && (args[1] === "origin/main" || args[1] === "main")) {
            return { status: 0, stdout: "pin\n", stderr: "" };
          }
          if (args[0] === "switch") {
            return { status: 0, stdout: "", stderr: "" };
          }
          if (args[0] === "rev-parse" && args[1] === "HEAD") {
            return { status: 0, stdout: "pin\n", stderr: "" };
          }
          return { status: 0, stdout: "", stderr: "" };
        },
      }),
    );
    expect(r.attached).toContain("aos-core");
    expect(r.diverged).toEqual([]);
  });

  it("reports diverged without force when not ancestor", () => {
    const r = attachSubmodulesToMainIfSafe(
      "/repo",
      {},
      syncDeps({
        probe: () => [
          {
            path: "aos-core",
            detached: true,
            dirty: false,
            branch: null,
            head: "pin",
          },
        ],
        refExists: () => true,
        runGit: (args) => {
          if (args[0] === "rev-parse" && args[1] === "HEAD:aos-core") {
            return { status: 0, stdout: "pin\n", stderr: "" };
          }
          if (args[0] === "rev-parse" && (args[1] === "origin/main" || args[1] === "main")) {
            return { status: 0, stdout: "other\n", stderr: "" };
          }
          if (args[0] === "merge-base") {
            return { status: 1, stdout: "", stderr: "" };
          }
          return { status: 0, stdout: "", stderr: "" };
        },
      }),
    );
    expect(r.diverged).toContain("aos-core");
    expect(r.attached).toEqual([]);
  });
});

describe("runFinish sync integration", () => {
  function whereOk(): WhereResult {
    return {
      found: true,
      change: "add-dark-mode",
      path: "/repo/.worktrees/add-dark-mode",
      branch: "add-dark-mode",
      head: "abc",
      dirty: false,
      primaryPath: "/repo",
      changeDirExists: false,
      changeDirPath: null,
      matchedBy: "path",
      submodules: [],
    };
  }

  function baseDeps(over: Partial<FinishDeps> = {}): FinishDeps {
    return {
      locate: () => whereOk(),
      resolveRepo: () => ({
        cwd: "/repo",
        primaryPath: "/repo",
        worktreeRoot: "/repo/.worktrees",
        worktrees: [],
      }),
      prepare: () => ({ deinited: [] }),
      removeWorktree: () => {},
      branchCleanup: () => ({
        attempted: false,
        mergedPr: null,
        localDeleted: false,
        localAlreadyAbsent: false,
        remoteDeleted: false,
        remoteAlreadyAbsent: false,
        keptReason: "not_merged",
      }),
      detectBehind: () => ({
        behind: true,
        baseBranch: "main",
        originBaseRef: "origin/main",
        primaryHead: "a",
        originHead: "b",
        reason: "ok",
      }),
      ...over,
    };
  }

  const opts = {
    change: "add-dark-mode",
    json: true,
    force: false,
    keepBranch: false,
    remote: "origin",
  };

  it("default finish does not call sync and includes closeoutHints", () => {
    const pull = vi.fn();
    const r = runFinish(
      opts,
      baseDeps({
        finishSyncDeps: syncDeps({
          runGit: (args) => {
            pull(args);
            return { status: 0, stdout: "", stderr: "" };
          },
        }),
      }),
    );
    expect(r.sync.syncPrimary).toBe("skipped");
    expect(r.sync.syncSubmodules).toBe("skipped");
    expect(r.closeoutHints.primaryBehindOrigin).toBe(true);
    expect(r.closeoutHints.messages.length).toBeGreaterThan(0);
    expect(pull).not.toHaveBeenCalled();
  });

  it("sync-primary dirty fails after worktree removed", () => {
    try {
      runFinish(
        { ...opts, syncPrimary: true },
        baseDeps({
          finishSyncDeps: syncDeps({ isDirty: () => true }),
        }),
      );
      expect.fail("throw");
    } catch (e) {
      expect((e as CliError).code).toBe("primary_dirty");
      expect((e as CliError).details.worktreeRemoved).toBe(true);
    }
  });

  it("sync-primary ok path", () => {
    const r = runFinish(
      { ...opts, syncPrimary: true },
      baseDeps({
        finishSyncDeps: syncDeps({
          runGit: (args) => {
            if (args[0] === "symbolic-ref") {
              return { status: 0, stdout: "refs/heads/main\n", stderr: "" };
            }
            return { status: 0, stdout: "", stderr: "" };
          },
        }),
        detectBehind: () => ({
          behind: false,
          baseBranch: "main",
          originBaseRef: "origin/main",
          primaryHead: "x",
          originHead: "x",
          reason: "ok",
        }),
      }),
    );
    expect(r.sync.syncPrimary).toBe("ok");
    expect(r.closeoutHints.primaryBehindOrigin).toBe(false);
  });
});
