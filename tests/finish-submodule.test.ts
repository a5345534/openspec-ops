import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  isSubmoduleContainmentError,
  prepareWorktreeForRemoval,
} from "../src/submodules/teardown.js";
import { isDirty, removeWorktree } from "../src/git.js";
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

  it("deinits initialized submodules while preserving hollow gitlink paths", () => {
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
      expect(out.cleared).toEqual([]);
      expect(existsSync(join(dir, "aos-core"))).toBe(true);
      expect(runGit).toHaveBeenCalledWith(
        ["submodule", "deinit", "-f", "--", "aos-core"],
        expect.objectContaining({ cwd: dir }),
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("preserves residual hollow submodule dirs to avoid synthetic dirtiness", () => {
    const dir = mkdtempSync(join(tmpdir(), "ops-fin-hollow-"));
    try {
      writeFileSync(
        join(dir, ".gitmodules"),
        `[submodule "aos-core"]\n\tpath = aos-core\n\turl = ../x\n`,
      );
      mkdirSync(join(dir, "aos-core"));
      const runGit = vi.fn<GitRunner>(() => ({ stdout: "", stderr: "", status: 0 }));
      const out = prepareWorktreeForRemoval(dir, { runGit });
      expect(out).toEqual({ deinited: [], cleared: [] });
      expect(existsSync(join(dir, "aos-core"))).toBe(true);
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
      isDirty: vi.fn(() => false),
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

  it("uses structural force once after clean containment error", () => {
    const removeWorktree = vi.fn((_cwd: string, _path: string, force: boolean) => {
      if (!force) {
        throw new CliError(
          "git_failed",
          "fatal: cannot move or remove a worktree that contains submodules",
        );
      }
    });
    const prepare = vi.fn(() => ({ deinited: [], cleared: ["aos-core"] }));
    const isDirty = vi.fn(() => false);
    const deps = mockDeps({ prepare, isDirty, removeWorktree });
    const result = runFinish(baseOpts, deps);
    expect(result.worktreeRemoved).toBe(true);
    expect(result.forced).toBe(false);
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(isDirty).toHaveBeenCalledWith("/tmp/wt/demo-change");
    expect(removeWorktree).toHaveBeenNthCalledWith(
      1,
      "/tmp/primary",
      "/tmp/wt/demo-change",
      false,
    );
    expect(removeWorktree).toHaveBeenNthCalledWith(
      2,
      "/tmp/primary",
      "/tmp/wt/demo-change",
      true,
    );
  });

  it("refuses structural force when preparation leaves the worktree dirty", () => {
    const removeWorktree = vi.fn(() => {
      throw new CliError(
        "git_failed",
        "fatal: cannot move or remove a worktree that contains submodules",
      );
    });
    const deps = mockDeps({ isDirty: () => true, removeWorktree });
    expect(() => runFinish(baseOpts, deps)).toThrowError(
      expect.objectContaining({ code: "worktree_dirty" }),
    );
    expect(removeWorktree).toHaveBeenCalledTimes(1);
  });

  it("fails submodule_teardown_failed when structural force still contains", () => {
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
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(removeWorktree).toHaveBeenCalledTimes(2);
  });

  it("preserves unrelated structural retry errors", () => {
    const removeWorktree = vi.fn((_cwd: string, _path: string, force: boolean) => {
      throw new CliError(
        "git_failed",
        force
          ? "fatal: permission denied"
          : "fatal: cannot move or remove a worktree that contains submodules",
      );
    });
    expect(() => runFinish(baseOpts, mockDeps({ removeWorktree }))).toThrowError(
      expect.objectContaining({ code: "git_failed", message: "fatal: permission denied" }),
    );
  });

  it("does not reinterpret operator force as structural retry", () => {
    const removeWorktree = vi.fn(() => {
      throw new CliError(
        "git_failed",
        "fatal: cannot move or remove a worktree that contains submodules",
      );
    });
    expect(() => runFinish({ ...baseOpts, force: true }, mockDeps({ removeWorktree }))).toThrowError(
      expect.objectContaining({ code: "submodule_teardown_failed" }),
    );
    expect(removeWorktree).toHaveBeenCalledTimes(1);
  });
});

describe("runFinish real submodule gitlink integration", () => {
  function git(cwd: string, ...args: string[]) {
    const result = spawnSync("git", args, {
      cwd,
      encoding: "utf8",
      env: {
        ...process.env,
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_CONFIG_GLOBAL: "/dev/null",
      },
    });
    if (result.status !== 0) {
      throw new Error(`git ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
    }
    return result.stdout.trim();
  }

  function fixture(mode: "initialized" | "deinitialized" | "dirty-submodule") {
    const root = mkdtempSync(join(tmpdir(), "ops-fin-real-sub-"));
    const submodule = join(root, "submodule");
    const primary = join(root, "primary");
    const worktree = join(root, "change-worktree");
    mkdirSync(submodule);
    git(submodule, "init", "-q");
    git(submodule, "config", "user.email", "test@example.com");
    git(submodule, "config", "user.name", "Test User");
    writeFileSync(join(submodule, "tracked.txt"), "submodule\n");
    git(submodule, "add", "tracked.txt");
    git(submodule, "commit", "-qm", "init submodule");

    mkdirSync(primary);
    git(primary, "init", "-q");
    git(primary, "config", "user.email", "test@example.com");
    git(primary, "config", "user.name", "Test User");
    writeFileSync(join(primary, "README.md"), "primary\n");
    git(primary, "add", "README.md");
    git(primary, "commit", "-qm", "init primary");
    git(
      primary,
      "-c",
      "protocol.file.allow=always",
      "submodule",
      "add",
      "-q",
      submodule,
      "modules/sub",
    );
    git(primary, "commit", "-qam", "add submodule");
    git(primary, "worktree", "add", "-qb", "demo-change", worktree);
    git(
      worktree,
      "-c",
      "protocol.file.allow=always",
      "submodule",
      "update",
      "--init",
      "-q",
    );

    if (mode === "deinitialized") {
      git(worktree, "submodule", "deinit", "-f", "--", "modules/sub");
    } else if (mode === "dirty-submodule") {
      writeFileSync(join(worktree, "modules/sub/tracked.txt"), "dirty\n");
    }

    return {
      root,
      primary,
      worktree,
      cleanup: () => {
        spawnSync("git", ["worktree", "remove", "--force", worktree], {
          cwd: primary,
          encoding: "utf8",
        });
        rmSync(root, { recursive: true, force: true });
      },
    };
  }

  function realDeps(primary: string, worktree: string): FinishDeps {
    return {
      locate: () => ({
        found: true,
        change: "demo-change",
        path: worktree,
        branch: "demo-change",
        head: git(worktree, "rev-parse", "HEAD"),
        dirty: isDirty(worktree),
        primaryPath: primary,
        changeDirExists: false,
        changeDirPath: null,
        matchedBy: "path",
        submodules: [],
      }),
      resolveRepo: () => ({
        cwd: primary,
        primaryPath: primary,
        worktreeRoot: join(primary, ".worktrees"),
        worktrees: [],
      }),
      prepare: prepareWorktreeForRemoval,
      isDirty,
      removeWorktree,
      branchCleanup: () => ({
        attempted: false,
        localDeleted: false,
        localAlreadyAbsent: false,
        remoteDeleted: false,
        remoteAlreadyAbsent: false,
        keptReason: "not_merged",
        mergedPr: null,
      }),
      detectBehind: () => ({
        behind: false,
        baseBranch: "main",
        originBaseRef: "origin/main",
        primaryHead: "a",
        originHead: "a",
        reason: "ok",
      }),
    };
  }

  for (const mode of ["initialized", "deinitialized"] as const) {
    it(`removes a clean ${mode} submodule worktree without operator force`, () => {
      const f = fixture(mode);
      try {
        const ordinary = spawnSync("git", ["worktree", "remove", f.worktree], {
          cwd: f.primary,
          encoding: "utf8",
        });
        expect(ordinary.status).not.toBe(0);
        expect(isSubmoduleContainmentError(ordinary.stderr)).toBe(true);

        const result = runFinish(
          { change: "demo-change", repo: f.primary },
          realDeps(f.primary, f.worktree),
        );
        expect(result.worktreeRemoved).toBe(true);
        expect(result.forced).toBe(false);
        expect(existsSync(f.worktree)).toBe(false);
        expect(git(f.primary, "worktree", "list", "--porcelain")).not.toContain(f.worktree);
      } finally {
        f.cleanup();
      }
    });
  }

  it("blocks a dirty real submodule without operator force", () => {
    const f = fixture("dirty-submodule");
    try {
      expect(isDirty(f.worktree)).toBe(true);
      expect(() =>
        runFinish(
          { change: "demo-change", repo: f.primary },
          realDeps(f.primary, f.worktree),
        ),
      ).toThrowError(expect.objectContaining({ code: "worktree_dirty" }));
      expect(existsSync(f.worktree)).toBe(true);
    } finally {
      f.cleanup();
    }
  });
});
