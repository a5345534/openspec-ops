## Context

The guided extension currently calls `pi.sendUserMessage(..., { deliverAs: "followUp" })` directly inside `/ops-next` and `/ops-deliver` command handlers. That delivery mode is correct while Pi is busy, but on Pi 0.80.7 a command executed from `flushCompactionQueue()` can synchronously start a new turn before that flush has dispatched the rest of its saved inputs. The host then calls a plain `session.prompt()` while busy and restores the queue with `Agent is already processing`.

The upstream defect is earendil-works/pi#6728. It is auto-closed rather than confirmed fixed, and the installed supported version still contains the vulnerable plain-prompt queue flush. openspec-ops cannot repair Pi's queue internals, but it can avoid starting its follow-up turn inside that flush stack.

## Goals / Non-Goals

**Goals:**

- Move both guided handoffs to the next host task.
- Preserve non-interrupting `followUp` delivery and exactly-once invocation.
- Report successful scheduling only after the send API accepts the request synchronously.
- Provide deterministic tests without needing a timing-sensitive live TUI compaction run.
- Identify Pi 0.80.7 and upstream issue #6728 as the reason for the compatibility layer.

**Non-Goals:**

- Patch or monkey-patch Pi's compaction queue.
- Guarantee delivery of a slash command that Pi itself never dispatches to the extension.
- Retry rejected handoffs automatically, which could duplicate lifecycle work.
- Change lifecycle station logic or introduce `steer` delivery.

## Decisions

### Use one next-task helper

A small helper will schedule one callback with `setTimeout(..., 0)`. The callback calls the supplied sender exactly once with `{ deliverAs: "followUp" }`, then emits the accepted notification. A caught synchronous exception emits a rejection notification and is not retried.

A timer is preferred over a microtask because promise continuations inside `flushCompactionQueue()` also run as microtasks; a later timer gives the host's current async dispatch sequence a chance to complete before openspec-ops starts or queues its turn.

### Share the helper across both slash commands

`/ops-next` and `/ops-deliver` will use the same helper and only provide message- and notification-specific text. This prevents one command from retaining the immediate pattern and gives tests a narrow behavioral seam.

### Treat send return as synchronous acceptance, not completion

The current Extension API returns `void`, so it cannot prove eventual model execution. Success wording will state that the follow-up was queued only after the call returns. If the call throws, the extension will report that the follow-up was not queued. It will not claim lifecycle completion.

### Keep an explicit compatibility note

Source documentation and README will identify Pi 0.80.7 and link upstream issue #6728. The helper can be removed after the minimum supported Pi release has a verified queue-flush fix and regression coverage is retained.

## Risks / Trade-offs

- [A zero-delay timer adds one event-loop turn of latency] → The delay is negligible and applies only after an explicit slash selection.
- [The extension instance could become stale before the timer fires] → Catch the sender exception, report rejection, and never retry automatically.
- [Pi may fail before invoking the slash handler] → Document that this workaround only controls the extension handoff after handler dispatch; upstream remains responsible for queue integrity.
- [A future Pi release may make the workaround unnecessary] → Keep the helper isolated and version/upstream rationale explicit.
