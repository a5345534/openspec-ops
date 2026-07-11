import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolvePackageRoot } from "../src/package-root.js";

describe("resolvePackageRoot", () => {
  it("finds package root from nested .pi/extensions", () => {
    const root = mkdtempSync(join(tmpdir(), "ops-pkg-"));
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({ name: "openspec-ops" }),
    );
    mkdirSync(join(root, "bin"), { recursive: true });
    writeFileSync(join(root, "bin", "openspec-ops"), "#!/usr/bin/env node\n");
    const extDir = join(root, ".pi", "extensions");
    mkdirSync(extDir, { recursive: true });
    expect(resolvePackageRoot(extDir)).toBe(root);
  });
});
