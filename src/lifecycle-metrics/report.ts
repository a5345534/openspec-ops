import type {
  DeliverAttemptMetricRecord,
  MetricsAction,
  MetricsRecord,
  ReviewRoundMetricRecord,
  ReviewType,
  TurnMetricRecord,
} from "./types.js";

export type UsageAggregate = {
  turns: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  reasoning: number;
  cost: number;
  maxContextPercent: number | null;
};

export type ReviewRoundAggregate = {
  reviewType: ReviewType;
  round: number;
  entries: number;
  missing: number;
  cost: number;
  averageCost: number;
  newMajorRate: number | null;
  readyRate: number | null;
};

export type DeliverAggregate = {
  attempts: number;
  changes: number;
  completedChanges: number;
  completedAttempts: number;
  firstInvocationCompletionRate: number | null;
  resumes: number;
  hardStops: number;
  needsHuman: number;
  incomplete: number;
  hardStopDistribution: Record<string, number>;
};

export type MetricsReport = {
  records: number;
  malformedLines: number;
  source: "jsonl" | "sqlite";
  projection: { rows: number; lastSyncAt: number | null } | null;
  filters: { change?: string };
  usage: {
    total: UsageAggregate;
    byAction: Record<string, UsageAggregate>;
    byModel: Record<string, UsageAggregate>;
    attributionCoverage: number | null;
  };
  reviews: ReviewRoundAggregate[];
  deliver: DeliverAggregate;
};

function emptyUsage(): UsageAggregate {
  return {
    turns: 0,
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    reasoning: 0,
    cost: 0,
    maxContextPercent: null,
  };
}

function addTurn(target: UsageAggregate, turn: TurnMetricRecord): void {
  target.turns += 1;
  target.input += turn.usage.input;
  target.output += turn.usage.output;
  target.cacheRead += turn.usage.cacheRead;
  target.cacheWrite += turn.usage.cacheWrite;
  target.reasoning += turn.usage.reasoning ?? 0;
  target.cost += turn.usage.cost.total;
  const percent = turn.context?.percent;
  if (typeof percent === "number") {
    target.maxContextPercent = Math.max(target.maxContextPercent ?? 0, percent);
  }
}

function tokenMass(turn: TurnMetricRecord): number {
  return (
    turn.usage.input +
    turn.usage.output +
    turn.usage.cacheRead +
    turn.usage.cacheWrite
  );
}

function getUsageBucket(
  map: Record<string, UsageAggregate>,
  key: string,
): UsageAggregate {
  return (map[key] ??= emptyUsage());
}

function turnCostByRound(
  turns: TurnMetricRecord[],
): Map<string, number> {
  const result = new Map<string, number>();
  for (const turn of turns) {
    let type: ReviewType | null = null;
    if (turn.action === "ops-spec-review") type = "spec";
    if (turn.action === "ops-impl-review") type = "impl";
    if (!type || turn.reviewRound == null) continue;
    const key = `${type}:${turn.reviewRound}`;
    result.set(key, (result.get(key) ?? 0) + turn.usage.cost.total);
  }
  return result;
}

function aggregateReviews(
  turns: TurnMetricRecord[],
  reviewRecords: ReviewRoundMetricRecord[],
): ReviewRoundAggregate[] {
  const groups = new Map<string, ReviewRoundMetricRecord[]>();
  for (const record of reviewRecords) {
    const key = `${record.reviewType}:${record.round}`;
    const list = groups.get(key) ?? [];
    list.push(record);
    groups.set(key, list);
  }
  const costs = turnCostByRound(turns);
  const rows: ReviewRoundAggregate[] = [];
  for (const [key, records] of groups) {
    const [reviewType, roundRaw] = key.split(":");
    const round = Number(roundRaw);
    const valid = records.filter((r) => !r.missing);
    const cost = costs.get(key) ?? 0;
    rows.push({
      reviewType: reviewType as ReviewType,
      round,
      entries: records.length,
      missing: records.length - valid.length,
      cost,
      averageCost: records.length > 0 ? cost / records.length : 0,
      newMajorRate:
        valid.length > 0
          ? valid.filter((r) => (r.newMajors ?? 0) > 0).length / valid.length
          : null,
      readyRate:
        valid.length > 0
          ? valid.filter((r) => r.verdict === "ready").length / valid.length
          : null,
    });
  }
  return rows.sort(
    (a, b) =>
      a.reviewType.localeCompare(b.reviewType) || a.round - b.round,
  );
}

