import { formatOpsRuntimeBinding } from "./runtime-binding.js";
import type { ResolvedOpsBin } from "./runtime-binding.js";

export function buildDeliverFollowup(options: {
  change: string;
  objective?: string;
  runtime: ResolvedOpsBin;
  responseLanguageContract?: string;
}): string {
  return [
    `Run the ops-deliver skill for change \`${options.change}\` only.`,
    `REQUIRED: change name is \`${options.change}\` (kebab-case). Do not claim the name is missing.`,
    formatOpsRuntimeBinding(options.runtime),
    options.responseLanguageContract ?? "",
    options.objective ? `Optional objective: ${options.objective}` : "",
    "Follow .pi/skills/ops-deliver/SKILL.md until done or hard stop (mandatory reviews; merge consent already given by this invoke).",
  ]
    .filter(Boolean)
    .join("\n");
}
