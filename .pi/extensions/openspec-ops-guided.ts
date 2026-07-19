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
import {
  resolveOpsBin,
  resolveOpsBinDetailed,
  runOps,
} from "../../src/ops-runtime/run-ops.js";
import { buildDeliverFollowup } from "../../src/ops-runtime/deliver-handoff.js";
import { deferFollowUpHandoff } from "../../src/ops-runtime/deferred-followup.js";
import {
  RESPONSE_LANGUAGE_ENTRY_TYPE,
  formatResponseLanguageContract,
  inferResponseLanguage,
  restoreResponseLanguage,
  type ResponseLanguage,
} from "../../src/ops-runtime/response-language.js";
import { formatOpsRuntimeBinding } from "../../src/ops-runtime/runtime-binding.js";
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
  recognizeMetricsInput,
  readMetricsConfig,
  readMetricsRecords,
  resetMetricsData,
  setMetricsEnabled,
  destroyMetricsSqlite,
  detachMetricsSqlite,
  getMetricsSqliteStatus,
  initMetricsSqlite,
  readMetricsSqlite,
  rebuildMetricsSqlite,
  resolveWorkspaceId,
  syncMetricsSqlite,
  type MetricsAction,
  type MetricsSqliteStatus,
  type MetricsSqliteSyncResult,
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

/**
 * Metrics must not trigger PR/network lookups. Return a locally provable station;
 * states that require PR knowledge (applied vs shipped vs merged) stay unknown.
 */
function localStationForMetrics(change: string, cwd: string): LifecycleStation {
  const roots = [PACKAGE_ROOT, cwd].filter(Boolean);
  let worktreeFound = false;
  const bin = resolveOpsBin({ projectRoot: PACKAGE_ROOT });
  if (bin) {
    const where = runOps(bin, ["where", change], { cwd });
    if (where.json?.ok && where.json.result) {
      const wr = where.json.result;
      worktreeFound = Boolean(wr.found);
      if (wr.path) roots.push(String(wr.path));
      if (wr.primaryPath) roots.push(String(wr.primaryPath));
    }
  }
  const local = detectLifecycleStation({
    change,
    roots: [...new Set(roots)],
    worktreeFound,
    hasOpenPr: false,
    hasMergedPr: false,
  });
  // Locally "applied" is ambiguous once a PR exists/merges; do not guess.
  return local === "applied" ? "unknown" : local;
}

function textContent(content: Array<{ type: string; text?: string }>): string {
  return content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text ?? "")
    .join("\n");
}

function unquotePath(value: string | undefined): string | undefined {
  const text = value?.trim();
  if (!text) return undefined;
  if (
    text.length >= 2 &&
    ((text.startsWith('"') && text.endsWith('"')) ||
      (text.startsWith("'") && text.endsWith("'")))
  ) {
    return text.slice(1, -1);
  }
  return text;
}

function formatSqliteStatus(status: MetricsSqliteStatus): string {
  const sync = status.lastSyncAt == null
    ? "never"
    : new Date(status.lastSyncAt).toISOString();
  return [
    `SQLite feature: ${status.available ? "available" : "unavailable"}`,
    `Configured: ${status.configured ? "yes" : "no"}`,
    `Path: ${status.path ?? "(none)"}`,
    `Exists: ${status.exists ? "yes" : "no"}; compatible: ${status.compatible == null ? "unknown" : status.compatible ? "yes" : "no"}`,
    `Rows: ${status.rows ?? "unknown"}; last sync: ${sync}`,
    ...(status.reason ? [`Status: ${status.reason}`] : []),
  ].join("\n");
}

function formatSqliteSync(result: MetricsSqliteSyncResult, verb = "synchronized"): string {
  return [
    `SQLite metrics ${verb}: ${result.path}`,
    `Scanned: ${result.scanned}; inserted: ${result.inserted}; duplicates: ${result.duplicates}`,
    `Legacy: ${result.legacy}; malformed/read warnings: ${result.malformed}`,
  ].join("\n");
}

