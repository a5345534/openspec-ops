import { describe, expect, it } from "vitest";
import {
  decideOrphanGate,
  isArchiveIntent,
  parseArchiveChangeName,
  parseAutoFinishPolicy,
  parseWhereSnapshot,
} from "../src/auto-finish/index.js";
import { evaluateWatchedChange } from "../src/auto-finish/evaluate.js";
import type { RunOpsResult } from "../src/auto-ensure/run-ops.js";

describe("parseAutoFinishPolicy", () => {
  it("defaults to ask", () => {
    expect(parseAutoFinishPolicy(undefined)).toBe("ask");
    expect(parseAutoFinishPolicy("")).toBe("ask");
  });

  it("accepts ask|on|off case-insensitively", () => {
    expect(parseAutoFinishPolicy("ASK")).toBe("ask");
    expect(parseAutoFinishPolicy("On")).toBe("on");
    expect(parseAutoFinishPolicy("off")).toBe("off");
  });

  it("falls back to ask for unknown values", () => {
    expect(parseAutoFinishPolicy("maybe")).toBe("ask");
  });
});

describe("archive intent and change name", () => {
  it("detects opsx-archive forms", () => {
    expect(isArchiveIntent("/opsx-archive add-dark-mode")).toBe(true);
    expect(isArchiveIntent("/opsx:archive add-dark-mode")).toBe(true);
    expect(isArchiveIntent("  /opsx-archive foo")).toBe(true);
  });

  it("does not detect propose, finish, or prose", () => {
    expect(isArchiveIntent("/opsx-propose add-x")).toBe(false);
    expect(isArchiveIntent("/ops-finish add-x")).toBe(false);
    expect(isArchiveIntent("please archive add-dark-mode")).toBe(false);
  });

  it("parses kebab-case first arg", () => {
    expect(parseArchiveChangeName("/opsx-archive add-dark-mode")).toBe("add-dark-mode");
    expect(parseArchiveChangeName("/opsx-archive add-dark-mode extra")).toBe("add-dark-mode");
    expect(parseArchiveChangeName("/opsx:archive foo-bar")).toBe("foo-bar");
  });

  it("returns null when name missing or invalid", () => {
    expect(parseArchiveChangeName("/opsx-archive")).toBeNull();
    expect(parseArchiveChangeName("/opsx-archive Add_Dark")).toBeNull();
    expect(parseArchiveChangeName("/opsx-propose add-dark-mode")).toBeNull();
  });
});

describe("decideOrphanGate", () => {
  const orphanClean = {
    status: "found" as const,
    change: "add-x",
    path: "/repo/.worktrees/add-x",
    branch: "add-x",
    dirty: false,
    changeDirExists: false,
  };

  it("keeps watch when change still active", () => {
    const d = decideOrphanGate({
      where: { ...orphanClean, changeDirExists: true },
      policy: "ask",
      hasUI: true,
    });
    expect(d).toEqual({ action: "keep_watch" });
  });

  it("clears on not_found", () => {
    expect(
      decideOrphanGate({
        where: { status: "not_found" },
        policy: "on",
        hasUI: true,
      }),
    ).toEqual({ action: "clear_skip", reason: "not_found" });
  });

  it("notifies dirty clear when inactive and dirty", () => {
    expect(
      decideOrphanGate({
        where: { ...orphanClean, dirty: true },
        policy: "on",
        hasUI: true,
      }),
    ).toEqual({ action: "notify_dirty_clear" });
  });

  it("ask + UI → confirm_finish", () => {
    const d = decideOrphanGate({
      where: orphanClean,
      policy: "ask",
      hasUI: true,
    });
    expect(d.action).toBe("confirm_finish");
    if (d.action === "confirm_finish") {
      expect(d.path).toBe(orphanClean.path);
    }
  });

  it("ask without UI → no silent finish", () => {
    expect(
      decideOrphanGate({
        where: orphanClean,
        policy: "ask",
        hasUI: false,
      }),
    ).toEqual({ action: "clear_skip", reason: "ask_no_ui" });
  });

  it("on → finish_now without confirm", () => {
    const d = decideOrphanGate({
      where: orphanClean,
      policy: "on",
      hasUI: false,
    });
    expect(d.action).toBe("finish_now");
  });

  it("where error keeps watch via notify_where_error", () => {
    expect(
      decideOrphanGate({
        where: { status: "error", code: "git_failed", message: "boom" },
        policy: "ask",
        hasUI: true,
      }),
    ).toEqual({
      action: "notify_where_error",
      code: "git_failed",
      message: "boom",
    });
  });
});