function aggregateDeliver(
  records: DeliverAttemptMetricRecord[],
): DeliverAggregate {
  const starts = records.filter((r) => r.event === "start");
  const settledById = new Map<string, DeliverAttemptMetricRecord>();
  for (const record of records) {
    if (record.event === "settled") settledById.set(record.attemptId, record);
  }
  const changes = new Set(starts.map((r) => r.change));
  const completedChanges = new Set<string>();
  let completedAttempts = 0;
  let hardStops = 0;
  let needsHuman = 0;
  let incomplete = 0;
  let resumes = 0;
  const hardStopDistribution: Record<string, number> = {};

  for (const start of starts) {
    if (start.resume) resumes += 1;
    const end = settledById.get(start.attemptId);
    const outcome = end?.outcome ?? "incomplete";
    if (outcome === "completed") {
      completedAttempts += 1;
      completedChanges.add(start.change);
    } else if (outcome === "hard_stop") {
      hardStops += 1;
      const key = `${end?.hardStopAction ?? "unknown"}:${end?.errorCode ?? "unknown"}`;
      hardStopDistribution[key] = (hardStopDistribution[key] ?? 0) + 1;
    } else if (outcome === "needs_human") {
      needsHuman += 1;
    } else {
      incomplete += 1;
    }
  }

  let firstCompleted = 0;
  for (const change of changes) {
    const first = starts
      .filter((s) => s.change === change)
      .sort((a, b) => a.timestamp - b.timestamp)[0];
    if (first && settledById.get(first.attemptId)?.outcome === "completed") {
      firstCompleted += 1;
    }
  }

  return {
    attempts: starts.length,
    changes: changes.size,
    completedChanges: completedChanges.size,
    completedAttempts,
    firstInvocationCompletionRate:
      changes.size > 0 ? firstCompleted / changes.size : null,
    resumes,
    hardStops,
    needsHuman,
    incomplete,
    hardStopDistribution,
  };
}

export function buildMetricsReport(
  allRecords: MetricsRecord[],
  options: {
    change?: string;
    malformedLines?: number;
    source?: "jsonl" | "sqlite";
    projection?: { rows: number; lastSyncAt: number | null };
  } = {},
): MetricsReport {
  const records = options.change
    ? allRecords.filter((record) =>
        "change" in record ? record.change === options.change : false,
      )
    : allRecords;
  const turns = records.filter((r): r is TurnMetricRecord => r.kind === "turn");
  const reviews = records.filter(
    (r): r is ReviewRoundMetricRecord => r.kind === "review_round",
  );
  const attempts = records.filter(
    (r): r is DeliverAttemptMetricRecord => r.kind === "deliver_attempt",
  );
  const total = emptyUsage();
  const byAction: Record<string, UsageAggregate> = {};
  const byModel: Record<string, UsageAggregate> = {};
  let totalMass = 0;
  let attributedMass = 0;

  for (const turn of turns) {
    addTurn(total, turn);
    addTurn(getUsageBucket(byAction, turn.action), turn);
    addTurn(
      getUsageBucket(byModel, `${turn.model.provider}/${turn.model.id}`),
      turn,
    );
    const mass = tokenMass(turn);
    totalMass += mass;
    if (turn.attribution !== "unknown" && turn.action !== "unknown") {
      attributedMass += mass;
    }
  }

  return {
    records: records.length,
    malformedLines: options.malformedLines ?? 0,
    source: options.source ?? "jsonl",
    projection: options.projection ?? null,
    filters: options.change ? { change: options.change } : {},
    usage: {
      total,
      byAction,
      byModel,
      attributionCoverage: totalMass > 0 ? attributedMass / totalMass : null,
    },
    reviews: aggregateReviews(turns, reviews),
    deliver: aggregateDeliver(attempts),
  };
}

function percent(value: number | null): string {
  return value == null ? "n/a" : `${(value * 100).toFixed(1)}%`;
}

function tokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

function usd(value: number): string {
  return `$${value.toFixed(4)}`;
}

function contextPercent(value: number | null): string {
  return value == null ? "n/a" : `${value.toFixed(1)}%`;
}

type TableColumn = {
  header: string;
  width: number;
  align?: "left" | "right";
};

function fitCell(value: string, width: number): string {
  if (value.length <= width) return value;
  if (width <= 1) return "~".slice(0, width);
  return `${value.slice(0, width - 1)}~`;
}

function tableCell(value: string | number, column: TableColumn): string {
  const fitted = fitCell(String(value), column.width);
  return column.align === "right"
    ? fitted.padStart(column.width)
    : fitted.padEnd(column.width);
}

function renderTable(
  columns: TableColumn[],
  rows: Array<Array<string | number>>,
): string[] {
  const render = (row: Array<string | number>) =>
    columns.map((column, index) => tableCell(row[index] ?? "", column)).join("  ");
  return [
    render(columns.map((column) => column.header)),
    columns.map((column) => "-".repeat(column.width)).join("  "),
    ...rows.map(render),
  ];
}

