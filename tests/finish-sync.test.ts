import { describe, expect, it, vi } from "vitest";
import {
  attachSubmodulesToMainIfSafe,
  returnPrimaryAndSubmodulesToMain,
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

  it("creates a missing local base as a tracking branch without force", () => {
    const calls: string[][] = [];
    const r = syncPrimaryCheckout(
      "/repo",
      {},
      syncDeps({
        refExists: (_cwd, ref) => ref === "origin/main",
        runGit: (args) => {
          calls.push(args);
          if (args[0] === "symbolic-ref") {
            return { status: 0, stdout: "refs/heads/topic\n", stderr: "" };
          }
          if (args[0] === "switch" && args.length === 2) {
            return { status: 1, stdout: "", stderr: "unknown branch" };
          }
          return { status: 0, stdout: "", stderr: "" };
        },
      }),
    );
    expect(r.ok).toBe(true);
    expect(calls).toContainEqual([
      "switch",
      "-c",
      "main",
      "--track",
      "origin/main",
    ]);
    expect(calls.flat()).not.toContain("-C");
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

describe("strict return-to-main", () => {
  function recursiveDeps(incompatible = false): FinishSyncDeps {
    const pinFor = (cwd: string) => cwd.endsWith("/inner") ? "pin-inner" : "pin-outer";
    return syncDeps({
      resolveBase: () => "origin/main",
      revParse: (_cwd, rev) => rev === "HEAD" || rev === "origin/main" ? "primary-tip" : rev,
      refExists: (cwd, ref) => cwd === "/repo" && ref === "origin/main",
      isDirty: () => false,
      runGit: (args, options) => {
        const cwd = options?.cwd ?? "";
        if (args[0] === "status") return { status: 0, stdout: "", stderr: "" };
        if (args[0] === "config") {
          if (cwd === "/repo") {
            return { status: 0, stdout: "submodule.outer.path\nmodules/outer space\0", stderr: "" };
          }
          if (cwd.endsWith("/modules/outer space")) {
            return { status: 0, stdout: "submodule.inner.path\ninner\0", stderr: "" };
          }
          return { status: 1, stdout: "", stderr: "" };
        }
        if (args[0] === "symbolic-ref" && args[1] === "-q") {
          return { status: 0, stdout: "refs/heads/main\n", stderr: "" };
        }
        if (args[0] === "symbolic-ref") {
          const remote = cwd.endsWith("/inner") ? "upstream" : "origin";
          return { status: 0, stdout: `refs/remotes/${remote}/master\n`, stderr: "" };
        }
        if (args[0] === "remote" && args.length === 1) {
          return {
            status: 0,
            stdout: cwd.endsWith("/inner") ? "upstream\n" : "origin\n",
            stderr: "",
          };
        }
        if (args[0] === "branch") {
          return { status: 0, stdout: "master\n", stderr: "" };
        }
        if (args[0] === "rev-parse" && args[1] === "--is-inside-work-tree") {
          return { status: 0, stdout: "true\n", stderr: "" };
        }
        if (args[0] === "rev-parse" && String(args[1]).startsWith("HEAD:")) {
          const pin = args[1] === "HEAD:inner" ? "pin-inner" : "pin-outer";
          return { status: 0, stdout: `${pin}\n`, stderr: "" };
        }
        if (
          args[0] === "rev-parse" &&
          (args[1] === "origin/master" || args[1] === "upstream/master")
        ) {
          return {
            status: 0,
            stdout: `${incompatible && cwd.endsWith("/inner") ? "ahead-inner" : pinFor(cwd)}\n`,
            stderr: "",
          };
        }
        if (args[0] === "rev-parse" && args[1] === "HEAD") {
          return { status: 0, stdout: `${pinFor(cwd)}\n`, stderr: "" };
        }
        if (args[0] === "merge-base") {
          return { status: incompatible ? 1 : 0, stdout: "", stderr: "" };
        }
        return { status: 0, stdout: "", stderr: "" };
      },
    });
  }

  it("recursively reports and attaches resolved non-main defaults", () => {
    const result = returnPrimaryAndSubmodulesToMain(
      "/repo",
      { remote: "origin", worktreeRemoved: true },
      recursiveDeps(),
    );
    expect(result.primary).toEqual({
      branch: "main",
      head: "primary-tip",
      remoteHead: "primary-tip",
    });
    expect(result.submodules.map((row) => row.path)).toEqual([
      "modules/outer space",
      "modules/outer space/inner",
    ]);
    expect(result.submodules.every((row) =>
      row.remoteDefaultBranch === "master" && row.attachOutcome === "attached"
    )).toBe(true);
  });

  it("restores the detached parent pin when ff-only attachment fails", () => {
    let subHead = "pin";
    let subBranch: string | null = null;
    const deps = syncDeps({
      resolveBase: () => "origin/main",
      revParse: (_cwd, rev) => rev === "HEAD" || rev === "origin/main" ? "primary" : rev,
      refExists: (cwd, ref) =>
        (cwd === "/repo" && ref === "origin/main") ||
        (cwd === "/repo/sub" && ref === "refs/heads/main"),
      isDirty: () => false,
      runGit: (args, options) => {
        const cwd = options?.cwd ?? "";
        if (args[0] === "status") return { status: 0, stdout: "", stderr: "" };
        if (args[0] === "config") {
          return cwd === "/repo"
            ? { status: 0, stdout: "submodule.sub.path\nsub\0", stderr: "" }
            : { status: 1, stdout: "", stderr: "" };
        }
        if (args[0] === "symbolic-ref" && args[1] === "-q") {
          return { status: 0, stdout: "refs/heads/main\n", stderr: "" };
        }
        if (args[0] === "symbolic-ref") {
          return { status: 0, stdout: "refs/remotes/origin/main\n", stderr: "" };
        }
        if (args[0] === "remote" && args.length === 1) {
          return { status: 0, stdout: "origin\n", stderr: "" };
        }
        if (args[0] === "branch") {
          return { status: 0, stdout: subBranch ? `${subBranch}\n` : "", stderr: "" };
        }
        if (args[0] === "rev-parse" && args[1] === "--is-inside-work-tree") {
          return { status: 0, stdout: "true\n", stderr: "" };
        }
        if (args[0] === "rev-parse" && args[1] === "HEAD:sub") {
          return { status: 0, stdout: "pin\n", stderr: "" };
        }
        if (args[0] === "rev-parse" && args[1] === "origin/main") {
          return { status: 0, stdout: "old\n", stderr: "" };
        }
        if (args[0] === "rev-parse" && args[1] === "refs/heads/main") {
          return { status: 0, stdout: "old\n", stderr: "" };
        }
        if (args[0] === "rev-parse" && args[1] === "HEAD") {
          return { status: 0, stdout: `${subHead}\n`, stderr: "" };
        }
        if (args[0] === "switch" && args[1] === "main") {
          subHead = "old";
          subBranch = "main";
          return { status: 0, stdout: "", stderr: "" };
        }
        if (args[0] === "switch" && args[1] === "--detach") {
          subHead = "pin";
          subBranch = null;
          return { status: 0, stdout: "", stderr: "" };
        }
        if (args[0] === "merge") {
          return { status: 1, stdout: "", stderr: "locked" };
        }
        return { status: 0, stdout: "", stderr: "" };
      },
    });
    try {
      returnPrimaryAndSubmodulesToMain(
        "/repo",
        { remote: "origin", worktreeRemoved: true },
        deps,
      );
      expect.fail("throw");
    } catch (error) {
      const cli = error as CliError;
      expect(cli.code).toBe("return_to_main_needs_human");
      expect(cli.details.submodules).toEqual([
        expect.objectContaining({
          path: "sub",
          head: "pin",
          branch: null,
          attachOutcome: "fast_forward_failed",
        }),
      ]);
    }
  });

  it("fails with structured nested incompatibility diagnostics", () => {
    try {
      returnPrimaryAndSubmodulesToMain(
        "/repo",
        { remote: "origin", worktreeRemoved: true },
        recursiveDeps(true),
      );
      expect.fail("throw");
    } catch (error) {
      const cli = error as CliError;
      expect(cli.code).toBe("return_to_main_needs_human");
      expect(cli.details.worktreeRemoved).toBe(true);
      expect(cli.details.submodules).toEqual(expect.arrayContaining([
        expect.objectContaining({
          path: "modules/outer space/inner",
          attachOutcome: "incompatible_default",
        }),
      ]));
    }
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
      isDirty: () => false,
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

  it("strict composite reports required primary snapshot", () => {
    const r = runFinish(
      { ...opts, returnToMain: true },
      baseDeps({
        finishSyncDeps: syncDeps({
          runGit: (args) => {
            if (args[0] === "status") {
              return { status: 0, stdout: "", stderr: "" };
            }
            if (args[0] === "config") {
              return { status: 1, stdout: "", stderr: "" };
            }
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
          primaryHead: "newhead",
          originHead: "newhead",
          reason: "ok",
        }),
      }),
    );
    expect(r.sync.required).toBe(true);
    expect(r.sync.syncPrimary).toBe("ok");
    expect(r.sync.syncSubmodules).toBe("ok");
    expect(r.sync.attachSubmoduleMain).toBe("ok");
    expect(r.sync.primary).toEqual({
      branch: "main",
      head: "newhead",
      remoteHead: "newhead",
    });
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
