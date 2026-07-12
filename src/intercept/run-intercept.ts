import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { resolveRealOpenspec } from "./resolve-real-openspec.js";

export type InterceptDeps = {
  argv: string[];
  selfPath: string;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  resolveReal?: typeof resolveRealOpenspec;
  spawn?: typeof spawnSync;
  logErr?: (msg: string) => void;
};

export type InterceptResult = {
  exitCode: number;
  /** Always false — ensure-on-intercept removed */
  didEnsure?: boolean;
  ensurePath?: string;
  forwardedCwd?: string;
  realBin?: string | null;
};

/**
 * Forward-only intercept: resolve real openspec and spawn with same argv/cwd.
 * Does NOT run openspec-ops start.
 */
export function runOpenspecIntercept(deps: InterceptDeps): InterceptResult {
  const env = deps.env ?? process.env;
  const logErr = deps.logErr ?? ((m) => console.error(m));
  const resolveReal = deps.resolveReal ?? resolveRealOpenspec;
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
    return { exitCode: 10, realBin: null, didEnsure: false };
  }

  const childCwd = deps.cwd ?? process.cwd();
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
    didEnsure: false,
    forwardedCwd: childCwd,
    realBin,
  };
}

/** CLI bootstrap path for bin/openspec-ops-intercept */
export function interceptMain(argv = process.argv): number {
  const selfPath = fileURLToPath(import.meta.url);
  const binSelf = argv[1] && existsSync(argv[1]) ? resolve(argv[1]) : selfPath;
  const res = runOpenspecIntercept({
    argv: argv.slice(2),
    selfPath: binSelf,
  });
  return res.exitCode;
}
