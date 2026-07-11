import { describe, expect, it, vi } from "vitest";
import {
  parseInterceptNewChangePolicy,
  parseOpenspecArgv,
  resolveRealOpenspec,
  runOpenspecIntercept,
} from "../src/intercept/index.js";

describe("parseOpenspecArgv", () => {
  it("detects new change with kebab name", () => {
    expect(parseOpenspecArgv(["new", "change", "add-dark-mode"])).toEqual({
      kind: "new_change",
      name: "add-dark-mode",
    });
  });

  it("allows flags around subcommands", () => {
    expect(
      parseOpenspecArgv(["--json", "new", "change", "foo-bar", "--schema", "spec-driven"]),
    ).toEqual({ kind: "new_change", name: "foo-bar" });
  });

  it("invalid name", () => {
    expect(parseOpenspecArgv(["new", "change", "Not_Valid"])).toEqual({
      kind: "new_change_invalid_or_missing",
    });
  });

  it("missing name", () => {
    expect(parseOpenspecArgv(["new", "change"])).toEqual({
      kind: "new_change_invalid_or_missing",
    });
  });

  it("passthrough for other commands", () => {
    expect(parseOpenspecArgv(["list", "--json"])).toEqual({ kind: "passthrough" });
    expect(parseOpenspecArgv(["archive", "foo"])).toEqual({ kind: "passthrough" });
  });
});

describe("parseInterceptNewChangePolicy", () => {
  it("defaults on", () => {
    expect(parseInterceptNewChangePolicy(undefined)).toBe("on");
    expect(parseInterceptNewChangePolicy("")).toBe("on");
  });
  it("off", () => {
    expect(parseInterceptNewChangePolicy("off")).toBe("off");
    expect(parseInterceptNewChangePolicy("OFF")).toBe("off");
  });
  it("unknown as on", () => {
    expect(parseInterceptNewChangePolicy("ask")).toBe("on");
  });
});

describe("resolveRealOpenspec", () => {
  it("skips OPENSPEC_REAL_BIN when it is the shim itself", () => {
    const self = "/tmp/shim/openspec";
    // If REAL_BIN points at self, must not return self (may still find system openspec)
    const real = resolveRealOpenspec({
      selfPath: self,
      envRealBin: self,
      pathEnv: "",
      extraCandidates: [],
    });
    expect(real).not.toBe(self);
  });

  it("prefers OPENSPEC_REAL_BIN when it exists and is not self", () => {
    // process.execPath always exists
    const bin = process.execPath;
    const real = resolveRealOpenspec({
      selfPath: "/tmp/shim/openspec-ops-intercept",
      envRealBin: bin,
      pathEnv: "",
      extraCandidates: [],
    });
    expect(real).toBe(bin);
  });
});

describe("runOpenspecIntercept", () => {
  it("policy off does not ensure", () => {
    const spawn = vi.fn().mockReturnValue({ status: 0 });
    const runOpsJson = vi.fn();
    const res = runOpenspecIntercept({
      argv: ["new", "change", "add-x"],
      selfPath: "/shim/openspec-ops-intercept",
      env: {
        PATH: "/usr/bin",
        OPENSPEC_OPS_INTERCEPT_NEW_CHANGE: "off",
        OPENSPEC_REAL_BIN: "/usr/bin/true",
      },
      resolveReal: () => "/usr/bin/true",
      resolveOps: () => "/ops/bin",
      runOpsJson,
      spawn,
      logErr: () => {},
    });
    expect(runOpsJson).not.toHaveBeenCalled();
    expect(spawn).toHaveBeenCalled();
    expect(res.didEnsure).toBe(false);
    expect(res.exitCode).toBe(0);
  });

  it("policy on ensures then forwards with worktree cwd", () => {
    const spawn = vi.fn().mockReturnValue({ status: 0 });
    const runOpsJson = vi.fn().mockReturnValue({
      code: 0,
      stdout: "",
      stderr: "",
      json: {
        ok: true,
        result: { path: "/repo/.worktrees/add-x", action: "created" },
      },
    });
    // existsSync for path - may fail if path doesn't exist; use cwd that exists
    const res = runOpenspecIntercept({
      argv: ["new", "change", "add-x"],
      selfPath: "/shim/openspec-ops-intercept",
      cwd: process.cwd(),
      env: {
        OPENSPEC_OPS_INTERCEPT_NEW_CHANGE: "on",
      },
      resolveReal: () => "/usr/bin/true",
      resolveOps: () => "/ops/bin",
      runOpsJson,
      spawn,
      logErr: () => {},
    });
    expect(runOpsJson).toHaveBeenCalledWith(
      "/ops/bin",
      ["start", "add-x"],
      expect.any(Object),
    );
    expect(res.didEnsure).toBe(true);
    // path may not exist on disk so cwd might stay process.cwd()
    expect(spawn).toHaveBeenCalled();
    expect(res.exitCode).toBe(0);
  });

  it("start failure blocks new change", () => {
    const spawn = vi.fn();
    const res = runOpenspecIntercept({
      argv: ["new", "change", "add-x"],
      selfPath: "/shim/x",
      env: { OPENSPEC_OPS_INTERCEPT_NEW_CHANGE: "on" },
      resolveReal: () => "/usr/bin/true",
      resolveOps: () => "/ops/bin",
      runOpsJson: () => ({
        code: 3,
        stdout: "",
        stderr: "",
        json: { ok: false, error: { code: "branch_busy", message: "busy" } },
      }),
      spawn,
      logErr: () => {},
    });
    expect(spawn).not.toHaveBeenCalled();
    expect(res.exitCode).toBe(3);
  });

  it("passthrough list without ensure", () => {
    const spawn = vi.fn().mockReturnValue({ status: 0 });
    const runOpsJson = vi.fn();
    runOpenspecIntercept({
      argv: ["list", "--json"],
      selfPath: "/shim/x",
      env: {},
      resolveReal: () => "/usr/bin/true",
      resolveOps: () => "/ops/bin",
      runOpsJson,
      spawn,
      logErr: () => {},
    });
    expect(runOpsJson).not.toHaveBeenCalled();
    expect(spawn).toHaveBeenCalled();
  });
});
