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
  it("always off (ensure-on-intercept removed)", () => {
    expect(parseInterceptNewChangePolicy(undefined)).toBe("off");
    expect(parseInterceptNewChangePolicy("")).toBe("off");
    expect(parseInterceptNewChangePolicy("off")).toBe("off");
    expect(parseInterceptNewChangePolicy("on")).toBe("off");
    expect(parseInterceptNewChangePolicy("ask")).toBe("off");
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
  it("forwards new change without ensure (ensure removed)", () => {
    const spawn = vi.fn().mockReturnValue({ status: 0 });
    const res = runOpenspecIntercept({
      argv: ["new", "change", "add-x"],
      selfPath: "/shim/openspec-ops-intercept",
      env: {
        PATH: "/usr/bin",
        OPENSPEC_OPS_INTERCEPT_NEW_CHANGE: "on",
        OPENSPEC_REAL_BIN: "/usr/bin/true",
      },
      resolveReal: () => "/usr/bin/true",
      spawn,
      logErr: () => {},
    });
    expect(spawn).toHaveBeenCalled();
    expect(res.didEnsure).toBe(false);
    expect(res.exitCode).toBe(0);
  });

  it("INTERCEPT=on still does not ensure", () => {
    const spawn = vi.fn().mockReturnValue({ status: 0 });
    const res = runOpenspecIntercept({
      argv: ["new", "change", "add-x"],
      selfPath: "/shim/openspec-ops-intercept",
      cwd: process.cwd(),
      env: { OPENSPEC_OPS_INTERCEPT_NEW_CHANGE: "on" },
      resolveReal: () => "/usr/bin/true",
      spawn,
      logErr: () => {},
    });
    expect(res.didEnsure).toBe(false);
    expect(spawn).toHaveBeenCalled();
    expect(res.exitCode).toBe(0);
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
