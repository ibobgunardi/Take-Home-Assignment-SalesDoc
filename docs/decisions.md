# Task 1 — Decisions and Interpretations

> **Derived project guidance.** These are *our* interpretations, not the
> client's requirements. Everything below is a decision we made because the
> source was silent or self-contradictory. Nothing here may be presented to a
> reviewer as if the assignment demanded it.
>
> Format for every entry: **the ambiguity → the interpretation → why it is
> reasonable → the tradeoff.**
>
> If the implementing session changes a decision, **edit this file in the same
> change**. A stale decisions file is worse than none.

Ambiguity IDs (`A-n`) refer to `docs/assignment-scope.md` §5.

---

## D-01 — Contact upsert semantics (A-1)

**Ambiguity.** The spec says, verbatim:

> "If lead has no `crmExternalId`, update contact"

Taken literally this is incoherent: you cannot *update* a CRM contact for a lead
that has no CRM id. The else-branch (lead *does* have an id) is never stated.

**Interpretation.** Treat it as an **upsert**:

- Lead has **no** `crmExternalId` → **create** a contact in the mock CRM, and
  persist the returned id back onto the lead as `crmExternalId`.
- Lead **has** a `crmExternalId` → **update** that existing mock-CRM contact.

Either branch runs before the activity is created, so the activity always
carries a valid `crmExternalId`.

**Why reasonable.** It is the only reading under which both branches are
well-defined, it matches how every real CRM integration behaves, and it is the
only reading that makes `crmExternalId` on `CRMActivity` reliably populated —
which the spec requires. The most likely explanation is a dropped word in the
original ("no `crmExternalId`, *create* contact; otherwise update").

**Tradeoff.** We deviate from the literal sentence. Mitigation: the deviation is
called out in `NOTES.md` so the reviewer sees it was a considered reading, not a
misread. If the reviewer intended the literal text, the change is one branch.

---

## D-02 — Winner semantics and the fate of the other line (A-2, A-3, A-4)

> **Revised.** An earlier version made the winner *sticky for the session*, so
> the session ended when the first answered call hung up. That was wrong; the
> reasoning is under "Why the sticky reading was rejected" below. Keep the
> win-and-cancel logic in one function either way.

**Ambiguity.** `winnerCallId` is declared on `DialerSession` and shown on
Screen 2 "if connected", but never defined. `CANCELED_BY_DIALER` exists as a
status with no stated trigger. Whether dialing continues after a winner is
unstated.

**Interpretation.** A standard **parallel/power dialer**, with the winner scoped
to a **round**, not to the session. The winner is decided at the **answer**
moment (D-03), not at the terminal moment:

1. A `RUNNING` session dials up to 2 leads concurrently.
2. The **first** call answered while no other call is `LIVE` becomes
   `winnerCallId`, replacing whatever it held.
3. At that instant every other in-flight call is terminated
   `CANCELED_BY_DIALER` - one agent can hold one conversation. This includes a
   call that would have answered in the **same tick**: it loses the race, never
   enters `LIVE`, and is cancelled from `DIALING`. Only the winner is ever
   `LIVE` (D-03).
4. While the winner is `LIVE`, **no further leads are promoted**.
5. When the winner call **ends** it takes `status = CONNECTED` (`endedAt` set,
   CRM sync fires) and **dialing resumes** - the next round promotes up to 2 more
   leads. `winnerCallId` **keeps pointing at that call** until a later call is
   answered and replaces it (D-18).
6. The session reaches `STOPPED` when the queue is exhausted **and** no calls
   are active, or when the agent stops it. Not when a call connects.

So `winnerCallId` means *the most recent call that was answered* - `null` until
the first connect, then always pointing at the latest one (D-18). Every selected
lead is eventually dialed unless the agent stops the session early.

**Why reasonable.**

- The Goal says the agent "runs a 2-line dialer session **over a list of
  leads**". Working the list is the product; stopping at the first pickup is
  not.
- **The metrics decide it.** `metrics: attempted, connected, failed, canceled`
  are counters. Under a session-sticky winner, `connected` could only ever be
  `0` or `1` - there would be no reason to make it a counter. Four counters only
  make sense if a session can accumulate several of each.
