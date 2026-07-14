import { CHANGE_NAME_RE } from "../ops-runtime/change-name.js";
import {
  METRICS_ACTIONS,
  type MetricsAction,
  type ReviewMarker,
  type StageMarker,
} from "./types.js";

const ACTION_SET = new Set<string>(METRICS_ACTIONS);
const MARKER_RE = /<!--\s*ops-metrics:(stage|review)\s+(\{[^\n]*\})\s*-->/g;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function nonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function roundNumber(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 10;
}

function parseStage(value: unknown): StageMarker | null {
  if (!isRecord(value)) return null;
  if (typeof value.change !== "string" || !CHANGE_NAME_RE.test(value.change)) {
    return null;
  }
  if (typeof value.action !== "string" || !ACTION_SET.has(value.action)) {
    return null;
  }
  if (value.round != null && !roundNumber(value.round)) return null;
  return {
    change: value.change,
    action: value.action as MetricsAction,
    ...(value.round == null ? {} : { round: value.round as number }),
  };
}

function parseReview(value: unknown): ReviewMarker | null {
  if (!isRecord(value)) return null;
  if (typeof value.change !== "string" || !CHANGE_NAME_RE.test(value.change)) {
    return null;
  }
  if (value.reviewType !== "spec" && value.reviewType !== "impl") return null;
  if (!roundNumber(value.round)) return null;
  if (!nonNegativeInteger(value.newMajors)) return null;
  if (!nonNegativeInteger(value.newMinors)) return null;
  if (!nonNegativeInteger(value.majorsFixed)) return null;
  if (typeof value.fixVerificationPassed !== "boolean") return null;
  if (
    value.verdict !== "continue" &&
    value.verdict !== "ready" &&
    value.verdict !== "needs_human"
  ) {
    return null;
  }
  return {
    change: value.change,
    reviewType: value.reviewType,
    round: value.round,
    newMajors: value.newMajors,
    newMinors: value.newMinors,
    majorsFixed: value.majorsFixed,
    fixVerificationPassed: value.fixVerificationPassed,
    verdict: value.verdict,
  };
}

/** Strictly parse metadata-only HTML markers; malformed markers are ignored. */
export function parseMetricsMarkers(text: string): {
  stages: StageMarker[];
  reviews: ReviewMarker[];
  invalidCount: number;
} {
  const stages: StageMarker[] = [];
  const reviews: ReviewMarker[] = [];
  let invalidCount = 0;
  if (!text) return { stages, reviews, invalidCount };

  for (const match of text.matchAll(MARKER_RE)) {
    const kind = match[1];
    const raw = match[2];
    try {
      const value: unknown = JSON.parse(raw ?? "");
      if (kind === "stage") {
        const marker = parseStage(value);
        if (marker) stages.push(marker);
        else invalidCount += 1;
      } else {
        const marker = parseReview(value);
        if (marker) reviews.push(marker);
        else invalidCount += 1;
      }
    } catch {
      invalidCount += 1;
    }
  }
  return { stages, reviews, invalidCount };
}

export function stageMarkerLine(marker: StageMarker): string {
  return `<!-- ops-metrics:stage ${JSON.stringify(marker)} -->`;
}

export function reviewMarkerLine(marker: ReviewMarker): string {
  return `<!-- ops-metrics:review ${JSON.stringify(marker)} -->`;
}
