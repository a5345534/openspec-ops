import { describe, expect, it, vi } from "vitest";
import { runFinish, type FinishDeps } from "../src/commands/finish.js";
import { cleanupMergedChangeBranches } from "../src/commands/branch-cleanup.js";
import { CliError } from "../src/types.js";
import type { WhereResult } from "../src/types.js";

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
        branchCleanup: () => ({
          attempted: true,
          mergedPr: { number: 1, url: "https://x/pull/1" },
          localDeleted: true,
          localAlreadyAbsent: false,
          remoteDeleted: true,
          remoteAlreadyAbsent: false,
          keptReason: null,
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
    const cleanup = vi.fn(() => ({
      attempted: false,
      mergedPr: null,
      localDeleted: false,
      localAlreadyAbsent: false,
      remoteDeleted: false,
      remoteAlreadyAbsent: false,
      keptReason: "keep_flag" as const,
    }));
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
        branchCleanup: () => ({
          attempted: true,
          mergedPr: { number: 2, url: "https://x/pull/2" },
          localDeleted: true,
          localAlreadyAbsent: false,
          remoteDeleted: false,
          remoteAlreadyAbsent: true,
          keptReason: null,
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
          branchCleanup: () => ({
            attempted: false,
            mergedPr: null,
            localDeleted: false,
            localAlreadyAbsent: false,
            remoteDeleted: false,
            remoteAlreadyAbsent: false,
            keptReason: "not_merged",
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
        branchCleanup: () => ({
          attempted: false,
          mergedPr: null,
          localDeleted: false,
          localAlreadyAbsent: false,
          remoteDeleted: false,
          remoteAlreadyAbsent: false,
          keptReason: "not_merged",
        }),
      }),
    );
    expect(r.worktreeRemoved).toBe(true);
    expect(r.forced).toBe(true);
    expect(r.branchDeleted).toBe(false);
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
