import type { LifecycleStation, NextActionId } from "../next-step/edges.js";

export const METRICS_SCHEMA_VERSION = 1 as const;

export type MetricsAction = NextActionId | "ops-deliver-overhead" | "unknown";
export type AttributionSource = "observed" | "declared" | "unknown";
export type ReviewType = "spec" | "impl";
export type ReviewVerdict = "continue" | "ready" | "needs_human";
export type DeliverOutcome =
  | "completed"
  | "hard_stop"
  | "needs_human"
  | "incomplete";

export type RawUsage = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  reasoning?: number;
  totalTokens: number;
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
};

export type ContextSnapshot = {
  tokens: number | null;
  contextWindow: number;
  percent: number | null;
} | null;

type BaseRecord = {
  schemaVersion: typeof METRICS_SCHEMA_VERSION;
  timestamp: number;
  sessionIdHash: string;
};

export type TurnMetricRecord = BaseRecord & {
  kind: "turn";
  change: string | null;
  deliveryAttemptId: string | null;
  action: MetricsAction;
  attribution: AttributionSource;
  reviewRound: number | null;
  model: {
    provider: string;
    id: string;
    responseModel?: string;
    reasoningLevel?: string;
  };
  usage: RawUsage;
  context: ContextSnapshot;
};

export type ReviewRoundMetricRecord = BaseRecord & {
  kind: "review_round";
  change: string;
  deliveryAttemptId: string | null;
  reviewType: ReviewType;
  round: number;
  missing: boolean;
  newMajors?: number;
  newMinors?: number;
  majorsFixed?: number;
  fixVerificationPassed?: boolean;
  verdict?: ReviewVerdict;
};

export type DeliverAttemptMetricRecord = BaseRecord & {
  kind: "deliver_attempt";
  event: "start" | "settled";
  attemptId: string;
  change: string;
  resume: boolean;
  startStation: LifecycleStation;
  endStation?: LifecycleStation;
  outcome?: DeliverOutcome;
  hardStopAction?: MetricsAction | null;
  errorCode?: string | null;
};

export type MetricsRecord =
  | TurnMetricRecord
  | ReviewRoundMetricRecord
  | DeliverAttemptMetricRecord;

export type StageMarker = {
  change: string;
  action: MetricsAction;
  round?: number;
};

export type ReviewMarker = {
  change: string;
  reviewType: ReviewType;
  round: number;
  newMajors: number;
  newMinors: number;
  majorsFixed: number;
  fixVerificationPassed: boolean;
  verdict: ReviewVerdict;
};

export type ActiveMetricsContext = {
  change: string | null;
  action: MetricsAction;
  attribution: AttributionSource;
  reviewRound: number | null;
};

export const METRICS_ACTIONS: readonly MetricsAction[] = [
  "ops-start",
  "opsx-propose",
  "ops-spec-review",
  "opsx-apply",
  "ops-ship",
  "ops-impl-review",
  "ops-merge",
  "opsx-archive",
  "ops-finish",
  "stop",
  "ops-deliver-overhead",
  "unknown",
] as const;
