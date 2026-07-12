import { describe, expect, it, vi } from "vitest";
import { parseMergeMethod, runMerge, type MergeDeps } from "../src/commands/merge.js";
import { CliError } from "../src/types.js";

function mockDeps(over: Partial<MergeDeps> = {}): MergeDeps {
  return {
    resolveRepo: () => ({
      cwd: "/repo",
      primaryPath: "/repo",
      worktreeRoot: "/repo/.worktrees",
      worktrees: [],
    }),
    defaultBranch: (c, b) => b ?? c,
    findOpenPr: () => ({ number: 7, url: "https://github.com/o/r/pull/7" }),
    findMergedPr: () => null,
    assertChecksGreen: () => {},
    mergePr: () => {},
    ...over,
  };
}

const base = { change: "add-dark-mode", json: true, method: "squash" as const };

describe("parseMergeMethod", () => {
  it("defaults squash", () => {
    expect(parseMergeMethod(undefined)).toBe("squash");
    expect(parseMergeMethod("SQUASH")).toBe("squash");
  });
  it("rejects invalid", () => {
    expect(() => parseMergeMethod("ff")).toThrow(CliError);
  });
});

describe("runMerge", () => {
  it("merges when open PR and checks green", () => {
    const mergePr = vi.fn();
    const assertChecks = vi.fn();
    const r = runMerge(base, mockDeps({ mergePr, assertChecksGreen: assertChecks }));
    expect(assertChecks).toHaveBeenCalledWith("/repo", 7);
    expect(mergePr).toHaveBeenCalledWith("/repo", 7, "squash");
    expect(r.action).toBe("merged");
    expect(r.pr.number).toBe(7);
  });

  it("blocks when checks fail", () => {
    expect(() =>
      runMerge(
        base,
        mockDeps({
          assertChecksGreen: () => {
            throw new CliError("checks_failed", "pending", { pr: 7 });
          },
        }),
      ),
    ).toThrow(CliError);
    try {
      runMerge(
        base,
        mockDeps({
          assertChecksGreen: () => {
            throw new CliError("checks_failed", "pending", { pr: 7 });
          },
          mergePr: () => {
            throw new Error("should not merge");
          },
        }),
      );
    } catch (e) {
      expect((e as CliError).code).toBe("checks_failed");
    }
  });

  it("already_merged when no open but merged exists", () => {
    const mergePr = vi.fn();
    const r = runMerge(
      base,
      mockDeps({
        findOpenPr: () => null,
        findMergedPr: () => ({
          number: 9,
          url: "https://github.com/o/r/pull/9",
        }),
        mergePr,
      }),
    );
    expect(r.action).toBe("already_merged");
    expect(mergePr).not.toHaveBeenCalled();
  });

  it("pr_not_found when no open and no merged", () => {
    try {
      runMerge(
        base,
        mockDeps({
          findOpenPr: () => null,
          findMergedPr: () => null,
        }),
      );
      expect.fail("throw");
    } catch (e) {
      expect((e as CliError).code).toBe("pr_not_found");
    }
  });

  it("works without worktree (empty worktrees list)", () => {
    const r = runMerge(base, mockDeps());
    expect(r.action).toBe("merged");
  });

  it("propagates pr_backend_unavailable", () => {
    try {
      runMerge(
        base,
        mockDeps({
          findOpenPr: () => {
            throw new CliError("pr_backend_unavailable", "no gh", {});
          },
        }),
      );
      expect.fail("throw");
    } catch (e) {
      expect((e as CliError).code).toBe("pr_backend_unavailable");
    }
  });
});
