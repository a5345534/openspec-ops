/**
 * openspec-ops Pi extension — guided lifecycle (no auto chain)
 *
 * - /ops-config session settings
 * - /ops-start manual worktree (explicit only)
 * - /ops-next station menu (ui.select or text; user choice only)
 * - /ops-deliver binds slash change name then skill follow-up (batch start→finish)
 * - /ops-metrics local opt-in lifecycle usage/review/deliver reporting
 * - before_agent_start: inject config + optional one-shot workspace handoff after /ops-start
 *
 * REMOVED: auto-ensure on propose, auto-review settle fire, auto-finish, auto-impl-review.
 */
import {
  getAgentDir,
  isToolCallEventType,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
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
  type LifecycleStation,
} from "../../src/next-step/index.js";
import { resolveOpsBin, runOps } from "../../src/ops-runtime/run-ops.js";
import {
  CHANGE_NAME_RE,
  parseSlashChangeAndRest,
} from "../../src/ops-runtime/change-name.js";
import { resolvePackageRoot } from "../../src/package-root.js";
import {
  LifecycleMetricsRuntime,
  actionFromShellCommand,
  appendMetricsRecord,
  buildMetricsReport,
  changeFromShellCommand,
  formatMetricsReport,
  hashSessionId,
  hasPriorUnsuccessfulAttempt,
  parseJsonEnvelope,
  parseLifecycleSlash,
  readMetricsConfig,
  readMetricsRecords,
  resetMetricsData,
  setMetricsEnabled,
  type MetricsAction,
} from "../../src/lifecycle-metrics/index.js";

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

function stationForMetrics(change: string, cwd: string): LifecycleStation {
  const roots = [PACKAGE_ROOT, cwd].filter(Boolean);
  let worktreeFound = false;
  let branch = change;
  let prCwd = cwd || PACKAGE_ROOT;
  const bin = resolveOpsBin({ projectRoot: PACKAGE_ROOT });
  if (bin) {
    const where = runOps(bin, ["where", change], { cwd });
    if (where.json?.ok && where.json.result) {
      const wr = where.json.result;
      worktreeFound = Boolean(wr.found);
      if (wr.path) roots.push(String(wr.path));
      if (wr.primaryPath) {
        roots.push(String(wr.primaryPath));
        prCwd = String(wr.primaryPath);
      } else if (wr.path) {
        prCwd = String(wr.path);
      }
      if (wr.branch) branch = String(wr.branch);
    }
  }
  const pr = resolvePrSignals(prCwd, branch);
  return detectLifecycleStation({
    change,
    roots: [...new Set(roots)],
    worktreeFound,
    hasOpenPr: pr.hasOpenPr,
    hasMergedPr: pr.hasMergedPr,
  });
}

function textContent(content: Array<{ type: string; text?: string }>): string {
  return content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text ?? "")
    .join("\n");
}

