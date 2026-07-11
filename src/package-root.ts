import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Walk upward from startDir to find the openspec-ops package root
 * (directory with package.json name openspec-ops and bin/openspec-ops).
 *
 * Works for both:
 * - project layout: .pi/extensions/*.ts → ../..
 * - package layout: same tree under ~/.pi/agent/git/... after pi install
 */
export function resolvePackageRoot(startDir: string): string {
  let dir = startDir;
  for (;;) {
    const pkgJson = join(dir, "package.json");
    const bin = join(dir, "bin", "openspec-ops");
    if (existsSync(pkgJson) && existsSync(bin)) {
      try {
        const raw = readFileSync(pkgJson, "utf8");
        const name = (JSON.parse(raw) as { name?: string }).name;
        if (name === "openspec-ops" || name?.endsWith("/openspec-ops")) {
          return dir;
        }
      } catch {
        // fall through — still accept bin+package.json if parse fails
        return dir;
      }
      // package.json exists with different name but bin present: still accept
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Legacy fallback: extension under .pi/extensions
  return join(startDir, "..", "..");
}
