import { afterEach, describe, expect, it } from "vitest";
import {
  SPEC_REVIEW_MAX_ROUNDS_DEFAULT,
  SPEC_REVIEW_MAX_ROUNDS_ENV,
  SPEC_REVIEW_MAX_ROUNDS_KEY,
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

describe("showAll", () => {
  it("lists known keys", () => {
    const rows = showAll({});
    expect(rows.some((r) => r.key === SPEC_REVIEW_MAX_ROUNDS_KEY)).toBe(true);
  });
});
