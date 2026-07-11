import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  doctorIssuesFromSubmodules,
  parseGitmodulesPaths,
  probeTopLevelSubmodules,
  type GitRunner,
} from "../src/submodules/probe.js";
import type { SubmoduleStatus } from "../src/types.js";

describe("parseGitmodulesPaths", () => {
  it("extracts unique path entries", () => {
    const content = `
[submodule "aos-core"]
	path = aos-core
	url = ../aos-core.git
[submodule "other"]
	path = libs/other
	url = ../other.git
`;
    expect(parseGitmodulesPaths(content)).toEqual(["aos-core", "libs/other"]);
  });

  it("returns empty for empty content", () => {
    expect(parseGitmodulesPaths("")).toEqual([]);
  });
});

describe("probeTopLevelSubmodules", () => {
  it("returns [] when worktree root missing", () => {
    expect(probeTopLevelSubmodules("/no/such/path-openspec-ops")).toEqual([]);
  });

  it("returns [] when no .gitmodules", () => {
    const dir = mkdtempSync(join(tmpdir(), "ops-nosub-"));
    try {
      expect(probeTopLevelSubmodules(dir)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("doctorIssuesFromSubmodules", () => {
  const base = "/repo/.worktrees/c";

  it("emits info for clean detached", () => {
    const subs: SubmoduleStatus[] = [
      { path: "aos-core", detached: true, dirty: false, branch: null, head: "abc" },
    ];
    const issues = doctorIssuesFromSubmodules(base, subs);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.id).toBe("submodule_detached");
    expect(issues[0]!.severity).toBe("info");
    expect(issues[0]!.path).toContain("aos-core");
  });

  it("emits warning for detached dirty", () => {
    const subs: SubmoduleStatus[] = [
      { path: "aos-core", detached: true, dirty: true, branch: null, head: "abc" },
    ];
    const issues = doctorIssuesFromSubmodules(base, subs);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.id).toBe("submodule_detached_dirty");
    expect(issues[0]!.severity).toBe("warning");
  });

  it("ignores attached dirty (v1)", () => {
    const subs: SubmoduleStatus[] = [
      { path: "aos-core", detached: false, dirty: true, branch: "feat", head: "abc" },
    ];
    expect(doctorIssuesFromSubmodules(base, subs)).toEqual([]);
  });
});

describe("probeTopLevelSubmodules with injected git", () => {
  it("maps detached dirty via injected runner", () => {
    const dir = mkdtempSync(join(tmpdir(), "ops-sub-"));
    try {
      writeFileSync(
        join(dir, ".gitmodules"),
        `[submodule "aos-core"]\n\tpath = aos-core\n\turl = ../x\n`,
      );
      mkdirSync(join(dir, "aos-core"));

      const runGit: GitRunner = (args) => {
        if (args[0] === "rev-parse" && args[1] === "--is-inside-work-tree") {
          return { stdout: "true\n", stderr: "", status: 0 };
        }
        if (args[0] === "rev-parse" && args[1] === "HEAD") {
          return { stdout: "deadbeef\n", stderr: "", status: 0 };
        }
        if (args[0] === "symbolic-ref") {
          return { stdout: "", stderr: "", status: 1 };
        }
        if (args[0] === "status") {
          return { stdout: " M package.json\n", stderr: "", status: 0 };
        }
        return { stdout: "", stderr: `unexpected ${args.join(" ")}`, status: 1 };
      };

      const out = probeTopLevelSubmodules(dir, { runGit });
      expect(out).toEqual([
        {
          path: "aos-core",
          detached: true,
          dirty: true,
          branch: null,
          head: "deadbeef",
        },
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("skips submodule when probe git fails open", () => {
    const dir = mkdtempSync(join(tmpdir(), "ops-sub-fail-"));
    try {
      writeFileSync(
        join(dir, ".gitmodules"),
        `[submodule "aos-core"]\n\tpath = aos-core\n\turl = ../x\n`,
      );
      mkdirSync(join(dir, "aos-core"));
      const runGit: GitRunner = () => {
        throw new Error("boom");
      };
      expect(probeTopLevelSubmodules(dir, { runGit })).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
