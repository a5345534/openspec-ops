import type { LifecycleStation, NextActionId } from "../next-step/edges.js";
import { CHANGE_NAME_RE } from "../ops-runtime/change-name.js";
import { parseMetricsMarkers } from "./markers.js";
import {
  METRICS_SCHEMA_VERSION,
  type ActiveMetricsContext,
  type ContextSnapshot,
  type DeliverAttemptMetricRecord,
  type MetricsAction,
  type MetricsRecord,
  type RawUsage,
  type ReviewRoundMetricRecord,
  type TurnMetricRecord,
} from "./types.js";
import { createAttemptId } from "./storage.js";

export type TurnInput = {
  text: string;
  provider: string;
  model: string;
  responseModel?: string;
  reasoningLevel?: string;
  usage: RawUsage;
  context: ContextSnapshot;
};

export type RuntimeOptions = {
  sessionIdHash: string;
  enabled: () => boolean;
  append: (record: MetricsRecord) => void;
  now?: () => number;
  createId?: () => string;
  onError?: (error: unknown) => void;
};

type AttemptState = {
  attemptId: string;
  change: string;
  resume: boolean;
  startStation: LifecycleStation;
  lastError: { action: MetricsAction; code: string } | null;
  needsHuman: boolean;
  finishSucceeded: boolean;
};

function reviewTypeForAction(action: MetricsAction): "spec" | "impl" | null {
  if (action === "ops-spec-review") return "spec";
  if (action === "ops-impl-review") return "impl";
  return null;
}

function reviewKey(context: ActiveMetricsContext): string | null {
  const type = reviewTypeForAction(context.action);
  if (!type || !context.change) return null;
  return `${context.change}:${type}:${context.reviewRound ?? 1}`;
}

export class LifecycleMetricsRuntime {
  private context: ActiveMetricsContext = {
    change: null,
    action: "unknown",
    attribution: "unknown",
    reviewRound: null,
  };
  private attempt: AttemptState | null = null;
  private reviewResultSeenForContext = false;
  private readonly options: RuntimeOptions;

  constructor(options: RuntimeOptions) {
    this.options = options;
  }

  get activeContext(): ActiveMetricsContext {
    return { ...this.context };
  }

  get activeAttemptId(): string | null {
    return this.attempt?.attemptId ?? null;
  }

  get activeAttemptChange(): string | null {
    return this.attempt?.change ?? null;
  }

  private now(): number {
    return (this.options.now ?? Date.now)();
  }

  private append(record: MetricsRecord): void {
    if (!this.options.enabled()) return;
    try {
      this.options.append(record);
    } catch (error) {
      try {
        this.options.onError?.(error);
      } catch {
        // Metrics are fail-open even if the warning callback fails.
      }
    }
  }

  private flushMissingReview(nextKey: string | null = null): void {
    const key = reviewKey(this.context);
    if (
      !key ||
      key === nextKey ||
      this.reviewResultSeenForContext ||
      !this.context.change
    ) {
      return;
    }
    const reviewType = reviewTypeForAction(this.context.action);
    if (!reviewType) return;
    const record: ReviewRoundMetricRecord = {
      schemaVersion: METRICS_SCHEMA_VERSION,
      kind: "review_round",
      timestamp: this.now(),
      sessionIdHash: this.options.sessionIdHash,
      change: this.context.change,
      deliveryAttemptId: this.activeAttemptId,
      reviewType,
      round: this.context.reviewRound ?? 1,
      missing: true,
    };
    this.append(record);
    this.reviewResultSeenForContext = true;
  }

  setAction(
    change: string | null,
    action: MetricsAction,
    attribution: ActiveMetricsContext["attribution"] = "observed",
    round: number | null = null,
  ): void {
    const next: ActiveMetricsContext = {
      change,
      action,
      attribution,
      reviewRound: round,
    };
    const previousKey = reviewKey(this.context);
    const nextKey = reviewKey(next);
    this.flushMissingReview(nextKey);
    if (previousKey !== nextKey) this.reviewResultSeenForContext = false;
    this.context = next;
  }

