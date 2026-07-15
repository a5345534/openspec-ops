import {
  appendFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  LifecycleMetricsRuntime,
  METRICS_SCHEMA_VERSION,
  actionFromShellCommand,
  appendMetricsRecord,
  buildMetricsReport,
  changeFromShellCommand,
  formatMetricsReport,
  hashSessionId,
  hasPriorUnsuccessfulAttempt,
  metricsConfigPath,
  parseJsonEnvelope,
  parseLifecycleSlash,
  parseMetricsMarkers,
  readMetricsConfig,
  readMetricsRecords,
  resetMetricsData,
  reviewMarkerLine,
  sessionMetricsPath,
  setMetricsEnabled,
  stageMarkerLine,
  type DeliverAttemptMetricRecord,
  type MetricsRecord,
  type RawUsage,
  type ReviewRoundMetricRecord,
  type TurnMetricRecord,
} from "../src/lifecycle-metrics/index.js";

const usage = (cost = 1): RawUsage => ({
  input: 100,
  output: 20,
  cacheRead: 80,
  cacheWrite: 10,
  reasoning: 5,
  totalTokens: 210,
  cost: {
    input: cost * 0.3,
    output: cost * 0.4,
    cacheRead: cost * 0.2,
    cacheWrite: cost * 0.1,
    total: cost,
  },
});

const base = {
  schemaVersion: METRICS_SCHEMA_VERSION,
  recordId: "test-record",
  workspaceId: null,
  sessionIdHash: "abc",
  timestamp: 1,
} as const;

function turn(
  action: TurnMetricRecord["action"],
  attribution: TurnMetricRecord["attribution"],
  cost = 1,
  round: number | null = null,
): TurnMetricRecord {
  return {
    ...base,
    kind: "turn",
    change: "demo-change",
    deliveryAttemptId: null,
    action,
    attribution,
    reviewRound: round,
    model: { provider: "p", id: "m", reasoningLevel: "high" },
    usage: usage(cost),
    context: { tokens: 1000, contextWindow: 10000, percent: 10 },
  };
}

describe("lifecycle metrics markers", () => {
  it("round-trips strict stage and review markers", () => {
    const text = [
      stageMarkerLine({
        change: "demo-change",
        action: "ops-spec-review",
        round: 2,
      }),
      reviewMarkerLine({
        change: "demo-change",
        reviewType: "spec",
        round: 2,
        newMajors: 0,
        newMinors: 1,
        majorsFixed: 0,
        fixVerificationPassed: true,
        verdict: "ready",
      }),
    ].join("\n");
    const parsed = parseMetricsMarkers(text);
    expect(parsed.invalidCount).toBe(0);
    expect(parsed.stages[0]?.action).toBe("ops-spec-review");
    expect(parsed.reviews[0]?.verdict).toBe("ready");
  });

  it("ignores prose and rejects malformed or unsafe values", () => {
    const text = [
      "ops-spec-review demo-change",
      '<!-- ops-metrics:stage {"change":"../secret","action":"ops-ship"} -->',
      '<!-- ops-metrics:review {"change":"demo-change","round":1} -->',
    ].join("\n");
    const parsed = parseMetricsMarkers(text);
    expect(parsed.stages).toEqual([]);
    expect(parsed.reviews).toEqual([]);
    expect(parsed.invalidCount).toBe(2);
  });
});

