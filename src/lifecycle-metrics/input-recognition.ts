import { CHANGE_NAME_RE } from "../ops-runtime/change-name.js";
import type { MetricsAction } from "./types.js";

export type RecognizedMetricsInput = {
  action: MetricsAction;
  change: string | null;
};

const RAW_ACTIONS: Record<string, MetricsAction> = {
  "opsx-explore": "opsx-explore",
  "ops-start": "ops-start",
  "opsx-propose": "opsx-propose",
  "ops-spec-review": "ops-spec-review",
  "opsx-apply": "opsx-apply",
  "ops-ship": "ops-ship",
  "ops-impl-review": "ops-impl-review",
  "ops-merge": "ops-merge",
  "opsx-sync": "opsx-sync",
  "opsx-archive": "opsx-archive",
  "ops-finish": "ops-finish",
};

const SIGNATURES: Array<{
  action: MetricsAction;
  anchors: readonly string[];
}> = [
  {
    action: "opsx-explore",
    anchors: [
      "Enter explore mode. Think deeply. Visualize freely.",
      "Explore mode is for thinking, not implementing.",
      "This is a stance, not a workflow.",
    ],
  },
  {
    action: "opsx-propose",
    anchors: [
      "Propose a new change - create the change and generate all artifacts in one step.",
      "I'll create a change with artifacts:",
      "When ready to implement, run /opsx-apply",
    ],
  },
  {
    action: "opsx-apply",
    anchors: [
      "Implement tasks from an OpenSpec change.",
      "Check status to understand the schema",
      "Implement tasks (loop until done or blocked)",
    ],
  },
  {
    action: "opsx-sync",
    anchors: [
      "Sync delta specs from a change to main specs.",
      "This is an **agent-driven** operation",
      "directly edit main specs",
    ],
  },
  {
    action: "opsx-archive",
    anchors: [
      "Archive a completed change in the experimental workflow.",
      "Check artifact completion status",
      "openspec archive",
    ],
  },
  {
    action: "opsx-archive",
    anchors: [
      "Archive a completed change in the experimental workflow.",
      "Perform the archive",
      "Move `changeRoot` to the archive directory",
    ],
  },
];

function validChange(value: string | undefined): string | null {
  const candidate = value?.trim() ?? "";
  return CHANGE_NAME_RE.test(candidate) ? candidate : null;
}

function lastValidMatch(text: string, pattern: RegExp): string | null {
  const matches = [...text.matchAll(pattern)];
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const change = validChange(matches[index]?.[1]);
    if (change) return change;
  }
  return null;
}

function changeFromExpandedInput(text: string): string | null {
  return (
    lastValidMatch(
      text,
      /^\*\*Provided arguments\*\*:\s*([^\r\n]*)/gmu,
    ) ?? lastValidMatch(text, /^User:\s*([^\r\n]*)\s*$/gmu)
  );
}

/**
 * Content-free mechanical recognition. The input is inspected in memory only;
 * callers persist the returned action/change metadata, never the source text.
 */
export function recognizeMetricsInput(text: string): RecognizedMetricsInput | null {
  const input = String(text ?? "").trim();
  if (!input) return null;

  const raw = input.match(/^\/(opsx?[-:][a-z-]+)\b(?:\s+([^\r\n]*))?/u);
  if (raw) {
    const command = (raw[1] ?? "").replace(":", "-");
    const action = RAW_ACTIONS[command];
    if (action) {
      const args = raw[2]?.trim() ?? "";
      const freeForm = action === "opsx-explore" || action === "opsx-propose";
      const candidate = freeForm ? args : args.split(/\s+/)[0];
      return { action, change: validChange(candidate) };
    }
  }

  for (const signature of SIGNATURES) {
    if (signature.anchors.every((anchor) => input.includes(anchor))) {
      return {
        action: signature.action,
        change: changeFromExpandedInput(input),
      };
    }
  }
  return null;
}
