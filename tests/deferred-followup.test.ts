import { describe, expect, it, vi } from "vitest";
import {
  deferFollowUpHandoff,
  type HostTaskScheduler,
} from "../src/ops-runtime/deferred-followup.js";

function controlledScheduler() {
  const tasks: Array<() => void> = [];
  const schedule: HostTaskScheduler = (task) => tasks.push(task);
  return { tasks, schedule };
}

describe("deferFollowUpHandoff", () => {
  it("returns before compaction-adjacent host dispatch and then sends one follow-up", () => {
    const { tasks, schedule } = controlledScheduler();
    const events: string[] = [];

    deferFollowUpHandoff({
      message: "/opsx-apply demo",
      schedule,
      send: (_message, options) => {
        events.push(`send:${options.deliverAs}`);
      },
      onAccepted: () => events.push("accepted"),
      onRejected: () => events.push("rejected"),
    });

    expect(events).toEqual([]);
    expect(tasks).toHaveLength(1);

    // Model the rest of Pi's current compaction queue flush completing before
    // the next host task runs. The handoff can now queue behind that prompt.
    events.push("host-flush-complete");
    tasks[0]!();

    expect(events).toEqual([
      "host-flush-complete",
      "send:followUp",
      "accepted",
    ]);
  });

  it("uses the same deferred follow-up-only path for an idle invocation", () => {
    const { tasks, schedule } = controlledScheduler();
    const send = vi.fn();
    const accepted = vi.fn();

    deferFollowUpHandoff({
      message: "deliver",
      schedule,
      send,
      onAccepted: accepted,
      onRejected: vi.fn(),
    });

    expect(send).not.toHaveBeenCalled();
    tasks[0]!();
    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith("deliver", { deliverAs: "followUp" });
    expect(accepted).toHaveBeenCalledOnce();
  });

  it("notifies acceptance only after send returns", () => {
    const { tasks, schedule } = controlledScheduler();
    const events: string[] = [];

    deferFollowUpHandoff({
      message: "deliver",
      schedule,
      send: () => events.push("send-returned"),
      onAccepted: () => events.push("accepted"),
      onRejected: () => events.push("rejected"),
    });

    tasks[0]!();
    expect(events).toEqual(["send-returned", "accepted"]);
  });

  it("does not misreport an accepted send when success notification fails", () => {
    const { tasks, schedule } = controlledScheduler();
    const rejected = vi.fn();

    deferFollowUpHandoff({
      message: "deliver",
      schedule,
      send: vi.fn(),
      onAccepted: () => {
        throw new Error("stale UI");
      },
      onRejected: rejected,
    });

    expect(() => tasks[0]!()).not.toThrow();
    expect(rejected).not.toHaveBeenCalled();
  });

  it("reports synchronous rejection once without success or retry", () => {
    const { tasks, schedule } = controlledScheduler();
    const send = vi.fn(() => {
      throw new Error("Agent is already processing");
    });
    const accepted = vi.fn();
    const rejected = vi.fn();

    deferFollowUpHandoff({
      message: "deliver",
      schedule,
      send,
      onAccepted: accepted,
      onRejected: rejected,
    });

    tasks[0]!();
    tasks[0]!(); // Even a broken scheduler invoking the callback twice is safe.

    expect(send).toHaveBeenCalledOnce();
    expect(accepted).not.toHaveBeenCalled();
    expect(rejected).toHaveBeenCalledOnce();
    expect(rejected.mock.calls[0]![0].message).toBe(
      "Agent is already processing",
    );
  });
});
