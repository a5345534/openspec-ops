import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  FINISH_RETURN_TO_MAIN_ENV,
  FINISH_RETURN_TO_MAIN_KEY,
  IMPL_REVIEW_MAX_ROUNDS_ENV,
  IMPL_REVIEW_MAX_ROUNDS_KEY,
  SPEC_REVIEW_MAX_ROUNDS_DEFAULT,
  SPEC_REVIEW_MAX_ROUNDS_ENV,
  SPEC_REVIEW_MAX_ROUNDS_KEY,
  formatConfigInjection,
  getEffectiveFinishReturnToMain,
  getEffectiveImplReviewMaxRounds,
  getEffectiveMaxRounds,
  parseFinishReturnToMainStrict,
  parseMaxRoundsStrict,
  resetSessionConfig,
  resetUserPreferences,
  setSessionValue,
  setUserValue,
  showAll,
  unsetSessionValue,
  unsetUserValue,
  userConfigPath,
} from "../src/pi-config/index.js";

let tempAgent: string | null = null;

afterEach(() => {
  resetSessionConfig();
  if (tempAgent) {
    rmSync(tempAgent, { recursive: true, force: true });
    tempAgent = null;
  }
});

function agentDir(): string {
  tempAgent = mkdtempSync(join(tmpdir(), "ops-config-"));
  return tempAgent;
}

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

  it("user wins over env", () => {
    const dir = agentDir();
    setUserValue(dir, SPEC_REVIEW_MAX_ROUNDS_KEY, "5");
    const e = getEffectiveMaxRounds(
      { [SPEC_REVIEW_MAX_ROUNDS_ENV]: "4" },
      dir,
    );
    expect(e).toEqual({ value: 5, source: "user" });
  });

  it("session wins over user", () => {
    const dir = agentDir();
    setUserValue(dir, SPEC_REVIEW_MAX_ROUNDS_KEY, "5");
    setSessionValue(SPEC_REVIEW_MAX_ROUNDS_KEY, "2");
    const e = getEffectiveMaxRounds({}, dir);
    expect(e).toEqual({ value: 2, source: "session" });
  });

  it("unset session falls back to user then env", () => {
    const dir = agentDir();
    setUserValue(dir, SPEC_REVIEW_MAX_ROUNDS_KEY, "5");
    setSessionValue(SPEC_REVIEW_MAX_ROUNDS_KEY, "2");
    unsetSessionValue(SPEC_REVIEW_MAX_ROUNDS_KEY);
    expect(getEffectiveMaxRounds({ [SPEC_REVIEW_MAX_ROUNDS_ENV]: "4" }, dir)).toEqual({
      value: 5,
      source: "user",
    });
    unsetUserValue(dir, SPEC_REVIEW_MAX_ROUNDS_KEY);
    expect(getEffectiveMaxRounds({ [SPEC_REVIEW_MAX_ROUNDS_ENV]: "4" }, dir)).toEqual({
      value: 4,
      source: "env",
    });
  });

  it("invalid env ignored", () => {
    const e = getEffectiveMaxRounds({ [SPEC_REVIEW_MAX_ROUNDS_ENV]: "nope" });
    expect(e.source).toBe("default");
    expect(e.value).toBe(3);
  });

  it("invalid user file entries ignored", () => {
    const dir = agentDir();
    const path = userConfigPath(dir);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, "{not json", { mode: 0o600 });
    expect(getEffectiveMaxRounds({}, dir).source).toBe("default");
  });
});

describe("impl-review.max-rounds", () => {
  it("defaults to 3 independent of spec-review", () => {
    setSessionValue(SPEC_REVIEW_MAX_ROUNDS_KEY, "5");
    const e = getEffectiveImplReviewMaxRounds({});
    expect(e).toEqual({ value: 3, source: "default" });
  });

  it("session > user > env > default", () => {
    const dir = agentDir();
    const env = { [IMPL_REVIEW_MAX_ROUNDS_ENV]: "4" };
    expect(getEffectiveImplReviewMaxRounds(env, dir)).toEqual({ value: 4, source: "env" });
    setUserValue(dir, IMPL_REVIEW_MAX_ROUNDS_KEY, "5");
    expect(getEffectiveImplReviewMaxRounds(env, dir)).toEqual({ value: 5, source: "user" });
    setSessionValue(IMPL_REVIEW_MAX_ROUNDS_KEY, "2");
    expect(getEffectiveImplReviewMaxRounds(env, dir)).toEqual({ value: 2, source: "session" });
  });
});

describe("finish.return-to-main", () => {
  it("defaults off and resolves session > user > env", () => {
    const dir = agentDir();
    expect(getEffectiveFinishReturnToMain({}, dir)).toEqual({
      value: "off",
      source: "default",
    });
    const env = { [FINISH_RETURN_TO_MAIN_ENV]: "required" };
    expect(getEffectiveFinishReturnToMain(env, dir)).toEqual({
      value: "required",
      source: "env",
    });
    setUserValue(dir, FINISH_RETURN_TO_MAIN_KEY, "off");
    expect(getEffectiveFinishReturnToMain(env, dir)).toEqual({
      value: "off",
      source: "user",
    });
    setSessionValue(FINISH_RETURN_TO_MAIN_KEY, "required");
    expect(getEffectiveFinishReturnToMain(env, dir)).toEqual({
      value: "required",
      source: "session",
    });
  });

  it("user preference persists without env", () => {
    const dir = agentDir();
    setUserValue(dir, FINISH_RETURN_TO_MAIN_KEY, "required");
    expect(getEffectiveFinishReturnToMain({}, dir)).toEqual({
      value: "required",
      source: "user",
    });
  });

  it("reset user clears preferences only", () => {
    const dir = agentDir();
    setUserValue(dir, FINISH_RETURN_TO_MAIN_KEY, "required");
    resetUserPreferences(dir);
    expect(getEffectiveFinishReturnToMain({}, dir).source).toBe("default");
  });

  it("accepts primary-only and injects flag guidance", () => {
    expect(parseFinishReturnToMainStrict("primary-only")).toBe("primary-only");
    const dir = agentDir();
    setUserValue(dir, FINISH_RETURN_TO_MAIN_KEY, "primary-only");
    expect(getEffectiveFinishReturnToMain({}, dir)).toEqual({
      value: "primary-only",
      source: "user",
    });
    const text = formatConfigInjection({}, dir);
    expect(text).toContain("--sync-primary --sync-submodules");
    expect(text).toContain("do NOT pass --return-to-main");
  });

  it("rejects invalid policy values", () => {
    expect(() => setSessionValue(FINISH_RETURN_TO_MAIN_KEY, "yes")).toThrow(
      "primary-only",
    );
    const dir = agentDir();
    expect(() => setUserValue(dir, FINISH_RETURN_TO_MAIN_KEY, "yes")).toThrow();
  });
});

describe("showAll", () => {
  it("lists round and closeout keys", () => {
    const rows = showAll({});
    const keys = rows.map((r) => r.key);
    expect(keys).toContain(SPEC_REVIEW_MAX_ROUNDS_KEY);
    expect(keys).toContain(IMPL_REVIEW_MAX_ROUNDS_KEY);
    expect(keys).toContain(FINISH_RETURN_TO_MAIN_KEY);
  });
});
