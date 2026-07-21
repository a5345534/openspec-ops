import { describe, expect, it } from "vitest";
import {
  formatConfigTextCatalog,
  formatMetricsTextCatalog,
  keyFromConfigLabel,
  metricsRootLabels,
  stripUserFlag,
  valueChoicesForKey,
} from "../src/ops-runtime/admin-menus.js";
import { FINISH_RETURN_TO_MAIN_KEY } from "../src/pi-config/index.js";

describe("admin-menus helpers", () => {
  it("parses --user flag anywhere in args", () => {
    expect(stripUserFlag(["--user", "k", "v"])).toEqual({
      user: true,
      rest: ["k", "v"],
    });
    expect(stripUserFlag(["k", "--user", "v"])).toEqual({
      user: true,
      rest: ["k", "v"],
    });
    expect(stripUserFlag(["k", "v"])).toEqual({ user: false, rest: ["k", "v"] });
  });

  it("extracts keys from edit labels", () => {
    expect(
      keyFromConfigLabel("finish.return-to-main = off (default)"),
    ).toBe(FINISH_RETURN_TO_MAIN_KEY);
  });

  it("offers policy and round choices", () => {
    expect(valueChoicesForKey(FINISH_RETURN_TO_MAIN_KEY)).toContain("required");
    expect(valueChoicesForKey("spec-review.max-rounds")).toContain("3");
  });

  it("builds text catalogs without destructive language as action", () => {
    expect(formatConfigTextCatalog({}, "/tmp/agent")).toContain("Direct:");
    expect(formatMetricsTextCatalog(false)).toContain("disabled");
    expect(metricsRootLabels(true)).toContain("Disable collection");
  });
});
