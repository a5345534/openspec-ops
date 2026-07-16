export type FollowUpOptions = { deliverAs: "followUp" };
export type FollowUpSender = (
  message: string,
  options: FollowUpOptions,
) => void;
export type HostTaskScheduler = (task: () => void) => unknown;

export interface DeferredFollowUpOptions {
  message: string;
  send: FollowUpSender;
  onAccepted: () => void;
  onRejected: (error: Error) => void;
  schedule?: HostTaskScheduler;
}

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

function notifySafely(notify: () => void): void {
  try {
    notify();
  } catch {
    // A stale UI must not turn an already accepted handoff into an unhandled
    // timer exception or a false send rejection.
  }
}

/**
 * Pi 0.80.7 compatibility workaround for earendil-works/pi#6728.
 *
 * A slash handler can run inside Pi's compaction-queue flush. Starting its
 * follow-up synchronously can make that flush issue a later plain prompt while
 * the agent is already busy. Move the send to the next host task instead.
 * Keep the exactly-once regression coverage when removing this workaround after
 * the minimum supported Pi version contains a verified upstream fix.
 */
export function deferFollowUpHandoff(
  options: DeferredFollowUpOptions,
): void {
  const schedule =
    options.schedule ?? ((task: () => void) => setTimeout(task, 0));
  let dispatched = false;

  schedule(() => {
    if (dispatched) return;
    dispatched = true;
    try {
      options.send(options.message, { deliverAs: "followUp" });
    } catch (error) {
      notifySafely(() => options.onRejected(asError(error)));
      return;
    }
    notifySafely(options.onAccepted);
  });
}
