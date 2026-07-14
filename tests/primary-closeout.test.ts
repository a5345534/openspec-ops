import { describe, expect, it } from "vitest";
import {
  detectPrimaryBehindOrigin,
  doctorIssuesFromPrimarySubmodules,
  primaryBehindDoctorIssue,
} from "../src/doctor/primary-closeout.js";
import type { SubmoduleStatus } from "../src/types.js";

describe("detectPrimaryBehindOrigin", () => {
  it("reports behind when primary is strict ancestor of origin/base", () => {
    const r = detectPrimaryBehindOrigin("/repo", {
      resolveBase: () => "origin/main",
      revParse: (_cwd, rev) => {
        if (rev === "HEAD") return "aaa";
        if (rev === "origin/main") return "bbb";
        return rev;
      },
      refExists: (_cwd, rev) => rev === "origin/main",
      runGit: (args) => {
        if (args[0] === "merge-base") {
          return { status: 0, stdout: "", stderr: "" };
        }
        if (args[0] === "rev-list") {
          return { status: 0, stdout: "3\n", stderr: "" };
        }
        return { status: 1, stdout: "", stderr: "no" };
      },
    });
    expect(r.behind).toBe(true);
    expect(r.baseBranch).toBe("main");
    expect(r.originBaseRef).toBe("origin/main");
    const issue = primaryBehindDoctorIssue("/repo", r);
    expect(issue?.id).toBe("primary_behind_origin");
    expect(issue?.severity).toBe("warning");
  });

  it("omits behind when tips equal", () => {
    const r = detectPrimaryBehindOrigin("/repo", {
      resolveBase: () => "main",
      revParse: () => "same",
      refExists: () => true,
      runGit: () => ({ status: 0, stdout: "0\n", stderr: "" }),
    });
    expect(r.behind).toBe(false);
    expect(primaryBehindDoctorIssue("/repo", r)).toBeNull();
  });

  it("fail-open when remote-tracking missing", () => {
    const r = detectPrimaryBehindOrigin("/repo", {
      resolveBase: () => "main",
      revParse: () => "x",
      refExists: () => false,
      runGit: () => ({ status: 1, stdout: "", stderr: "" }),
    });
    expect(r.behind).toBe(false);
    expect(r.reason).toBe("missing_remote");
    expect(primaryBehindDoctorIssue("/repo", r)).toBeNull();
  });

  it("not behind when diverged (not ancestor)", () => {
    const r = detectPrimaryBehindOrigin("/repo", {
      resolveBase: () => "main",
      revParse: (_c, rev) => (rev === "HEAD" ? "a" : "b"),
      refExists: () => true,
      runGit: (args) => {
        if (args[0] === "merge-base") {
          return { status: 1, stdout: "", stderr: "" };
        }
        return { status: 0, stdout: "1\n", stderr: "" };
      },
    });
    expect(r.behind).toBe(false);
    expect(r.reason).toBe("diverged");
  });
});

describe("doctorIssuesFromPrimarySubmodules", () => {
  it("uses primary_* ids not submodule_detached", () => {
    const subs: SubmoduleStatus[] = [
      { path: "aos-core", detached: true, dirty: false, branch: null, head: "abc" },
      { path: "other", detached: true, dirty: true, branch: null, head: "def" },
    ];
    const issues = doctorIssuesFromPrimarySubmodules("/repo", subs);
    expect(issues.map((i) => i.id)).toEqual([
      "primary_submodule_detached",
      "primary_submodule_detached_dirty",
    ]);
    expect(issues[0]!.severity).toBe("info");
    expect(issues[1]!.severity).toBe("warning");
  });
});