- `winnerCallId` being **nullable** is natural under this reading - `null` until
  the first connect, thereafter naming the most recent one (D-18).
- It is how real power dialers behave: dial, connect, talk, wrap, dial again.

**Why the sticky reading was rejected.** It required a hand-picked simulator
seed to demo the queue at all (see D-13) - if the first call connected, the app
was over. A decision that needs curated inputs to look right is usually the
wrong decision, not a demo problem. It also capped `connected` at 1, and left
selected leads permanently undialed with no status to explain why.

**Tradeoff.** `winnerCallId` changes over the life of a session, so a reviewer
inspecting it at two different moments sees two different values. It names the
most recent connect and is never cleared (D-18), so the UI panel stays populated
once anything has connected - label it "Last connected" after that call ends. If
a reviewer intended one winner per session, the change is confined to steps 5-6.

**Additive fields allowed.** A non-spec `completionReason`
(`QUEUE_EXHAUSTED | STOPPED_BY_AGENT`) may be added for UI clarity.
`status` itself must stay exactly `RUNNING | STOPPED` as specified.

---

## D-03 — Call lifecycle: phase vs. status (A-5)

**Ambiguity.** `Call_Status` has no in-progress value, yet Screen 2 must show a
status for each active line. Worse, `CONNECTED` is doing double duty: it is
both "this call was answered" (the event that must cancel the other line) and
"this call's final outcome was a connection" (the disposition written to the
CRM). Those are **different moments in time** and cannot be the same field
transition.

**Interpretation.** Separate **phase** (where the call is now) from **status**
(how it finished). `Call_Status` stays exactly the five specified values.

```text
phase:  DIALING ──answered──> LIVE ──hangup──> ENDED
             └──────────no answer / busy / voicemail / cancel──────> ENDED

status: null while DIALING or LIVE
        set once, together with endedAt, on entry to ENDED
```

- `phase` is an **added, non-spec field**: `DIALING | LIVE | ENDED`.
- `status` (the spec enum) is the **final outcome only**. It is `null` until the
  call ends, then `status` and `endedAt` are set **together in one step**.
- A call is in flight when `phase !== ENDED` (equivalently `endedAt === null`).
- **Terminal** — the trigger for CRM sync and metrics — means entering `ENDED`.
- `answeredAt` may be added alongside `startedAt`/`endedAt` for the UI.
- **At most one call is `LIVE` at a time, and while one is, it is
  `winnerCallId`.** A call that would answer while **another call is already
  `LIVE`** never enters `LIVE` — it is cancelled from `DIALING`. (The test is
  "is a call `LIVE`", *not* "is `winnerCallId` set" — the latter stays set
  forever after the first connect, D-18.) A `LIVE` call can only end as
  `CONNECTED` (D-11). The converse does not hold: `winnerCallId` may name an
  `ENDED` call.

Mapping to outcomes:

| Simulated outcome | Path |
| --- | --- |
| answered, conversation happens | `DIALING` → `LIVE` → `ENDED` with `status = CONNECTED` |
| `NO_ANSWER` / `BUSY` / `VOICEMAIL` | `DIALING` → `ENDED` with that status |
| lost the race / stopped while still ringing | `DIALING` → `ENDED` with `CANCELED_BY_DIALER` |

The frontend shows the phase for active lines ("Dialing…", "Connected — live")
and the terminal `status` once ended.

**Why reasonable.** Without this split the model is incoherent: if `CONNECTED`
were set atomically with `endedAt`, then a call would end at the instant it
connected — there would be no live call to cancel the other line against, no
winner to display on Screen 2, and D-02 step 5 ("when the winner call ends")
would be vacuous. The split also keeps the specified enum unpolluted: `DIALING`
and `LIVE` never appear in `Call_Status`, so no invented value is added to a
field the spec defined.

**Tradeoff.** One added field and a slightly larger state machine. Accepted —
the alternative is either altering a specified enum or a lifecycle that cannot
express the behaviour `CANCELED_BY_DIALER` clearly implies. Both `phase` and
`answeredAt` are flagged in `NOTES.md` as additions, not spec fields.

