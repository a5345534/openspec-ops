import type { OpsBinResolution } from "./run-ops.js";

export type ResolvedOpsBin = Extract<OpsBinResolution, { ok: true }>;

export function formatOpsRuntimeBinding(runtime: ResolvedOpsBin): string {
  return [
    `REQUIRED: openspec-ops binary is ${JSON.stringify(runtime.path)} (source=${runtime.source}).`,
    "Use this exact executable (or the inherited OPENSPEC_OPS_BIN) for lifecycle CLI actions; quote it as one command path.",
  ].join("\n");
}