export default function (pi: ExtensionAPI) {
  let active: WorkspaceState | null = null;
  const opsRuntime = resolveOpsBinDetailed({ projectRoot: PACKAGE_ROOT });
  if (opsRuntime.ok && !process.env.OPENSPEC_OPS_BIN) {
    // Session-local handoff: descendants inherit the same package-affine CLI.
    process.env.OPENSPEC_OPS_BIN = opsRuntime.path;
  }
  const opsRuntimeBlock = opsRuntime.ok
    ? formatOpsRuntimeBinding(opsRuntime)
    : `openspec-ops runtime unavailable: ${opsRuntime.message}`;
  const metricsAgentDir = getAgentDir();
  let metricsEnabled = readMetricsConfig(metricsAgentDir).enabled;
  let responseLanguage: ResponseLanguage | null = null;
  let metricsRuntime: LifecycleMetricsRuntime | null = null;
  let metricsWarned = false;
  const pendingShell = new Map<
    string,
    { action: MetricsAction; change: string | null }
  >();

  const ensureMetrics = (ctx: {
    cwd: string;
    sessionManager: { getSessionId(): string };
    ui: { notify(message: string, level?: "info" | "warning" | "error"): void };
  }): LifecycleMetricsRuntime => {
    if (metricsRuntime) return metricsRuntime;
    metricsRuntime = new LifecycleMetricsRuntime({
      sessionIdHash: hashSessionId(ctx.sessionManager.getSessionId()),
      workspaceId: () => resolveWorkspaceId(ctx.cwd),
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

  const observeOperatorLanguage = (text: string): void => {
    const next = inferResponseLanguage(text, responseLanguage);
    if (!next || next === responseLanguage) return;
    responseLanguage = next;
    pi.appendEntry(RESPONSE_LANGUAGE_ENTRY_TYPE, { language: next });
  };

  pi.on("session_start", async (_event, ctx) => {
    responseLanguage = restoreResponseLanguage(ctx.sessionManager.getEntries());
    metricsEnabled = readMetricsConfig(metricsAgentDir).enabled;
    metricsRuntime = null;
    metricsWarned = false;
    pendingShell.clear();
    ensureMetrics(ctx);
  });

  pi.on("input", async (event, ctx) => {
    if (event.source !== "extension") observeOperatorLanguage(event.text);
    if (!metricsEnabled) return { action: "continue" as const };
    const parsed = recognizeMetricsInput(event.text);
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
        station = localStationForMetrics(change, ctx.cwd);
      } catch {
        station = "unknown";
      }
    }
    runtime.settleAgent(station);
  });

  pi.on("before_agent_start", async () => {
    const configBlock = formatConfigInjection(process.env);
    const languageBlock = formatResponseLanguageContract(responseLanguage);
    if (!active) {
      return {
        message: {
          customType: "openspec-ops-config",
          content: `${opsRuntimeBlock}\n\n${configBlock}\n\n${languageBlock}`,
          display: false,
        },
      };
    }
    const lines = [
      `Active openspec-ops workspace: change=${active.change} path=${active.path} branch=${active.branch} mode=${active.mode}.`,
      `REQUIRED: Prefer workspace path ${active.path} for change "${active.change}" (tool cwd or cd). start does NOT switch process cwd.`,
      opsRuntimeBlock,
      configBlock,
      languageBlock,
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
      if (!opsRuntime.ok) {
        ctx.ui.notify(opsRuntime.message, "error");
        return;
      }
      const res = runOps(opsRuntime.path, ["start", change], { cwd: ctx.cwd });
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
      "Local opt-in metrics plus optional SQLite projection: status|on|off|report|export|reset|db.",
    handler: async (args, ctx) => {
      const raw = (args ?? "").trim();
      const parts = raw.split(/\s+/).filter(Boolean);
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
          const sqlite = await getMetricsSqliteStatus(metricsAgentDir);
          ctx.ui.notify(
            [
              `Lifecycle metrics: ${metricsEnabled ? "enabled" : "disabled"}`,
              `Local root: ${metricsAgentDir}`,
              `Records: ${data.records.length}; files: ${data.files}; legacy: ${data.legacyRecords}; malformed skipped: ${data.malformedLines}`,
              `SQLite: ${sqlite.configured ? sqlite.path : "not configured"} (${sqlite.available ? "available" : "unavailable"})`,
              "No prompt/source/tool content is collected; no network telemetry.",
            ].join("\n"),
            "info",
          );
          return;
        }
        if (sub === "db") {
          const dbSub = (parts[1] ?? "status").toLowerCase();
          if (dbSub === "status" && parts.length <= 2) {
            ctx.ui.notify(
              formatSqliteStatus(await getMetricsSqliteStatus(metricsAgentDir)),
              "info",
            );
            return;
          }
          if (dbSub === "init") {
            const match = raw.match(/^db\s+init(?:\s+([\s\S]+))?$/i);
            if (!match) {
              ctx.ui.notify("Usage: /ops-metrics db init [absolute-local-path]", "warning");
              return;
            }
            const path = unquotePath(match[1]);
            const status = await initMetricsSqlite(metricsAgentDir, path);
            ctx.ui.notify(
              `SQLite projection initialized/attached without syncing.\n${formatSqliteStatus(status)}\nRun: /ops-metrics db sync`,
              "info",
            );
            return;
          }
          if (dbSub === "sync" && parts.length === 2) {
            ctx.ui.notify(
              formatSqliteSync(await syncMetricsSqlite(metricsAgentDir)),
              "info",
            );
            return;
          }
          if (dbSub === "rebuild") {
            if ((parts[2] ?? "").toLowerCase() !== "confirm" || parts.length !== 3) {
              ctx.ui.notify(
                "Rebuild clears only the SQLite projection, then re-ingests retained JSONL. Confirm with: /ops-metrics db rebuild confirm",
                "warning",
              );
              return;
            }
            ctx.ui.notify(
              formatSqliteSync(
                await rebuildMetricsSqlite(metricsAgentDir, true),
                "rebuilt",
              ),
              "info",
            );
            return;
          }
          if (dbSub === "detach" && parts.length === 2) {
            const path = detachMetricsSqlite(metricsAgentDir);
            ctx.ui.notify(
              path
                ? `SQLite projection detached; database kept: ${path}`
                : "No SQLite projection was configured.",
              "info",
            );
            return;
          }
          if (dbSub === "destroy") {
            if ((parts[2] ?? "").toLowerCase() !== "confirm" || parts.length !== 3) {
              ctx.ui.notify(
                "Destroy deletes only the compatible configured SQLite projection. Confirm with: /ops-metrics db destroy confirm",
                "warning",
              );
              return;
            }
            const result = await destroyMetricsSqlite(metricsAgentDir, true);
            ctx.ui.notify(
              `${result.deleted ? "Deleted" : "Detached missing"} SQLite projection: ${result.path}. JSONL kept.`,
              "info",
            );
            return;
          }
          ctx.ui.notify(
            "Usage: /ops-metrics db status|init [absolute-local-path]|sync|rebuild confirm|detach|destroy confirm",
            "warning",
          );
          return;
        }
        if (sub === "report") {
          const sqliteSource = (parts[1] ?? "").toLowerCase() === "--source";
          if (sqliteSource) {
            if ((parts[2] ?? "").toLowerCase() !== "sqlite" || parts.length > 4) {
              ctx.ui.notify(
                "Usage: /ops-metrics report --source sqlite [kebab-change]",
                "warning",
              );
              return;
            }
            const change = firstKebab(parts[3]);
            if (parts[3] && !change) {
              ctx.ui.notify(
                "Usage: /ops-metrics report --source sqlite [kebab-change]",
                "warning",
              );
              return;
            }
            const data = await readMetricsSqlite(metricsAgentDir);
            ctx.ui.notify(
              formatMetricsReport(
                buildMetricsReport(data.records, {
                  ...(change ? { change } : {}),
                  malformedLines: data.malformedLines,
                  source: "sqlite",
                  projection: {
                    rows: data.rows,
                    lastSyncAt: data.lastSyncAt,
                  },
                }),
              ),
              "info",
            );
            return;
          }
          const change = firstKebab(parts[1]);
          if ((parts[1] && !change) || parts.length > 2) {
            ctx.ui.notify("Usage: /ops-metrics report [kebab-change]", "warning");
            return;
          }
          const data = readMetricsRecords(metricsAgentDir);
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
        if (sub === "export") {
          const change = firstKebab(parts[1]);
          if ((parts[1] && !change) || parts.length > 2) {
            ctx.ui.notify("Usage: /ops-metrics export [kebab-change]", "warning");
            return;
          }
          const data = readMetricsRecords(metricsAgentDir);
          const records = change
            ? data.records.filter((record) => record.change === change)
            : data.records;
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
        if (sub === "reset") {
          if ((parts[1] ?? "").toLowerCase() !== "confirm" || parts.length !== 2) {
            ctx.ui.notify(
              "Reset deletes JSONL metrics records only (SQLite is untouched). Confirm with: /ops-metrics reset confirm",
              "warning",
            );
            return;
          }
          resetMetricsData(metricsAgentDir);
          metricsRuntime = null;
          pendingShell.clear();
          ensureMetrics(ctx);
          ctx.ui.notify("Local JSONL lifecycle metrics records deleted; SQLite untouched.", "info");
          return;
        }
        ctx.ui.notify(
          "Usage: /ops-metrics status|on|off|report [change]|report --source sqlite [change]|export [change]|reset confirm|db …",
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

      const bin = opsRuntime.ok ? opsRuntime.path : null;
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
        deferFollowUpHandoff({
          message: opt.command,
          send: (message, sendOptions) =>
            pi.sendUserMessage(message, sendOptions),
          onAccepted: () =>
            ctx.ui.notify(`Queued follow-up: ${opt.command}`, "info"),
          onRejected: (error) =>
            ctx.ui.notify(
              `Follow-up was not queued: ${opt.command}. ${error.message}`,
              "error",
            ),
        });
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

      if (!opsRuntime.ok) {
        ctx.ui.notify(
          `Cannot schedule ops-deliver: ${opsRuntime.message}`,
          "error",
        );
        return;
      }

      if (metricsEnabled) {
        try {
          const prior = readMetricsRecords(metricsAgentDir).records;
          ensureMetrics(ctx).beginDeliver(
            change,
            localStationForMetrics(change, ctx.cwd),
            hasPriorUnsuccessfulAttempt(prior, change),
          );
        } catch {
          // Metrics are fail-open; deliver still runs.
        }
      }

      if (rest) observeOperatorLanguage(rest);
      const followup = buildDeliverFollowup({
        change,
        ...(rest ? { objective: rest } : {}),
        runtime: opsRuntime,
        responseLanguageContract: formatResponseLanguageContract(responseLanguage),
      });

      if (typeof pi.sendUserMessage === "function") {
        deferFollowUpHandoff({
          message: followup,
          send: (message, sendOptions) =>
            pi.sendUserMessage(message, sendOptions),
          onAccepted: () =>
            ctx.ui.notify(`ops-deliver queued for ${change}`, "info"),
          onRejected: (error) => {
            try {
              metricsRuntime?.settleDeliver(
                localStationForMetrics(change, ctx.cwd),
              );
            } catch {
              metricsRuntime?.settleDeliver("unknown");
            }
            ctx.ui.notify(
              `ops-deliver was not queued for ${change}: ${error.message}`,
              "error",
            );
          },
        });
      } else {
        try {
          metricsRuntime?.settleDeliver(localStationForMetrics(change, ctx.cwd));
        } catch {
          metricsRuntime?.settleDeliver("unknown");
        }
        ctx.ui.notify(
          `No sendUserMessage — run ops-deliver for ${change} manually.\n${followup}`,
          "warning",
        );
      }
    },
  });
}