---

## D-04 — Metrics mapping (A-6)

**Ambiguity.** `metrics: attempted, connected, failed, canceled` — no mapping
from `Call_Status` to counter is given.

**Interpretation.**

| Counter | Incremented when |
| --- | --- |
| `attempted` | a Call is created and dialing begins (once per call) |
| `connected` | a call reaches `CONNECTED` |
| `failed` | a call reaches `NO_ANSWER`, `BUSY`, or `VOICEMAIL` |
| `canceled` | a call reaches `CANCELED_BY_DIALER` |

**All four counters move only at call creation (`attempted`) or at the terminal
transition (the other three).** In particular `connected` increments when the
winner's call **ends** with `status = CONNECTED` — *not* when it is answered.
Incrementing at the answer moment would double-count once the call ends, and
would break the balance below while the call is still `LIVE`.

**Derived invariant, to be asserted in tests:**

```text
connected + failed + canceled == attempted    (once no calls are in flight)
attempted == total Calls created for the session
```

**Why reasonable.** It is the only partition of the five statuses into the four
counters that leaves no status unmapped and no counter unused.
`CANCELED_BY_DIALER` is the only status that is a dialer decision rather than a
call result, which matches `canceled` being separate from `failed`.

**Tradeoff.** One could argue `VOICEMAIL` is a form of "connected". We treat it
as `failed` because no conversation occurred and it never wins the race.

---

## D-05 — Which outcomes are "terminal" for CRM sync (A-7)

**Ambiguity.** "When a call reaches a terminal outcome" — the set is not stated.

**Interpretation.** **All five** `Call_Status` values are terminal. Every call
ends in exactly one of them, and **every** terminal transition triggers CRM sync
(contact upsert → activity create), including `CANCELED_BY_DIALER`.

The `disposition` on the CRMActivity is the `Call_Status` value.

**Why reasonable.** All five are outcome values; there is no sixth. A cancelled
attempt is still a real attempt against that lead and is worth recording. It
also means the idempotency guarantee is exercised on every code path rather
than only the happy one.

**Tradeoff.** A reviewer might argue a dialer-cancelled call is noise in a CRM.
The counter-argument is recorded in `NOTES.md`; the behaviour is one predicate
to change if desired.

---

## D-06 — Deterministic call simulation (A-9)

**Ambiguity.** Calls are "mocked". No outcome distribution or duration is
specified.

**Interpretation.** The simulator is a **seam**, not a pile of `Math.random()`.

- Define one `CallSimulator` interface that decides `(outcome, durationMs)` for
  a call.
- **Production/dev implementation:** a **seeded PRNG** plus a real timer. The
  seed is configurable (env var, default fixed) so `npm run dev` is reproducible
  and a demo can be replayed.
- **Test implementation:** a scripted simulator injected by the test, which
  returns exact outcomes and completes calls at exact, test-controlled moments.

`Math.random()` and bare `setTimeout` must not appear in domain logic. Time is
injected too, so tests never sleep.

**Why reasonable.** The dialer's interesting behaviour — the max-2 ceiling,
queue promotion, the winner race, near-simultaneous completion — is only
testable if outcomes and timing are controllable. This is the single highest-
leverage design decision for test quality in this project.

**Tradeoff.** One extra interface and a little dependency injection. Cheap, and
it is what makes the concurrency and idempotency tests meaningful rather than
decorative.

---

## D-07 — "or Lead Management MVP" in the title (A-10)

**Ambiguity.** The title reads "Multi-Line Dialer (2 lines) + Update CRM (or
Lead Management MVP)", which could be read as an either/or.

**Interpretation.** It describes **one** deliverable. The app *is* a small
lead-management/CRM MVP; the parenthetical is a gloss on the same thing, not a
second option. Build exactly Parts 1–3 as specified.

**Why reasonable.** The Goal, and all of Parts 1–3, describe a single coherent
application. No alternative deliverable is specified anywhere.

**Tradeoff.** None material.