describe("lifecycle metrics storage", () => {
  it("defaults disabled, persists opt-in, reads records, and skips corrupt lines", () => {
    const dir = mkdtempSync(join(tmpdir(), "ops-metrics-"));
    try {
      expect(readMetricsConfig(dir)).toEqual({ enabled: false });
      setMetricsEnabled(dir, true);
      expect(readMetricsConfig(dir)).toEqual({ enabled: true });
      expect(existsSync(metricsConfigPath(dir))).toBe(true);

      const record = turn("opsx-apply", "observed");
      appendMetricsRecord(dir, record);
      appendFileSync(
        sessionMetricsPath(dir, record.sessionIdHash),
        'not-json\n{"schemaVersion":1,"timestamp":2,"sessionIdHash":"abc","kind":"turn"}\n',
      );
      const read = readMetricsRecords(dir);
      expect(read.records).toHaveLength(1);
      expect(read.malformedLines).toBe(2);
      expect(read.files).toBe(1);

      const persisted = readFileSync(
        sessionMetricsPath(dir, record.sessionIdHash),
        "utf8",
      );
      expect(persisted).not.toContain("prompt");
      expect(persisted).not.toContain("toolResults");

      resetMetricsData(dir);
      expect(readMetricsRecords(dir).records).toEqual([]);
      expect(readMetricsConfig(dir)).toEqual({ enabled: true });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("hashes session ids without exposing them", () => {
    expect(hashSessionId("secret-session")).toMatch(/^[a-f0-9]{16}$/);
    expect(hashSessionId("secret-session")).not.toContain("secret");
  });
});

describe("lifecycle metrics reports", () => {
  it("aggregates usage by action/model and exposes attribution coverage", () => {
    const report = buildMetricsReport([
      turn("opsx-apply", "observed", 2),
      turn("unknown", "unknown", 1),
    ]);
    expect(report.usage.total.turns).toBe(2);
    expect(report.usage.byAction["opsx-apply"]?.cost).toBe(2);
    expect(report.usage.byModel["p/m"]?.turns).toBe(2);
    expect(report.usage.attributionCoverage).toBeCloseTo(0.5);
    expect(formatMetricsReport(report)).toContain("Attribution coverage: 50.0%");
  });

  it("renders an exact compact empty report with cost provenance", () => {
    expect(formatMetricsReport(buildMetricsReport([]))).toBe(
      [
        "openspec-ops lifecycle metrics",
        "Source: JSONL (authoritative); records: 0",
        "Cost: USD estimate (Pi model-registry rates x provider token usage)",
        "Note: openspec-ops aggregates Pi values; $0 may mean unavailable or zero rates.",
        "",
        "A. Usage by action",
        "(no turn records)",
        "Attribution coverage: n/a",
        "",
        "By model",
        "(no model records)",
        "",
        "B. Review round yield",
        "(no review records)",
        "",
        "C. Deliver reliability",
        "metric                                value",
        "-------------------------------  ----------",
        "attempts                                  0",
        "changes                                   0",
        "completed attempts                        0",
        "completed changes                         0",
        "first-invocation completion             n/a",
        "resumes                                   0",
        "hard stops                                0",
        "needs human                               0",
        "incomplete                                0",
      ].join("\n"),
    );
  });

  it("aligns usage totals and bounds long model labels", () => {
    const longModelTurn = turn("opsx-apply", "observed", 2);
    longModelTurn.model = {
      provider: "provider",
      id: "a-model-name-that-is-much-too-long",
    };
    const output = formatMetricsReport(buildMetricsReport([longModelTurn]));

    expect(output).toContain(
      [
        "bucket                  turns    input   output   c-read  c-write   reason    USD est.  ctx max",
        "----------------------  -----  -------  -------  -------  -------  -------  ----------  -------",
        "opsx-apply                  1      100       20       80       10        5     $2.0000    10.0%",
        "TOTAL                       1      100       20       80       10        5     $2.0000    10.0%",
      ].join("\n"),
    );
    expect(output).toContain("provider/a-model-name~");
    expect(output).not.toContain("a-model-name-that-is-much-too-long");
  });

  it("compacts oversized numeric cells without identifier-style truncation", () => {
    const output = formatMetricsReport(
      buildMetricsReport([turn("opsx-apply", "observed", 123_456_789)]),
    );

    expect(output).toContain("$1.23e+8");
    expect(output).not.toContain("$1234567~");
  });

  it("aggregates review round yield and cost", () => {
    const reviewRecords: ReviewRoundMetricRecord[] = [
      {
        ...base,
        kind: "review_round",
        change: "demo-change",
        deliveryAttemptId: null,
        reviewType: "spec",
        round: 1,
        missing: false,
        newMajors: 2,
        newMinors: 0,
        majorsFixed: 2,
        fixVerificationPassed: true,
        verdict: "continue",
      },
      {
        ...base,
        timestamp: 2,
        kind: "review_round",
        change: "demo-change",
        deliveryAttemptId: null,
        reviewType: "spec",
        round: 1,
        missing: false,
        newMajors: 0,
        newMinors: 1,
        majorsFixed: 0,
        fixVerificationPassed: true,
        verdict: "ready",
      },
      {
        ...base,
        timestamp: 3,
        kind: "review_round",
        change: "demo-change",
        deliveryAttemptId: null,
        reviewType: "impl",
        round: 2,
        missing: true,
      },
    ];
    const report = buildMetricsReport([
      turn("ops-spec-review", "declared", 4, 1),
      ...reviewRecords,
    ]);
    const spec = report.reviews.find((r) => r.reviewType === "spec");
    expect(spec?.entries).toBe(2);
    expect(spec?.newMajorRate).toBe(0.5);
    expect(spec?.readyRate).toBe(0.5);
    expect(spec?.averageCost).toBe(2);
    const impl = report.reviews.find((r) => r.reviewType === "impl");
    expect(impl?.missing).toBe(1);
    expect(impl?.newMajorRate).toBeNull();
  });

  it("aggregates deliver attempts, resumes, and hard stops", () => {
    const records: DeliverAttemptMetricRecord[] = [
      {
        ...base,
        kind: "deliver_attempt",
        event: "start",
        attemptId: "a1",
        change: "demo-change",
        resume: false,
        startStation: "no_workspace",
      },
      {
        ...base,
        timestamp: 2,
        kind: "deliver_attempt",
        event: "settled",
        attemptId: "a1",
        change: "demo-change",
        resume: false,
        startStation: "no_workspace",
        endStation: "shipped",
        outcome: "hard_stop",
        hardStopAction: "ops-impl-review",
        errorCode: "tests_failed",
      },
      {
        ...base,
        timestamp: 3,
        kind: "deliver_attempt",
        event: "start",
        attemptId: "a2",
        change: "demo-change",
        resume: true,
        startStation: "shipped",
      },
      {
        ...base,
        timestamp: 4,
        kind: "deliver_attempt",
        event: "settled",
        attemptId: "a2",
        change: "demo-change",
        resume: true,
        startStation: "shipped",
        endStation: "done",
        outcome: "completed",
      },
    ];
    const report = buildMetricsReport(records);
    expect(report.deliver.attempts).toBe(2);
    expect(report.deliver.completedChanges).toBe(1);
    expect(report.deliver.firstInvocationCompletionRate).toBe(0);
    expect(report.deliver.resumes).toBe(1);
    expect(report.deliver.hardStopDistribution["ops-impl-review:tests_failed"]).toBe(1);
    expect(hasPriorUnsuccessfulAttempt(records, "demo-change")).toBe(false);
    expect(hasPriorUnsuccessfulAttempt(records.slice(0, 2), "demo-change")).toBe(true);
    const openAttempt: DeliverAttemptMetricRecord = {
      ...base,
      timestamp: 5,
      kind: "deliver_attempt",
      event: "start",
      attemptId: "a3",
      change: "demo-change",
      resume: false,
      startStation: "unknown",
    };
    expect(hasPriorUnsuccessfulAttempt([...records, openAttempt], "demo-change")).toBe(true);
  });
});

describe("lifecycle metrics runtime", () => {
  it("records marker-attributed turns and review results", () => {
    const records: MetricsRecord[] = [];
    let now = 1;
    const runtime = new LifecycleMetricsRuntime({
      sessionIdHash: "abc",
      enabled: () => true,
      append: (record) => records.push(record),
      now: () => now++,
      createId: () => "attempt-1",
    });
    runtime.beginDeliver("demo-change", "proposed", false);
    runtime.recordTurn({
      text: [
        stageMarkerLine({
          change: "demo-change",
          action: "ops-spec-review",
          round: 1,
        }),
        reviewMarkerLine({
          change: "demo-change",
          reviewType: "spec",
          round: 1,
          newMajors: 0,
          newMinors: 1,
          majorsFixed: 0,
          fixVerificationPassed: true,
          verdict: "ready",
        }),
      ].join("\n"),
      provider: "p",
      model: "m",
      usage: usage(),
      context: null,
    });
    runtime.noteActionResult("ops-finish", true);
    runtime.settleAgent("unknown");
    const turnRecord = records.find((r): r is TurnMetricRecord => r.kind === "turn");
    expect(turnRecord?.action).toBe("ops-spec-review");
    expect(turnRecord?.attribution).toBe("declared");
    expect(records.some((r) => r.kind === "review_round")).toBe(true);
    const end = records.find(
      (r): r is DeliverAttemptMetricRecord =>
        r.kind === "deliver_attempt" && r.event === "settled",
    );
    expect(end?.outcome).toBe("completed");
    expect(end?.endStation).toBe("done");
  });

  it("records missing review summary instead of inferring", () => {
    const records: MetricsRecord[] = [];
    const runtime = new LifecycleMetricsRuntime({
      sessionIdHash: "abc",
      enabled: () => true,
      append: (record) => records.push(record),
    });
    runtime.setAction("demo-change", "ops-impl-review", "observed", 1);
    runtime.settleAgent("shipped");
    const review = records.find(
      (r): r is ReviewRoundMetricRecord => r.kind === "review_round",
    );
    expect(review?.missing).toBe(true);
  });

  it("does not carry review-result state across repeated round numbers", () => {
    const records: MetricsRecord[] = [];
    const runtime = new LifecycleMetricsRuntime({
      sessionIdHash: "abc",
      enabled: () => true,
      append: (record) => records.push(record),
    });
    runtime.setAction("demo-change", "ops-spec-review", "observed", 1);
    runtime.recordTurn({
      text: reviewMarkerLine({
        change: "demo-change",
        reviewType: "spec",
        round: 1,
        newMajors: 0,
        newMinors: 0,
        majorsFixed: 0,
        fixVerificationPassed: true,
        verdict: "ready",
      }),
      provider: "p",
      model: "m",
      usage: usage(),
      context: null,
    });
    runtime.settleAgent("proposed");

    runtime.setAction("demo-change", "ops-spec-review", "observed", 1);
    runtime.settleAgent("proposed");
    const rounds = records.filter(
      (r): r is ReviewRoundMetricRecord => r.kind === "review_round",
    );
    expect(rounds).toHaveLength(2);
    expect(rounds[0]?.missing).toBe(false);
    expect(rounds[1]?.missing).toBe(true);
  });

  it("is fail-open when append and warning callback throw", () => {
    const runtime = new LifecycleMetricsRuntime({
      sessionIdHash: "abc",
      enabled: () => true,
      append: () => {
        throw new Error("disk full");
      },
      onError: () => {
        throw new Error("ui broken");
      },
    });
    expect(() =>
      runtime.recordTurn({
        text: "",
        provider: "p",
        model: "m",
        usage: usage(),
        context: null,
      }),
    ).not.toThrow();
  });
});

describe("mechanical lifecycle recognition", () => {
  it("recognizes explicit slash and known shell actions", () => {
    expect(parseLifecycleSlash("/ops-ship demo-change")?.action).toBe("ops-ship");
    expect(parseLifecycleSlash("/ops-ship Not_Good")).toBeNull();
    expect(actionFromShellCommand("./bin/openspec-ops finish demo-change --json")).toBe("ops-finish");
    expect(
      actionFromShellCommand(
        "/opt/openspec-ops/bin/openspec-ops ship demo-change --json",
      ),
    ).toBe("ops-ship");
    expect(actionFromShellCommand("echo hi")).toBeNull();
    expect(
      changeFromShellCommand(
        "/opt/openspec-ops/bin/openspec-ops ship demo-change --json",
      ),
    ).toBe("demo-change");
  });

  it("extracts stable JSON envelope outcome without storing prose", () => {
    expect(parseJsonEnvelope('{"schemaVersion":1,"ok":true}')).toEqual({ ok: true });
    expect(
      parseJsonEnvelope(
        'log\n{"schemaVersion":1,"ok":false,"error":{"code":"checks_failed","message":"secret"}}\ntrailing shell output',
      ),
    ).toEqual({ ok: false, errorCode: "checks_failed" });
    expect(parseJsonEnvelope("not json")).toBeNull();
  });

  it("keeps metrics station probing local-only", () => {
    const source = readFileSync(
      join(process.cwd(), ".pi/extensions/openspec-ops-guided.ts"),
      "utf8",
    );
    const block = source.slice(
      source.indexOf("function localStationForMetrics"),
      source.indexOf("function textContent"),
    );
    expect(block).not.toContain("resolvePrSignals");
    expect(block).not.toContain("gh ");
  });

  it("keeps metrics and SQLite commands operator-direct with no model or network path", () => {
    const source = readFileSync(
      join(process.cwd(), ".pi/extensions/openspec-ops-guided.ts"),
      "utf8",
    );
    const block = source.slice(
      source.indexOf('pi.registerCommand("ops-metrics"'),
      source.indexOf('pi.registerCommand("ops-next"'),
    );
    expect(block).toContain('dbSub === "sync"');
    expect(block).toContain('source: "sqlite"');
    expect(block).not.toContain("sendUserMessage");
    expect(block).not.toContain("fetch(");
    expect(block).not.toContain("resolvePrSignals");
  });
});
