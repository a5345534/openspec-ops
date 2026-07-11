import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildOpsReviewFollowUpMessage,
  discoverReadyProposalChanges,
  isProposalReady,
  parseAutoReviewPolicy,
  selectReviewFollowUps,
  OPS_REVIEW_SLASH,
} from "../src/auto-review/index.js";

describe("parseAutoReviewPolicy", () => {
  it("defaults to on", () => {
    expect(parseAutoReviewPolicy(undefined)).toBe("on");
    expect(parseAutoReviewPolicy("")).toBe("on");
  });

  it("accepts off case-insensitively", () => {
    expect(parseAutoReviewPolicy("off")).toBe("off");
    expect(parseAutoReviewPolicy("OFF")).toBe("off");
  });

  it("treats unknown as on", () => {
    expect(parseAutoReviewPolicy("maybe")).toBe("on");
    expect(parseAutoReviewPolicy("on")).toBe("on");
  });
});

describe("isProposalReady", () => {
  it("false when roots empty or missing", () => {
    expect(isProposalReady("add-x", [])).toBe(false);
    expect(isProposalReady("add-x", ["/no/such/root"])).toBe(false);
  });

  it("true when proposal.md exists under a root", () => {
    const root = mkdtempSync(join(tmpdir(), "ops-review-ready-"));
    const dir = join(root, "openspec", "changes", "add-x");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "proposal.md"), "## Why\n");
    expect(isProposalReady("add-x", [root])).toBe(true);
    expect(isProposalReady("other", [root])).toBe(false);
  });

  it("checks any root in list", () => {
    const a = mkdtempSync(join(tmpdir(), "ops-review-a-"));
    const b = mkdtempSync(join(tmpdir(), "ops-review-b-"));
    const dir = join(b, "openspec", "changes", "add-x");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "proposal.md"), "x");
    expect(isProposalReady("add-x", [a, b])).toBe(true);
  });
});

describe("buildOpsReviewFollowUpMessage", () => {
  it("uses /ops-review slash entrypoint", () => {
    expect(OPS_REVIEW_SLASH).toBe("/ops-review");
    expect(buildOpsReviewFollowUpMessage("add-dark-mode")).toBe(
      "/ops-review add-dark-mode",
    );
  });
});

describe("discoverReadyProposalChanges", () => {
  it("finds change dirs with proposal.md", () => {
    const root = mkdtempSync(join(tmpdir(), "ops-disc-"));
    const dir = join(root, "openspec", "changes", "add-x");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "proposal.md"), "## Why\n");
    mkdirSync(join(root, "openspec", "changes", "archive"), { recursive: true });
    expect(discoverReadyProposalChanges([root])).toEqual(["add-x"]);
  });
});

describe("selectReviewFollowUps", () => {
  it("skips already scheduled", () => {
    expect(
      selectReviewFollowUps(["a", "b"], new Set(["a"])),
    ).toEqual(["b"]);
  });
});
