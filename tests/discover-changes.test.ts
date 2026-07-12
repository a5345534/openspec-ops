import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  formatChangePickList,
  listCandidateChanges,
  worktreeLeafChangeName,
} from "../src/next-step/discover-changes.js";

describe("listCandidateChanges", () => {
  it("finds active change dirs and worktree leaves", () => {
    const root = mkdtempSync(join(tmpdir(), "ops-disc-ch-"));
    mkdirSync(join(root, "openspec", "changes", "add-x"), { recursive: true });
    mkdirSync(join(root, "openspec", "changes", "archive", "2026-01-01-old"), {
      recursive: true,
    });
    writeFileSync(join(root, "openspec", "changes", "add-x", "proposal.md"), "x");
    mkdirSync(join(root, ".worktrees", "ship-y"), { recursive: true });
    expect(listCandidateChanges([root])).toEqual(["add-x", "ship-y"]);
  });

  it("returns empty for missing roots", () => {
    expect(listCandidateChanges(["/no/such/path"])).toEqual([]);
  });

  it("dedupes and sorts", () => {
    const root = mkdtempSync(join(tmpdir(), "ops-disc-ch2-"));
    mkdirSync(join(root, "openspec", "changes", "zeta"), { recursive: true });
    mkdirSync(join(root, ".worktrees", "alpha"), { recursive: true });
    mkdirSync(join(root, "openspec", "changes", "alpha"), { recursive: true });
    expect(listCandidateChanges([root])).toEqual(["alpha", "zeta"]);
  });

  it("does not treat package root basename openspec-ops as a change", () => {
    const parent = mkdtempSync(join(tmpdir(), "ops-pkg-"));
    const root = join(parent, "openspec-ops");
    mkdirSync(root, { recursive: true });
    // no openspec/changes, no .worktrees
    expect(listCandidateChanges([root])).toEqual([]);
  });

  it("package root named openspec-ops with only archive stays empty of false package name", () => {
    const parent = mkdtempSync(join(tmpdir(), "ops-pkg2-"));
    const root = join(parent, "openspec-ops");
    mkdirSync(join(root, "openspec", "changes", "archive", "2026-01-01-old"), {
      recursive: true,
    });
    expect(listCandidateChanges([root])).toEqual([]);
  });

  it("includes leaf when root is a .worktrees/<change> path", () => {
    const parent = mkdtempSync(join(tmpdir(), "ops-wt-"));
    const leaf = join(parent, ".worktrees", "add-x");
    mkdirSync(leaf, { recursive: true });
    expect(listCandidateChanges([leaf])).toEqual(["add-x"]);
  });
});

describe("worktreeLeafChangeName", () => {
  it("null when not under .worktrees", () => {
    expect(worktreeLeafChangeName("/repo/openspec-ops")).toBeNull();
  });
});

describe("formatChangePickList", () => {
  it("lists ops-next commands without auto-select", () => {
    const t = formatChangePickList(["a", "b"]);
    expect(t).toContain("/ops-next a");
    expect(t).toContain("Nothing was auto-selected");
  });
});
