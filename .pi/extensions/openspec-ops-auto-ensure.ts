/**
 * openspec-ops harness gates (Pi extension)
 *
 * 1) Auto-ensure on propose:
 *    /opsx-propose → ensure worktree via CLI → release stock propose
 *    Policy: OPENSPEC_OPS_AUTO_START=on|ask|off (default on)
 *
 * 2) Auto-review follow-up turn (independent of ensure success):
 *    /opsx-propose <kebab> → arm sticky review watch
 *    agent_settled → if proposal.md ready → sendUserMessage("/ops-review …", followUp)
 *    Ensure hard-abort → clear review watch (no zombie)
 *    Policy: OPENSPEC_OPS_AUTO_REVIEW=on|off (default on)
 *    Entrypoint: /ops-review (project prompt .pi/prompts/ops-review.md)
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
  isProposeIntent,
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
  buildOpsReviewFollowUpMessage,
  isProposalReady,
  parseAutoReviewPolicy,
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
};

export default function (pi: ExtensionAPI) {
  let active: WorkspaceState | null = null;
  /** Sticky watches for ops-review follow-up turns (change names). */
  const reviewWatches = new Set<string>();
  /** Sticky watches for orphan finish reclaim (change names). */
  const finishWatches = new Set<string>();
  /** Re-entrancy guard while settle evaluation runs async work. */
  let settleRunning = false;

  pi.on("input", async (event, ctx) => {
    // Never re-arm from extension-injected messages (e.g. followUp /ops-review)
    if (event.source === "extension") {
      return { action: "continue" };
    }

    const text = event.text ?? "";

    // ── Archive watch arm (fail-open; never finish here) ─────────────
    if (isArchiveIntent(text)) {
      const finishPolicy = parseAutoFinishPolicy(process.env.OPENSPEC_OPS_AUTO_FINISH);
      if (finishPolicy !== "off") {
        const change = parseArchiveChangeName(text);
        if (change) {
          const bin = resolveOpsBin({ projectRoot: PROJECT_ROOT });
          if (bin) {
            const whereRes = runOps(bin, ["where", change], { cwd: ctx.cwd });
            const notFound =
              whereRes.code === 5 || whereRes.json?.error?.code === "not_found";
            if (!notFound) {
              finishWatches.add(change);
              ctx.ui.notify(
                `Watching worktree for "${change}" (orphan reclaim after change inactive).`,
                "info",
              );
            }
          } else {
            ctx.ui.notify(
              "openspec-ops CLI not found; skipping post-archive worktree watch (archive continues).",
              "warning",
            );
          }
        }
      }
      return { action: "continue" };
    }

    // ── Propose: review arm (ensure-independent) + ensure ────────────
    if (!isProposeIntent(text)) {
      return { action: "continue" };
    }

    const change = parseProposeChangeName(text);
    const reviewPolicy = parseAutoReviewPolicy(process.env.OPENSPEC_OPS_AUTO_REVIEW);

    // Arm review watch before ensure; never handle propose for review reasons
    if (change && reviewPolicy === "on") {
      reviewWatches.add(change);
    }

    const ensurePolicy = parseAutoStartPolicy(process.env.OPENSPEC_OPS_AUTO_START);
    if (ensurePolicy === "off") {
      // Review may still be armed; propose continues without ensure
      return { action: "continue" };
    }

    if (!change) {
      return { action: "continue" };
    }

    const bin = resolveOpsBin({ projectRoot: PROJECT_ROOT });
    if (!bin) {
      // Ensure aborts propose → clear review watch (zombie prevention)
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
      // Propose continues (e.g. user declined create under ask) — keep review watch
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
    };

    ctx.ui.notify(
      `Workspace ready @ ${outcome.path} (${outcome.action}). Continuing propose…`,
      "info",
    );

    return { action: "continue" };
  });

  pi.on("before_agent_start", async () => {
    // Workspace path hint only — no same-turn review inject
    if (!active) return;

    return {
      message: {
        customType: "openspec-ops-workspace",
        content: [
          `Active openspec-ops workspace: change=${active.change} path=${active.path} branch=${active.branch}.`,
          `OpenSpec propose/apply/archive semantics are unchanged; workspace was ensured by harness only.`,
        ].join("\n\n"),
        display: true,
      },
    };
  });

  // ── Settle: review follow-up + orphan finish ───────────────────────
  pi.on("agent_settled", async (_event, ctx) => {
    if (settleRunning) return;
    if (reviewWatches.size === 0 && finishWatches.size === 0) return;

    settleRunning = true;
    try {
      // Review follow-up turns
      const reviewPolicy = parseAutoReviewPolicy(process.env.OPENSPEC_OPS_AUTO_REVIEW);
      if (reviewPolicy === "off") {
        reviewWatches.clear();
      } else if (reviewWatches.size > 0) {
        const roots = [PROJECT_ROOT, ctx.cwd, active?.path].filter(
          (r): r is string => Boolean(r),
        );
        // unique roots
        const uniqueRoots = [...new Set(roots.map((r) => resolve(r)))];

        for (const change of [...reviewWatches]) {
          if (!isProposalReady(change, uniqueRoots)) {
            continue; // keep watch
          }
          // One-shot: clear before send to prevent double fire
          reviewWatches.delete(change);
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
              `Skipped auto-finish for "${change}": worktree is dirty. Commit/stash or /ops-finish with consent for --force.`,
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
        };
        ctx.ui.notify(`Workspace @ ${outcome.path} (${outcome.action})`, "info");
      }
    },
  });
}
