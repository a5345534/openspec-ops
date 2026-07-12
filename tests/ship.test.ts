import { describe, expect, it, vi } from "vitest";
import {
  defaultShipMessage,
  isNothingToShipMessage,
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
    branchAheadOfRemote: () => true,
    pushBranch: () => {},
    getPrBackend: () => ({
      id: "gh",
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
      expect((e as CliError).details.pushOk).toBe(true);
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

describe("isNothingToShipMessage", () => {
  it("detects empty compare phrasing", () => {
    expect(isNothingToShipMessage("no commits between A and B")).toBe(true);
    expect(isNothingToShipMessage("HTTP 401")).toBe(false);
  });
});
