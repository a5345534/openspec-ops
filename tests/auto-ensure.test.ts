import { describe, expect, it } from "vitest";
import {
  ensureWorkspace,
  isProposeIntent,
  parseAutoStartPolicy,
  parseProposeChangeName,
  type RunOpsResult,
} from "../src/auto-ensure/index.js";

describe("parseAutoStartPolicy", () => {
  it("defaults to on", () => {
    expect(parseAutoStartPolicy(undefined)).toBe("on");
    expect(parseAutoStartPolicy("")).toBe("on");
    expect(parseAutoStartPolicy("  ")).toBe("on");
  });

  it("accepts on|ask|off case-insensitively", () => {
    expect(parseAutoStartPolicy("ON")).toBe("on");
    expect(parseAutoStartPolicy("Ask")).toBe("ask");
    expect(parseAutoStartPolicy("off")).toBe("off");
  });

  it("falls back to on for unknown values", () => {
    expect(parseAutoStartPolicy("maybe")).toBe("on");
  });
});

describe("propose intent and change name", () => {
  it("detects opsx-propose forms", () => {
    expect(isProposeIntent("/opsx-propose add-dark-mode")).toBe(true);
    expect(isProposeIntent("/opsx:propose add-dark-mode")).toBe(true);
    expect(isProposeIntent("  /opsx-propose foo")).toBe(true);
  });

  it("does not detect explore or prose", () => {
    expect(isProposeIntent("/opsx-explore")).toBe(false);
    expect(isProposeIntent("/opsx-apply")).toBe(false);
    expect(isProposeIntent("please propose add-dark-mode")).toBe(false);
  });

  it("parses kebab-case first arg", () => {
    expect(parseProposeChangeName("/opsx-propose add-dark-mode")).toBe("add-dark-mode");
    expect(parseProposeChangeName("/opsx-propose add-dark-mode more text")).toBe(
      "add-dark-mode",
    );
    expect(parseProposeChangeName("/opsx:propose foo-bar")).toBe("foo-bar");
  });

  it("returns null when name missing or invalid", () => {
    expect(parseProposeChangeName("/opsx-propose")).toBeNull();
    expect(parseProposeChangeName("/opsx-propose Add_Dark")).toBeNull();
    expect(parseProposeChangeName("/opsx-explore add-dark-mode")).toBeNull();
  });
});

describe("ensureWorkspace", () => {
  it("skips when policy off", async () => {
    const out = await ensureWorkspace("add-x", {
      bin: "openspec-ops",
      policy: "off",
      run: () => {
        throw new Error("should not run");
      },
    });
    expect(out).toEqual({ status: "skipped", reason: "policy_off" });
  });

  it("reuses when where succeeds", async () => {
    const out = await ensureWorkspace("add-x", {
      bin: "openspec-ops",
      policy: "on",
      run: (_b, args) => {
        if (args[0] === "where") {
          return {
            code: 0,
            stdout: "",
            stderr: "",
            json: {
              ok: true,
              result: { path: "/repo/.worktrees/add-x", branch: "add-x" },
            },
          } satisfies RunOpsResult;
        }
        throw new Error(`unexpected ${args.join(" ")}`);
      },
    });
    expect(out.status).toBe("ok");
    if (out.status === "ok") {
      expect(out.action).toBe("already_present");
      expect(out.path).toBe("/repo/.worktrees/add-x");
    }
  });

  it("starts when where not_found and policy on", async () => {
    const calls: string[] = [];
    const out = await ensureWorkspace("add-x", {
      bin: "openspec-ops",
      policy: "on",
      run: (_b, args) => {
        calls.push(args[0]!);
        if (args[0] === "where") {
          return {
            code: 5,
            stdout: "",
            stderr: "",
            json: { ok: false, error: { code: "not_found", message: "missing" } },
          };
        }
        if (args[0] === "start") {
          return {
            code: 0,
            stdout: "",
            stderr: "",
            json: {
              ok: true,
              result: {
                action: "created",
                path: "/repo/.worktrees/add-x",
                branch: "add-x",
              },
            },
          };
        }
        throw new Error("bad");
      },
    });
    expect(calls).toEqual(["where", "start"]);
    expect(out.status).toBe("ok");
    if (out.status === "ok") {
      expect(out.action).toBe("created");
    }
  });

  it("ask declines without start", async () => {
    const calls: string[] = [];
    const out = await ensureWorkspace("add-x", {
      bin: "openspec-ops",
      policy: "ask",
      confirmCreate: () => false,
      run: (_b, args) => {
        calls.push(args[0]!);
        return {
          code: 5,
          stdout: "",
          stderr: "",
          json: { ok: false, error: { code: "not_found" } },
        };
      },
    });
    expect(calls).toEqual(["where"]);
    expect(out).toEqual({ status: "skipped", reason: "user_declined" });
  });

  it("surfaces start conflict errors", async () => {
    const out = await ensureWorkspace("add-x", {
      bin: "openspec-ops",
      policy: "on",
      run: (_b, args) => {
        if (args[0] === "where") {
          return {
            code: 5,
            stdout: "",
            stderr: "",
            json: { ok: false, error: { code: "not_found" } },
          };
        }
        return {
          code: 3,
          stdout: "",
          stderr: "",
          json: {
            ok: false,
            error: { code: "branch_busy", message: "checked out elsewhere" },
          },
        };
      },
    });
    expect(out.status).toBe("error");
    if (out.status === "error") {
      expect(out.code).toBe("branch_busy");
    }
  });
});
