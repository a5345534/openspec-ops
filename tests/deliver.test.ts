import { describe, expect, it } from "vitest";
import {
  defaultDeliverAction,
  deliverActionAfterReview,
  DELIVER_MAX_STEPS,
  DELIVER_PIPELINE_ORDER,
} from "../src/next-step/deliver.js";
import type { LifecycleStation } from "../src/next-step/edges.js";

describe("defaultDeliverAction", () => {
  const cases: Array<[LifecycleStation, string | null]> = [
    ["no_workspace", "ops-start"],
    ["ready_to_propose", "opsx-propose"],
    ["proposed", "ops-spec-review"],
    ["applied", "ops-ship"],
    ["shipped", "ops-impl-review"],
    ["merged", "opsx-archive"],
    ["archived", "ops-finish"],
    ["done", "stop"],
    ["unknown", null],
  ];

  it.each(cases)("%s → %s", (station, action) => {
    expect(defaultDeliverAction(station)).toBe(action);
  });
});

describe("deliverActionAfterReview", () => {
  it("spec → apply, impl → merge", () => {
    expect(deliverActionAfterReview("spec")).toBe("opsx-apply");
    expect(deliverActionAfterReview("impl")).toBe("ops-merge");
  });
});

describe("pipeline constants", () => {
  it("has start through finish and max steps", () => {
    expect(DELIVER_PIPELINE_ORDER[0]).toBe("start");
    expect(DELIVER_PIPELINE_ORDER.at(-1)).toBe("finish");
    expect(DELIVER_MAX_STEPS).toBeGreaterThanOrEqual(10);
  });
});