const USAGE_COLUMNS: TableColumn[] = [
  { header: "bucket", width: 22 },
  { header: "turns", width: 5, align: "right" },
  { header: "input", width: 7, align: "right" },
  { header: "output", width: 7, align: "right" },
  { header: "c-read", width: 7, align: "right" },
  { header: "c-write", width: 7, align: "right" },
  { header: "reason", width: 7, align: "right" },
  { header: "USD est.", width: 10, align: "right" },
  { header: "ctx max", width: 7, align: "right" },
];

function usageRow(label: string, value: UsageAggregate): Array<string | number> {
  return [
    label,
    value.turns,
    tokens(value.input),
    tokens(value.output),
    tokens(value.cacheRead),
    tokens(value.cacheWrite),
    tokens(value.reasoning),
    usd(value.cost),
    contextPercent(value.maxContextPercent),
  ];
}

export function formatMetricsReport(report: MetricsReport): string {
  const lines: string[] = [
    `openspec-ops lifecycle metrics${report.filters.change ? ` — ${report.filters.change}` : ""}`,
  ];
  if (report.source === "sqlite") {
    const synced = report.projection?.lastSyncAt == null
      ? "never"
      : new Date(report.projection.lastSyncAt).toISOString();
    lines.push(
      `Source: SQLite projection; rows: ${report.projection?.rows ?? report.records}; last sync: ${synced}`,
    );
  } else {
    lines.push(`Source: JSONL (authoritative); records: ${report.records}`);
  }
  lines.push(
    "Cost: USD estimate (Pi model-registry rates x provider token usage)",
    "Note: openspec-ops aggregates Pi values; $0 may mean unavailable or zero rates.",
    "",
    "A. Usage by action",
  );
  const actions = Object.entries(report.usage.byAction).sort(
    (a, b) => b[1].cost - a[1].cost || a[0].localeCompare(b[0]),
  );
  if (actions.length === 0) {
    lines.push("(no turn records)");
  } else {
    lines.push(
      ...renderTable(USAGE_COLUMNS, [
        ...actions.map(([action, value]) => usageRow(action, value)),
        usageRow("TOTAL", report.usage.total),
      ]),
    );
  }
  lines.push(`Attribution coverage: ${percent(report.usage.attributionCoverage)}`);

  const models = Object.entries(report.usage.byModel).sort(
    (a, b) => b[1].cost - a[1].cost || a[0].localeCompare(b[0]),
  );
  lines.push("", "By model");
  if (models.length === 0) {
    lines.push("(no model records)");
  } else {
    lines.push(
      ...renderTable(USAGE_COLUMNS, [
        ...models.map(([model, value]) => usageRow(model, value)),
        usageRow("TOTAL", report.usage.total),
      ]),
    );
  }

  lines.push("", "B. Review round yield");
  if (report.reviews.length === 0) {
    lines.push("(no review records)");
  } else {
    const reviewColumns: TableColumn[] = [
      { header: "type/round", width: 10 },
      { header: "entries", width: 7, align: "right" },
      { header: "missing", width: 7, align: "right" },
      { header: "avg USD", width: 10, align: "right" },
      { header: "new-major", width: 9, align: "right" },
      { header: "ready", width: 8, align: "right" },
    ];
    lines.push(
      ...renderTable(
        reviewColumns,
        report.reviews.map((row) => [
          `${row.reviewType}/${row.round}`,
          row.entries,
          row.missing,
          usd(row.averageCost),
          percent(row.newMajorRate),
          percent(row.readyRate),
        ]),
      ),
    );
  }

  const d = report.deliver;
  const reliabilityColumns: TableColumn[] = [
    { header: "metric", width: 31 },
    { header: "value", width: 10, align: "right" },
  ];
  lines.push(
    "",
    "C. Deliver reliability",
    ...renderTable(reliabilityColumns, [
      ["attempts", d.attempts],
      ["changes", d.changes],
      ["completed attempts", d.completedAttempts],
      ["completed changes", d.completedChanges],
      ["first-invocation completion", percent(d.firstInvocationCompletionRate)],
      ["resumes", d.resumes],
      ["hard stops", d.hardStops],
      ["needs human", d.needsHuman],
      ["incomplete", d.incomplete],
    ]),
  );
  const stops = Object.entries(d.hardStopDistribution).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  if (stops.length > 0) {
    lines.push(
      "",
      "Hard-stop distribution",
      ...renderTable(
        [
          { header: "action:error", width: 42 },
          { header: "count", width: 7, align: "right" },
        ],
        stops.map(([key, count]) => [key, count]),
      ),
    );
  }
  if (report.malformedLines > 0) {
    lines.push("", `Warning: skipped ${report.malformedLines} malformed record line(s).`);
  }
  return lines.join("\n");
}
