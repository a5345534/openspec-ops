export type LifecycleStation =
  | "no_workspace"
  | "ready_to_propose"
  | "proposed"
  | "applied"
  | "shipped"
  | "merged"
  | "archived"
  | "done"
  | "unknown";

export type NextActionId =
  | "ops-start"
  | "opsx-propose"
  | "ops-spec-review"
  | "opsx-apply"
  | "ops-ship"
  | "ops-impl-review"
  | "ops-merge"
  | "opsx-archive"
  | "ops-finish"
  | "stop";

export type NextOption = {
  id: NextActionId;
  /** Slash / prompt label for menus */
  label: string;
  /** Message to run if selected (empty for stop) */
  command: string;
};

function opt(id: NextActionId, change: string): NextOption {
  const commands: Record<NextActionId, string> = {
    "ops-start": `/ops-start ${change}`,
    "opsx-propose": `/opsx-propose ${change}`,
    "ops-spec-review": `/ops-spec-review ${change}`,
    "opsx-apply": `/opsx-apply ${change}`,
    "ops-ship": `/ops-ship ${change}`,
    "ops-impl-review": `/ops-impl-review ${change}`,
    "ops-merge": `/ops-merge ${change}`,
    "opsx-archive": `/opsx-archive ${change}`,
    "ops-finish": `/ops-finish ${change}`,
    stop: "",
  };
  const labels: Record<NextActionId, string> = {
    "ops-start": `Start worktree (/ops-start ${change})`,
    "opsx-propose": `Propose (/opsx-propose ${change})`,
    "ops-spec-review": `Spec review (/ops-spec-review ${change})`,
    "opsx-apply": `Apply (/opsx-apply ${change})`,
    "ops-ship": `Ship PR (/ops-ship ${change})`,
    "ops-impl-review": `Impl review (/ops-impl-review ${change})`,
    "ops-merge": `Merge PR (/ops-merge ${change})`,
    "opsx-archive": `Archive (/opsx-archive ${change})`,
    "ops-finish": `Finish worktree (/ops-finish ${change})`,
    stop: "Stop (no further step)",
  };
  return { id, label: labels[id], command: commands[id] };
}

/** Hard-coded legal edges (main menu). */
export function optionsForStation(
  station: LifecycleStation,
  change: string,
): NextOption[] {
  const o = (id: NextActionId) => opt(id, change);
  switch (station) {
    case "no_workspace":
      return [o("ops-start"), o("stop")];
    case "ready_to_propose":
      return [o("opsx-propose"), o("stop")];
    case "proposed":
      return [o("ops-spec-review"), o("opsx-apply"), o("stop")];
    case "applied":
      return [o("ops-ship"), o("stop")];
    case "shipped":
      return [o("ops-impl-review"), o("ops-ship"), o("ops-merge"), o("stop")];
    case "merged":
      return [o("opsx-archive"), o("stop")];
    case "archived":
      return [o("ops-finish"), o("stop")];
    case "done":
      return [o("stop")];
    case "unknown":
    default:
      return [o("stop")];
  }
}