  beginDeliver(
    change: string,
    startStation: LifecycleStation,
    resume: boolean,
  ): string | null {
    if (!this.options.enabled()) return null;
    if (this.attempt) this.settleDeliver("unknown");
    const attemptId = (this.options.createId ?? createAttemptId)();
    this.attempt = {
      attemptId,
      change,
      resume,
      startStation,
      lastError: null,
      needsHuman: false,
      finishSucceeded: false,
    };
    this.setAction(change, "ops-deliver-overhead", "observed", null);
    const record: DeliverAttemptMetricRecord = {
      schemaVersion: METRICS_SCHEMA_VERSION,
      kind: "deliver_attempt",
      event: "start",
      timestamp: this.now(),
      sessionIdHash: this.options.sessionIdHash,
      attemptId,
      change,
      resume,
      startStation,
    };
    this.append(record);
    return attemptId;
  }

  noteActionResult(action: MetricsAction, ok: boolean, errorCode?: string): void {
    if (!this.attempt) return;
    if (ok) {
      if (this.attempt.lastError?.action === action) this.attempt.lastError = null;
      if (action === "ops-finish") this.attempt.finishSucceeded = true;
      return;
    }
    this.attempt.lastError = {
      action,
      code: errorCode && /^[a-z0-9_]+$/.test(errorCode) ? errorCode : "unknown",
    };
  }

  recordTurn(input: TurnInput): void {
    if (!this.options.enabled()) return;
    const markers = parseMetricsMarkers(input.text);
    const lastStage = markers.stages.at(-1);

    for (const marker of markers.reviews) {
      const action: MetricsAction =
        marker.reviewType === "spec" ? "ops-spec-review" : "ops-impl-review";
      this.setAction(marker.change, action, "declared", marker.round);
      const record: ReviewRoundMetricRecord = {
        schemaVersion: METRICS_SCHEMA_VERSION,
        kind: "review_round",
        timestamp: this.now(),
        sessionIdHash: this.options.sessionIdHash,
        change: marker.change,
        deliveryAttemptId: this.activeAttemptId,
        reviewType: marker.reviewType,
        round: marker.round,
        missing: false,
        newMajors: marker.newMajors,
        newMinors: marker.newMinors,
        majorsFixed: marker.majorsFixed,
        fixVerificationPassed: marker.fixVerificationPassed,
        verdict: marker.verdict,
      };
      this.append(record);
      this.reviewResultSeenForContext = true;
      if (marker.verdict === "needs_human" && this.attempt) {
        this.attempt.needsHuman = true;
      }
    }

    // The last stage marker in an assistant turn owns that turn. Review markers
    // carry results but do not override a later action marker in the same turn.
    if (lastStage) {
      this.setAction(
        lastStage.change,
        lastStage.action,
        "declared",
        lastStage.round ?? null,
      );
    }

    const record: TurnMetricRecord = {
      schemaVersion: METRICS_SCHEMA_VERSION,
      kind: "turn",
      timestamp: this.now(),
      sessionIdHash: this.options.sessionIdHash,
      change: this.context.change,
      deliveryAttemptId: this.activeAttemptId,
      action: this.context.action,
      attribution: this.context.attribution,
      reviewRound: this.context.reviewRound,
      model: {
        provider: input.provider,
        id: input.model,
        ...(input.responseModel ? { responseModel: input.responseModel } : {}),
        ...(input.reasoningLevel ? { reasoningLevel: input.reasoningLevel } : {}),
      },
      usage: input.usage,
      context: input.context,
    };
    this.append(record);
  }

  settleAgent(endStation: LifecycleStation = "unknown"): void {
    this.flushMissingReview();
    if (this.attempt) this.settleDeliver(endStation);
    this.context = {
      change: null,
      action: "unknown",
      attribution: "unknown",
      reviewRound: null,
    };
    this.reviewResultSeenForContext = false;
  }

  settleDeliver(endStation: LifecycleStation): void {
    if (!this.attempt) return;
    const attempt = this.attempt;
    const settledStation: LifecycleStation =
      attempt.finishSucceeded && endStation === "unknown" ? "done" : endStation;
    let outcome: DeliverAttemptMetricRecord["outcome"] = "incomplete";
    if (settledStation === "done" || attempt.finishSucceeded) outcome = "completed";
    else if (attempt.needsHuman) outcome = "needs_human";
    else if (attempt.lastError) outcome = "hard_stop";

    const record: DeliverAttemptMetricRecord = {
      schemaVersion: METRICS_SCHEMA_VERSION,
      kind: "deliver_attempt",
      event: "settled",
      timestamp: this.now(),
      sessionIdHash: this.options.sessionIdHash,
      attemptId: attempt.attemptId,
      change: attempt.change,
      resume: attempt.resume,
      startStation: attempt.startStation,
      endStation: settledStation,
      outcome,
      hardStopAction: attempt.lastError?.action ?? null,
      errorCode: attempt.lastError?.code ?? null,
    };
    this.append(record);
    this.attempt = null;
  }
}

