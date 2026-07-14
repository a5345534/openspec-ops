import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  resolveOpsBin,
  resolveOpsBinDetailed,
  runOps,
} from "../src/ops-runtime/run-ops.js";
import { buildDeliverFollowup } from "../src/ops-runtime/deliver-handoff.js";
import { formatOpsRuntimeBinding } from "../src/ops-runtime/runtime-binding.js";

function executable(path: string): string {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, "#!/bin/sh\nprintf '%s\\n' '{\"schemaVersion\":1,\"ok\":true}'\n");
  chmodSync(path, 0o755);
  return path;
}

function packageBin(root: string): string {
  return executable(join(root, "bin", "openspec-ops"));
}

describe("package-affine openspec-ops runtime resolution", () => {
  it("keeps a valid explicit override authoritative", () => {
    const root = mkdtempSync(join(tmpdir(), "ops-runtime-"));
    try {
      const explicit = executable(join(root, "explicit ops"));
      packageBin(join(root, "package"));
      const result = resolveOpsBinDetailed({
        envBin: explicit,
        projectRoot: join(root, "package"),
        pathLookup: () => executable(join(root, "path-ops")),
        moduleFallback: false,
      });
      expect(result).toMatchObject({ ok: true, source: "explicit", path: explicit });
      expect(resolveOpsBin({ envBin: explicit, moduleFallback: false })).toBe(explicit);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails closed for an invalid explicit override", () => {
    const root = mkdtempSync(join(tmpdir(), "ops-runtime-"));
    try {
      const result = resolveOpsBinDetailed({
        envBin: join(root, "missing-explicit"),
        projectRoot: root,
        pathLookup: () => packageBin(root),
        moduleFallback: false,
      });
      expect(result).toMatchObject({ ok: false, code: "explicit_invalid" });
      expect(resolveOpsBin({
        envBin: join(root, "missing-explicit"),
        projectRoot: root,
        moduleFallback: false,
      })).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("prefers a loaded package bin over PATH and supports spaces", () => {
    const root = mkdtempSync(join(tmpdir(), "ops runtime spaces "));
    try {
      const pkg = join(root, "package clone with spaces");
      const packagePath = packageBin(pkg);
      const pathPath = executable(join(root, "global", "openspec-ops"));
      const result = resolveOpsBinDetailed({
        envBin: undefined,
        projectRoot: pkg,
        pathLookup: () => pathPath,
        moduleFallback: false,
      });
      expect(result).toMatchObject({
        ok: true,
        source: "package",
        path: packagePath,
      });
      if (!result.ok) throw new Error("expected resolved runtime");
      const binding = formatOpsRuntimeBinding(result);
      expect(binding).toContain(JSON.stringify(packagePath));
      expect(binding).toContain("source=package");
      const followup = buildDeliverFollowup({
        change: "demo-change",
        objective: "test objective",
        runtime: result,
      });
      expect(followup).toContain("REQUIRED: change name is `demo-change`");
      expect(followup).toContain(binding);
      expect(followup).toContain("Optional objective: test objective");
      expect(runOps(result.path, ["where", "demo-change"]).code).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects non-executable package bins and may use a valid PATH fallback", () => {
    const root = mkdtempSync(join(tmpdir(), "ops-runtime-"));
    try {
      const pkgPath = join(root, "pkg", "bin", "openspec-ops");
      mkdirSync(join(root, "pkg", "bin"), { recursive: true });
      writeFileSync(pkgPath, "not executable\n");
      chmodSync(pkgPath, 0o644);
      const fallback = executable(join(root, "global", "openspec-ops"));
      expect(resolveOpsBinDetailed({
        envBin: undefined,
        projectRoot: join(root, "pkg"),
        pathLookup: () => fallback,
        moduleFallback: false,
      })).toMatchObject({ ok: true, source: "path", path: fallback });

      const missing = resolveOpsBinDetailed({
        envBin: undefined,
        projectRoot: join(root, "pkg"),
        pathLookup: () => undefined,
        moduleFallback: false,
      });
      expect(missing).toMatchObject({ ok: false, code: "not_found" });
      if (missing.ok) throw new Error("expected unresolved runtime");
      expect(missing.candidates).toContainEqual({
        source: "package",
        path: pkgPath,
        reason: "not_executable",
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("uses PATH without package context and supports module fallback", () => {
    const root = mkdtempSync(join(tmpdir(), "ops-runtime-"));
    try {
      const fallback = executable(join(root, "path", "openspec-ops"));
      expect(resolveOpsBinDetailed({
        envBin: undefined,
        pathLookup: () => fallback,
        moduleFallback: false,
      })).toMatchObject({ ok: true, source: "path", path: fallback });

      expect(resolveOpsBinDetailed({
        envBin: undefined,
        pathLookup: () => undefined,
      })).toMatchObject({ ok: true, source: "module" });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("runs a git-style package clone with spaces, no dist, and bundled tsx", () => {
    const root = mkdtempSync(join(tmpdir(), "ops package clone spaces "));
    try {
      cpSync(resolve(process.cwd(), "bin"), join(root, "bin"), { recursive: true });
      cpSync(resolve(process.cwd(), "src"), join(root, "src"), { recursive: true });
      writeFileSync(
        join(root, "package.json"),
        JSON.stringify({ name: "openspec-ops", type: "module" }),
      );
      mkdirSync(join(root, "node_modules"), { recursive: true });
      symlinkSync(
        realpathSync(resolve(process.cwd(), "node_modules/tsx")),
        join(root, "node_modules/tsx"),
        "dir",
      );
      const bin = join(root, "bin", "openspec-ops");
      chmodSync(bin, 0o755);
      expect(resolveOpsBinDetailed({
        envBin: undefined,
        projectRoot: root,
        pathLookup: () => undefined,
        moduleFallback: false,
      })).toMatchObject({ ok: true, source: "package", path: bin });
      const result = spawnSync(bin, ["--help"], {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, OPENSPEC_OPS_BIN: "" },
      });
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain("openspec-ops");
      expect(existsSync(join(root, "dist"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("returns a clear spawn error if a bound executable disappears", () => {
    const root = mkdtempSync(join(tmpdir(), "ops-runtime-"));
    const path = executable(join(root, "openspec-ops"));
    rmSync(path);
    const result = runOps(path, ["where", "demo-change"]);
    expect(result.code).toBe(10);
    expect(result.stderr).toContain("Failed to execute openspec-ops");
    rmSync(root, { recursive: true, force: true });
  });
});
