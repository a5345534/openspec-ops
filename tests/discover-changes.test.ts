import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  formatChangePickList,
  listCandidateChanges,
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
});

describe("formatChangePickList", () => {
  it("lists ops-next commands without auto-select", () => {
    const t = formatChangePickList(["a", "b"]);
    expect(t).toContain("/ops-next a");
    expect(t).toContain("Nothing was auto-selected");
  });
});