describe("parseWhereSnapshot", () => {
  it("maps exit 5 to not_found", () => {
    expect(
      parseWhereSnapshot("add-x", {
        code: 5,
        json: { ok: false, error: { code: "not_found" } },
      }),
    ).toEqual({ status: "not_found" });
  });

  it("maps success result fields", () => {
    const s = parseWhereSnapshot("add-x", {
      code: 0,
      json: {
        ok: true,
        result: {
          change: "add-x",
          path: "/wt",
          branch: "add-x",
          dirty: false,
          changeDirExists: true,
        },
      },
    });
    expect(s).toEqual({
      status: "found",
      change: "add-x",
      path: "/wt",
      branch: "add-x",
      dirty: false,
      changeDirExists: true,
    });
  });
});

describe("evaluateWatchedChange", () => {
  it("policy on finishes clean orphan", async () => {
    const calls: string[] = [];
    const out = await evaluateWatchedChange("add-x", {
      bin: "openspec-ops",
      policy: "on",
      hasUI: true,
      run: (_b, args) => {
        calls.push(args[0]!);
        if (args[0] === "where") {
          return {
            code: 0,
            stdout: "",
            stderr: "",
            json: {
              ok: true,
              result: {
                change: "add-x",
                path: "/wt",
                branch: "add-x",
                dirty: false,
                changeDirExists: false,
              },
            },
          } satisfies RunOpsResult;
        }
        if (args[0] === "finish") {
          expect(args.includes("--force")).toBe(false);
          return {
            code: 0,
            stdout: "",
            stderr: "",
            json: {
              ok: true,
              result: { path: "/wt", branch: "add-x", forced: false },
            },
          };
        }
        throw new Error("unexpected");
      },
    });
    expect(calls).toEqual(["where", "finish"]);
    expect(out.kind).toBe("finished");
  });

  it("still active keeps watch without finish", async () => {
    const calls: string[] = [];
    const out = await evaluateWatchedChange("add-x", {
      bin: "openspec-ops",
      policy: "on",
      hasUI: true,
      run: (_b, args) => {
        calls.push(args[0]!);
        return {
          code: 0,
          stdout: "",
          stderr: "",
          json: {
            ok: true,
            result: {
              change: "add-x",
              path: "/wt",
              branch: "add-x",
              dirty: false,
              changeDirExists: true,
            },
          },
        };
      },
    });
    expect(calls).toEqual(["where"]);
    expect(out).toEqual({
      kind: "decision",
      change: "add-x",
      decision: { action: "keep_watch" },
    });
  });

  it("ask decline does not finish", async () => {
    const calls: string[] = [];
    const out = await evaluateWatchedChange("add-x", {
      bin: "openspec-ops",
      policy: "ask",
      hasUI: true,
      confirmFinish: () => false,
      run: (_b, args) => {
        calls.push(args[0]!);
        return {
          code: 0,
          stdout: "",
          stderr: "",
          json: {
            ok: true,
            result: {
              change: "add-x",
              path: "/wt",
              branch: "add-x",
              dirty: false,
              changeDirExists: false,
            },
          },
        };
      },
    });
    expect(calls).toEqual(["where"]);
    expect(out).toEqual({ kind: "declined", change: "add-x" });
  });
});
