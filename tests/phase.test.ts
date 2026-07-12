import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  detectSpecReviewPhase,
  isArchiveDirNameForChange,
  isHistoricalSpecReviewOverride,
} from "../src/lifecycle/phase.js";

describe("isArchiveDirNameForChange", () => {
  it("matches dated archive folders", () => {
    expect(isArchiveDirNameForChange("2026-07-12-my-change", "my-change")).toBe(true);
    expect(isArchiveDirNameForChange("2026-07-12-other", "my-change")).toBe(false);
  });
});

describe("detectSpecReviewPhase", () => {
  it("ok when only active", () => {
    const root = mkdtempSync(join(tmpdir(), "ops-phase-ok-"));
    try {
      mkdirSync(join(root, "openspec", "changes", "foo"), { recursive: true });
      writeFileSync(join(root, "openspec", "changes", "foo", "proposal.md"), "x");
      const r = detectSpecReviewPhase("foo", [root]);
      expect(r.phase).toBe("ok");
      expect(r.activeRoots.length).toBe(1);
      expect(r.archivePaths.length).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("archived when only archive", () => {
    const root = mkdtempSync(join(tmpdir(), "ops-phase-arch-"));
    try {
      mkdirSync(join(root, "openspec", "changes", "archive", "2026-07-12-foo"), {
        recursive: true,
      });
      const r = detectSpecReviewPhase("foo", [root]);
      expect(r.phase).toBe("archived");
      expect(r.activeRoots.length).toBe(0);
      expect(r.archivePaths.length).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("active_and_archived split-brain", () => {
    const primary = mkdtempSync(join(tmpdir(), "ops-phase-p-"));
    const wt = mkdtempSync(join(tmpdir(), "ops-phase-w-"));
    try {
      mkdirSync(join(primary, "openspec", "changes", "foo"), { recursive: true });
      mkdirSync(join(wt, "openspec", "changes", "archive", "2026-07-12-foo"), {
        recursive: true,
      });
      const r = detectSpecReviewPhase("foo", [primary, wt]);
      expect(r.phase).toBe("active_and_archived");
    } finally {
      rmSync(primary, { recursive: true, force: true });
      rmSync(wt, { recursive: true, force: true });
    }
  });
});

describe("isHistoricalSpecReviewOverride", () => {
  it("detects force/historical", () => {
    expect(isHistoricalSpecReviewOverride("historical re-review please")).toBe(true);
    expect(isHistoricalSpecReviewOverride("--force")).toBe(true);
    expect(isHistoricalSpecReviewOverride("normal review")).toBe(false);
  });
});
