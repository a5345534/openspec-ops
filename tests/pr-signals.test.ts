import { describe, expect, it } from "vitest";
import { detectLifecycleStation } from "../src/next-step/stations.js";
import { optionsForStation } from "../src/next-step/edges.js";
import { resolvePrSignals } from "../src/next-step/pr-signals.js";

describe("resolvePrSignals", () => {
  it("sets open and merged from deps", () => {
    const r = resolvePrSignals("/repo", "feat", {
      findOpen: () => ({ number: 1 }),
      findMerged: () => null,
    });
    expect(r.hasOpenPr).toBe(true);
    expect(r.hasMergedPr).toBe(false);
    expect(r.queryFailed).toBe(false);
  });

  it("fail-open on throw", () => {
    const r = resolvePrSignals("/repo", "feat", {
      findOpen: () => {
        throw new Error("no gh");
      },
      findMerged: () => {
        throw new Error("no gh");
      },
    });
    expect(r.hasOpenPr).toBe(false);
    expect(r.hasMergedPr).toBe(false);
    expect(r.queryFailed).toBe(true);
  });

  it("merged true", () => {
    const r = resolvePrSignals("/repo", "feat", {
      findOpen: () => null,
      findMerged: () => ({ number: 2 }),
    });
    expect(r.hasMergedPr).toBe(true);
  });
});

describe("station + edges with PR signals", () => {
  it("open PR → shipped options include merge", () => {
    const station = detectLifecycleStation({
      change: "add-x",
      roots: [],
      worktreeFound: true,
      hasOpenPr: true,
      hasMergedPr: false,
    });
    // without proposal on disk may be shipped still from hasOpenPr first
    expect(station).toBe("shipped");
    const ids = optionsForStation(station, "add-x").map((o) => o.id);
    expect(ids).toContain("ops-merge");
    expect(ids).toContain("ops-impl-review");
  });
});
