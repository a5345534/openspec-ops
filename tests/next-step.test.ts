import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildNextStepPlan,
  detectLifecycleStation,
  formatTextMenu,
  optionsForStation,
} from "../src/next-step/index.js";

describe("optionsForStation hard-coded edges", () => {
  it("applied excludes spec-review", () => {
    const ids = optionsForStation("applied", "add-x").map((o) => o.id);
    expect(ids).toContain("ops-ship");
    expect(ids).toContain("stop");
    expect(ids).not.toContain("ops-spec-review");
  });

  it("shipped includes impl-review, ship, merge", () => {
    const ids = optionsForStation("shipped", "add-x").map((o) => o.id);
    expect(ids).toEqual([
      "ops-impl-review",
      "ops-ship",
      "ops-merge",
      "stop",
    ]);
  });

  it("proposed includes review and apply", () => {
    const ids = optionsForStation("proposed", "add-x").map((o) => o.id);
    expect(ids).toContain("ops-spec-review");
    expect(ids).toContain("opsx-apply");
  });
});

describe("detectLifecycleStation", () => {
  it("no_workspace when nothing found", () => {
    expect(
      detectLifecycleStation({
        change: "add-x",
        roots: ["/nope"],
        worktreeFound: false,
        hasOpenPr: false,
        hasMergedPr: false,
      }),
    ).toBe("no_workspace");
  });

  it("proposed when proposal exists and tasks open", () => {
    const root = mkdtempSync(join(tmpdir(), "ops-st-"));
    const dir = join(root, "openspec", "changes", "add-x");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "proposal.md"), "## Why\n");
    writeFileSync(join(dir, "tasks.md"), "- [ ] open\n");
    expect(
      detectLifecycleStation({
        change: "add-x",
        roots: [root],
        worktreeFound: true,
        hasOpenPr: false,
        hasMergedPr: false,
      }),
    ).toBe("proposed");
  });

  it("applied when all tasks complete", () => {
    const root = mkdtempSync(join(tmpdir(), "ops-st-"));
    const dir = join(root, "openspec", "changes", "add-x");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "proposal.md"), "## Why\n");
    writeFileSync(join(dir, "tasks.md"), "- [x] done\n");
    expect(
      detectLifecycleStation({
        change: "add-x",
        roots: [root],
        worktreeFound: true,
        hasOpenPr: false,
        hasMergedPr: false,
      }),
    ).toBe("applied");
  });

  it("shipped when open PR", () => {
    const root = mkdtempSync(join(tmpdir(), "ops-st-"));
    const dir = join(root, "openspec", "changes", "add-x");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "proposal.md"), "x");
    writeFileSync(join(dir, "tasks.md"), "- [x] d\n");
    expect(
      detectLifecycleStation({
        change: "add-x",
        roots: [root],
        worktreeFound: true,
        hasOpenPr: true,
        hasMergedPr: false,
      }),
    ).toBe("shipped");
  });
});

describe("formatTextMenu", () => {
  it("lists options without auto language", () => {
    const text = formatTextMenu(buildNextStepPlan("add-x", "applied"));
    expect(text).toContain("ops-ship");
    expect(text).toContain("Do not auto-continue");
  });
});
