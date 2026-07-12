import { describe, expect, it, vi } from "vitest";
import {
  initSubmoduleBranches,
  warningsFromSubmoduleBranchResults,
} from "../src/submodules/init-branches.js";
import type { SubmoduleStatus } from "../src/types.js";

describe("initSubmoduleBranches", () => {
  it("creates branch when detached and branch missing", () => {
    const git = vi.fn((args: string[]) => {
      if (args[0] === "show-ref") return { status: 1, stdout: "", stderr: "" };
      if (args[0] === "switch" && args[1] === "-c") {
        return { status: 0, stdout: "", stderr: "" };
      }
      return { status: 0, stdout: "", stderr: "" };
    });
    const probe = () =>
      [
        {
          path: "aos-core",
          detached: true,
          dirty: false,
          branch: null,
          head: "abc",
        },
      ] satisfies SubmoduleStatus[];

    const r = initSubmoduleBranches("/wt", "my-change", {
      runGit: git as never,
      probe: probe as never,
    });
    expect(r).toEqual([
      { path: "aos-core", branch: "my-change", action: "created" },
    ]);
    expect(git).toHaveBeenCalledWith(
      ["switch", "-c", "my-change"],
      expect.objectContaining({ cwd: expect.stringContaining("aos-core") }),
    );
  });

  it("switches when branch exists", () => {
    const git = vi.fn((args: string[]) => {
      if (args[0] === "show-ref") return { status: 0, stdout: "", stderr: "" };
      if (args[0] === "switch") return { status: 0, stdout: "", stderr: "" };
      return { status: 0, stdout: "", stderr: "" };
    });
    const r = initSubmoduleBranches("/wt", "my-change", {
      runGit: git as never,
      probe: () =>
        [
          {
            path: "lib",
            detached: true,
            dirty: true,
            branch: null,
            head: "x",
          },
        ] as SubmoduleStatus[],
    });
    expect(r[0]!.action).toBe("switched");
    expect(git).toHaveBeenCalledWith(
      ["switch", "my-change"],
      expect.any(Object),
    );
  });

  it("skips non-detached", () => {
    const git = vi.fn();
    const r = initSubmoduleBranches("/wt", "my-change", {
      runGit: git as never,
      probe: () =>
        [
          {
            path: "lib",
            detached: false,
            dirty: false,
            branch: "main",
            head: "x",
          },
        ] as SubmoduleStatus[],
    });
    expect(r[0]!.action).toBe("skipped");
    expect(git).not.toHaveBeenCalled();
  });

  it("fail-open on switch failure", () => {
    const git = vi.fn((args: string[]) => {
      if (args[0] === "show-ref") return { status: 1, stdout: "", stderr: "" };
      return { status: 1, stdout: "", stderr: "boom" };
    });
    const r = initSubmoduleBranches("/wt", "my-change", {
      runGit: git as never,
      probe: () =>
        [
          {
            path: "lib",
            detached: true,
            dirty: false,
            branch: null,
            head: "x",
          },
        ] as SubmoduleStatus[],
    });
    expect(r[0]!.action).toBe("failed");
    expect(warningsFromSubmoduleBranchResults(r)).toHaveLength(1);
  });
});
