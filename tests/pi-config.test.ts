import { afterEach, describe, expect, it } from "vitest";
import {
  IMPL_REVIEW_MAX_ROUNDS_ENV,
  IMPL_REVIEW_MAX_ROUNDS_KEY,
  SPEC_REVIEW_MAX_ROUNDS_DEFAULT,
  SPEC_REVIEW_MAX_ROUNDS_ENV,
  SPEC_REVIEW_MAX_ROUNDS_KEY,
  getEffectiveImplReviewMaxRounds,
  getEffectiveMaxRounds,
  parseMaxRoundsStrict,
  resetSessionConfig,
  setSessionValue,
  showAll,
  unsetSessionValue,
} from "../src/pi-config/index.js";

afterEach(() => {
  resetSessionConfig();
});

describe("parseMaxRoundsStrict", () => {
  it("accepts 1–10", () => {
    expect(parseMaxRoundsStrict("1")).toBe(1);
    expect(parseMaxRoundsStrict("3")).toBe(3);
    expect(parseMaxRoundsStrict("10")).toBe(10);
  });

  it("rejects invalid", () => {
    expect(() => parseMaxRoundsStrict("0")).toThrow();
    expect(() => parseMaxRoundsStrict("11")).toThrow();
    expect(() => parseMaxRoundsStrict("x")).toThrow();
    expect(() => parseMaxRoundsStrict("3.5")).toThrow();
  });
});

describe("getEffectiveMaxRounds precedence", () => {
  it("defaults to 3", () => {
    const e = getEffectiveMaxRounds({});
    expect(e).toEqual({ value: SPEC_REVIEW_MAX_ROUNDS_DEFAULT, source: "default" });
  });

  it("env before default", () => {
    const e = getEffectiveMaxRounds({ [SPEC_REVIEW_MAX_ROUNDS_ENV]: "4" });
    expect(e).toEqual({ value: 4, source: "env" });
  });

  it("session wins over env", () => {
    setSessionValue(SPEC_REVIEW_MAX_ROUNDS_KEY, "2");
    const e = getEffectiveMaxRounds({ [SPEC_REVIEW_MAX_ROUNDS_ENV]: "4" });
    expect(e).toEqual({ value: 2, source: "session" });
  });

  it("unset session falls back to env", () => {
    setSessionValue(SPEC_REVIEW_MAX_ROUNDS_KEY, "5");
    unsetSessionValue(SPEC_REVIEW_MAX_ROUNDS_KEY);
    const e = getEffectiveMaxRounds({ [SPEC_REVIEW_MAX_ROUNDS_ENV]: "4" });
    expect(e).toEqual({ value: 4, source: "env" });
  });

  it("invalid env ignored", () => {
    const e = getEffectiveMaxRounds({ [SPEC_REVIEW_MAX_ROUNDS_ENV]: "nope" });
    expect(e.source).toBe("default");
    expect(e.value).toBe(3);
  });
});

describe("impl-review.max-rounds", () => {
  it("defaults to 3 independent of spec-review", () => {
    setSessionValue(SPEC_REVIEW_MAX_ROUNDS_KEY, "5");
    const e = getEffectiveImplReviewMaxRounds({});
    expect(e).toEqual({ value: 3, source: "default" });
  });

  it("session > env > default", () => {
    const env = { [IMPL_REVIEW_MAX_ROUNDS_ENV]: "4" };
    expect(getEffectiveImplReviewMaxRounds(env)).toEqual({ value: 4, source: "env" });
    setSessionValue(IMPL_REVIEW_MAX_ROUNDS_KEY, "2");
    expect(getEffectiveImplReviewMaxRounds(env)).toEqual({ value: 2, source: "session" });
  });
});

describe("showAll", () => {
  it("lists both round keys", () => {
    const rows = showAll({});
    const keys = rows.map((r) => r.key);
    expect(keys).toContain(SPEC_REVIEW_MAX_ROUNDS_KEY);
    expect(keys).toContain(IMPL_REVIEW_MAX_ROUNDS_KEY);
  });
});
