/**
 * openspec-ops Pi extension — guided lifecycle (no auto chain)
 *
 * - /ops-config session settings
 * - /ops-start manual worktree (explicit only)
 * - /ops-next station menu (ui.select or text; user choice only)
 * - /ops-deliver binds slash change name then skill follow-up (batch start→finish)
 * - before_agent_start: inject config + optional one-shot workspace handoff after /ops-start
 *
 * REMOVED: auto-ensure on propose, auto-review settle fire, auto-finish, auto-impl-review.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  formatConfigInjection,
  getEffectiveEntry,
  isKnownKey,
  listKnownKeys,
  resetSessionConfig,
  setSessionValue,
  showAll,
  unsetSessionValue,
  SPEC_REVIEW_MAX_ROUNDS_KEY,
} from "../../src/pi-config/index.js";
import {
  buildNextStepPlan,
  detectLifecycleStation,
  formatChangePickList,
  formatTextMenu,
  labelsForSelect,
  listCandidateChanges,
  optionFromSelectLabel,
  resolvePrSignals,
} from "../../src/next-step/index.js";
import { resolveOpsBin, runOps } from "../../src/ops-runtime/run-ops.js";
import {
  CHANGE_NAME_RE,
  parseSlashChangeAndRest,
} from "../../src/ops-runtime/change-name.js";
import { resolvePackageRoot } from "../../src/package-root.js";

const EXT_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolvePackageRoot(EXT_DIR);

type WorkspaceState = {
  change: string;
  path: string;
  branch: string;
  mode: "propose" | "apply" | "archive";
};

function firstKebab(args: string | undefined): string | null {
  const first = (args ?? "").trim().split(/\s+/)[0] ?? "";
  return first && CHANGE_NAME_RE.test(first) ? first : null;
}

export default function (pi: ExtensionAPI) {
  let active: WorkspaceState | null = null;

  pi.on("before_agent_start", async () => {
    const configBlock = formatConfigInjection(process.env);
    if (!active) {
      return {
        message: {
          customType: "openspec-ops-config",
          content: configBlock,
          display: false,
        },
      };
    }
    const lines = [
      `Active openspec-ops workspace: change=${active.change} path=${active.path} branch=${active.branch} mode=${active.mode}.`,
      `REQUIRED: Prefer workspace path ${active.path} for change "${active.change}" (tool cwd or cd). start does NOT switch process cwd.`,
      configBlock,
    ];
    active = null;
    return {
      message: {
        customType: "openspec-ops-workspace",
        content: lines.join("\n\n"),
        display: true,
      },
    };
  });

  pi.registerCommand("ops-start", {
    description: "Create/reuse worktree via openspec-ops start (manual only)",
    handler: async (args, ctx) => {
      const change = firstKebab(args);
      if (!change) {
        ctx.ui.notify("Usage: /ops-start <change>", "warning");
        return;
      }
      const bin = resolveOpsBin({ projectRoot: PACKAGE_ROOT });
      if (!bin) {
        ctx.ui.notify("openspec-ops CLI not found", "error");
        return;
      }
      const res = runOps(bin, ["start", change], { cwd: ctx.cwd });
      const resJson = res.json;
      if (res.code !== 0 || !resJson || !resJson.ok) {
        const errMsg =
          (resJson && resJson.error && resJson.error.message) ||
          res.stderr ||
          `start failed (${res.code})`;
        ctx.ui.notify(errMsg, "error");
        return;
      }
      const r = resJson.result || {};
      active = {
        change: String(r.change != null ? r.change : change),
        path: String(r.path != null ? r.path : ""),
        branch: String(r.branch != null ? r.branch : change),
        mode: "propose",
      };
      ctx.ui.notify(
        `Workspace @ ${active.path} (${String(r.action != null ? r.action : "ok")}). Not auto-running propose.`,
        "info",
      );
    },
  });

  pi.registerCommand("ops-config", {
    description:
      "Session openspec-ops settings (show|get|set|unset|reset). Not a project file.",
    handler: async (args, ctx) => {
      const parts = (args ?? "").trim().split(/\s+/).filter(Boolean);
      const sub = (parts[0] ?? "show").toLowerCase();
      try {
        if (sub === "show" || sub === "list") {
          const rows = showAll(process.env);
          const text = rows.map((r) => `${r.key}=${r.value} (${r.source})`).join("\n");
          ctx.ui.notify(
            text || "(no keys)\nSession-only; resets when Pi restarts.",
            "info",
          );
          return;
        }
        if (sub === "get") {
          const key = parts[1];
          if (!key) {
            ctx.ui.notify("Usage: /ops-config get <key>", "warning");
            return;
          }
          if (!isKnownKey(key)) {
            ctx.ui.notify(`Unknown key. Known: ${listKnownKeys().join(", ")}`, "warning");
            return;
          }
          const e = getEffectiveEntry(key, process.env);
          ctx.ui.notify(`${e.key}=${e.value} (source=${e.source})`, "info");
          return;
        }
        if (sub === "set") {
          const key = parts[1];
          const value = parts.slice(2).join(" ");
          if (!key || !value) {
            ctx.ui.notify("Usage: /ops-config set <key> <value>", "warning");
            return;
          }
          setSessionValue(key, value);
          const e = getEffectiveEntry(key, process.env);
          ctx.ui.notify(`Set ${e.key}=${e.value} (session)`, "info");
          return;
        }
        if (sub === "unset") {
          const key = parts[1];
          if (!key) {
            ctx.ui.notify("Usage: /ops-config unset <key>", "warning");
            return;
          }
          unsetSessionValue(key);
          const e = getEffectiveEntry(key, process.env);
          ctx.ui.notify(`Unset session ${key}; now ${e.value} (${e.source})`, "info");
          return;
        }
        if (sub === "reset") {
          resetSessionConfig();
          ctx.ui.notify("Cleared all session overrides (env/defaults apply).", "info");
          return;
        }
        ctx.ui.notify(
          "Usage: /ops-config show|get <key>|set <key> <value>|unset <key>|reset\n" +
            `Keys: ${listKnownKeys().join(", ")} (e.g. ${SPEC_REVIEW_MAX_ROUNDS_KEY})`,
          "warning",
        );
      } catch (err) {
        ctx.ui.notify(err instanceof Error ? err.message : String(err), "error");
      }
    },
  });

  pi.registerCommand("ops-next", {
    description:
      "Guided next lifecycle step. Optional change name; omit to pick among candidates.",
    handler: async (args, ctx) => {
      const rootsBase = [PACKAGE_ROOT, ctx.cwd].filter(Boolean) as string[];
      let change = firstKebab(args);

      if (!change) {
        const candidates = listCandidateChanges(rootsBase);
        if (candidates.length === 0) {
          ctx.ui.notify(
            "No active changes found. Use /ops-start <change> or open a change worktree, then /ops-next.",
            "warning",
          );
          return;
        }
        if (candidates.length === 1) {
          change = candidates[0]!;
          ctx.ui.notify(`Using only candidate: ${change}`, "info");
        } else if (!ctx.hasUI || typeof ctx.ui.select !== "function") {
          ctx.ui.notify(formatChangePickList(candidates), "info");
          return;
        } else {
          const picked = await ctx.ui.select("Pick change", candidates);
          if (!picked || !candidates.includes(picked)) {
            ctx.ui.notify("Stopped. No change selected.", "info");
            return;
          }
          change = picked;
        }
      }

      const roots = [...rootsBase];
      let worktreeFound = false;
      let branch = change;
      let prCwd = ctx.cwd || PACKAGE_ROOT;

      const bin = resolveOpsBin({ projectRoot: PACKAGE_ROOT });
      if (bin) {
        const where = runOps(bin, ["where", change], { cwd: ctx.cwd });
        if (where.json?.ok && where.json.result) {
          const wr = where.json.result;
          worktreeFound = Boolean(wr.found);
          if (wr.path) {
            roots.push(String(wr.path));
          }
          if (wr.primaryPath) {
            roots.push(String(wr.primaryPath));
            prCwd = String(wr.primaryPath);
          } else if (wr.path) {
            prCwd = String(wr.path);
          }
          if (wr.branch) {
            branch = String(wr.branch);
          }
        }
      }

      const pr = resolvePrSignals(prCwd, branch);
      if (pr.queryFailed) {
        ctx.ui.notify(
          "PR status unavailable (gh?). Station may stay pre-ship until gh works.",
          "info",
        );
      }

      const station = detectLifecycleStation({
        change,
        roots: [...new Set(roots)],
        worktreeFound,
        hasOpenPr: pr.hasOpenPr,
        hasMergedPr: pr.hasMergedPr,
      });
      const plan = buildNextStepPlan(change, station);

      if (!ctx.hasUI || typeof ctx.ui.select !== "function") {
        ctx.ui.notify(
          formatTextMenu(plan) +
            "\n\n(No UI — nothing auto-started. Run a slash yourself.)",
          "info",
        );
        return;
      }

      const selected = await ctx.ui.select(
        `Next for ${change} (${plan.station})`,
        labelsForSelect(plan),
      );
      const opt = optionFromSelectLabel(plan, selected);
      if (!opt || opt.id === "stop" || !opt.command) {
        ctx.ui.notify("Stopped. No next step scheduled.", "info");
        return;
      }
      if (typeof pi.sendUserMessage === "function") {
        pi.sendUserMessage(opt.command, { deliverAs: "followUp" });
        ctx.ui.notify(`Scheduled: ${opt.command}`, "info");
      } else {
        ctx.ui.notify(`Run manually: ${opt.command}`, "warning");
      }
    },
  });

  pi.registerCommand("ops-deliver", {
    description:
      "Batch start→finish after explore (reviews required; merge consent on invoke). Slash args bind change name.",
    handler: async (args, ctx) => {
      const rootsBase = [PACKAGE_ROOT, ctx.cwd].filter(Boolean) as string[];
      let { change, rest } = parseSlashChangeAndRest(args);

      if (!change) {
        const candidates = listCandidateChanges(rootsBase);
        if (candidates.length === 0) {
          ctx.ui.notify(
            "Usage: /ops-deliver <kebab-change> [objective]. No active candidates. Use /ops-start first or pass a name.",
            "warning",
          );
          return;
        }
        if (candidates.length === 1) {
          change = candidates[0]!;
          ctx.ui.notify(`Using only candidate: ${change}`, "info");
        } else if (!ctx.hasUI || typeof ctx.ui.select !== "function") {
          ctx.ui.notify(
            formatChangePickList(candidates) +
              "\n\nRe-run: /ops-deliver <change>",
            "info",
          );
          return;
        } else {
          const picked = await ctx.ui.select("Pick change for deliver", candidates);
          if (!picked || !candidates.includes(picked)) {
            ctx.ui.notify("Stopped. No change selected for deliver.", "info");
            return;
          }
          change = picked;
        }
      }

      const lines = [
        `Run the ops-deliver skill for change \`${change}\` only.`,
        `REQUIRED: change name is \`${change}\` (kebab-case). Do not claim the name is missing.`,
        rest ? `Optional objective: ${rest}` : "",
        "Follow .pi/skills/ops-deliver/SKILL.md until done or hard stop (mandatory reviews; merge consent already given by this invoke).",
      ].filter(Boolean);

      if (typeof pi.sendUserMessage === "function") {
        pi.sendUserMessage(lines.join("\n"), { deliverAs: "followUp" });
        ctx.ui.notify(`ops-deliver scheduled for ${change}`, "info");
      } else {
        ctx.ui.notify(
          `No sendUserMessage — run ops-deliver for ${change} manually.\n${lines.join("\n")}`,
          "warning",
        );
      }
    },
  });
}
