import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { resolveOpsBin, runOps } from "../auto-ensure/run-ops.js";
import { resolvePackageRoot } from "../package-root.js";
import { parseOpenspecArgv } from "./parse-argv.js";
import { parseInterceptNewChangePolicy } from "./policy.js";
import { resolveRealOpenspec } from "./resolve-real-openspec.js";

export type InterceptDeps = {
  argv: string[];
  selfPath: string;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  /** inject for tests */
  resolveReal?: typeof resolveRealOpenspec;
  resolveOps?: typeof resolveOpsBin;
  runOpsJson?: typeof runOps;
  spawn?: typeof spawnSync;
  logErr?: (msg: string) => void;
};

export type InterceptResult = {
  exitCode: number;
  /** for tests */
  didEnsure?: boolean;
  ensurePath?: string;
  forwardedCwd?: string;
  realBin?: string | null;
};

/**
 * Main intercept entry: maybe ensure, then forward to real openspec.
 */
export function runOpenspecIntercept(deps: InterceptDeps): InterceptResult {
  const env = deps.env ?? process.env;
  const logErr = deps.logErr ?? ((m) => console.error(m));
  const resolveReal = deps.resolveReal ?? resolveRealOpenspec;
  const resolveOps = deps.resolveOps ?? resolveOpsBin;
  const runOpsJson = deps.runOpsJson ?? runOps;
  const spawn = deps.spawn ?? spawnSync;

  const realBin = resolveReal({
    selfPath: deps.selfPath,
    envRealBin: env.OPENSPEC_REAL_BIN,
    pathEnv: env.PATH,
  });

  if (!realBin) {
    logErr(
      "openspec-ops-intercept: could not resolve real OpenSpec binary. Set OPENSPEC_REAL_BIN or install @fission-ai/openspec.",
    );
    return { exitCode: 10, realBin: null };
  }

  const parsed = parseOpenspecArgv(deps.argv);
  const policy = parseInterceptNewChangePolicy(env.OPENSPEC_OPS_INTERCEPT_NEW_CHANGE);

  let childCwd = deps.cwd ?? process.cwd();
  let didEnsure = false;
  let ensurePath: string | undefined;

  if (parsed.kind === "new_change" && policy === "on") {
    const packageRoot = resolvePackageRoot(dirname(deps.selfPath));
    const opsBin = resolveOps({
      envBin: env.OPENSPEC_OPS_BIN,
      projectRoot: packageRoot,
    });
    if (!opsBin) {
      logErr(
        "openspec-ops-intercept: openspec-ops CLI not found (OPENSPEC_OPS_BIN / PATH / package bin). Refusing new change under INTERCEPT=on.",
      );
      return { exitCode: 10, realBin, didEnsure: false };
    }

    const startRes = runOpsJson(opsBin, ["start", parsed.name], {
      cwd: deps.cwd ?? process.cwd(),
    });
    if (startRes.code !== 0 || startRes.json?.ok === false) {
      const code = startRes.json?.error?.code ?? `exit_${startRes.code}`;
      const msg =
        startRes.json?.error?.message ??
        (startRes.stderr || startRes.stdout || "start failed");
      logErr(
        `openspec-ops-intercept: openspec-ops start failed (${code}): ${msg}. new change aborted (OPENSPEC_OPS_INTERCEPT_NEW_CHANGE=on).`,
      );
      return { exitCode: startRes.code === 0 ? 10 : startRes.code, realBin, didEnsure: false };
    }

    didEnsure = true;
    const path = String(startRes.json?.result?.path ?? "");
    if (path && existsSync(path)) {
      ensurePath = path;
      childCwd = path;
      logErr(
        `openspec-ops-intercept: worktree ready @ ${path} (cd here for subsequent openspec writes).`,
      );
    }
  }

  // Forward all cases (including invalid name / passthrough / after ensure)
  const nodeRunner = realBin.endsWith(".js") ? process.execPath : null;
  const result = nodeRunner
    ? spawn(nodeRunner, [realBin, ...deps.argv], {
        cwd: childCwd,
        env: { ...env },
        stdio: "inherit",
      })
    : spawn(realBin, deps.argv, {
        cwd: childCwd,
        env: { ...env },
        stdio: "inherit",
      });

  const exitCode = result.status ?? (result.error ? 10 : 0);
  return {
    exitCode,
    didEnsure,
    ensurePath,
    forwardedCwd: childCwd,
    realBin,
  };
}

/** CLI bootstrap path for bin/openspec-ops-intercept */
export function interceptMain(argv = process.argv): number {
  const selfPath = fileURLToPath(import.meta.url);
  // When run via dist/intercept/cli.js or bin wrapper, self is bin path better as argv[1]
  const binSelf = argv[1] && existsSync(argv[1]) ? resolve(argv[1]) : selfPath;
  const res = runOpenspecIntercept({
    argv: argv.slice(2),
    selfPath: binSelf,
  });
  return res.exitCode;
}
