import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { collectEnvDoctorIssues } from "../src/doctor/env-checks.js";

describe("collectEnvDoctorIssues", () => {
  it("does not require package-local openspec-propose markers", () => {
    const packageRoot = mkdtempSync(join(tmpdir(), "ops-pkg-"));
    const projectRoot = mkdtempSync(join(tmpdir(), "ops-proj-"));
    // package has no openspec-propose
    const issues = collectEnvDoctorIssues({
      primaryPath: projectRoot,
      packageRoot,
      whichOpenspec: null,
      env: { PATH: "" },
    });
    expect(issues.some((i) => i.id === "propose_skill_alignment_markers_missing")).toBe(
      false,
    );
  });

  it("info when consumer propose skill lacks markers", () => {
    const root = mkdtempSync(join(tmpdir(), "ops-doc-"));
    const skillDir = join(root, ".pi/skills/openspec-propose");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "# propose\nno markers\n");
    const issues = collectEnvDoctorIssues({
      primaryPath: root,
      packageRoot: mkdtempSync(join(tmpdir(), "ops-pkg2-")),
      whichOpenspec: null,
      env: { PATH: "" },
    });
    expect(issues.some((i) => i.id === "propose_skill_alignment_markers_missing")).toBe(
      true,
    );
  });

  it("info when openspec is not intercept", () => {
    const root = mkdtempSync(join(tmpdir(), "ops-doc2-"));
    const issues = collectEnvDoctorIssues({
      primaryPath: root,
      packageRoot: root,
      whichOpenspec: "/usr/bin/openspec",
      env: {},
    });
    expect(issues.some((i) => i.id === "openspec_not_intercept")).toBe(true);
  });

  it("distinguishes invalid explicit override from package failure", () => {
    const root = mkdtempSync(join(tmpdir(), "ops-doc-runtime-"));
    const binDir = join(root, "bin");
    mkdirSync(binDir, { recursive: true });
    const bin = join(binDir, "openspec-ops");
    writeFileSync(bin, "#!/bin/sh\n");
    chmodSync(bin, 0o755);

    const overrideIssues = collectEnvDoctorIssues({
      primaryPath: root,
      packageRoot: root,
      whichOpenspec: null,
      env: { PATH: "", OPENSPEC_OPS_BIN: join(root, "missing") },
    });
    expect(overrideIssues.some((issue) => issue.id === "ops_bin_override_invalid")).toBe(true);

    chmodSync(bin, 0o644);
    const packageIssues = collectEnvDoctorIssues({
      primaryPath: root,
      packageRoot: root,
      whichOpenspec: null,
      env: { PATH: "" },
    });
    expect(packageIssues.some((issue) => issue.id === "ops_package_bin_invalid")).toBe(true);
  });

  it("no marker issue when consumer has alignment block", () => {
    const root = mkdtempSync(join(tmpdir(), "ops-doc3-"));
    const skillDir = join(root, ".pi/skills/openspec-propose");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, "SKILL.md"),
      "<!-- openspec-ops:worktree-alignment BEGIN -->\nx\n<!-- openspec-ops:worktree-alignment END -->\n",
    );
    const issues = collectEnvDoctorIssues({
      primaryPath: root,
      packageRoot: mkdtempSync(join(tmpdir(), "ops-pkg3-")),
      whichOpenspec: null,
      env: { PATH: "" },
    });
    expect(issues.some((i) => i.id === "propose_skill_alignment_markers_missing")).toBe(
      false,
    );
  });
});
