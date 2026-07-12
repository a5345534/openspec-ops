import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  areAllTasksComplete,
  buildOpsReviewFollowUpMessage,
  discoverReadyProposalChanges,
  isAutoReviewEligible,
  isProposalReady,
  parseAutoReviewPolicy,
  selectReviewFollowUps,
  summarizeTaskCheckboxes,
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

describe("summarizeTaskCheckboxes", () => {
  it("counts open and done boxes", () => {
    const s = summarizeTaskCheckboxes(`
## 1
- [ ] open one
- [x] done
- [X] also done
- not a box
`);
    expect(s.open).toBe(1);
    expect(s.done).toBe(2);
    expect(s.total).toBe(3);
  });

  it("empty when no boxes", () => {
    expect(summarizeTaskCheckboxes("no tasks\n")).toEqual({
      open: 0,
      done: 0,
      total: 0,
    });
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

describe("isAutoReviewEligible", () => {
  it("false without proposal", () => {
    const root = mkdtempSync(join(tmpdir(), "ops-el-"));
    expect(isAutoReviewEligible("add-x", [root])).toBe(false);
  });

  it("true with proposal only (no tasks.md)", () => {
    const root = mkdtempSync(join(tmpdir(), "ops-el-"));
    const dir = join(root, "openspec", "changes", "add-x");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "proposal.md"), "## Why\n");
    expect(isAutoReviewEligible("add-x", [root])).toBe(true);
  });

  it("true when tasks have open checkbox", () => {
    const root = mkdtempSync(join(tmpdir(), "ops-el-"));
    const dir = join(root, "openspec", "changes", "add-x");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "proposal.md"), "## Why\n");
    writeFileSync(join(dir, "tasks.md"), "- [x] done\n- [ ] open\n");
    expect(areAllTasksComplete("add-x", [root])).toBe(false);
    expect(isAutoReviewEligible("add-x", [root])).toBe(true);
  });

  it("false when all tasks complete", () => {
    const root = mkdtempSync(join(tmpdir(), "ops-el-"));
    const dir = join(root, "openspec", "changes", "add-x");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "proposal.md"), "## Why\n");
    writeFileSync(join(dir, "tasks.md"), "- [x] one\n- [X] two\n");
    expect(areAllTasksComplete("add-x", [root])).toBe(true);
    expect(isAutoReviewEligible("add-x", [root])).toBe(false);
  });

  it("false when archived only (no active)", () => {
    const root = mkdtempSync(join(tmpdir(), "ops-el-"));
    const arch = join(
      root,
      "openspec",
      "changes",
      "archive",
      "2026-07-12-add-x",
    );
    mkdirSync(arch, { recursive: true });
    writeFileSync(join(arch, "proposal.md"), "## Why\n");
    // no active dir — proposal not under active path
    expect(isProposalReady("add-x", [root])).toBe(false);
    expect(isAutoReviewEligible("add-x", [root])).toBe(false);
  });

  it("false on split-brain active+archived", () => {
    const root = mkdtempSync(join(tmpdir(), "ops-el-"));
    const active = join(root, "openspec", "changes", "add-x");
    const arch = join(
      root,
      "openspec",
      "changes",
      "archive",
      "2026-07-12-add-x",
    );
    mkdirSync(active, { recursive: true });
    mkdirSync(arch, { recursive: true });
    writeFileSync(join(active, "proposal.md"), "## Why\n");
    writeFileSync(join(active, "tasks.md"), "- [ ] still open\n");
    expect(isAutoReviewEligible("add-x", [root])).toBe(false);
  });
});

describe("buildOpsReviewFollowUpMessage", () => {
  it("uses /ops-spec-review slash entrypoint", () => {
    expect(OPS_REVIEW_SLASH).toBe("/ops-spec-review");
    expect(buildOpsReviewFollowUpMessage("add-dark-mode")).toBe(
      "/ops-spec-review add-dark-mode",
    );
  });
});

describe("discoverReadyProposalChanges", () => {
  it("finds change dirs with proposal when eligible", () => {
    const root = mkdtempSync(join(tmpdir(), "ops-disc-"));
    const dir = join(root, "openspec", "changes", "add-x");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "proposal.md"), "## Why\n");
    mkdirSync(join(root, "openspec", "changes", "archive"), { recursive: true });
    expect(discoverReadyProposalChanges([root])).toEqual(["add-x"]);
  });

  it("skips when all tasks complete", () => {
    const root = mkdtempSync(join(tmpdir(), "ops-disc-"));
    const dir = join(root, "openspec", "changes", "add-x");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "proposal.md"), "## Why\n");
    writeFileSync(join(dir, "tasks.md"), "- [x] done\n");
    expect(discoverReadyProposalChanges([root])).toEqual([]);
  });
});

describe("selectReviewFollowUps", () => {
  it("skips already scheduled", () => {
    expect(selectReviewFollowUps(["a", "b"], new Set(["a"]))).toEqual(["b"]);
  });
});
