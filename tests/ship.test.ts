import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  classifyPushFailure,
  defaultShipMessage,
  isNothingToShipMessage,
  resolveRemotePushUrl,
  runShip,
  toBaseBranchName,
  type ShipDeps,
} from "../src/commands/ship.js";
import { CliError } from "../src/types.js";
import type { WhereResult } from "../src/types.js";

function baseWhere(over: Partial<WhereResult> = {}): WhereResult {
  return {
    found: true,
    change: "add-dark-mode",
    path: "/repo/.worktrees/add-dark-mode",
    branch: "add-dark-mode",
    head: "abc",
    dirty: true,
    primaryPath: "/repo",
    changeDirExists: true,
    changeDirPath: "/repo/.worktrees/add-dark-mode/openspec/changes/add-dark-mode",
    matchedBy: "path",
    submodules: [],
    ...over,
  };
}

function mockDeps(over: Partial<ShipDeps> = {}): ShipDeps {
  return {
    locate: () => baseWhere(),
    isDirty: () => true,
    probe: () => [],
    resolveBase: () => "origin/main",
    revParse: () => "deadbeef",
    stageAllAndCommit: () => "commitsha1",
    getRemotePushUrl: () => "git@github.com:org/repo.git",
    branchAheadOfRemote: () => true,
    pushBranch: () => {},
    getPrBackend: () => ({
      id: "gh",
      preflightRepository: () => ({ repository: "org/repo" }),
      createOrReusePullRequest: () => ({
        url: "https://github.com/org/repo/pull/1",
        number: 1,
        alreadyExisted: false,
      }),
    }),
    ...over,
  };
}

describe("defaultShipMessage", () => {
  it("uses ship(<change>): worktree", () => {
    expect(defaultShipMessage("ops-ship")).toBe("ship(ops-ship): worktree");
  });
});

describe("toBaseBranchName", () => {
  it("strips remote prefixes", () => {
    expect(toBaseBranchName("origin/main")).toBe("main");
    expect(toBaseBranchName("refs/remotes/origin/main")).toBe("main");
    expect(toBaseBranchName("main")).toBe("main");
  });
});

