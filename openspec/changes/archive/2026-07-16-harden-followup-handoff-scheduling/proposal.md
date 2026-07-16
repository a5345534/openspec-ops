## Why

Pi 0.80.7 can flush compaction-queued slash input while another prompt has already resumed, so the guided extension's immediate follow-up handoff can make a later queued prompt fail with `Agent is already processing`. `/ops-next` and `/ops-deliver` must avoid starting their lifecycle turn from inside the vulnerable queue-flush call stack and must not claim success before the handoff API accepts it.

## What Changes

- Defer guided lifecycle follow-up delivery to a later host task while preserving `deliverAs: "followUp"`.
- Share one exactly-once handoff helper between `/ops-next` and `/ops-deliver`.
- Notify success only after `sendUserMessage` returns successfully; report synchronous rejection without a false scheduled message.
- Add focused runtime tests for busy/compaction-adjacent invocation, exactly-once delivery, idle behavior, and rejection wording.
- Document this as a compatibility workaround for Pi 0.80.7 and link upstream issue earendil-works/pi#6728 so it can be reevaluated after an upstream fix.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `guided-next-step`: Selected next actions are handed off on a deferred host task, exactly once, as follow-up messages, with acceptance-aware notification.
- `ops-deliver`: Slash delivery uses the same deferred, follow-up-only, acceptance-aware handoff behavior.

## Impact

Affected areas are `.pi/extensions/openspec-ops-guided.ts`, a small testable handoff helper, extension-runtime tests, package documentation, and the guided-next/deliver specifications. No lifecycle CLI behavior, OpenSpec semantics, or package dependencies change.