const SLASH_ACTIONS: Record<string, NextActionId> = {
  "ops-start": "ops-start",
  "opsx-propose": "opsx-propose",
  "ops-spec-review": "ops-spec-review",
  "opsx-apply": "opsx-apply",
  "ops-ship": "ops-ship",
  "ops-impl-review": "ops-impl-review",
  "ops-merge": "ops-merge",
  "opsx-archive": "opsx-archive",
  "ops-finish": "ops-finish",
};

export function parseLifecycleSlash(text: string): {
  action: NextActionId;
  change: string;
} | null {
  const match = String(text ?? "")
    .trim()
    .match(/^\/(ops-start|opsx-propose|ops-spec-review|opsx-apply|ops-ship|ops-impl-review|ops-merge|opsx-archive|ops-finish)\s+([^\s]+)/);
  if (!match) return null;
  const action = SLASH_ACTIONS[match[1] ?? ""];
  const change = match[2] ?? "";
  if (!action || !CHANGE_NAME_RE.test(change)) return null;
  return { action, change };
}

const SHELL_ACTIONS: Array<[RegExp, MetricsAction]> = [
  [/(?:^|[\n;&|]\s*)(?:[^\s;&|]*\/)?openspec-ops\s+start\s+/, "ops-start"],
  [/(?:^|[\n;&|]\s*)(?:[^\s;&|]*\/)?openspec-ops\s+ship\s+/, "ops-ship"],
  [/(?:^|[\n;&|]\s*)(?:[^\s;&|]*\/)?openspec-ops\s+merge\s+/, "ops-merge"],
  [/(?:^|[\n;&|]\s*)(?:[^\s;&|]*\/)?openspec-ops\s+finish\s+/, "ops-finish"],
  [/(?:^|[\n;&|]\s*)openspec\s+(?:new\s+change|new\s+)\s*/, "opsx-propose"],
  [/(?:^|[\n;&|]\s*)openspec\s+archive\s+/, "opsx-archive"],
];

export function actionFromShellCommand(command: string): MetricsAction | null {
  for (const [pattern, action] of SHELL_ACTIONS) {
    if (pattern.test(command)) return action;
  }
  return null;
}

export function changeFromShellCommand(command: string): string | null {
  const text = String(command ?? "");
  const patterns = [
    /(?:[^\s;&|]*\/)?openspec-ops\s+(?:start|ship|merge|finish)\s+["']?([a-z0-9]+(?:-[a-z0-9]+)*)["']?/,
    /openspec\s+new\s+change\s+["']?([a-z0-9]+(?:-[a-z0-9]+)*)["']?/,
    /openspec\s+archive\s+["']?([a-z0-9]+(?:-[a-z0-9]+)*)["']?/,
  ];
  for (const pattern of patterns) {
    const change = text.match(pattern)?.[1];
    if (change && CHANGE_NAME_RE.test(change)) return change;
  }
  return null;
}

function jsonObjectCandidates(text: string): string[] {
  const result: string[] = [];
  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== "{") continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < text.length; i += 1) {
      const char = text[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') inString = true;
      else if (char === "{") depth += 1;
      else if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          result.push(text.slice(start, i + 1));
          break;
        }
      }
    }
  }
  return result;
}

export function parseJsonEnvelope(text: string): {
  ok: boolean;
  errorCode?: string;
} | null {
  for (const candidate of jsonObjectCandidates(String(text ?? ""))) {
    try {
      const value: unknown = JSON.parse(candidate);
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const obj = value as Record<string, unknown>;
      if (typeof obj.ok !== "boolean") continue;
      let errorCode: string | undefined;
      if (obj.error && typeof obj.error === "object" && !Array.isArray(obj.error)) {
        const code = (obj.error as Record<string, unknown>).code;
        if (typeof code === "string") errorCode = code;
      }
      return { ok: obj.ok, ...(errorCode ? { errorCode } : {}) };
    } catch {
      // Try the next balanced object.
    }
  }
  return null;
}

export function hasPriorUnsuccessfulAttempt(
  records: MetricsRecord[],
  change: string,
): boolean {
  const latest = records
    .filter(
      (record): record is DeliverAttemptMetricRecord =>
        record.kind === "deliver_attempt" &&
        record.event === "settled" &&
        record.change === change,
    )
    .sort((a, b) => b.timestamp - a.timestamp)[0];
  return latest != null && latest.outcome !== "completed";
}
