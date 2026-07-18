import { existsSync, readFileSync } from "node:fs";
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

  it("files list includes ops-next skill", () => {
    const pkg = loadPkg();
    const files = pkg.files ?? [];
    expect(files.some((f) => f.includes("ops-next"))).toBe(true);
    expect(files.some((f) => f.includes("ops-deliver"))).toBe(true);
  });

  it("files list includes ops-deliver skill but not deliver prompt", () => {
    const pkg = loadPkg();
    const files = pkg.files ?? [];
    expect(files.some((f) => f.includes("ops-deliver"))).toBe(true);
    // Slash /ops-deliver is extension-owned; no prompt template (avoids dual registration)
    expect(files).not.toContain(".pi/prompts/ops-deliver.md");
  });

  it("CLI-backed packaged docs accept the extension-bound runtime", () => {
    const files = [
      ".pi/skills/ops-start/SKILL.md",
      ".pi/skills/ops-where/SKILL.md",
      ".pi/skills/ops-finish/SKILL.md",
      ".pi/skills/ops-doctor/SKILL.md",
      ".pi/skills/ops-ship/SKILL.md",
      ".pi/skills/ops-prune/SKILL.md",
      ".pi/skills/ops-merge/SKILL.md",
      ".pi/skills/ops-spec-review/SKILL.md",
      ".pi/skills/ops-impl-review/SKILL.md",
      ".pi/skills/ops-deliver/SKILL.md",
      ".pi/prompts/ops-start.md",
      ".pi/prompts/ops-where.md",
      ".pi/prompts/ops-finish.md",
      ".pi/prompts/ops-doctor.md",
      ".pi/prompts/ops-ship.md",
      ".pi/prompts/ops-prune.md",
      ".pi/prompts/ops-merge.md",
      ".pi/prompts/ops-spec-review.md",
      ".pi/prompts/ops-impl-review.md",
    ];
    for (const file of files) {
      const body = readFileSync(resolve(process.cwd(), file), "utf8");
      expect(body.toLowerCase(), file).toContain("extension-bound");
      expect(body, file).toContain("OPENSPEC_OPS_BIN");
    }
  });

  it("keeps finish skill and prompt aligned on return-to-main policy", () => {
    for (const file of [
      ".pi/skills/ops-finish/SKILL.md",
      ".pi/prompts/ops-finish.md",
    ]) {
      const body = readFileSync(resolve(process.cwd(), file), "utf8");
      expect(body, file).toContain("finish.return-to-main");
      expect(body, file).toContain("--return-to-main");
      expect(body, file).toContain("return_to_main_needs_human");
    }
  });

  it("clean build does not leave dist/auto-ensure", () => {
    expect(existsSync(resolve(process.cwd(), "dist/auto-ensure"))).toBe(false);
  });

});
