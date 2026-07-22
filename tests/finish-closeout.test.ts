import { describe, expect, it, vi } from "vitest";
import { runFinish, type FinishDeps } from "../src/commands/finish.js";
import {
  cleanupMergedChangeBranches,
  cleanupMergedParentHeads,
  parentCleanupCandidateBranches,
} from "../src/commands/branch-cleanup.js";
import { CliError } from "../src/types.js";
import type { FinishBranchCleanup, WhereResult } from "../src/types.js";

function cleanupStub(
  over: Partial<FinishBranchCleanup> = {},
): FinishBranchCleanup {
  return {
    attempted: false,
    mergedPr: null,
    localDeleted: false,
    localAlreadyAbsent: false,
    remoteDeleted: false,
    remoteAlreadyAbsent: false,
    keptReason: "not_merged",
    heads: [],
    ...over,
  };
}

function whereOk(over: Partial<WhereResult> = {}): WhereResult {
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
    ...over,
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
    branchCleanup: () => cleanupStub(),
    detectBehind: () => ({
      behind: false,
      baseBranch: "main",
      originBaseRef: "origin/main",
      primaryHead: "a",
      originHead: "a",
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

describe("runFinish closeout", () => {
  it("removes worktree and keeps branch when not merged", () => {
    const remove = vi.fn();
    const r = runFinish(opts, baseDeps({ removeWorktree: remove }));
    expect(remove).toHaveBeenCalled();
    expect(r.action).toBe("removed");
    expect(r.worktreeRemoved).toBe(true);
    expect(r.branchDeleted).toBe(false);
    expect(r.branchCleanup.keptReason).toBe("not_merged");
  });

  it("removes worktree and prunes when merged", () => {
    const r = runFinish(
      opts,
      baseDeps({
        branchCleanup: () =>
          cleanupStub({
            attempted: true,
            mergedPr: { number: 1, url: "https://x/pull/1" },
            localDeleted: true,
            remoteDeleted: true,
            keptReason: null,
            heads: [
              {
                branch: "add-dark-mode",
                attempted: true,
                localDeleted: true,
                localAlreadyAbsent: false,
                remoteDeleted: true,
                remoteAlreadyAbsent: false,
                keptReason: null,
                mergedPr: { number: 1, url: "https://x/pull/1" },
              },
            ],
          }),
      }),
    );
    expect(r.action).toBe("removed_and_pruned");
    expect(r.branchDeleted).toBe(true);
  });

  it("captures residual submodule refs for the resolved branch before teardown", () => {
    const probeBranches = vi.fn(() => [
      {
        code: "submodule_change_branch_local" as const,
        path: "aos-core",
        branch: "release-x",
        remote: null,
        current: true,
      },
      {
        code: "submodule_change_branch_remote_tracking" as const,
        path: "aos-core",
        branch: "release-x",
        remote: "origin",
        current: true,
      },
    ]);
    const prepare = vi.fn(() => ({ deinited: [], cleared: [] }));
    const result = runFinish(
      { ...opts, branch: "release-x" },
      baseDeps({
        locate: () => whereOk({ branch: "release-x" }),
        probeBranches,
        prepare,
      }),
    );

    expect(probeBranches).toHaveBeenCalledWith(
      "/repo/.worktrees/add-dark-mode",
      "release-x",
    );
    expect(probeBranches.mock.invocationCallOrder[0]).toBeLessThan(
      prepare.mock.invocationCallOrder[0]!,
    );
    expect(result.submoduleBranchDiagnostics).toEqual([
      expect.objectContaining({
        code: "submodule_change_branch_local",
        path: "aos-core",
        branch: "release-x",
      }),
      expect.objectContaining({
        code: "submodule_change_branch_remote_tracking",
        remote: "origin",
      }),
    ]);
  });

  it("prints scoped human residual diagnostics without claiming deletion", () => {
    const output: string[] = [];
    const write = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((chunk: string | Uint8Array) => {
        output.push(String(chunk));
        return true;
      });
    try {
      runFinish(
        { ...opts, json: false },
        baseDeps({
          probeBranches: () => [
            {
              code: "submodule_change_branch_local",
              path: "aos-core",
              branch: "add-dark-mode",
              remote: null,
              current: true,
            },
            {
              code: "submodule_change_branch_remote_tracking",
              path: "aos-core",
              branch: "add-dark-mode",
              remote: "origin",
              current: true,
            },
          ],
        }),
      );
    } finally {
      write.mockRestore();
    }
    expect(output.join(""))
      .toContain("submodule residual: aos-core local add-dark-mode (current); not pruned");
    expect(output.join(""))
      .toContain("submodule residual: aos-core remote-tracking origin/add-dark-mode; local observation, not pruned");
  });

  it("keep-branch skips branch delete even if cleanup would", () => {
    const cleanup = vi.fn(() =>
      cleanupStub({
        keptReason: "keep_flag",
        heads: [
          {
            branch: "add-dark-mode",
            attempted: false,
            localDeleted: false,
            localAlreadyAbsent: false,
            remoteDeleted: false,
            remoteAlreadyAbsent: false,
            keptReason: "keep_flag",
            mergedPr: null,
          },
        ],
      }),
    );
    const r = runFinish(
      { ...opts, keepBranch: true },
      baseDeps({
        branchCleanup: cleanup,
      }),
    );
    expect(cleanup).toHaveBeenCalledWith(
      expect.objectContaining({ keepBranch: true }),
      expect.anything(),
    );
    expect(r.action).toBe("removed");
    expect(r.branchDeleted).toBe(false);
  });

  it("dirty without force refuses before remove", () => {
    const remove = vi.fn();
    expect(() =>
      runFinish(
        opts,
        baseDeps({
          locate: () => whereOk({ dirty: true }),
          removeWorktree: remove,
        }),
      ),
    ).toThrow(CliError);
    expect(remove).not.toHaveBeenCalled();
  });

  it("no worktree + merged → pruned_only", () => {
    const r = runFinish(
      opts,
      baseDeps({
        locate: () => {
          throw new CliError("not_found", "missing", {});
        },
        branchCleanup: () =>
          cleanupStub({
            attempted: true,
            mergedPr: { number: 2, url: "https://x/pull/2" },
            localDeleted: true,
            remoteAlreadyAbsent: true,
            keptReason: null,
            heads: [
              {
                branch: "add-dark-mode",
                attempted: true,
                localDeleted: true,
                localAlreadyAbsent: false,
                remoteDeleted: false,
                remoteAlreadyAbsent: true,
                keptReason: null,
                mergedPr: { number: 2, url: "https://x/pull/2" },
              },
            ],
          }),
      }),
    );
    expect(r.action).toBe("pruned_only");
    expect(r.worktreeRemoved).toBe(false);
    expect(r.branchDeleted).toBe(true);
    expect(r.submoduleBranchDiagnostics).toEqual([]);
  });

  it("no worktree + not merged → not_found", () => {
    try {
      runFinish(
        opts,
        baseDeps({
          locate: () => {
            throw new CliError("not_found", "missing", {});
          },
          branchCleanup: () =>
            cleanupStub({
              heads: [
                {
                  branch: "add-dark-mode",
                  attempted: false,
                  localDeleted: false,
                  localAlreadyAbsent: false,
                  remoteDeleted: false,
                  remoteAlreadyAbsent: false,
                  keptReason: "not_merged",
                  mergedPr: null,
                },
              ],
            }),
        }),
      );
      expect.fail("throw");
    } catch (e) {
      expect((e as CliError).code).toBe("not_found");
    }
  });

  it("force dirty still does not force unmerged branch delete", () => {
    const r = runFinish(
      { ...opts, force: true },
      baseDeps({
        locate: () => whereOk({ dirty: true }),
        branchCleanup: () => cleanupStub(),
      }),
    );
    expect(r.worktreeRemoved).toBe(true);
    expect(r.forced).toBe(true);
    expect(r.branchDeleted).toBe(false);
  });

  it("single candidate when located equals change-default", () => {
    const cleanup = vi.fn(() =>
      cleanupStub({
        attempted: true,
        localDeleted: true,
        remoteDeleted: true,
        keptReason: null,
        mergedPr: { number: 1, url: "https://x/pull/1" },
        heads: [
          {
            branch: "add-dark-mode",
            attempted: true,
            localDeleted: true,
            localAlreadyAbsent: false,
            remoteDeleted: true,
            remoteAlreadyAbsent: false,
            keptReason: null,
            mergedPr: { number: 1, url: "https://x/pull/1" },
          },
        ],
      }),
    );
    const r = runFinish(opts, baseDeps({ branchCleanup: cleanup }));
    expect(cleanup).toHaveBeenCalledWith(
      expect.objectContaining({
        changeDefaultBranch: "add-dark-mode",
        locatedBranch: "add-dark-mode",
      }),
      expect.anything(),
    );
    expect(r.branchCleanup.heads).toHaveLength(1);
    expect(r.branchCleanup.heads[0]!.branch).toBe("add-dark-mode");
  });

  it("passes both heads when worktree is on archive branch", () => {
    const cleanup = vi.fn(() =>
      cleanupStub({
        attempted: true,
        localDeleted: true,
        remoteDeleted: true,
        keptReason: null,
        mergedPr: { number: 10, url: "https://x/pull/10" },
        heads: [
          {
            branch: "add-dark-mode",
            attempted: true,
            localDeleted: true,
            localAlreadyAbsent: false,
            remoteDeleted: true,
            remoteAlreadyAbsent: false,
            keptReason: null,
            mergedPr: { number: 10, url: "https://x/pull/10" },
          },
          {
            branch: "archive-add-dark-mode",
            attempted: true,
            localDeleted: true,
            localAlreadyAbsent: false,
            remoteDeleted: true,
            remoteAlreadyAbsent: false,
            keptReason: null,
            mergedPr: { number: 11, url: "https://x/pull/11" },
          },
        ],
      }),
    );
    const r = runFinish(
      opts,
      baseDeps({
        locate: () => whereOk({ branch: "archive-add-dark-mode" }),
        branchCleanup: cleanup,
      }),
    );
    expect(cleanup).toHaveBeenCalledWith(
      expect.objectContaining({
        changeDefaultBranch: "add-dark-mode",
        locatedBranch: "archive-add-dark-mode",
      }),
      expect.anything(),
    );
    expect(r.branch).toBe("archive-add-dark-mode");
    expect(r.action).toBe("removed_and_pruned");
    expect(r.branchDeleted).toBe(true);
    expect(r.branchCleanup.heads.map((h) => h.branch)).toEqual([
      "add-dark-mode",
      "archive-add-dark-mode",
    ]);
  });

  it("branchDeleted true when any head local deleted", () => {
    const r = runFinish(
      opts,
      baseDeps({
        locate: () => whereOk({ branch: "archive-add-dark-mode" }),
        branchCleanup: () =>
          cleanupStub({
            attempted: true,
            localDeleted: true,
            remoteDeleted: false,
            keptReason: null,
            mergedPr: { number: 10, url: "https://x/pull/10" },
            heads: [
              {
                branch: "add-dark-mode",
                attempted: true,
                localDeleted: true,
                localAlreadyAbsent: false,
                remoteDeleted: false,
                remoteAlreadyAbsent: true,
                keptReason: null,
                mergedPr: { number: 10, url: "https://x/pull/10" },
              },
              {
                branch: "archive-add-dark-mode",
                attempted: false,
                localDeleted: false,
                localAlreadyAbsent: false,
                remoteDeleted: false,
                remoteAlreadyAbsent: false,
                keptReason: "not_merged",
                mergedPr: null,
              },
            ],
          }),
      }),
    );
    expect(r.branchDeleted).toBe(true);
    expect(r.action).toBe("removed_and_pruned");
    expect(r.branchCleanup.heads[1]!.keptReason).toBe("not_merged");
  });
});

describe("parent multi-head cleanup helpers", () => {
  it("dedupes identical candidates", () => {
    expect(parentCleanupCandidateBranches("a", "a")).toEqual(["a"]);
  });

  it("orders change-default then located", () => {
    expect(parentCleanupCandidateBranches("change", "archive-change")).toEqual([
      "change",
      "archive-change",
    ]);
  });

  it("cleans both heads when each has merged PR", () => {
    const deleted: string[] = [];
    const r = cleanupMergedParentHeads(
      {
        change: "add-dark-mode",
        cwd: "/repo",
        changeDefaultBranch: "add-dark-mode",
        locatedBranch: "archive-add-dark-mode",
        remote: "origin",
        keepBranch: false,
      },
      {
        findMergedPr: ({ head }) =>
          head === "add-dark-mode"
            ? { number: 1, url: "https://x/1" }
            : head === "archive-add-dark-mode"
              ? { number: 2, url: "https://x/2" }
              : null,
        branchExists: () => true,
        deleteLocalBranch: (_cwd, branch) => {
          deleted.push(`local:${branch}`);
        },
        deleteRemoteBranch: (_cwd, _remote, branch) => {
          deleted.push(`remote:${branch}`);
        },
        remoteBranchExists: () => true,
      },
    );
    expect(r.heads).toHaveLength(2);
    expect(r.localDeleted).toBe(true);
    expect(r.remoteDeleted).toBe(true);
    expect(r.mergedPr?.number).toBe(1);
    expect(deleted).toEqual([
      "local:add-dark-mode",
      "remote:add-dark-mode",
      "local:archive-add-dark-mode",
      "remote:archive-add-dark-mode",
    ]);
  });

  it("keeps unmerged located head while pruning change-default", () => {
    const deleted: string[] = [];
    const r = cleanupMergedParentHeads(
      {
        change: "add-dark-mode",
        cwd: "/repo",
        changeDefaultBranch: "add-dark-mode",
        locatedBranch: "archive-add-dark-mode",
        remote: "origin",
        keepBranch: false,
      },
      {
        findMergedPr: ({ head }) =>
          head === "add-dark-mode" ? { number: 1, url: "https://x/1" } : null,
        branchExists: () => true,
        deleteLocalBranch: (_cwd, branch) => {
          deleted.push(branch);
        },
        deleteRemoteBranch: (_cwd, _remote, branch) => {
          deleted.push(`r:${branch}`);
        },
        remoteBranchExists: () => true,
      },
    );
    expect(deleted).toEqual(["add-dark-mode", "r:add-dark-mode"]);
    expect(r.heads[0]!.localDeleted).toBe(true);
    expect(r.heads[1]!.keptReason).toBe("not_merged");
    expect(r.localDeleted).toBe(true);
    expect(r.keptReason).toBe(null);
  });

  it("keep-branch skips all heads", () => {
    const del = vi.fn();
    const r = cleanupMergedParentHeads(
      {
        change: "c",
        cwd: "/repo",
        changeDefaultBranch: "c",
        locatedBranch: "archive-c",
        remote: "origin",
        keepBranch: true,
      },
      {
        findMergedPr: () => ({ number: 1, url: "u" }),
        branchExists: () => true,
        deleteLocalBranch: del,
        deleteRemoteBranch: del,
        remoteBranchExists: () => true,
      },
    );
    expect(del).not.toHaveBeenCalled();
    expect(r.keptReason).toBe("keep_flag");
    expect(r.heads).toHaveLength(2);
    expect(r.heads.every((h) => h.keptReason === "keep_flag")).toBe(true);
  });

  it("all not_merged keeps aggregate keptReason", () => {
    const r = cleanupMergedParentHeads(
      {
        change: "c",
        cwd: "/repo",
        changeDefaultBranch: "c",
        locatedBranch: "archive-c",
        remote: "origin",
        keepBranch: false,
      },
      {
        findMergedPr: () => null,
        branchExists: () => true,
        deleteLocalBranch: () => {},
        deleteRemoteBranch: () => {},
        remoteBranchExists: () => true,
      },
    );
    expect(r.keptReason).toBe("not_merged");
    expect(r.attempted).toBe(false);
    expect(r.localDeleted).toBe(false);
  });
});

describe("cleanupMergedChangeBranches", () => {
  it("returns not_merged without deleting", () => {
    const del = vi.fn();
    const r = cleanupMergedChangeBranches(
      {
        change: "c",
        cwd: "/repo",
        branch: "c",
        remote: "origin",
        keepBranch: false,
      },
      {
        findMergedPr: () => null,
        branchExists: () => true,
        deleteLocalBranch: del,
        deleteRemoteBranch: del,
        remoteBranchExists: () => true,
      },
    );
    expect(r.keptReason).toBe("not_merged");
    expect(del).not.toHaveBeenCalled();
  });
});
