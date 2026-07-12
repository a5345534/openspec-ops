import { describe, expect, it } from "vitest";
import {
  isNoChecksReportedMessage,
  parseEmptyChecksPolicy,
} from "../src/ship/backends/gh.js";

describe("parseEmptyChecksPolicy", () => {
  it("defaults to allow when unset or empty", () => {
    expect(parseEmptyChecksPolicy(undefined)).toBe("allow");
    expect(parseEmptyChecksPolicy("")).toBe("allow");
    expect(parseEmptyChecksPolicy("  ")).toBe("allow");
  });

  it("allow aliases", () => {
    expect(parseEmptyChecksPolicy("allow")).toBe("allow");
    expect(parseEmptyChecksPolicy("on")).toBe("allow");
    expect(parseEmptyChecksPolicy("true")).toBe("allow");
  });

  it("refuse aliases", () => {
    expect(parseEmptyChecksPolicy("refuse")).toBe("refuse");
    expect(parseEmptyChecksPolicy("strict")).toBe("refuse");
    expect(parseEmptyChecksPolicy("fail")).toBe("refuse");
    expect(parseEmptyChecksPolicy("off")).toBe("refuse");
    expect(parseEmptyChecksPolicy("REFUSE")).toBe("refuse");
  });
});

describe("isNoChecksReportedMessage", () => {
  it("matches gh empty-check phrasing", () => {
    expect(isNoChecksReportedMessage("no checks reported on the 'x' branch")).toBe(
      true,
    );
    expect(isNoChecksReportedMessage("No Checks Reported")).toBe(true);
  });

  it("does not match ordinary failures", () => {
    expect(isNoChecksReportedMessage("1 failing check")).toBe(false);
    expect(isNoChecksReportedMessage("pending checks")).toBe(false);
  });
});
