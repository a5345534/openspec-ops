/**
 * openspec-ops harness gates (Pi extension)
 *
 * 1) Auto-ensure on propose:
 *    /opsx-propose → ensure worktree via CLI → release stock propose
 *    Policy: OPENSPEC_OPS_AUTO_START=on|ask|off (default on)
 *
 * 2) Auto-review inject (optional, after successful ensure):
 *    OPENSPEC_OPS_AUTO_REVIEW=on|off (default on)
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
 * Under policy ask without UI, orphan gate skips finish (no silent reclaim).
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

const EXT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(EXT_DIR, "../..");

type WorkspaceState = {
  change: string;
  path: string;
  branch: string;
};

type ReviewPolicy = "on" | "off";

function parseReviewPolicy(raw: string | undefined): ReviewPolicy {
  if (raw == null || raw.trim() === "") return "on";
  const v = raw.trim().toLowerCase();
  return v === "off" ? "off" : "on";
}

export default function (pi: ExtensionAPI) {
  let active: WorkspaceState | null = null;
  /** One-shot flag: propose just ran, auto-review on next before_agent_start. */
  let pendingReviewChange: string | null = null;
  /** Sticky watches for orphan finish reclaim (change names). */
  const finishWatches = new Set<string>();
  /** Re-entrancy guard while settle evaluation runs async work. */
  let settleRunning = false;

  pi.on("input", async (event, ctx) => {
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
            // Optional precheck: do not arm if worktree already gone
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
            // Missing bin: still do not block archive; skip watch
            ctx.ui.notify(
              "openspec-ops CLI not found; skipping post-archive worktree watch (archive continues).",
              "warning",
            );
          }
        }
      }
      // Always continue archive input
      // (fall through only if not also propose — archive and propose are distinct)
      return { action: "continue" };
    }

    // ── Propose ensure ───────────────────────────────────────────────
    if (!isProposeIntent(text)) {
      return { action: "continue" };
    }

    const policy = parseAutoStartPolicy(process.env.OPENSPEC_OPS_AUTO_START);
    if (policy === "off") {
      return { action: "continue" };
    }

    const change = parseProposeChangeName(text);
    if (!change) {
      return { action: "continue" };
    }

    const bin = resolveOpsBin({ projectRoot: PROJECT_ROOT });
    if (!bin) {
      ctx.ui.notify(
        "openspec-ops CLI not found (set OPENSPEC_OPS_BIN or install/link bin). Propose aborted.",
        "error",
      );
      return { action: "handled" };
    }

    const outcome = await ensureWorkspace(change, {
      bin,
      cwd: ctx.cwd,
      policy,
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

    if (parseReviewPolicy(process.env.OPENSPEC_OPS_AUTO_REVIEW) !== "off") {
      pendingReviewChange = outcome.change;
    }

    return { action: "continue" };
  });

  pi.on("before_agent_start", async () => {
    if (!active && !pendingReviewChange) return;

    const lines: string[] = [];
    if (active) {
      lines.push(
        `Active openspec-ops workspace: change=${active.change} path=${active.path} branch=${active.branch}.`,
        `OpenSpec propose/apply/archive semantics are unchanged; workspace was ensured by harness only.`,
      );
    }

    if (pendingReviewChange) {
      const change = pendingReviewChange;
      pendingReviewChange = null;
      lines.push(
        `Change "${change}" was just proposed. ` +
          `After presenting the propose results, AUTOMATICALLY run the ops-review skill on this change ` +
          `(read .pi/skills/ops-review/SKILL.md for detailed instructions) and include the review findings ` +
          `in your response. Keep findings concise: max 5, prioritized by impact. ` +
          `If propose failed and no artifacts exist, skip review.`,
      );
    }

    if (lines.length === 0) return;

    return {
      message: {
        customType: "openspec-ops-workspace",
        content: lines.join("\n\n"),
        display: true,
      },
    };
  });

  // ── Orphan finish evaluation at settle ─────────────────────────────
  pi.on("agent_settled", async (_event, ctx) => {
    if (settleRunning) return;
    if (finishWatches.size === 0) return;

    const policy = parseAutoFinishPolicy(process.env.OPENSPEC_OPS_AUTO_FINISH);
    if (policy === "off") {
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

    settleRunning = true;
    try {
      const watched = [...finishWatches];
      for (const change of watched) {
        const outcome = await evaluateWatchedChange(change, {
          bin,
          cwd: ctx.cwd,
          policy,
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
          // Keep watch so a later settle can retry; notify with code
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