describe("runShip", () => {
  it("commits all, pushes, opens PR when dirty", () => {
    const stage = vi.fn(() => "sha1");
    const push = vi.fn();
    const result = runShip(
      {
        change: "add-dark-mode",
        json: true,
        draft: false,
        remote: "origin",
        backend: "gh",
      },
      mockDeps({
        stageAllAndCommit: stage,
        pushBranch: push,
      }),
    );
    expect(stage).toHaveBeenCalledWith(
      "/repo/.worktrees/add-dark-mode",
      "ship(add-dark-mode): worktree",
    );
    expect(push).toHaveBeenCalledWith(
      "/repo/.worktrees/add-dark-mode",
      "origin",
      "add-dark-mode",
    );
    expect(result.action).toBe("shipped");
    expect(result.commit?.created).toBe(true);
    expect(result.pr?.url).toContain("/pull/1");
    expect(result.base).toBe("main");
  });

  it("uses custom message", () => {
    const stage = vi.fn(() => "sha1");
    runShip(
      {
        change: "add-dark-mode",
        json: true,
        draft: false,
        remote: "origin",
        backend: "gh",
        message: "feat: dark mode",
      },
      mockDeps({ stageAllAndCommit: stage }),
    );
    expect(stage).toHaveBeenCalledWith(
      "/repo/.worktrees/add-dark-mode",
      "feat: dark mode",
    );
  });

  it("skips commit when clean but still pushes when ahead", () => {
    const stage = vi.fn(() => "sha1");
    const push = vi.fn();
    const result = runShip(
      {
        change: "add-dark-mode",
        json: true,
        draft: false,
        remote: "origin",
        backend: "gh",
      },
      mockDeps({
        isDirty: () => false,
        stageAllAndCommit: stage,
        branchAheadOfRemote: () => true,
        pushBranch: push,
      }),
    );
    expect(stage).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalled();
    expect(result.action).toBe("pushed");
    expect(result.commit?.created).toBe(false);
  });

  it("returns pr_exists when clean, not ahead, existing PR", () => {
    const push = vi.fn();
    const result = runShip(
      {
        change: "add-dark-mode",
        json: true,
        draft: false,
        remote: "origin",
        backend: "gh",
      },
      mockDeps({
        isDirty: () => false,
        branchAheadOfRemote: () => false,
        pushBranch: push,
        getPrBackend: () => ({
          id: "gh",
          preflightRepository: () => ({ repository: "org/repo" }),
          createOrReusePullRequest: () => ({
            url: "https://github.com/org/repo/pull/9",
            number: 9,
            alreadyExisted: true,
          }),
        }),
      }),
    );
    expect(push).not.toHaveBeenCalled();
    expect(result.action).toBe("pr_exists");
    expect(result.pr?.alreadyExisted).toBe(true);
  });

  it("aborts on detached dirty submodule without commit", () => {
    const stage = vi.fn(() => "sha1");
    expect(() =>
      runShip(
        {
          change: "add-dark-mode",
          json: true,
          draft: false,
          remote: "origin",
          backend: "gh",
        },
        mockDeps({
          probe: () => [
            {
              path: "aos-core",
              detached: true,
              dirty: true,
              branch: null,
              head: "x",
            },
          ],
          stageAllAndCommit: stage,
        }),
      ),
    ).toThrow(CliError);
    try {
      runShip(
        {
          change: "add-dark-mode",
          json: true,
          draft: false,
          remote: "origin",
          backend: "gh",
        },
        mockDeps({
          probe: () => [
            {
              path: "aos-core",
              detached: true,
              dirty: true,
              branch: null,
              head: "x",
            },
          ],
          stageAllAndCommit: stage,
        }),
      );
    } catch (e) {
      expect(e).toBeInstanceOf(CliError);
      expect((e as CliError).code).toBe("submodule_detached_dirty");
    }
    expect(stage).not.toHaveBeenCalled();
  });

  it("warns and continues on clean detached submodule", () => {
    const result = runShip(
      {
        change: "add-dark-mode",
        json: true,
        draft: false,
        remote: "origin",
        backend: "gh",
      },
      mockDeps({
        probe: () => [
          {
            path: "aos-core",
            detached: true,
            dirty: false,
            branch: null,
            head: "x",
          },
        ],
      }),
    );
    expect(result.warnings.some((w) => w.code === "submodule_detached")).toBe(true);
    expect(result.pr?.number).toBe(1);
  });

  it("marks pushOk on pr_failed after push", () => {
    try {
      runShip(
        {
          change: "add-dark-mode",
          json: true,
          draft: false,
          remote: "origin",
          backend: "gh",
        },
        mockDeps({
          getPrBackend: () => ({
            id: "gh",
            preflightRepository: () => ({ repository: "org/repo" }),
            createOrReusePullRequest: () => {
              throw new CliError("pr_failed", "auth", { backend: "gh" });
            },
          }),
        }),
      );
      expect.fail("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(CliError);
      expect((e as CliError).code).toBe("pr_failed");
      expect((e as CliError).details).toMatchObject({
        commitCreated: true,
        commitSha: "commitsha1",
        pushAttempted: true,
        pushOk: true,
      });
    }
  });

  it("does not pass force in default push dep (contract via mock call args)", () => {
    const push = vi.fn();
    runShip(
      {
        change: "add-dark-mode",
        json: true,
        draft: false,
        remote: "origin",
        backend: "gh",
      },
      mockDeps({ pushBranch: push }),
    );
    expect(push.mock.calls[0]).toEqual([
      "/repo/.worktrees/add-dark-mode",
      "origin",
      "add-dark-mode",
    ]);
  });

  it("propagates not_found from locate", () => {
    expect(() =>
      runShip(
        {
          change: "missing",
          json: true,
          draft: false,
          remote: "origin",
          backend: "gh",
        },
        mockDeps({
          locate: () => {
            throw new CliError("not_found", "No worktree", { change: "missing" });
          },
        }),
      ),
    ).toThrow(CliError);
  });

  it("maps clean+synced+empty-range pr_failed to nothing_to_ship", () => {
    try {
      runShip(
        {
          change: "add-dark-mode",
          json: true,
          draft: false,
          remote: "origin",
          backend: "gh",
        },
        mockDeps({
          isDirty: () => false,
          branchAheadOfRemote: () => false,
          getPrBackend: () => ({
            id: "gh",
            preflightRepository: () => ({ repository: "org/repo" }),
            createOrReusePullRequest: () => {
              throw new CliError(
                "pr_failed",
                "no commits between add-dark-mode and main",
                { backend: "gh" },
              );
            },
          }),
        }),
      );
      expect.fail("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(CliError);
      expect((e as CliError).code).toBe("nothing_to_ship");
    }
  });
});

describe("ship remote preflight", () => {
  it("detects a real local repository with no remote before creating a commit", () => {
    const dir = mkdtempSync(join(tmpdir(), "ops-ship-no-remote-"));
    try {
      execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
      execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: dir });
      execFileSync("git", ["config", "user.name", "Test"], { cwd: dir });
      writeFileSync(join(dir, "tracked.txt"), "base\n");
      execFileSync("git", ["add", "."], { cwd: dir });
      execFileSync("git", ["commit", "-qm", "base"], { cwd: dir });
      const before = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: dir,
        encoding: "utf8",
      }).trim();
      writeFileSync(join(dir, "tracked.txt"), "dirty\n");
      const stage = vi.fn(() => "new-sha");

      try {
        runShip(
          {
            change: "add-dark-mode",
            json: true,
            draft: false,
            remote: "origin",
            backend: "gh",
          },
          mockDeps({
            locate: () => baseWhere({ path: dir, primaryPath: dir }),
            getRemotePushUrl: resolveRemotePushUrl,
            stageAllAndCommit: stage,
          }),
        );
        expect.fail("should throw");
      } catch (error) {
        expect(error).toBeInstanceOf(CliError);
        expect((error as CliError).code).toBe("remote_not_configured");
        expect((error as CliError).details).toMatchObject({
          remote: "origin",
          commitCreated: false,
          commitSha: null,
          pushAttempted: false,
          pushOk: false,
        });
      }

      expect(stage).not.toHaveBeenCalled();
      const after = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: dir,
        encoding: "utf8",
      }).trim();
      expect(after).toBe(before);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("resolves an explicit pushurl instead of the fetch URL", () => {
    const dir = mkdtempSync(join(tmpdir(), "ops-ship-pushurl-"));
    try {
      execFileSync("git", ["init", "-q"], { cwd: dir });
      execFileSync("git", ["remote", "add", "origin", "https://github.com/fetch/repo.git"], { cwd: dir });
      execFileSync("git", ["config", "remote.origin.pushurl", "git@github.com:push/repo.git"], { cwd: dir });
      expect(resolveRemotePushUrl(dir, "origin")).toBe(
        "git@github.com:push/repo.git",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("stops on backend repository preflight before commit", () => {
    const stage = vi.fn(() => "sha1");
    expect(() =>
      runShip(
        {
          change: "add-dark-mode",
          json: true,
          draft: false,
          remote: "origin",
          backend: "gh",
        },
        mockDeps({
          stageAllAndCommit: stage,
          getPrBackend: () => ({
            id: "gh",
            preflightRepository: () => {
              throw new CliError(
                "github_repository_not_found",
                "missing",
                { repository: "org/missing" },
              );
            },
            createOrReusePullRequest: () => {
              throw new Error("must not create PR");
            },
          }),
        }),
      ),
    ).toThrowError(expect.objectContaining({ code: "github_repository_not_found" }));
    expect(stage).not.toHaveBeenCalled();
  });

  it.each([
    ["Authentication failed", "push_auth_failed"],
    ["! [rejected] feature -> feature (non-fast-forward)", "push_rejected"],
    ["Could not resolve host: github.com", "push_failed"],
  ] as const)("classifies push failure %s as %s with mutation facts", (message, code) => {
    try {
      runShip(
        {
          change: "add-dark-mode",
          json: true,
          draft: false,
          remote: "origin",
          backend: "gh",
        },
        mockDeps({
          stageAllAndCommit: () => "created-sha",
          pushBranch: () => {
            throw new CliError("git_failed", message);
          },
        }),
      );
      expect.fail("should throw");
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      expect((error as CliError).code).toBe(code);
      expect((error as CliError).details).toMatchObject({
        remote: "origin",
        branch: "add-dark-mode",
        commitCreated: true,
        commitSha: "created-sha",
        pushAttempted: true,
        pushOk: false,
      });
    }
  });

  it("classifies common push messages", () => {
    expect(classifyPushFailure("Permission denied (publickey)")).toBe(
      "push_auth_failed",
    );
    expect(
      classifyPushFailure("remote: Write access to repository not granted. error: 403"),
    ).toBe("push_auth_failed");
    expect(classifyPushFailure("pre-receive hook declined")).toBe(
      "push_rejected",
    );
    expect(classifyPushFailure("connection timed out")).toBe("push_failed");
  });
});

describe("isNothingToShipMessage", () => {
  it("detects empty compare phrasing", () => {
    expect(isNothingToShipMessage("no commits between A and B")).toBe(true);
    expect(isNothingToShipMessage("HTTP 401")).toBe(false);
  });
});