---

## D-08 — API surface for the dialer (A-8)

**Ambiguity.** Only the three CRM inspection endpoints are named, but Screen 1
and Screen 2 clearly require session endpoints.

**Interpretation.** The three specified endpoints are implemented **exactly as
written**. These are added as the minimum needed by the frontend:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/leads` | Screen 1 lead list |
| `POST` | `/sessions` | create session from `{ agentId, leadIds[] }` |
| `POST` | `/sessions/:id/start` | begin dialing |
| `POST` | `/sessions/:id/stop` | stop the session |
| `GET` | `/sessions/:id` | **the polling endpoint** |
| `GET` | `/mock-crm/contacts` | *specified* |
| `GET` | `/mock-crm/activities` | *specified* |
| `GET` | `/leads/:id/crm-activities` | *specified* |

`GET /sessions/:id` returns everything Screen 2 needs in **one** response:
session status, metrics, `winnerCallId`, the active lines (with lead name,
phone, status), completed calls, and per-call CRM activity status. One request
per poll tick.

**Why reasonable.** Minimal, conventional REST. A single polling endpoint keeps
the frontend simple and avoids the frontend stitching a consistent view from
several responses that were read at different instants.

**Tradeoff.** `GET /sessions/:id` is a slightly "fat" read model. That is the
right call here — it makes the polled view internally consistent by
construction.

---

## D-09 — The transition function, and how the max-2 invariant is guaranteed

**Decision.** All session state changes happen in **one synchronous function**,
`advance(session)` — no `await` between reading `activeCallIds` and writing it.
Timers and routes call it; nothing else mutates session state.

**This is the canonical algorithm.** It is written here, in `docs/`, because it
is the load-bearing design a human reviewer should be able to read without
opening agent config. `.claude/rules/backend.md` points here rather than
repeating it.

```text
advance(session):                       # called once per tick - see D-16
  1. answering = in-flight calls whose ANSWER is due this tick
                 (deterministic order - never rely on Map/Set iteration luck)

  newWinner = null

  2. RESOLVE THE RACE - at most one call may be LIVE at a time:
        if NO call has phase == LIVE and answering is non-empty:
              w = answering[0]
              w.phase = LIVE ; w.answeredAt = now
              winnerCallId = w.id        # REPLACES any previous winner (D-18)
              newWinner = w
        every other call in `answering` stays DIALING - it lost the race
        (if a call is already LIVE, NO call in `answering` enters LIVE)

  3. if newWinner is not null:
        mark every OTHER in-flight call (all still DIALING) for termination
        as CANCELED_BY_DIALER

  4. apply due TERMINAL transitions   (phase -> ENDED,
                                       status + endedAt together, metrics++)
        forced termination uses the phase rule:
              LIVE    -> CONNECTED
              DIALING -> CANCELED_BY_DIALER

  5. CRM-sync each newly terminal call   (idempotent by callId)
  6. release ended calls from activeCallIds
  7. while (activeCallIds.length < 2 && queue non-empty && RUNNING
            && no call has phase == LIVE):        # gate is LIVE, not winnerCallId
         promote next lead -> start call
     (winnerCallId is NOT cleared here - see D-18)

  8. if RUNNING && activeCallIds empty && queue empty:
         status = STOPPED
