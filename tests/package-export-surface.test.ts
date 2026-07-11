import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type PackageJson = {
  bin?: Record<string, string>;
  pi?: {
    skills?: string[];
    prompts?: string[];
    extensions?: string[];
  };
  files?: string[];
};

function loadPkg(): PackageJson {
  const p = resolve(process.cwd(), "package.json");
  return JSON.parse(readFileSync(p, "utf8")) as PackageJson;
}

describe("package ops-only Pi surface", () => {
  it("package.json pi export is ops-allowlisted", () => {
    const pkg = loadPkg();
    expect(pkg.bin?.openspec).toBeUndefined();

    const skills = pkg.pi?.skills ?? [];
    const prompts = pkg.pi?.prompts ?? [];

    expect(skills.length).toBeGreaterThan(0);
    expect(prompts.length).toBeGreaterThan(0);

    for (const g of skills) {
      expect(g.includes("openspec")).toBe(false);
      expect(g.includes("ops-")).toBe(true);
    }
    for (const g of prompts) {
      expect(g.includes("opsx")).toBe(false);
      expect(g.includes("ops-")).toBe(true);
    }

    // Forbidden broad globs
    expect(skills).not.toContain(".pi/skills/**/SKILL.md");
    expect(prompts).not.toContain(".pi/prompts/**/*.md");
  });

  it("files list does not publish entire .pi tree", () => {
    const pkg = loadPkg();
    const files = pkg.files ?? [];
    expect(files.includes(".pi")).toBe(false);
  });
});
