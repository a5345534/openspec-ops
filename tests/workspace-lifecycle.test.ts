import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createFixtureRepo, runCli, type FixtureRepo } from "./helpers/fixture.js";

const fixtures: FixtureRepo[] = [];

function fixture(): FixtureRepo {
  const f = createFixtureRepo();
  fixtures.push(f);
  return f;
}

afterEach(() => {
  while (fixtures.length) {
    fixtures.pop()?.cleanup();
  }
});

describe("openspec-ops workspace lifecycle", () => {
  it("S1 happy path: start → reuse → where → finish → not_found", async () => {
    const f = fixture();
    const start1 = await runCli(["start", "add-dark-mode", "--json"], f.root);
    expect(start1.code).toBe(0);
    expect(start1.json.ok).toBe(true);
    expect(start1.json.schemaVersion).toBe(1);
    expect(start1.json.command).toBe("start");
    expect(start1.json.result.action).toBe("created");
    expect(start1.json.result.branch).toBe("add-dark-mode");
    expect(start1.json.result.path).toBe(join(f.root, ".worktrees", "add-dark-mode"));
    expect(existsSync(start1.json.result.path)).toBe(true);

    const start2 = await runCli(["start", "add-dark-mode", "--json"], f.root);
    expect(start2.code).toBe(0);
    expect(start2.json.result.action).toBe("reused");

    const where = await runCli(["where", "add-dark-mode", "--json"], f.root);
    expect(where.code).toBe(0);
    expect(where.json.result.found).toBe(true);
    expect(where.json.result.dirty).toBe(false);
    expect(where.json.result.matchedBy).toBe("path");

    const finish = await runCli(["finish", "add-dark-mode", "--json"], f.root);
    expect(finish.code).toBe(0);
    expect(finish.json.result.action).toBe("removed");
    expect(finish.json.result.branchDeleted).toBe(false);
    expect(existsSync(join(f.root, ".worktrees", "add-dark-mode"))).toBe(false);

    // branch kept
    f.git("show-ref", "--verify", "refs/heads/add-dark-mode");

    const where2 = await runCli(["where", "add-dark-mode", "--json"], f.root);
    expect(where2.code).toBe(5);
    expect(where2.json.ok).toBe(false);
    expect(where2.json.error.code).toBe("not_found");
  });

  it("S2 reuses existing free branch without resetting tip", async () => {
    const f = fixture();
    f.git("branch", "add-dark-mode", "main");
    // Advance branch tip with a commit via temporary detached work approach:
    // create commit on branch using worktree-less update-ref after commit in index is hard;
    // instead: checkout branch, commit, checkout main.
    f.git("checkout", "add-dark-mode");
    writeFileSync(join(f.root, "extra.txt"), "x\n");
    f.git("add", "extra.txt");
    f.git("commit", "-m", "branch tip");
    const tip = f.git("rev-parse", "HEAD");
    f.git("checkout", "main");

    const start = await runCli(["start", "add-dark-mode", "--json"], f.root);
    expect(start.code).toBe(0);
    expect(start.json.result.action).toBe("created");
    expect(start.json.result.base).toBeNull();
    expect(start.json.result.head).toBe(tip);
    expect(f.git("rev-parse", "add-dark-mode")).toBe(tip);
  });

  it("S3 branch_busy when branch checked out elsewhere", async () => {
    const f = fixture();
    const other = join(f.root, "other-wt");
    f.git("branch", "add-dark-mode", "main");
    f.git("worktree", "add", other, "add-dark-mode");

    const start = await runCli(["start", "add-dark-mode", "--json"], f.root);
    expect(start.code).toBe(3);
    expect(start.json.error.code).toBe("branch_busy");
  });

  it("S4 path_not_worktree when directory occupies default path", async () => {
    const f = fixture();
    mkdirSync(join(f.root, ".worktrees", "add-dark-mode"), { recursive: true });
    writeFileSync(join(f.root, ".worktrees", "add-dark-mode", "junk"), "x");

    const start = await runCli(["start", "add-dark-mode", "--json"], f.root);
    expect(start.code).toBe(3);
    expect(start.json.error.code).toBe("path_not_worktree");
  });

  it("S5 dirty finish refused then force succeeds", async () => {
    const f = fixture();
    const start = await runCli(["start", "add-dark-mode", "--json"], f.root);
    expect(start.code).toBe(0);
    const wt = start.json.result.path as string;
    writeFileSync(join(wt, "dirty.txt"), "dirty\n");

    const where = await runCli(["where", "add-dark-mode", "--json"], f.root);
    expect(where.json.result.dirty).toBe(true);

    const finish = await runCli(["finish", "add-dark-mode", "--json"], f.root);
    expect(finish.code).toBe(4);
    expect(finish.json.error.code).toBe("worktree_dirty");
    expect(existsSync(wt)).toBe(true);

    const forced = await runCli(["finish", "add-dark-mode", "--force", "--json"], f.root);
    expect(forced.code).toBe(0);
    expect(forced.json.result.action).toBe("removed");
    expect(existsSync(wt)).toBe(false);
  });

  it("S6 start from linked worktree anchors under primary .worktrees", async () => {
    const f = fixture();
    const first = await runCli(["start", "first-change", "--json"], f.root);
    expect(first.code).toBe(0);
    const firstPath = first.json.result.path as string;

    const second = await runCli(["start", "second-change", "--json"], firstPath);
    expect(second.code).toBe(0);
    expect(second.json.result.path).toBe(join(f.root, ".worktrees", "second-change"));
    expect(second.json.result.path.startsWith(join(firstPath, ".worktrees"))).toBe(false);
  });

  it("S7 not_a_git_repo for all commands", async () => {
    const dir = createFixtureRepo();
    // Use a non-git temp by cleaning git — easier: plain tmp without init
    dir.cleanup();
    const plain = createFixtureRepo();
    // Actually create empty non-git dir
    const { mkdtempSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const empty = mkdtempSync(join(tmpdir(), "openspec-ops-nongit-"));
    try {
      for (const cmd of [
        ["start", "x"],
        ["where", "x"],
        ["finish", "x"],
        ["doctor"],
      ] as string[][]) {
        const res = await runCli([...cmd, "--json"], empty);
        expect(res.code).toBe(2);
        expect(res.json.error.code).toBe("not_a_git_repo");
      }
    } finally {
      rmSync(empty, { recursive: true, force: true });
      plain.cleanup();
    }
  });

  it("S8 invalid change name and JSON error envelope", async () => {
    const f = fixture();
    const res = await runCli(["start", "Add_Dark_Mode", "--json"], f.root);
    expect(res.code).toBe(1);
    expect(res.json.ok).toBe(false);
    expect(res.json.schemaVersion).toBe(1);
    expect(res.json.error.code).toBe("invalid_change_name");
    expect(typeof res.json.error.details).toBe("object");
  });

  it("doctor reports stale_worktree_dir with exit 0", async () => {
    const f = fixture();
    mkdirSync(join(f.root, ".worktrees", "orphan-dir"), { recursive: true });
    const doc = await runCli(["doctor", "--json"], f.root);
    expect(doc.code).toBe(0);
    expect(doc.json.ok).toBe(true);
    expect(doc.json.result.summary.warning).toBeGreaterThanOrEqual(1);
    const stale = doc.json.result.issues.find((i: any) => i.id === "stale_worktree_dir");
    expect(stale).toBeTruthy();
    expect(stale.severity).toBe("warning");
  });

  it("start succeeds without openspec change directory", async () => {
    const f = fixture();
    const res = await runCli(["start", "no-change-dir-yet", "--json"], f.root);
    expect(res.code).toBe(0);
    expect(res.json.result.changeDirExists).toBe(false);
  });

  it("help lists Phase 0 commands", async () => {
    const f = fixture();
    const res = await runCli(["--help"], f.root);
    expect(res.code).toBe(0);
    expect(res.stdout).toContain("start");
    expect(res.stdout).toContain("where");
    expect(res.stdout).toContain("finish");
    expect(res.stdout).toContain("doctor");
  });

  it("unknown command is usage error", async () => {
    const f = fixture();
    const res = await runCli(["nosuch", "--json"], f.root);
    expect(res.code).toBe(1);
    expect(res.json.error.code).toBe("usage");
  });
});
