import { describe, expect, it } from "vitest";
import { parseAutoImplReviewPolicy } from "../src/auto-impl-review/index.js";

describe("parseAutoImplReviewPolicy", () => {
  it("defaults to on", () => {
    expect(parseAutoImplReviewPolicy(undefined)).toBe("on");
    expect(parseAutoImplReviewPolicy("")).toBe("on");
    expect(parseAutoImplReviewPolicy("  ")).toBe("on");
  });

  it("accepts off case-insensitively", () => {
    expect(parseAutoImplReviewPolicy("off")).toBe("off");
    expect(parseAutoImplReviewPolicy("OFF")).toBe("off");
  });

  it("treats on and unknown as on", () => {
    expect(parseAutoImplReviewPolicy("on")).toBe("on");
    expect(parseAutoImplReviewPolicy("maybe")).toBe("on");
  });
});
