/**
 * openspec-ops harness gates (Pi extension)
 *
 * 1) Auto-ensure on propose:
 *    /opsx-propose → ensure worktree via CLI → release stock propose
 *    Policy: OPENSPEC_OPS_AUTO_START=on|ask|off (default on)
 *
 * 2) Auto-review follow-up turn (independent of ensure success):
 *    /opsx-propose <kebab> → arm sticky review watch
 *    agent_settled → if proposal.md ready → sendUserMessage("/ops-spec-review …", followUp)
 *    Full iterative review-fix loop (edits artifacts); not read-only
 *    Ensure hard-abort → clear review watch (no zombie)
 *    Policy: OPENSPEC_OPS_AUTO_REVIEW=on|off (default on)
 *    Entrypoint: /ops-spec-review (skill/prompt ops-spec-review)
 *    max rounds: /ops-config set spec-review.max-rounds | env OPENSPEC_OPS_SPEC_REVIEW_MAX_ROUNDS | 3
 *
 * 3) Auto-finish orphan reclaim (post-archive watch):
 *    /opsx-archive <kebab> → arm sticky watch (never finish at input)
 *    agent_settled → where; if orphan (found, !dirty, !changeDirExists) →
 *      ask: confirm → finish | on: finish | never --force
 *    Policy: OPENSPEC_OPS_AUTO_FINISH=ask|on|off (default ask)
 *    Fail-open for archive path (never handled archive input)
 *
 * Binary: OPENSPEC_OPS_BIN → PATH → <project>/bin/openspec-ops
 *
 * Spike (Pi): agent_settled handlers receive ExtensionContext with hasUI + ui.confirm.
 * sendUserMessage(…, { deliverAs: "followUp" }) schedules a new turn after settle.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ensureWorkspace,
  isApplyIntent,
  isPathInside,
  isProposeIntent,
  parseApplyChangeName,
  parseAutoStartPolicy,
  parseProposeChangeName,
  resolveOpsBin,
  runOps,
} from "../../src/auto-ensure/index.js";
import {
  evaluateWatchedChange,
  isArchiveIntent,
  parseArchiveChangeName,
  parseAutoFinishPolicy,
} from "../../src/auto-finish/index.js";
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
  buildOpsReviewFollowUpMessage,
  discoverReadyProposalChanges,
  isAutoReviewEligible,
  parseAutoReviewPolicy,
  selectReviewFollowUps,
} from "../../src/auto-review/index.js";
import { resolvePackageRoot } from "../../src/package-root.js";

const EXT_DIR = dirname(fileURLToPath(import.meta.url));
/** Package root (works for project checkout and pi install git: clone). */
const PACKAGE_ROOT = resolvePackageRoot(EXT_DIR);
/** @deprecated alias — same as package root for bin resolution */
const PROJECT_ROOT = PACKAGE_ROOT;

type WorkspaceState = {
  change: string;
  path: string;
  branch: string;
  /** propose | apply | archive — shapes REQUIRED handoff text */
  mode: "propose" | "apply" | "archive";
};

