import { describe, expect, it, vi } from "vitest";
import { runPrune, type PruneDeps } from "../src/commands/prune.js";
import { CliError } from "../src/types.js";
import type { WorktreeEntry } from "../src/types.js";

function mockDeps(over: Partial<PruneDeps> = {}): PruneDeps {
  return {
    resolveRepo: () => ({
      cwd: "/repo",
      primaryPath: "/repo",
      worktreeRoot: "/repo/.worktrees",
      worktrees: [],
    }),
    listWorktrees: () => [] as WorktreeEntry[],
    branchExists: () => true,
    defaultBranch: (change, branchFlag) => branchFlag ?? change,
    defaultPath: (primary, change) => `${primary}/.worktrees/${change}`,
    findMergedPr: () => ({
      number: 42,
      url: "https://github.com/org/repo/pull/42",
      baseRefName: "main",
    }),
    deleteLocalBranch: () => {},
    deleteRemoteBranch: () => {},
    remoteBranchExists: () => true,
    ...over,
  };
}

const baseOpts = {
  change: "add-dark-mode",
  json: true,
  remote: "origin",
};

describe("runPrune", () => {
  it("deletes local and remote when PR merged and no worktree", () => {
    const delLocal = vi.fn();
    const delRemote = vi.fn();
    const result = runPrune(baseOpts, mockDeps({
      deleteLocalBranch: delLocal,
      deleteRemoteBranch: delRemote,
    }));
    expect(delLocal).toHaveBeenCalledWith("/repo", "add-dark-mode");
    expect(delRemote).toHaveBeenCalledWith("/repo", "origin", "add-dark-mode");
    expect(result.action).toBe("pruned");
    expect(result.local.deleted).toBe(true);
    expect(result.remoteBranch.deleted).toBe(true);
    expect(result.mergedPr.number).toBe(42);
  });

  it("refuses when worktree registered by path", () => {
    expect(() =>
      runPrune(
        baseOpts,
        mockDeps({
          listWorktrees: () => [
            {
              path: "/repo/.worktrees/add-dark-mode",
              head: "x",
              branch: "add-dark-mode",
              bare: false,
              detached: false,
            },
          ],
        }),
      ),
    ).toThrow(CliError);
    try {
      runPrune(
        baseOpts,
        mockDeps({
          listWorktrees: () => [
            {
              path: "/repo/.worktrees/add-dark-mode",
              head: "x",
              branch: null,
              bare: false,
              detached: false,
            },
          ],
        }),
      );
    } catch (e) {
      expect((e as CliError).code).toBe("worktree_exists");
    }
  });

  it("refuses when not merged", () => {
    try {
      runPrune(baseOpts, mockDeps({ findMergedPr: () => null }));
      expect.fail("should throw");
    } catch (e) {
      expect((e as CliError).code).toBe("branch_not_merged");
    }
  });

  it("surfaces pr_backend_unavailable from findMergedPr", () => {
    try {
      runPrune(
        baseOpts,
        mockDeps({
          findMergedPr: () => {
            throw new CliError("pr_backend_unavailable", "no gh", { backend: "gh" });
          },
        }),
      );
      expect.fail("should throw");
    } catch (e) {
      expect((e as CliError).code).toBe("pr_backend_unavailable");
    }
  });

  it("local absent still deletes remote", () => {
    const delLocal = vi.fn();
    const delRemote = vi.fn();
    const result = runPrune(
      baseOpts,
      mockDeps({
        branchExists: () => false,
        deleteLocalBranch: delLocal,
        deleteRemoteBranch: delRemote,
        remoteBranchExists: () => true,
      }),
    );
    expect(delLocal).not.toHaveBeenCalled();
    expect(delRemote).toHaveBeenCalled();
    expect(result.local.alreadyAbsent).toBe(true);
    expect(result.remoteBranch.deleted).toBe(true);
  });

  it("remote already absent succeeds", () => {
    const result = runPrune(
      baseOpts,
      mockDeps({
        remoteBranchExists: () => false,
        branchExists: () => true,
      }),
    );
    expect(result.remoteBranch.alreadyAbsent).toBe(true);
    expect(result.local.deleted).toBe(true);
    expect(result.action).toBe("pruned");
  });

  it("both absent is already_clean", () => {
    const result = runPrune(
      baseOpts,
      mockDeps({
        branchExists: () => false,
        remoteBranchExists: () => false,
      }),
    );
    expect(result.action).toBe("already_clean");
  });

  it("branch -d failure does not call -D (only deleteLocalBranch once, throws)", () => {
    const delLocal = vi.fn(() => {
      throw new Error("not fully merged");
    });
    const delRemote = vi.fn();
    try {
      runPrune(
        baseOpts,
        mockDeps({
          deleteLocalBranch: delLocal,
          deleteRemoteBranch: delRemote,
        }),
      );
      expect.fail("should throw");
    } catch (e) {
      expect((e as CliError).code).toBe("git_failed");
      expect((e as CliError).message).toContain("-d");
      expect((e as CliError).message).toContain("not using -D");
    }
    expect(delLocal).toHaveBeenCalledTimes(1);
    expect(delRemote).not.toHaveBeenCalled();
  });
});
