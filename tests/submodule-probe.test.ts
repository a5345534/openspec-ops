import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  doctorIssuesFromSubmodules,
  parseGitmodulesPaths,
  probeMatchingSubmoduleBranches,
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

describe("probeMatchingSubmoduleBranches", () => {
  function fixture() {
    const dir = mkdtempSync(join(tmpdir(), "ops-sub-branches-"));
    writeFileSync(
      join(dir, ".gitmodules"),
      `[submodule "a"]\n\tpath = a\n\turl = ../a\n[submodule "b"]\n\tpath = b\n\turl = ../b\n`,
    );
    mkdirSync(join(dir, "a"));
    mkdirSync(join(dir, "b"));
    writeFileSync(join(dir, "a", ".git"), "gitdir: ../modules/a\n");
    writeFileSync(join(dir, "b", ".git"), "gitdir: ../modules/b\n");
    return dir;
  }

  it("reports matching local and remote-tracking refs across submodules", () => {
    const dir = fixture();
    const commands: string[] = [];
    try {
      const runGit: GitRunner = (args, options) => {
        commands.push(args.join(" "));
        const sub = options?.cwd?.endsWith("/a") ? "a" : "b";
        if (args[0] === "rev-parse") return { stdout: "true\n", stderr: "", status: 0 };
        if (args[0] === "symbolic-ref") {
          return {
            stdout: sub === "a" ? "demo-change\n" : "other\n",
            stderr: "",
            status: 0,
          };
        }
        if (args[0] === "remote") {
          return { stdout: "upstream\norigin\n", stderr: "", status: 0 };
        }
        const ref = args.at(-1) ?? "";
        const exists =
          (sub === "a" && ref === "refs/heads/demo-change") ||
          (sub === "a" && ref === "refs/remotes/origin/demo-change") ||
          (sub === "b" && ref === "refs/remotes/upstream/demo-change");
        return { stdout: "", stderr: "", status: exists ? 0 : 1 };
      };

      expect(
        probeMatchingSubmoduleBranches(dir, "demo-change", { runGit }),
      ).toEqual([
        {
          code: "submodule_change_branch_local",
          path: "a",
          branch: "demo-change",
          remote: null,
          current: true,
        },
        {
          code: "submodule_change_branch_remote_tracking",
          path: "a",
          branch: "demo-change",
          remote: "origin",
          current: true,
        },
        {
          code: "submodule_change_branch_remote_tracking",
          path: "b",
          branch: "demo-change",
          remote: "upstream",
          current: false,
        },
      ]);
      expect(commands.some((command) => /fetch|push|switch|branch -d/.test(command))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does not walk up from hollow submodule directories into the parent repo", () => {
    const dir = fixture();
    try {
      rmSync(join(dir, "a", ".git"), { force: true });
      rmSync(join(dir, "b", ".git"), { force: true });
      const runGit: GitRunner = () => {
        throw new Error("must not probe parent through hollow path");
      };
      expect(probeMatchingSubmoduleBranches(dir, "demo-change", { runGit })).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns empty without matches and skips an individual failing submodule", () => {
    const dir = fixture();
    try {
      const runGit: GitRunner = (args, options) => {
        if (options?.cwd?.endsWith("/a")) throw new Error("unreadable");
        if (args[0] === "rev-parse") return { stdout: "true\n", stderr: "", status: 0 };
        if (args[0] === "symbolic-ref") return { stdout: "", stderr: "", status: 1 };
        if (args[0] === "remote") return { stdout: "", stderr: "", status: 0 };
        return { stdout: "", stderr: "", status: 1 };
      };
      expect(probeMatchingSubmoduleBranches(dir, "demo-change", { runGit })).toEqual([]);
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
