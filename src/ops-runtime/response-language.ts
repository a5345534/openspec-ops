import { franc } from "franc-min";

export const RESPONSE_LANGUAGE_ENTRY_TYPE =
  "openspec-ops-response-language" as const;

export type ResponseLanguage = "zh-Hant" | "zh-Hans" | string;

const TRADITIONAL = new Set(
  [..."體臺灣請與語這個為會處理長時間後開關檔專業說還讓從來進應該將錯誤網頁輸出執行審查總結"],
);
const SIMPLIFIED = new Set(
  [..."体台湾请与语这个为会处理长时间后开关档专业说还让从来进应该将错误网页输出执行审查总结"],
);

const EXPLICIT: Array<[RegExp, ResponseLanguage]> = [
  [/(?:traditional chinese|繁體中文|正體中文)/iu, "zh-Hant"],
  [/(?:simplified chinese|简体中文|簡體中文)/iu, "zh-Hans"],
  [/(?:respond|continue|reply|回答|回覆|回复).{0,20}(?:in\s+english|用英文|使用英文)/iu, "eng"],
  [/(?:respond|continue|reply).{0,20}(?:in )?spanish/iu, "spa"],
  [/(?:respond|continue|reply).{0,20}(?:in )?japanese/iu, "jpn"],
  [/(?:respond|continue|reply).{0,20}(?:in )?korean/iu, "kor"],
];

export function isResponseLanguage(value: unknown): value is ResponseLanguage {
  return (
    value === "zh-Hant" ||
    value === "zh-Hans" ||
    (typeof value === "string" && /^[a-z]{3}$/.test(value) && value !== "und")
  );
}

function naturalText(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\/[A-Za-z0-9._/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function inferResponseLanguage(
  input: string,
  current: ResponseLanguage | null = null,
): ResponseLanguage | null {
  const text = naturalText(input);
  if (!text) return current;

  for (const [pattern, language] of EXPLICIT) {
    if (pattern.test(text)) return language;
  }

  if (/\p{Script=Hiragana}|\p{Script=Katakana}/u.test(text)) return "jpn";
  if (/\p{Script=Hangul}/u.test(text)) return "kor";

  const han = [...text].filter((char) => /\p{Script=Han}/u.test(char));
  if (han.length > 0) {
    const traditional = han.filter((char) => TRADITIONAL.has(char)).length;
    const simplified = han.filter((char) => SIMPLIFIED.has(char)).length;
    if (traditional > simplified) return "zh-Hant";
    if (simplified > traditional) return "zh-Hans";
    if (current === "zh-Hant" || current === "zh-Hans") return current;
    return han.length >= 2 ? "cmn" : current;
  }

  const letters = [...text].filter((char) => /\p{Letter}/u.test(char)).length;
  if (letters < 20) return current;
  const detected = franc(text, { minLength: 20 });
  return isResponseLanguage(detected) ? detected : current;
}

export function formatResponseLanguageContract(
  language: ResponseLanguage | null,
): string {
  const target = language === "zh-Hant"
    ? "Traditional Chinese (zh-Hant)"
    : language === "zh-Hans"
      ? "Simplified Chinese (zh-Hans)"
      : language
        ? `the language identified by ISO 639-3 code \`${language}\``
        : "the same natural language and script as the latest genuine operator-authored message";
  return [
    `REQUIRED RESPONSE LANGUAGE: Write all conversational openspec-ops lifecycle progress, review findings, verdicts, hard-stop guidance, and final summaries in ${target}.`,
    "Do not infer the response language from extension-generated English control or follow-up messages.",
    "Keep commands, paths, change/branch names, identifiers, error codes, JSON keys, URLs, raw tool output, and ops-metrics markers unchanged.",
    "English output examples in ops skills are structural templates, not required wording; translate their natural-language meaning into the required response language.",
  ].join("\n");
}

export function restoreResponseLanguage(
  entries: readonly unknown[],
): ResponseLanguage | null {
  let restored: ResponseLanguage | null = null;
  for (const value of entries) {
    if (!value || typeof value !== "object") continue;
    const entry = value as {
      type?: unknown;
      customType?: unknown;
      data?: { language?: unknown };
    };
    if (
      entry.type === "custom" &&
      entry.customType === RESPONSE_LANGUAGE_ENTRY_TYPE &&
      isResponseLanguage(entry.data?.language)
    ) {
      restored = entry.data.language;
    }
  }
  return restored;
}
