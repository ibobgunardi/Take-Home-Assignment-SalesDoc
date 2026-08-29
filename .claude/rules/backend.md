# Rule — Backend (Node.js)

Applies to the Task 1 backend: domain models, dialer session, queue,
concurrency, CRM sync, API boundary.

Read alongside `docs/decisions.md` — that file holds the *why*; this
file holds the *how*.

---

## Shape

Keep it small and obvious. Suggested layout — adapt if the repo is already
different, but keep the layering:

```text
server/
  models/       plain data shapes + the status enums
  store/        in-memory Maps, one module per collection
  services/
    dialer      session state machine  (the only place session state mutates)
    simulator   CallSimulator interface + seeded and scripted impls
    crm-sync    terminal call -> contact upsert -> activity (idempotent)
    mock-crm    the "external" CRM store
  routes/       thin HTTP layer: parse, call a service, serialize
  seed.js       4-8 leads
```

**Routes stay thin.** No domain logic in a route handler — parse input, call one
service function, serialize the result. A reviewer reads routes first; they
should read like a table of contents.

**One writer.** Session state is mutated in exactly one module (`services/dialer`).
Timers and routes call into it; they never mutate `session.activeCallIds`,
`metrics`, or `winnerCallId` directly. If you need a second place to mutate
session state, the design is wrong.

---

## Models — match the spec exactly

Field names and enum values come straight from
`docs/source/task1-multi-line-dialer.md`. Do not rename, do not "improve",
do not add values to a specified enum.

```text
Call_Status : CONNECTED | NO_ANSWER | BUSY | VOICEMAIL | CANCELED_BY_DIALER
session.status : RUNNING | STOPPED
metrics : attempted, connected, failed, canceled
```

Adding fields is fine when they earn their place (e.g. a `completionReason`).
Changing specified names or enum members is not — that is silent spec drift and
it is exactly what a reviewer greps for.

**Call lifecycle — phase vs. status (D-03).** These are two different things and
conflating them breaks the winner logic:

```text
phase:  DIALING ──answered──> LIVE ──hangup──> ENDED
             └────────no answer / busy / voicemail / cancel────────> ENDED

status: null while DIALING or LIVE
        set once, with endedAt, on entry to ENDED
```

- `phase` (`DIALING | LIVE | ENDED`) is an **added** field. `Call_Status` keeps
  exactly its five specified values — `DIALING`/`LIVE` never go in it.
- `status` is the **final outcome only**. Set it together with `endedAt`, never
  one without the other.
- **Terminal** = entering `ENDED`. That is what triggers CRM sync and metrics.
- The **winner is decided on answer** (`DIALING` → `LIVE`), *not* at terminal.
  An answered call gets `status = CONNECTED` later, when it ends.
- `answeredAt` may be added alongside `startedAt`/`endedAt`.

Getting this wrong produces the classic bug: setting `CONNECTED` at answer time
ends the call instantly, so there is no live call, nothing to cancel the other
line against, and no winner to display.

---

## INVARIANT 1 — `activeCallIds.length <= 2`

This is a domain invariant, not a validation rule. It must be impossible to
violate, not merely checked.

**How it is guaranteed (D-09).** All transitions run inside **one synchronous
function**. There is **no `await`** between reading `activeCallIds` and writing
it. Node runs one callback at a time, so with no interleaving point there is no
race.

The single transition entry point is `advance(session)`. **The canonical
algorithm lives in `docs/decisions.md` D-09** — read it there; it is not
repeated here, because two copies drift.

**What drives it (D-16):** one `setInterval` per `RUNNING` session,
`TICK_MS = 250`, whose callback does nothing but call `advance(session)`. No
per-call timers. A **tick** is one invocation of `advance()`; two events are "in
the same tick" when both fell due before the same invocation. The interval is
cleared when the session stops. Tests never start it — they advance a fake clock
and call `advance()` directly.

Tick length is independent of the 1–2 s UI poll (R-89). Do not couple them.

**Reason about these paths every time you touch the dialer:**

- starting a session (2 leads promoted at once, not 1, not 3)
- a call reaching a terminal outcome
- freeing a line and promoting the next queue item
- **two calls completing in the same tick** — the classic 3-active bug
- a winner cancelling the other line
- stopping a session with calls in flight
- a winner call ending -> next round promoted (`winnerCallId` is **not**
  cleared — D-18)
- an exhausted queue (promote nothing, do not loop forever, do not crash)
- fewer selected leads than lines

Never write "promote next" logic anywhere but inside the bounded `while` loop
of D-09 step 7.

---

## INVARIANT 2 — one `callId` → at most one CRMActivity

Terminal handling can legitimately run more than once (a retry, a stop that
re-terminates, a duplicated timer). The system must absorb that.

**Implementation.** Keep an idempotency index keyed by `callId`. Check it
**before** any write. On a hit, return the existing activity and write nothing
to either store.

