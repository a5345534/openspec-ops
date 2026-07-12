import type { LifecycleStation, NextOption } from "./edges.js";
import { optionsForStation } from "./edges.js";

export type NextStepPlan = {
  change: string;
  station: LifecycleStation;
  options: NextOption[];
};

export function buildNextStepPlan(
  change: string,
  station: LifecycleStation,
): NextStepPlan {
  return {
    change,
    station,
    options: optionsForStation(station, change),
  };
}

/** Numbered text menu for headless / no UI. */
export function formatTextMenu(plan: NextStepPlan): string {
  const lines = [
    `Next step for \`${plan.change}\` (station: ${plan.station})`,
    ``,
    `Choose one (reply with number or slash). Do not auto-continue.`,
    ``,
  ];
  plan.options.forEach((opt, i) => {
    const n = i + 1;
    if (opt.id === "stop") {
      lines.push(`${n}. ${opt.label}`);
    } else {
      lines.push(`${n}. ${opt.label}`);
      if (opt.command) lines.push(`   → ${opt.command}`);
    }
  });
  return lines.join("\n");
}

export function labelsForSelect(plan: NextStepPlan): string[] {
  return plan.options.map((o) => o.label);
}

export function optionFromSelectLabel(
  plan: NextStepPlan,
  label: string | null | undefined,
): NextOption | null {
  if (!label) return null;
  return plan.options.find((o) => o.label === label) ?? null;
}

export function optionFromNumber(
  plan: NextStepPlan,
  n: number,
): NextOption | null {
  if (!Number.isFinite(n) || n < 1 || n > plan.options.length) return null;
  return plan.options[n - 1] ?? null;
}