```

Promotion is a `while` loop bounded by `activeCallIds.length < 2`, so the
ceiling is enforced by the loop condition itself rather than by a check that
could be bypassed. Steps 2-3 run before step 4 so a call that loses the race is
terminated in the same tick, not one tick late.

**Steps 2, 3 and 7 must never be gated on `winnerCallId`.** Under D-18 it is
permanently non-null after the first connect, so gating on it would stop any
later call becoming `LIVE` (step 2) and would cancel every newly promoted call
on sight (step 3) - the session would burn the rest of the queue to
`CANCELED_BY_DIALER` while still looking plausible. The three gates are:

| Step | Gate | Question it asks |
| --- | --- | --- |
| 2 | no call has `phase == LIVE` | is the agent free to take a call? |
| 3 | `newWinner` was set *this tick* | did someone just win a race? |
| 7 | no call has `phase == LIVE` | is the agent free for a new round? |

**Why reasonable.** Node runs one JS callback at a time. If no transition awaits
mid-update, no interleaving can produce three active calls. This makes the
invariant a property of the code's shape, not of careful discipline.

**Tradeoff.** Timer callbacks must not mutate session state directly — they must
call `advance()`. Enforce this in review.

---

## D-16 — What a "tick" is (A-15)

**Ambiguity.** The whole concurrency design is expressed in ticks — "due this
tick", "two calls terminal in the same tick", "two answers in the same tick" —
and the two invariants are stated in those terms. But nothing said what drives
`advance()`, so "same tick" had no definition.

**Decision.**

- **One scheduler per `RUNNING` session.** Starting a session creates a single
  `setInterval`; stopping it (or reaching `STOPPED`) clears it. There is no
  per-call timer.
- **`TICK_MS = 250`.** The callback does nothing but call `advance(session)`.
- **A "tick" is one invocation of `advance()`.** Two events are "in the same
  tick" when both became due before the same invocation — which is exactly the
  race the invariants have to survive.
- Each call carries the timestamps at which its answer and its end become due
  (from the simulator, D-06/D-17). `advance()` applies everything now due.
- **Tests never start the interval.** They advance a fake clock and call
  `advance()` directly. "Same tick" is then produced deliberately by making two
  events due before one call — not by hoping timers coincide.

**Why reasonable.** A single driver is what makes "same tick" meaningful; with
per-call timers, two callbacks are genuinely separate turns of the event loop
and the interesting race becomes hard to produce on purpose. 250 ms is well
inside the 1–2 s poll window (R-89), so the UI never shows state more than a
tick stale, and it is cheap — a handful of timers doing near-nothing.

Tick length and poll interval are **independent**: the tick advances the
simulation, the poll reads it. Do not couple them.

**Tradeoff.** Up to 250 ms of latency between an event becoming due and being
applied. Irrelevant here — the UI polls an order of magnitude slower. A smaller
tick costs CPU for no visible benefit.

---

## D-17 — Call timing and outcome mix (A-9, part two)

**Ambiguity.** D-06 fixed the simulator *seam* and D-13 fixed the *seed*, but
nothing decided how long a call rings, how long a conversation lasts, or how
often each outcome occurs. That directly determines whether the demo looks alive.

**Decision.** Defaults for the seeded simulator (all configurable):

| Parameter | Default |
| --- | --- |
| Ring duration (dial → answer or give up) | 2–5 s |
| Talk duration (answer → hangup) | 6–15 s |
| `CONNECTED` | 35% |
| `NO_ANSWER` | 25% |
| `VOICEMAIL` | 20% |
| `BUSY` | 20% |

`CANCELED_BY_DIALER` is never drawn — it is imposed by the dialer (D-02), not an
outcome the provider returns.

**Expected connects.** A round dials 2, so at 35% each, a round connects with
probability `1 - 0.65² ≈ 0.58`. Five leads is about 2–3 rounds, so **one or two
connects is the typical run** — do not treat a single-connect demo as a defect
(R-39b). If a demo must show two connects, use more leads rather than inflating
the connect rate.

**Why reasonable.** These make a 5–6 lead session run roughly 60–90 seconds:
long enough for a reviewer to watch a line ring,
win, cancel its partner, talk, and hand back to the queue; short enough to sit
through twice. A ~35% connect rate keeps rounds frequent without making
`NO_ANSWER`/`BUSY`/`VOICEMAIL` rare — all three must appear or the metrics panel
looks broken. Ring shorter than talk mirrors real calling and keeps lines
turning over.

**Tradeoff.** Optimistic against real outbound rates (a real connect rate is far
lower). This is a demo of dialer mechanics, not a simulation of telephony —
stated in `NOTES.md` so the numbers are not mistaken for a claim about reality.

---

## D-10 — Storage (design, not ambiguity)

**Decision.** In-memory `Map`s behind small repository modules. No database.

**Why reasonable.** The spec says explicitly: "it is okay for this to be in
memory". A DB adds setup friction against a 24-hour deadline and a reviewer who
must run `npm install && npm run dev` and have it work.

**Tradeoff.** State is lost on restart. Stated in `NOTES.md` as a known,
deliberate limitation, with "persist to Postgres" listed under what we would do
next.

---

## D-11 — Stop behaviour and empty selection (design, not ambiguity)

**Decision.**

- `POST /sessions/:id/stop` sets `status = STOPPED`, terminates all in-flight
  calls (each running the normal, idempotent CRM sync), and promotes nothing
  further. Stopping an already-stopped session is a no-op returning success.
- **Terminating an in-flight call depends on its phase (D-03):**

  | Phase when terminated | Resulting `status` |
  | --- | --- |
  | `DIALING` | `CANCELED_BY_DIALER` |
  | `LIVE` | `CONNECTED` |

  A `LIVE` call was answered and a conversation happened; ending it — whether by
  natural hangup or by the agent pressing Stop — is a **connection**, not a
  dialer cancellation. This rule holds everywhere a call is force-terminated, so
  `CANCELED_BY_DIALER` only ever lands on a call that was never answered.

  Without this, stopping during a live call would leave `winnerCallId` pointing
  at a `CANCELED_BY_DIALER` call — contradicting Screen 2's "show winner call
  (**if connected**)" and leaving the `connected` metric at 0 despite an
  answered call.
- `POST /sessions` with **zero** `leadIds` is rejected `400`. The Screen 1
  "Create Dialer Session" button is disabled until at least one lead is
  selected.
- Starting an already-running session is a no-op returning current state.

**Why reasonable.** A stopped session must not leave calls dangling in flight,
or the metrics never balance. Rejecting an empty selection at the boundary is
clearer than creating a session that can do nothing.

**Tradeoff.** Rejecting empty selection is a choice; an empty session that
immediately reports `STOPPED` would also be defensible. Chosen for a clearer
error message to the user.

---

## D-12 — How CRM sync reaches the mock CRM (A-11)

**Ambiguity.** Part 2 says "Implement Mock CRM inside backend / **These
endpoints represent an external CRM system** (store data in memory)" — but the
only endpoints it then names are three `GET` inspection routes. Whether the
write path (contact upsert, activity create) must also go over HTTP to
`/mock-crm/*`, or may be a direct in-process call, is never stated.

**Interpretation.** The mock CRM is a **module with its own store and its own
API surface**, called in-process. The write path is a direct function call into
`services/mock-crm`; it does **not** make an HTTP request to the app's own
server.

To keep the "external system" framing honest, the module is treated as a
boundary: the dialer and `crm-sync` may only touch mock-CRM data through that
module's functions, never by reaching into its store. The three specified `GET`
routes are thin readers over the same store.

**Why reasonable.** An app issuing HTTP requests to itself adds a failure mode,
a port dependency, and async in the middle of the terminal transition — which
directly threatens the D-09 "no `await` inside the transition" guarantee that
makes INV-1 and INV-2 hold. The spec's word "endpoints" is satisfied by the
three routes it actually names. Nothing observable to a reviewer differs.

**Tradeoff.** Slightly less faithful to "external system" than a real HTTP hop.
If a reviewer wanted genuine transport realism, the module boundary means only
its implementation changes, not its callers. Noted in `NOTES.md`.

---

## D-13 — Simulator seed (design, not ambiguity)

**Decision.** The default simulator seed is **fixed** (configurable by env var)
so `npm run dev` and a demo replay identically. It is chosen for reproducibility
only.

**Why reasonable.** A reviewer who runs the app twice should see the same run;
a bug report that cannot be reproduced is not actionable. Under the revised
D-02 the session works the whole list, so the queue, metrics and winner are all
exercised on any seed - no curation is needed to make the demo representative.

**Tradeoff.** A fixed default means one run order is seen most often. The seed
is configurable, so a different distribution can be shown on request. State in
`NOTES.md` that the seed is fixed for reproducibility.

---

## D-14 — Session lifecycle and `agentId` (A-12, A-13)

**Ambiguity.** Two gaps, both in `DialerSession`:

1. `status` is exactly `RUNNING | STOPPED`, so a session that has been
   **created but not yet started** must be `STOPPED` - which is also the state
   of a **finished** session. Start-on-`STOPPED` must be legal or nothing could
   ever start, but then the same call would either begin a new session or
   restart a finished one, and the spec says which nowhere.
2. `agentId` is a required field, but Screen 1 has no agent concept, nothing
   seeds an agent, and the spec never says where the value comes from.

**Interpretation.**

*Lifecycle.* Keep `status` exactly `RUNNING | STOPPED` and distinguish the two
`STOPPED` meanings with the **existing** `startedAt`-style data rather than a
new status value:

| State | `status` | `startedAt` | Active calls |
| --- | --- | --- | --- |
| created, not started | `STOPPED` | `null` | none |
| running | `RUNNING` | set | 0-2 |
| finished / stopped | `STOPPED` | set | none |

- `POST /sessions/:id/start` is legal **only when `startedAt === null`**. It
  sets `startedAt` and `status = RUNNING`.
- Start on a `RUNNING` session -> no-op, returns current state.
- Start on a **finished** session (`STOPPED` with `startedAt` set) -> **`409`**.
  **There is no restart.** Re-running the list means creating a new session.
- `session.startedAt` is an added, non-spec field, flagged in `NOTES.md`.

*agentId.* A single hardcoded demo agent, `"agent-1"`, is seeded alongside the
leads. The client sends it as a constant on `POST /sessions`; the server
defaults to it when the field is absent. There is no agent picker, no login, no
agent management.

**Why reasonable.** Adding a third `status` value would alter a specified enum
(the same objection as D-03), so the distinction is carried in data instead.
Refusing restart keeps `metrics` and `leadQueue` meaning one pass over one list;
a restart would need rules for whether counters reset and whether already-called
leads are re-dialed, none of which the spec provides. For `agentId`, the spec
requires the field but the assignment has no authentication and no multi-agent
requirement - inventing an agent-management UI would be scope creep (see
`.claude/rules/scope.md`).

**Tradeoff.** A reviewer clicking Start twice on a finished session gets a `409`
rather than a fresh run; the UI should therefore offer "New session" rather than
re-enabling Start. The hardcoded agent is visibly a stub - called out in
`NOTES.md` under what would come next.

---

## D-15 — Deployment target (A-14)

**Ambiguity.** The Submission section requires deliverables "hosted on any free
webhost service" and an emailed URL, but names no platform, and the spec's
in-memory permission (D-10) sits awkwardly with free hosting.

**Interpretation.**

- **Deploy a walking skeleton on day one**, before feature work - the first
  slice that renders anything goes to the host immediately. Deployment problems
  are discovered at hour 2, not hour 23.
- **One host, both parts.** Prefer a single service that serves the Express/
  Fastify API *and* the built React bundle from one process (Render, Railway,
  Fly.io free tiers all do this). A split client/API deployment doubles the
  config surface and adds CORS and env-var wiring for no reviewer benefit.
- **Cold starts are a known, disclosed limitation.** Free tiers idle out, and
  D-10 keeps all state in memory, so **an idle instance loses sessions, calls,
  and CRM data**. Mitigations, in order:
  1. Seed leads on boot, so a cold instance is always immediately usable.
  2. The frontend handles a `404` on `GET /sessions/:id` by returning to
     Screen 1 with a clear "session expired, please create a new one" message -
     never a crash or a blank screen.
  3. `README.md` and `NOTES.md` state plainly that state is in-memory and a
     cold start clears it, and that a fresh session takes seconds to create.

**Why reasonable.** The deployed URL is one of only two things a reviewer
literally cannot proceed without, so it is scheduled first rather than last.
Persisting to a database to survive cold starts would contradict D-10 and the
spec's explicit in-memory permission; handling the expiry gracefully and saying
so is the honest, cheaper answer.

**Tradeoff.** A reviewer returning after an idle period must create a new
session. That is acceptable **only because it is disclosed and handled**; an
unexplained blank screen would not be. If it proves annoying in practice, a
keep-alive ping is a smaller change than adding persistence.

---

## D-18 — Does `winnerCallId` survive the end of its call? (A-16)

**Ambiguity.** Once the winner is per-round (D-02), a question appears that the
spec never asks: when the connected call ends, does `winnerCallId` clear, or
keep naming that call? An earlier draft said both in different files — the
algorithm cleared it, the stop test asserted it survived. That would have failed
as a phantom bug late in the build.

**Decision — it survives.** `winnerCallId` is **the most recent call that was
answered**. Set at the answer moment; replaced only when a later call is
answered; never set back to `null`. It is `null` only before the first connect.

Consequently the **promotion gate is "no call has `phase === LIVE`"**, not
"`winnerCallId is null`". The two were conflated; they are different questions:

| Question | Field |
| --- | --- |
| Is the agent on a call right now? | any call with `phase === LIVE` |
| Which call most recently connected? | `winnerCallId` |

**Why reasonable.** "Show winner call (if connected)" then reads as: show a
winner once something has connected. A reviewer who watches a session to
completion still sees the winner panel populated, instead of it emptying at the
exact moment the run finishes — under the clearing rule, the panel would be
visible only while a call happened to be live, which is a poor two-minute
review. It also makes D-11's reasoning true: stopping during a live call leaves
`winnerCallId` pointing at a `CONNECTED` call, which is the whole point of the
phase rule there.

**Tradeoff.** "Winner" now means *most recent connect*, not *current call*, so
the panel keeps showing a finished call. Label it accordingly in the UI ("Last
connected" reads better than "Winner" once the call has ended). The invariant
`at most one LIVE call, and if one exists it is winnerCallId` still holds; the
converse does not — `winnerCallId` may name an `ENDED` call.

---

## D-19 — Stack and host (A-17)

**Ambiguity.** The spec offers choices — "Node.js (**Express/Fastify**) + React
(**Vite/Next**)" — and every derived doc passed the choice through unresolved,
while pre-deciding far smaller things. Hour 1 cannot start on an unresolved
stack. The host was likewise only a parenthetical.

**Decision.**

| Layer | Choice |
| --- | --- |
| Backend | **Express** |
| Frontend | **React + Vite** |
| Tests | **Vitest** (both sides) |
| Host | **Render free web service** — *verify the free tier still exists before committing* |

- **Express over Fastify:** more reviewers read Express fluently, and nothing
  here needs Fastify's throughput or schema layer.
- **Vite over Next:** no SSR, no routing, no server components needed. Vite
  builds a static bundle Express can serve directly, which is what makes the
  single-process deployment of D-15 trivial. Next would add a second runtime for
  no requirement in the spec.
- **Vitest:** one runner for both sides, fake timers built in (needed by D-16),
  near-zero config.
- **Single process in production:** Express serves the API **at the literal root
  paths the spec names** (`/mock-crm/contacts`, `/mock-crm/activities`,
  `/leads/:id/crm-activities` — no `/api` prefix) plus the built React bundle,
  from the same port. **Register the API routers before the static/SPA
  middleware, and make the SPA fallback return `index.html` only for paths no
  router matched** — otherwise a catch-all at root swallows the graded
  endpoints. No CORS in production; CORS only for the Vite dev server (R-69).

**Free-tier caution.** Free hosting terms change. **Before spending an hour on
deployment, confirm the chosen host still offers a free tier that can run a Node
web service.** If Render has changed, Fly.io and Railway are the fallbacks;
the D-15 requirements (one process, seed on boot, cold-start disclosure) are
host-agnostic, so switching costs configuration only. Record whichever host was
actually used in `README.md`.

**Tradeoff.** Committing early means a reviewer who prefers Fastify or Next sees
neither. The spec explicitly allows either, so this is a permitted choice, not a
deviation — and stating it in `NOTES.md` as a deliberate pick reads better than
appearing not to have noticed there was a decision.

---

## Decision log — additions by the implementing session

Append new decisions here as `D-20`, `D-21`, … using the same four-part format.
Do not renumber existing entries.
