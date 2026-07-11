import { existsSync, realpathSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";

function safeRealpath(p: string): string | null {
  try {
    return realpathSync(p);
  } catch {
    return null;
  }
}

/**
 * Resolve the real OpenSpec CLI, never returning selfPath.
 */
export function resolveRealOpenspec(options: {
  selfPath: string;
  envRealBin?: string | undefined;
  pathEnv?: string | undefined;
  /** Extra candidate absolute paths (e.g. npm global) */
  extraCandidates?: string[];
}): string | null {
  const selfReal = safeRealpath(options.selfPath) ?? options.selfPath;
  const envBin = options.envRealBin ?? process.env.OPENSPEC_REAL_BIN;
  if (envBin && existsSync(envBin)) {
    const r = safeRealpath(envBin) ?? envBin;
    if (r !== selfReal) return envBin;
  }

  const pathEnv = options.pathEnv ?? process.env.PATH ?? "";
  for (const dir of pathEnv.split(delimiter)) {
    if (!dir) continue;
    for (const name of ["openspec", "openspec.js"]) {
      const cand = join(dir, name);
      if (!existsSync(cand)) continue;
      const r = safeRealpath(cand) ?? cand;
      if (r === selfReal) continue;
      // skip our intercept bin if named differently but same dir package
      if (cand.endsWith("openspec-ops-intercept")) continue;
      return cand;
    }
  }

  for (const cand of options.extraCandidates ?? []) {
    if (cand && existsSync(cand)) {
      const r = safeRealpath(cand) ?? cand;
      if (r !== selfReal) return cand;
    }
  }

  // Common npm global layout next to node
  try {
    const nodeDir = dirname(process.execPath);
    const guesses = [
      join(nodeDir, "openspec"),
      join(nodeDir, "../lib/node_modules/@fission-ai/openspec/bin/openspec.js"),
    ];
    for (const g of guesses) {
      if (existsSync(g)) {
        const r = safeRealpath(g) ?? g;
        if (r !== selfReal) return g;
      }
    }
  } catch {
    // ignore
  }

  return null;
}