export default function (pi: ExtensionAPI) {
  let active: WorkspaceState | null = null;
  /** Sticky watches for ops-spec-review follow-up turns (slash-armed names). */
  const reviewWatches = new Set<string>();
  /** One-shot: review follow-ups already scheduled this session. */
  const reviewScheduled = new Set<string>();
  /** Sticky watches for orphan finish reclaim (change names). */
  const finishWatches = new Set<string>();
  /** Re-entrancy guard while settle evaluation runs async work. */
  let settleRunning = false;

  pi.on("input", async (event, ctx) => {
    // Never re-arm from extension-injected messages (e.g. followUp /ops-spec-review)
    if (event.source === "extension") {
      return { action: "continue" };
    }

    const text = event.text ?? "";

    // ── Archive: path handoff (always when possible) + finish watch ──
    // Handoff is independent of AUTO_FINISH; finish watch respects policy.
    // Never block archive (always continue).
    if (isArchiveIntent(text)) {
      const change = parseArchiveChangeName(text);
      const finishPolicy = parseAutoFinishPolicy(process.env.OPENSPEC_OPS_AUTO_FINISH);
      const bin = resolveOpsBin({ projectRoot: PROJECT_ROOT });

      if (change) {
        if (bin) {
          const whereRes = runOps(bin, ["where", change], { cwd: ctx.cwd });
          const notFound =
            whereRes.code === 5 || whereRes.json?.error?.code === "not_found";
          if (!notFound && whereRes.json?.ok) {
            const wtPath = String(whereRes.json.result?.path ?? "");
            const changeDirPath = String(whereRes.json.result?.changeDirPath ?? "");
            // Prefer W only when active changeDir lives under worktree (pre-merge).
            // Never block primary/mainline archive after merge.
            if (
              wtPath &&
              changeDirPath &&
              isPathInside(wtPath, changeDirPath)
            ) {
              active = {
                change,
                path: wtPath,
                branch: String(whereRes.json.result?.branch ?? change),
                mode: "archive",
              };
              ctx.ui.notify(
                `Archive handoff: change dir is under worktree ${wtPath} — prefer that cwd for archive ops. Default loop after merge archives on mainline checkout (primary); worktree existence alone must not block primary archive.`,
                "info",
              );
            }
            if (finishPolicy !== "off") {
              finishWatches.add(change);
              ctx.ui.notify(
                `Watching worktree for "${change}" (orphan reclaim after change inactive).`,
                "info",
              );
            }
          }
        } else if (finishPolicy !== "off") {
          ctx.ui.notify(
            "openspec-ops CLI not found; skipping post-archive worktree watch (archive continues).",
            "warning",
          );
        }
      }
      return { action: "continue" };
    }

    // ── Apply: where/start + REQUIRED path (fail-closed when alignment required)
    if (isApplyIntent(text)) {
      const change = parseApplyChangeName(text);
      if (!change) {
        ctx.ui.notify(
          "No kebab change name on apply; worktree binding waits until a name is known.",
          "info",
        );
        return { action: "continue" };
      }
      const ensurePolicy = parseAutoStartPolicy(process.env.OPENSPEC_OPS_AUTO_START);
      if (ensurePolicy === "off") {
        return { action: "continue" };
      }
      const bin = resolveOpsBin({ projectRoot: PROJECT_ROOT });
      if (!bin) {
        ctx.ui.notify(
          "openspec-ops CLI not found (set OPENSPEC_OPS_BIN or install/link bin). Apply aborted (alignment required).",
          "error",
        );
        return { action: "handled" };
      }
      const outcome = await ensureWorkspace(change, {
        bin,
        cwd: ctx.cwd,
        policy: ensurePolicy,
        confirmCreate: async (ch) => {
          if (!ctx.hasUI) return false;
          return Boolean(
            await ctx.ui.confirm(
              "Create worktree?",
              `Create/reuse openspec-ops worktree for "${ch}" before apply?`,
            ),
          );
        },
      });
      if (outcome.status === "skipped") {
        if (outcome.reason === "user_declined") {
          ctx.ui.notify("Skipping worktree. Apply will use current directory.", "info");
        }
        return { action: "continue" };
      }
      if (outcome.status === "error") {
        ctx.ui.notify(
          `Workspace ensure failed (${outcome.code}): ${outcome.message}. Apply aborted.`,
          "error",
        );
        return { action: "handled" };
      }
      active = {
        change: outcome.change,
        path: outcome.path,
        branch: outcome.branch,
        mode: "apply",
      };
      ctx.ui.notify(
        `Workspace ready @ ${outcome.path} (${outcome.action}). Continuing apply…`,
        "info",
      );
      return { action: "continue" };
    }

    // ── Propose: review arm + ensure ─────────────────────────────────
    if (!isProposeIntent(text)) {
      return { action: "continue" };
    }

    const change = parseProposeChangeName(text);
    const reviewPolicy = parseAutoReviewPolicy(process.env.OPENSPEC_OPS_AUTO_REVIEW);

    if (change && reviewPolicy === "on") {
      reviewWatches.add(change);
    }

    if (!change) {
      ctx.ui.notify(
        "No kebab change name on propose; worktree ensure/write alignment waits until a name is known (e.g. openspec new change).",
        "info",
      );
      return { action: "continue" };
    }

    const ensurePolicy = parseAutoStartPolicy(process.env.OPENSPEC_OPS_AUTO_START);
    if (ensurePolicy === "off") {
      return { action: "continue" };
    }

    const bin = resolveOpsBin({ projectRoot: PROJECT_ROOT });
    if (!bin) {
      reviewWatches.delete(change);
      ctx.ui.notify(
        "openspec-ops CLI not found (set OPENSPEC_OPS_BIN or install/link bin). Propose aborted.",
        "error",
      );
      return { action: "handled" };
    }

    const outcome = await ensureWorkspace(change, {
      bin,
      cwd: ctx.cwd,
      policy: ensurePolicy,
      confirmCreate: async (ch) => {
        if (!ctx.hasUI) return false;
        return Boolean(
          await ctx.ui.confirm(
            "Create worktree?",
            `Create/reuse openspec-ops worktree for "${ch}" before propose?`,
          ),
        );
      },
    });

    if (outcome.status === "skipped") {
      if (outcome.reason === "user_declined") {
        ctx.ui.notify("Skipping worktree. Propose will use current directory.", "info");
      }
      return { action: "continue" };
    }

    if (outcome.status === "error") {
      reviewWatches.delete(change);
      ctx.ui.notify(
        `Workspace ensure failed (${outcome.code}): ${outcome.message}. Propose aborted.`,
        "error",
      );
      return { action: "handled" };
    }

    active = {
      change: outcome.change,
      path: outcome.path,
      branch: outcome.branch,
      mode: "propose",
    };

    ctx.ui.notify(
      `Workspace ready @ ${outcome.path} (${outcome.action}). Continuing propose…`,
      "info",
    );

    return { action: "continue" };
  });

  pi.on("before_agent_start", async () => {
    const configBlock = formatConfigInjection(process.env);

    // Workspace path handoff — REQUIRED write root (ensure does not chdir)
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
    ];
    if (active.mode === "archive") {
      lines.push(
        `REQUIRED (pre-merge): Prefer workspace path ${active.path} for archive-related OpenSpec ops for change "${active.change}" because the active change dir is under this worktree.`,
        `Default delivery order is merge → archive on mainline checkout (often primary) → finish. Do NOT block primary/mainline archive solely because a worktree still exists after merge.`,
      );
    } else if (active.mode === "apply") {
      lines.push(
        `REQUIRED: Implementation file writes and OpenSpec CLI for change "${active.change}" MUST use workspace path ${active.path} (tool cwd or cd).`,
      );
    } else {
      lines.push(
        `REQUIRED: All OpenSpec change artifact writes and preferred implementation writes for change "${active.change}" MUST use workspace path ${active.path} (e.g. tool cwd or cd). Do NOT write openspec/changes/${active.change}/ only under the primary checkout.`,
      );
    }
    lines.push(
      `Note: ensure/start does NOT switch the process cwd by itself. OpenSpec propose/apply/archive semantics are unchanged; workspace was ensured by harness only.`,
      configBlock,
    );

    // One-shot handoff: clear after inject so later turns do not re-assert stale mode
    const content = lines.join("\n\n");
    active = null;

    return {
      message: {
        customType: "openspec-ops-workspace",
        content,
        display: true,
      },
    };
  });

  // ── Settle: review follow-up + orphan finish ───────────────────────
  pi.on("agent_settled", async (_event, ctx) => {
    if (settleRunning) return;

    settleRunning = true;
    try {
      // Drop any leftover active binding after the turn (handoff already one-shot)
      active = null;
      // Review follow-up: slash watches + settle-time discovery (no slash name required)
      const reviewPolicy = parseAutoReviewPolicy(process.env.OPENSPEC_OPS_AUTO_REVIEW);
      if (reviewPolicy === "off") {
        reviewWatches.clear();
      } else {
        const roots = [PROJECT_ROOT, ctx.cwd, active?.path].filter(
          (r): r is string => Boolean(r),
        );
        const uniqueRoots = [...new Set(roots.map((r) => resolve(r)))];

        // Clear watches that are no longer pre-apply eligible (e.g. all tasks done)
        for (const w of [...reviewWatches]) {
          if (!isAutoReviewEligible(w, uniqueRoots)) {
            reviewWatches.delete(w);
          }
        }

        const candidates = new Set<string>([
          ...reviewWatches,
          ...discoverReadyProposalChanges(uniqueRoots),
        ]);
        const ready = [...candidates].filter((c) =>
          isAutoReviewEligible(c, uniqueRoots),
        );
        const toFire = selectReviewFollowUps(ready, reviewScheduled);

        for (const change of toFire) {
          reviewWatches.delete(change);
          reviewScheduled.add(change);
          const msg = buildOpsReviewFollowUpMessage(change);
          try {
            if (typeof pi.sendUserMessage !== "function") {
              ctx.ui.notify(
                `Auto-review: sendUserMessage unavailable; run ${msg} manually.`,
                "warning",
              );
              continue;
            }
            pi.sendUserMessage(msg, { deliverAs: "followUp" });
            ctx.ui.notify(
              `Auto-review: scheduled follow-up turn (${msg}).`,
              "info",
            );
          } catch (err) {
            const m = err instanceof Error ? err.message : String(err);
            ctx.ui.notify(
              `Auto-review: failed to schedule follow-up (${m}). Run ${msg} manually.`,
              "warning",
            );
          }
        }
      }

      // Orphan finish evaluation
      if (finishWatches.size === 0) return;

      const finishPolicy = parseAutoFinishPolicy(process.env.OPENSPEC_OPS_AUTO_FINISH);
      if (finishPolicy === "off") {
        finishWatches.clear();
        return;
      }

      const bin = resolveOpsBin({ projectRoot: PROJECT_ROOT });
      if (!bin) {
        ctx.ui.notify(
          "openspec-ops CLI not found; cannot reclaim watched worktrees (archive unaffected).",
          "warning",
        );
        return;
      }

      const watched = [...finishWatches];
      for (const change of watched) {
        const outcome = await evaluateWatchedChange(change, {
          bin,
          cwd: ctx.cwd,
          policy: finishPolicy,
          hasUI: ctx.hasUI,
          confirmFinish: async (ch, path, branch) => {
            if (!ctx.hasUI) return false;
            return Boolean(
              await ctx.ui.confirm(
                "Remove worktree?",
                `Change "${ch}" is no longer active. Remove worktree at ${path}? Branch ${branch} will be kept.`,
              ),
            );
          },
        });

        if (outcome.kind === "finished") {
          finishWatches.delete(change);
          ctx.ui.notify(
            `Removed worktree for "${change}" @ ${outcome.path}. Branch ${outcome.branch} kept. (Not OpenSpec archive.)`,
            "info",
          );
          if (active?.change === change) active = null;
          continue;
        }

        if (outcome.kind === "declined") {
          finishWatches.delete(change);
          ctx.ui.notify(`Kept worktree for "${change}" (cleanup declined).`, "info");
          continue;
        }

        if (outcome.kind === "finish_error") {
          ctx.ui.notify(
            `Finish failed for "${change}" (${outcome.code}): ${outcome.message}. Archive unaffected.`,
            "error",
          );
          continue;
        }

        const d = outcome.decision;
        switch (d.action) {
          case "keep_watch":
            break;
          case "clear_skip":
            finishWatches.delete(change);
            if (d.reason === "ask_no_ui") {
              ctx.ui.notify(
                `Skipped auto-finish for "${change}" (no UI for confirm). Use /ops-finish manually.`,
                "info",
              );
            }
            break;
          case "notify_dirty_clear":
            finishWatches.delete(change);
            ctx.ui.notify(
              `Skipped auto-finish for "${change}": worktree is dirty. ` +
                `Next: commit/push/PR on this branch (ops-ship when available), or ` +
                `openspec-ops finish ${change} --force only with explicit consent. ` +
                `Auto-finish never commits or merges.`,
              "warning",
            );
            break;
          case "notify_where_error":
            ctx.ui.notify(
              `where failed for watched "${change}" (${d.code}): ${d.message}. Watch kept.`,
              "warning",
            );
            break;
          default:
            break;
        }
      }
    } finally {
      settleRunning = false;
    }
  });

  // Explicit manual start (does not fork propose)
  pi.registerCommand("ops-start", {
    description: "Create/reuse worktree via openspec-ops start (manual)",
    handler: async (args, ctx) => {
      const change = (args ?? "").trim().split(/\s+/)[0] ?? "";
      if (!change) {
        ctx.ui.notify("Usage: /ops-start <change>", "warning");
        return;
      }
      const bin = resolveOpsBin({ projectRoot: PROJECT_ROOT });
      if (!bin) {
        ctx.ui.notify("openspec-ops CLI not found", "error");
        return;
      }
      const outcome = await ensureWorkspace(change, {
        bin,
        cwd: ctx.cwd,
        policy: "on",
      });
      if (outcome.status === "error") {
        ctx.ui.notify(`${outcome.code}: ${outcome.message}`, "error");
        return;
      }
      if (outcome.status === "ok") {
        active = {
          change: outcome.change,
          path: outcome.path,
          branch: outcome.branch,
          mode: "propose",
        };
        ctx.ui.notify(`Workspace @ ${outcome.path} (${outcome.action})`, "info");
      }
    },
  });

  // Session config (no project config files)
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
}
