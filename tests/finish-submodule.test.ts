import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  isSubmoduleContainmentError,
  prepareWorktreeForRemoval,
} from "../src/submodules/teardown.js";
import { CliError } from "../src/types.js";
import type { GitRunner } from "../src/submodules/teardown.js";
import { runFinish, type FinishDeps } from "../src/commands/finish.js";
import type { FinishOptions } from "../src/types.js";

describe("isSubmoduleContainmentError", () => {
  it("detects english and common phrasing", () => {
    expect(
      isSubmoduleContainmentError("fatal: cannot move or remove a worktree that contains submodules"),
    ).toBe(true);
    expect(isSubmoduleContainmentError("other error")).toBe(false);
  });

  it("detects chinese locale phrasing", () => {
    expect(
      isSubmoduleContainmentError("fatal: 不能移動或刪除包含子模組的工作區"),
    ).toBe(true);
    expect(
      isSubmoduleContainmentError("fatal: 不能移动或删除包含子模块的工作区"),
    ).toBe(true);
  });
});

describe("prepareWorktreeForRemoval", () => {
  it("no-ops without .gitmodules", () => {
    const dir = mkdtempSync(join(tmpdir(), "ops-fin-nosub-"));
    try {
      const runGit = vi.fn<GitRunner>(() => ({ stdout: "", stderr: "", status: 0 }));
      expect(prepareWorktreeForRemoval(dir, { runGit })).toEqual({ deinited: [], cleared: [] });
      expect(runGit).not.toHaveBeenCalled();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("deinits initialized submodule paths then returns list", () => {
    const dir = mkdtempSync(join(tmpdir(), "ops-fin-sub-"));
    try {
      writeFileSync(
        join(dir, ".gitmodules"),
        `[submodule "aos-core"]\n\tpath = aos-core\n\turl = ../x\n`,
      );
      mkdirSync(join(dir, "aos-core"));
      writeFileSync(join(dir, "aos-core", ".git"), "gitdir: ../../.git/modules/aos-core\n");

      const runGit = vi.fn<GitRunner>((args) => {
        if (args[0] === "submodule" && args[1] === "deinit") {
          // simulate deinit leaving a hollow dir (no .git)
          rmSync(join(dir, "aos-core", ".git"), { force: true });
          return { stdout: "", stderr: "", status: 0 };
        }
        return { stdout: "", stderr: "unexpected", status: 1 };
      });

      const out = prepareWorktreeForRemoval(dir, { runGit });
      expect(out.deinited).toEqual(["aos-core"]);
      expect(out.cleared).toEqual(["aos-core"]);
      expect(existsSync(join(dir, "aos-core"))).toBe(false);
      expect(runGit).toHaveBeenCalledWith(
        ["submodule", "deinit", "-f", "--", "aos-core"],
        expect.objectContaining({ cwd: dir }),
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("clears residual hollow submodule dirs without deinit", () => {
    const dir = mkdtempSync(join(tmpdir(), "ops-fin-hollow-"));
    try {
      writeFileSync(
        join(dir, ".gitmodules"),
        `[submodule "aos-core"]\n\tpath = aos-core\n\turl = ../x\n`,
      );
      mkdirSync(join(dir, "aos-core"));
      const runGit = vi.fn<GitRunner>(() => ({ stdout: "", stderr: "", status: 0 }));
      const out = prepareWorktreeForRemoval(dir, { runGit });
      expect(out).toEqual({ deinited: [], cleared: ["aos-core"] });
      expect(existsSync(join(dir, "aos-core"))).toBe(false);
      expect(runGit).not.toHaveBeenCalled();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("skips paths without .git when dir already absent", () => {
    const dir = mkdtempSync(join(tmpdir(), "ops-fin-skip-"));
    try {
      writeFileSync(
        join(dir, ".gitmodules"),
        `[submodule "aos-core"]\n\tpath = aos-core\n\turl = ../x\n`,
      );
      // no aos-core dir
      const runGit = vi.fn<GitRunner>(() => ({ stdout: "", stderr: "", status: 0 }));
      expect(prepareWorktreeForRemoval(dir, { runGit })).toEqual({
        deinited: [],
        cleared: [],
      });
      expect(runGit).not.toHaveBeenCalled();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("throws submodule_teardown_failed on deinit failure", () => {
    const dir = mkdtempSync(join(tmpdir(), "ops-fin-fail-"));
    try {
      writeFileSync(
        join(dir, ".gitmodules"),
        `[submodule "aos-core"]\n\tpath = aos-core\n\turl = ../x\n`,
      );
      mkdirSync(join(dir, "aos-core"));
      writeFileSync(join(dir, "aos-core", ".git"), "gitdir: foo\n");
      const runGit: GitRunner = () => ({
        stdout: "",
        stderr: "deinit failed",
        status: 1,
      });
      try {
        prepareWorktreeForRemoval(dir, { runGit });
        expect.fail("throw");
      } catch (e) {
        expect(e).toBeInstanceOf(CliError);
        expect((e as CliError).code).toBe("submodule_teardown_failed");
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});


describe("runFinish submodule containment retry", () => {
  const baseOpts: FinishOptions = {
    change: "demo-change",
    repo: "/tmp/primary",
  };

  function mockDeps(overrides: Partial<FinishDeps>): FinishDeps {
    return {
      locate: () => ({
        found: true,
        change: "demo-change",
        path: "/tmp/wt/demo-change",
        branch: "demo-change",
        head: "abc",
        dirty: false,
        primaryPath: "/tmp/primary",
        changeDirExists: true,
        changeDirPath: "/tmp/wt/demo-change/openspec/changes/demo-change",
        matchedBy: "path",
        submodules: [],
      }),
      resolveRepo: () => ({
        cwd: "/tmp/primary",
        primaryPath: "/tmp/primary",
        worktreeRoot: "/tmp/primary/.worktrees",
        worktrees: [],
      }),
      prepare: vi.fn(() => ({ deinited: ["aos-core"], cleared: ["aos-core"] })),
      removeWorktree: vi.fn(),
      branchCleanup: vi.fn(() => ({
        attempted: true,
        localDeleted: false,
        localAlreadyAbsent: true,
        remoteDeleted: false,
        remoteAlreadyAbsent: true,
        keptReason: "not_merged" as const,
        mergedPr: null,
      })),
      ...overrides,
    };
  }

  it("retries remove once after containment error", () => {
    let calls = 0;
    const removeWorktree = vi.fn(() => {
      calls += 1;
      if (calls === 1) {
        throw new CliError(
          "git_failed",
          "fatal: cannot move or remove a worktree that contains submodules",
        );
      }
    });
    const prepare = vi.fn(() => ({ deinited: [], cleared: ["aos-core"] }));
    const deps = mockDeps({ prepare, removeWorktree });
    const result = runFinish(baseOpts, deps);
    expect(result.worktreeRemoved).toBe(true);
    expect(prepare).toHaveBeenCalledTimes(2);
    expect(removeWorktree).toHaveBeenCalledTimes(2);
  });

  it("fails submodule_teardown_failed when retry still containment", () => {
    const removeWorktree = vi.fn(() => {
      throw new CliError(
        "git_failed",
        "fatal: 不能移動或刪除包含子模組的工作區",
      );
    });
    const prepare = vi.fn(() => ({ deinited: ["aos-core"], cleared: [] }));
    const deps = mockDeps({ prepare, removeWorktree });
    try {
      runFinish(baseOpts, deps);
      expect.fail("throw");
    } catch (e) {
      expect(e).toBeInstanceOf(CliError);
      expect((e as CliError).code).toBe("submodule_teardown_failed");
    }
    expect(prepare).toHaveBeenCalledTimes(2);
    expect(removeWorktree).toHaveBeenCalledTimes(2);
  });
});