```text
syncTerminalCall(call):
    if activityIndex.has(call.id): return activityIndex.get(call.id)   // no writes
    contact = upsertContact(lead)          // create if no crmExternalId, else update
    lead.crmExternalId = contact.id
    activity = buildActivity(call, contact, disposition=call.status)
    appStore.add(activity)                 // the app's CRMActivity model
    mockCrmStore.add(activity)             // the "external" CRM
    activityIndex.set(call.id, activity)
    return activity
```

**Both stores are written, or neither.** No `await` between the two writes —
a partial write is the bug this invariant exists to prevent. Set the index
entry in the same synchronous block.

**Contact upsert must also be idempotent (D-01, R-50):** two calls for the same
lead produce **one** contact, not two.

**All five statuses are terminal (D-05)** and each syncs. Including
`CANCELED_BY_DIALER`.

---

## Force-terminating a call (D-11)

When a call is terminated by the dialer (a winner cancelling the other line, or
a Stop), the resulting status depends on its **phase**, not on why it ended:

| Phase when terminated | Resulting `status` |
| --- | --- |
| `DIALING` | `CANCELED_BY_DIALER` |
| `LIVE` | `CONNECTED` |

Because only the race winner ever enters `LIVE` (D-03), `LIVE` implies winner,
and `CANCELED_BY_DIALER` only ever lands on a call that was never answered.
Stopping mid-conversation records a `CONNECTED` call, which keeps
`winnerCallId` consistent with Screen 2's "winner call (if connected)".
Put this in one helper and route every forced termination through it.

---

## Metrics (D-04)

| Counter | On |
| --- | --- |
| `attempted` | call created / dialing begins — once per call |
| `connected` | `CONNECTED` |
| `failed` | `NO_ANSWER`, `BUSY`, `VOICEMAIL` |
| `canceled` | `CANCELED_BY_DIALER` |

Increment **only** inside the terminal transition (and `attempted` only at
creation), so a counter cannot drift from the call records.

Assert in tests: `connected + failed + canceled === attempted` whenever nothing
is in flight. A break here almost always means a terminal transition ran twice —
the same defect class as a duplicate CRM activity.

---

## Winner (D-02)

- A call being **answered** (`DIALING` → `LIVE`) sets `winnerCallId`, replacing
  whatever it held. The winner is chosen on **answer**, not on terminal status,
  and is only ever replaced by a later answer — never cleared (D-18).
- All other in-flight calls immediately become `CANCELED_BY_DIALER` (each runs
  the normal CRM sync).
- No further promotion while the winner is `LIVE`.
- Winner call ends → `status = CONNECTED`, CRM sync, and **dialing resumes**.
  `winnerCallId` is **not** cleared — it keeps pointing at that call until a
  later call is answered (D-18). The promotion gate is "no call is `LIVE`", not
  "`winnerCallId` is null".
- Session reaches `STOPPED` only when the queue is exhausted and no calls are
  active, or on explicit stop — **not** when a call connects.
- Two calls due to answer in the same tick → **exactly one** enters `LIVE` and
  wins; the other never becomes `LIVE` and is cancelled from `DIALING`.

Keep this in one function so the policy can be changed in one place.

---

## Simulation (D-06)

`Math.random()` and bare `setTimeout` **must not appear in domain logic.**

- `CallSimulator` interface returns `(outcome, durationMs)`.
- Dev/prod impl: **seeded** PRNG, seed configurable via env, fixed default — so
  a demo is reproducible.
- Test impl: scripted outcomes, test-controlled completion.
- Time is injected. Tests never sleep.

Timers may schedule work, but the callback calls `advance()` — it does not
mutate state itself.

---

## API boundary (D-08)

These three paths are **specified verbatim** and must exist exactly as written:

```text
GET /mock-crm/contacts
GET /mock-crm/activities
GET /leads/:id/crm-activities
```

Added for the frontend: `GET /leads`, `POST /sessions`,
`POST /sessions/:id/start`, `POST /sessions/:id/stop`, `GET /sessions/:id`.

**No `/api` prefix on anything** — the three specified paths are graded at their
literal roots. In production the same process also serves the React bundle, so
**register the API routers first and let the SPA fallback return `index.html`
only for unmatched paths**, or a root catch-all will swallow them.

`GET /sessions/:id` is **the** polling endpoint: one request returns session
status, metrics, `winnerCallId`, the 2 line slots (lead name, phone, status),
completed calls, and per-call CRM activity status. The frontend must never need
two requests to render one consistent tick.

Validate at the boundary: empty `leadIds` → `400`; unknown id → `404`, never a
500 or an unhandled throw. Enable CORS for the Vite dev origin.

---

## Not in scope

No database, Redis, message broker, WebSockets, auth, or external services.
In-memory is explicitly permitted by the spec. See `.claude/rules/scope.md`.
