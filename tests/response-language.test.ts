import { describe, expect, it } from "vitest";
import {
  RESPONSE_LANGUAGE_ENTRY_TYPE,
  formatResponseLanguageContract,
  inferResponseLanguage,
  restoreResponseLanguage,
} from "../src/ops-runtime/response-language.js";

describe("inferResponseLanguage", () => {
  it.each([
    ["請使用繁體中文回報這個需求的處理進度", "zh-Hant"],
    ["请使用简体中文回复这个需求的处理进度", "zh-Hans"],
    ["この変更を確認して、日本語で進捗を報告してください。", "jpn"],
    ["이 변경 사항을 검토하고 한국어로 진행 상황을 알려주세요.", "kor"],
    ["Please review this change and report the complete progress in English.", "eng"],
    ["Por favor, revisa este cambio y comunica todo el progreso en español.", "spa"],
  ])("detects %s as %s", (text, expected) => {
    expect(inferResponseLanguage(text)).toBe(expected);
  });

  it("keeps an established language for short ambiguous input", () => {
    expect(inferResponseLanguage("ok", "zh-Hant")).toBe("zh-Hant");
    expect(inferResponseLanguage("PR #37", "spa")).toBe("spa");
  });

  it("honors a recognized explicit switch", () => {
    expect(
      inferResponseLanguage("Please continue in English", "zh-Hant"),
    ).toBe("eng");
  });

  it("keeps the prior Chinese variant for neutral Han text", () => {
    expect(inferResponseLanguage("今天完成", "zh-Hant")).toBe("zh-Hant");
  });
});

describe("response language session contract", () => {
  it("restores only valid content-free language entries", () => {
    expect(
      restoreResponseLanguage([
        { type: "custom", customType: RESPONSE_LANGUAGE_ENTRY_TYPE, data: { language: "eng" } },
        { type: "custom", customType: "other", data: { language: "spa" } },
        { type: "custom", customType: RESPONSE_LANGUAGE_ENTRY_TYPE, data: { language: "zh-Hant" } },
      ]),
    ).toBe("zh-Hant");
  });

  it("injects localized reporting while preserving technical literals", () => {
    const contract = formatResponseLanguageContract("zh-Hant");
    expect(contract).toContain("Traditional Chinese (zh-Hant)");
    expect(contract).toContain("error codes");
    expect(contract).toContain("ops-metrics markers");
  });

  it("uses genuine-operator mirroring when language is unknown", () => {
    expect(formatResponseLanguageContract(null)).toContain(
      "latest genuine operator-authored message",
    );
  });
});