export default function (pi: ExtensionAPI) {
  let active: WorkspaceState | null = null;
  const metricsAgentDir = getAgentDir();
  let metricsEnabled = readMetricsConfig(metricsAgentDir).enabled;
  let metricsRuntime: LifecycleMetricsRuntime | null = null;
  let metricsWarned = false;
  const pendingShell = new Map<
    string,
    { action: MetricsAction; change: string | null }
  >();

  const ensureMetrics = (ctx: {
    sessionManager: { getSessionId(): string };
    ui: { notify(message: string, level?: "info" | "warning" | "error"): void };
  }): LifecycleMetricsRuntime => {
    if (metricsRuntime) return metricsRuntime;
    metricsRuntime = new LifecycleMetricsRuntime({
      sessionIdHash: hashSessionId(ctx.sessionManager.getSessionId()),
      enabled: () => metricsEnabled,
      append: (record) => appendMetricsRecord(metricsAgentDir, record),
      onError: (error) => {
        if (metricsWarned) return;
        metricsWarned = true;
        ctx.ui.notify(
          `openspec-ops metrics unavailable (lifecycle continues): ${error instanceof Error ? error.message : String(error)}`,
          "warning",
        );
      },
    });
    return metricsRuntime;
  };

  pi.on("session_start", async (_event, ctx) => {
    metricsEnabled = readMetricsConfig(metricsAgentDir).enabled;
    metricsRuntime = null;
    metricsWarned = false;
    pendingShell.clear();
    ensureMetrics(ctx);
  });

  pi.on("input", async (event, ctx) => {
    if (!metricsEnabled) return { action: "continue" as const };
    const parsed = parseLifecycleSlash(event.text);
    if (parsed) {
      ensureMetrics(ctx).setAction(
        parsed.change,
        parsed.action,
        "observed",
        null,
      );
    }
    return { action: "continue" as const };
  });

  pi.on("tool_call", async (event, ctx) => {
    if (!metricsEnabled || !isToolCallEventType("bash", event)) return;
    const action = actionFromShellCommand(event.input.command);
    if (!action) return;
    const runtime = ensureMetrics(ctx);
    const change =
      changeFromShellCommand(event.input.command) ?? runtime.activeContext.change;
    runtime.setAction(change, action, "observed", null);
    pendingShell.set(event.toolCallId, { action, change });
  });

  pi.on("tool_result", async (event, ctx) => {
    if (!metricsEnabled) return;
    const pending = pendingShell.get(event.toolCallId);
    if (!pending) return;
    pendingShell.delete(event.toolCallId);
    const envelope = parseJsonEnvelope(textContent(event.content));
    ensureMetrics(ctx).noteActionResult(
      pending.action,
      envelope?.ok ?? !event.isError,
      envelope?.errorCode ?? (event.isError ? "tool_failed" : undefined),
    );
  });

  pi.on("turn_end", async (event, ctx) => {
    if (!metricsEnabled || event.message.role !== "assistant") return;
    const usage = event.message.usage;
    ensureMetrics(ctx).recordTurn({
      text: textContent(event.message.content),
      provider: event.message.provider,
      model: event.message.model,
      ...(event.message.responseModel
        ? { responseModel: event.message.responseModel }
        : {}),
      reasoningLevel: pi.getThinkingLevel(),
      usage: {
        input: usage.input,
        output: usage.output,
        cacheRead: usage.cacheRead,
        cacheWrite: usage.cacheWrite,
        ...(usage.reasoning == null ? {} : { reasoning: usage.reasoning }),
        totalTokens: usage.totalTokens,
        cost: {
          input: usage.cost.input,
          output: usage.cost.output,
          cacheRead: usage.cost.cacheRead,
          cacheWrite: usage.cost.cacheWrite,
          total: usage.cost.total,
        },
      },
      context: ctx.getContextUsage() ?? null,
    });
  });

  pi.on("agent_settled", async (_event, ctx) => {
    if (!metricsEnabled) return;
    const runtime = ensureMetrics(ctx);
    const change = runtime.activeAttemptChange;
    let station: LifecycleStation = "unknown";
    if (change) {
      try {
        station = stationForMetrics(change, ctx.cwd);
      } catch {
        station = "unknown";
      }
    }
    runtime.settleAgent(station);
  });

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

  pi.registerCommand("ops-metrics", {
    description:
      "Local opt-in lifecycle metrics: status|on|off|report [change]|export [change]|reset confirm.",
    handler: async (args, ctx) => {
      const parts = (args ?? "").trim().split(/\s+/).filter(Boolean);
      const sub = (parts[0] ?? "status").toLowerCase();
      try {
        if (sub === "on") {
          setMetricsEnabled(metricsAgentDir, true);
          metricsEnabled = true;
          ensureMetrics(ctx);
          ctx.ui.notify(
            `Lifecycle metrics enabled (local only): ${metricsAgentDir}`,
            "info",
          );
          return;
        }
        if (sub === "off") {
          setMetricsEnabled(metricsAgentDir, false);
          metricsEnabled = false;
          ctx.ui.notify("Lifecycle metrics disabled. Existing local data kept.", "info");
          return;
        }
        if (sub === "status") {
          const data = readMetricsRecords(metricsAgentDir);
          ctx.ui.notify(
            [
              `Lifecycle metrics: ${metricsEnabled ? "enabled" : "disabled"}`,
              `Local root: ${metricsAgentDir}`,
              `Records: ${data.records.length}; files: ${data.files}; malformed skipped: ${data.malformedLines}`,
              "No prompt/source/tool content is collected; no network telemetry.",
            ].join("\n"),
            "info",
          );
          return;
        }
        if (sub === "report" || sub === "export") {
          const change = firstKebab(parts[1]);
          if (parts[1] && !change) {
            ctx.ui.notify(
              `Usage: /ops-metrics ${sub} [kebab-change]`,
              "warning",
            );
            return;
          }
          const data = readMetricsRecords(metricsAgentDir);
          const records = change
            ? data.records.filter((record) =>
                "change" in record ? record.change === change : false,
              )
            : data.records;
          if (sub === "export") {
            ctx.ui.notify(
              JSON.stringify(
                {
                  schemaVersion: 1,
                  change: change ?? null,
                  malformedLines: data.malformedLines,
                  records,
                },
                null,
                2,
              ),
              "info",
            );
            return;
          }
          ctx.ui.notify(
            formatMetricsReport(
              buildMetricsReport(data.records, {
                ...(change ? { change } : {}),
                malformedLines: data.malformedLines,
              }),
            ),
            "info",
          );
          return;
        }
        if (sub === "reset") {
          if ((parts[1] ?? "").toLowerCase() !== "confirm") {
            ctx.ui.notify(
              "Reset deletes local metrics records only. Confirm with: /ops-metrics reset confirm",
              "warning",
            );
            return;
          }
          resetMetricsData(metricsAgentDir);
          metricsRuntime = null;
          pendingShell.clear();
          ensureMetrics(ctx);
          ctx.ui.notify("Local lifecycle metrics records deleted.", "info");
          return;
        }
        ctx.ui.notify(
          "Usage: /ops-metrics status|on|off|report [change]|export [change]|reset confirm",
          "warning",
        );
      } catch (error) {
        ctx.ui.notify(
          `Metrics command failed (lifecycle unaffected): ${error instanceof Error ? error.message : String(error)}`,
          "warning",
        );
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

      if (metricsEnabled) {
        try {
          const prior = readMetricsRecords(metricsAgentDir).records;
          ensureMetrics(ctx).beginDeliver(
            change,
            stationForMetrics(change, ctx.cwd),
            hasPriorUnsuccessfulAttempt(prior, change),
          );
        } catch {
          // Metrics are fail-open; deliver still runs.
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
        try {
          metricsRuntime?.settleDeliver(stationForMetrics(change, ctx.cwd));
        } catch {
          metricsRuntime?.settleDeliver("unknown");
        }
        ctx.ui.notify(
          `No sendUserMessage — run ops-deliver for ${change} manually.\n${lines.join("\n")}`,
          "warning",
        );
      }
    },
  });
}
