import { describe, expect, it } from "vitest";
import { parseSlashChangeAndRest } from "../src/ops-runtime/change-name.js";

describe("parseSlashChangeAndRest", () => {
  it("parses change only", () => {
    expect(parseSlashChangeAndRest("eve-via-litellm-gateway")).toEqual({
      change: "eve-via-litellm-gateway",
      rest: "",
    });
  });

  it("parses change + objective rest", () => {
    expect(
      parseSlashChangeAndRest('my-change "add dark mode"'),
    ).toEqual({
      change: "my-change",
      rest: '"add dark mode"',
    });
  });

  it("returns null change for empty", () => {
    expect(parseSlashChangeAndRest("")).toEqual({ change: null, rest: "" });
    expect(parseSlashChangeAndRest(undefined)).toEqual({
      change: null,
      rest: "",
    });
  });

  it("rejects non-kebab first token", () => {
    expect(parseSlashChangeAndRest("Not_Kebab rest")).toEqual({
      change: null,
      rest: "Not_Kebab rest",
    });
  });
});
