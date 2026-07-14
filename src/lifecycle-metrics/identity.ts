import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { resolveRepoContext } from "../resolve.js";

export function hashWorkspaceRoot(primaryPath: string): string {
  return createHash("sha256")
    .update("openspec-ops-workspace\0")
    .update(primaryPath)
    .digest("hex");
}

/**
 * Return a machine-local, privacy-preserving identity for the primary Git
 * checkout. Linked worktrees resolve through the same primary path. Unknown
 * repository identity deliberately remains null.
 */
export function resolveWorkspaceId(cwd: string): string | null {
  try {
    const primaryPath = realpathSync(resolveRepoContext(undefined, cwd).primaryPath);
    return hashWorkspaceRoot(primaryPath);
  } catch {
    return null;
  }
}
