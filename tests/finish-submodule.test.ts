import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  isSubmoduleContainmentError,
  prepareWorktreeForRemoval,
} from "../src/submodules/teardown.js";
import { CliError } from "../src/types.js";
import type { GitRunner } from "../src/submodules/teardown.js";

describe("isSubmoduleContainmentError", () => {
  it("detects english and common phrasing", () => {
    expect(
      isSubmoduleContainmentError("fatal: cannot move or remove a worktree that contains submodules"),
    ).toBe(true);
    expect(isSubmoduleContainmentError("other error")).toBe(false);
  });
});

describe("prepareWorktreeForRemoval", () => {
  it("no-ops without .gitmodules", () => {
    const dir = mkdtempSync(join(tmpdir(), "ops-fin-nosub-"));
    try {
      const runGit = vi.fn<GitRunner>(() => ({ stdout: "", stderr: "", status: 0 }));
      expect(prepareWorktreeForRemoval(dir, { runGit })).toEqual({ deinited: [] });
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
          return { stdout: "", stderr: "", status: 0 };
        }
        return { stdout: "", stderr: "unexpected", status: 1 };
      });

      const out = prepareWorktreeForRemoval(dir, { runGit });
      expect(out.deinited).toEqual(["aos-core"]);
      expect(runGit).toHaveBeenCalledWith(
        ["submodule", "deinit", "-f", "--", "aos-core"],
        expect.objectContaining({ cwd: dir }),
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("skips paths without .git", () => {
    const dir = mkdtempSync(join(tmpdir(), "ops-fin-skip-"));
    try {
      writeFileSync(
        join(dir, ".gitmodules"),
        `[submodule "aos-core"]\n\tpath = aos-core\n\turl = ../x\n`,
      );
      mkdirSync(join(dir, "aos-core"));
      const runGit = vi.fn<GitRunner>(() => ({ stdout: "", stderr: "", status: 0 }));
      expect(prepareWorktreeForRemoval(dir, { runGit }).deinited).toEqual([]);
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
