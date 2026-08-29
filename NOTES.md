# NOTES

Take Home Assignment 1 — Multi-Line Dialer + Mock CRM.
Live: <https://72.61.214.167.sslip.io> · Setup and demo steps: [`README.md`](README.md)

---

## Tradeoffs

**In-memory storage, no database.** The spec says explicitly that in-memory is
fine. A database would add setup friction to `npm install && npm run dev`, which
is the first thing a reviewer runs, in exchange for durability nothing here
needs. The cost is real and I have not hidden it: **a restart or redeploy clears
sessions and CRM data.** Leads are re-seeded on boot so the app is immediately
usable, and the UI handles a session that vanished under it by returning to
Screen 1 with a "session expired" message rather than white-screening.

**Polling, not WebSockets.** The spec requires a 1–2 s poll, so a socket would
have removed a graded requirement in exchange for latency nobody asked for. One
`GET /sessions/:id` returns everything Screen 2 needs, so each tick renders a
view that is internally consistent by construction rather than stitched from
several responses read at different instants.

**Express + Vite over Fastify + Next.** The spec allows either. More reviewers
read Express fluently, nothing here needs Fastify's throughput or schema layer,
and Vite produces a static bundle that Express can serve directly — which is what
makes the single-process deployment trivial. Next would have added a second
runtime for no requirement.

**Calls are simulated behind a seam, not with `Math.random()` sprinkled about.**
One `CallSimulator` interface: a seeded PRNG for dev and the demo, a scripted
implementation for tests. Time is injected too. This is the single decision that
makes the concurrency and idempotency tests meaningful rather than decorative —
without it, "two calls end in the same tick" is something you hope for instead of
something you assert. The cost is one interface and a little dependency
injection. The seed is fixed by default so a demo replays identically; set
`SIM_SEED` to change it.

**The mock CRM is called in-process, not over HTTP to ourselves.** It is a
module with its own store and its own boundary — the dialer may only reach its
data through its functions. An app issuing HTTP requests to itself would put an
`await` in the middle of the terminal transition, which is precisely what breaks
both invariants. Nothing a reviewer can observe differs; the three specified
`GET` routes read the same store.

**Both lines dial in parallel; when one is answered the other is cancelled**
(`CANCELED_BY_DIALER`), so **during a conversation exactly one line is busy.**
That is power-dialer behaviour, not a broken second line — one agent can hold
one conversation. It is worth stating because a reviewer skimming for two
minutes may land mid-conversation, see one active card, and read it as a bug.
The idle slot stays visible and says *"Idle while you are on a call"* for the
same reason. The 2-line design is most visible **between** conversations.

**Scope held back deliberately.** No auth, no persistence, no retry/callback
policy, no real telephony, no agent management. None is in the spec, and against
a 24-hour deadline shared with a second assignment, a complete small product
beats an incomplete large one.

### Where I deviated from the literal text, and why

- **Contact upsert.** The spec says *"If lead has no `crmExternalId`, update
  contact"*, which cannot be done literally — you cannot update a contact that
  does not exist, and the else-branch is never stated. I implemented an upsert:
  **create** when there is no id (writing it back to the lead), **update** when
  there is. It is the only reading where both branches are well-defined and the
  only one that keeps `CRMActivity.crmExternalId` reliably populated.
- **`phase` is an added field.** `Call_Status` has no in-flight value, yet
  Screen 2 must show a status on an active line — and `CONNECTED` is doing double
  duty as both *"was answered"* (which must cancel the other line) and *"finished
  as a connection"* (the CRM disposition). Those are different moments. So
  `phase` (`DIALING | LIVE | ENDED`) tracks where a call is, and `status` holds
  only the final outcome, set together with `endedAt`. **`Call_Status` keeps
  exactly its five specified values** — `DIALING` and `LIVE` never go in it.
  `answeredAt`, `startedAt` on the session, and `completionReason` are likewise
  additions, not spec fields.
- **The winner is per round, not per session.** The spec declares
  `winnerCallId` and never defines it. I read the session as working the whole
  list: dial, connect, talk, wrap, dial again. The metrics decided it — four
  counters only make sense if a session can accumulate several of each, and under
  a session-sticky winner `connected` could only ever be 0 or 1. `winnerCallId`
  means *the most recent call that was answered*; it is never cleared, so the
  panel stays populated after the run and is labelled "Last connected" once that
  call has ended.
- **All five statuses are terminal and each writes a CRM activity**, including
  `CANCELED_BY_DIALER`. A cancelled attempt is still a real attempt against that
  lead. One could argue it is noise in a CRM; it is one predicate to change.

Every ambiguity is written up as *ambiguity → interpretation → why reasonable →
tradeoff* in [`docs/decisions.md`](docs/decisions.md) (D-01…D-20). None of them
is presented as though the spec required it.

---

## What I'd do next

In priority order.

1. **Persistence.** Postgres behind the existing store modules — they are already
   the seam. Sessions surviving a restart is the single biggest gap.
2. **A real telephony provider.** The `CallSimulator` interface is where a
   Twilio/SIP adapter would go; the dialer would not change, but webhook-driven
   events arriving asynchronously would need care to preserve the "no `await`
   inside the transition" property that guarantees the concurrency ceiling.
3. **Retry and callback policy.** `NO_ANSWER` and `BUSY` should be re-queued on a
   schedule rather than dropped after one attempt. Deliberately omitted — the
   spec does not ask, and it needs rules (max attempts, backoff, time-of-day)
   that would be invention.
4. **Auth and multi-agent.** `agentId` is currently a hardcoded `agent-1` stub
   because the spec requires the field but supplies no agent concept.
5. **Configurable concurrency.** Fixed at 2 as specified. The ceiling is one
   constant, but the promotion loop and the winner policy would need a test pass
   at N > 2.
6. **Richer dispositions and notes.** Free-text agent notes, wrap-up codes,
   next-action scheduling.
7. **Observability.** Structured logs and a metrics endpoint. Debugging a race in
   a live dialer without them is unpleasant.
8. **Accessibility pass.** Basic labels are there; it has not been through a
   screen reader or an axe audit.

---

## How I used AI tools

I built this with **Claude Code (Opus 5)**, driving it from a repository I had
already set up with the assignment sources, a requirements matrix, and a written
decisions file. That preparation mattered more than the prompting: the
ambiguities were resolved and recorded *before* implementation started, so the
model was implementing decisions rather than inventing them mid-file.

**What it did:** the whole implementation, in tested vertical slices —
skeleton, deployment, models and stores, the simulator seam, the dialer state
machine, CRM sync, the API, both screens, the tests, and these docs. It also
provisioned the VPS over SSH and drove a headless Chrome to verify the deployed
UI.

**What I had to correct, or what it caught and corrected:**

- **The deployment plan was wrong on contact with reality.** The decisions file
  specified Caddy for TLS. The target VPS already runs nginx on :80 and :443 for
  sixteen unrelated production sites, so Caddy had nowhere to bind and installing
  it would have displaced a live TLS terminator. Switched to a new nginx server
  block plus certbot, recorded as D-20. The illustrative `localhost:3000` in the
  same decision was also an already-occupied port.
- **A test asserting the wrong contract.** An early test checked that an
  arbitrary path returns 404. It passed only while `client/dist` did not exist —
  once the bundle was built, that path became a legitimate SPA route. The
  guarantee that actually matters is that unmatched *API* paths return JSON 404
  instead of the HTML shell, so the test now asserts that, which also guards the
  router-ordering constraint that keeps the SPA fallback from swallowing the
  graded `/mock-crm` endpoints.
- **A documented estimate that measurement contradicted.** D-17 predicted a
  5-lead run would take 60–90 s. A measured run took **23.2 s** — the estimate
  assumed sequential rounds, but the two lines ring in parallel and only a
  connect adds talk time. The parameters were right; the derived figure was not.
  Corrected in the decision rather than left to mislead.
- **A UI defect that only a browser could show.** The winner panel was headed
  *"Last connected"* for the whole first round, before anything had connected.
  Component tests passed because they were checking the populated case. Caught by
  screenshotting the deployed app, then fixed test-first.

**How I checked its output:** by running things, not by reading them. Beyond the
suite, I **mutation-tested the tests** — deliberately introduced five bugs
(raised the concurrency ceiling to 3, removed the promotion gate, gated the
winner on `winnerCallId` instead of a live call, dropped the phase rule for
forced termination, removed the stop-polling branch) and confirmed each was
caught, then reverted it. A green suite proves nothing if the assertions do not
bite. Results are in the section below.

---

## What I verified

Labels are literal. Everything under *Tested* and *Manually verified* was
executed and its output observed. *Not verified* means exactly that.

### Tested — automated, executed, passing

`npm test` → **116 passing** (96 server, 20 client). No skipped tests.

| Suite | Tests | Covers |
| --- | --- | --- |
| `dialer.test.js` | 33 | the state machine, both invariants, the whole `docs/test-strategy.md` catalogue |
| `crm-sync.test.js` | 18 | contact upsert, activity creation, **INV-2** |
| `api.test.js` | 18 | every endpoint including the three specified paths, and the error codes |
| `models-and-seed.test.js` | 16 | spec field names, enum contents, seed bounds |
| `simulator.test.js` | 9 | determinism, D-17 bounds, the test seam |
| `health.test.js` | 2 | API paths are not swallowed by the SPA fallback |
| `App.test.jsx` (client) | 20 | both screens, every required element, polling behaviour |

The dialer tests call an `assertSessionLegal()` helper **after every transition
in every test**, not just in a dedicated invariant test — so a violation is
caught in whichever scenario actually triggers it. It asserts the ceiling, no
duplicate ids, no ended call holding a line, that `phase`/`status`/`endedAt`
agree, and that at most one call is live.

Specifically proven:

- **INV-1** — two calls ending in the *same tick* promote exactly two, never
  three; two answers in the same tick produce exactly one live call and the loser
  ends `CANCELED_BY_DIALER` rather than `CONNECTED`; the ceiling holds across a
  full 6-lead run, on start, on stop, with fewer leads than lines, and with an
  exhausted queue.
- **INV-2** — handling the same terminal event **three times** leaves exactly one
  activity in the app store *and* one in the mock CRM store *and* one contact —
  checked for **all five statuses**, not just `CONNECTED`. A stronger variant
  asserts the contact record is byte-for-byte unchanged after a repeat, proving
  the early return happens before any write rather than doing idempotent-looking
  rewrites.
- Metrics balance (`connected + failed + canceled == attempted`) after every
  scenario, plus exact per-counter values for a fixed script.
- Polling: the interval constant is asserted to be within 1000–2000 ms, polling
  stops on `STOPPED` and on unmount, and a failed poll shows an error while
  keeping the last good data on screen.

**Mutation-tested** (each bug introduced, suite run, bug reverted):

| Deliberate bug | Tests that failed |
| --- | --- |
| concurrency ceiling raised to 3 | 14 |
| promotion no longer gated on a live call | 3 |
| winner gated on `winnerCallId` instead of a live call | 1 |
| forced termination always `CANCELED_BY_DIALER` | 1 |
| polling no longer stops on `STOPPED` | 1 |

### Manually verified — ran it and observed the result

- **The deployed app**, <https://72.61.214.167.sslip.io>: real Let's Encrypt
  certificate, HTTP 301s to HTTPS, one process serving both the API and the
  bundle.
- **A full 6-lead session on the deployed app**, watched to completion:
  6 attempted → **6 activities in `/mock-crm/activities`, 6 contacts in
  `/mock-crm/contacts`**, metrics balanced, every completed call carrying a CRM
  activity id, `winnerCallId` still naming the connected call after the run.
- **The three specified endpoints curled at their literal paths**, locally and on
  the deployed app, plus `GET /leads/:id/crm-activities` returning only that
  lead's activity.
- **Error paths, observed:** `400` on an empty selection, `404` on an unknown
  session and an unknown lead, `409` on restarting a finished session.
- **The UI in a real browser** (headless Chrome, driven over CDP against the
  deployed URL, screenshots inspected): Screen 1 with six leads and Create
  disabled at zero selected; then clicking through actual DOM elements to
  Screen 2; a captured **live call** showing Line 2 `CONNECTED — LIVE`, Line 1
  present and labelled *"Idle while you are on a call"*, the winner panel
  populated, `connected` still 0 because the live call had not ended, and the
  other line already `CANCELED_BY_DIALER` with its CRM activity created; and the
  **finished session** with the heading correctly switched to "Last connected".
- **Call timings measured** against the real seeded simulator: rings of
  2.9/3.4/4.2/3.7/5.0 s and an 11.1 s conversation — inside the intended 2–5 s
  and 6–15 s bands.
- **`npm install` and `npm run dev`** from the repository root: API on 3200,
  Vite on 5173.
- **A clean clone from GitHub**, then `npm install` and `npm test` — see the
  README commands; this was run to confirm a reviewer starting from scratch gets
  a working app.
- **No dialer logic in the client**: `grep` over `client/src` finds exactly one
  timer, the poll itself, and no metric arithmetic, winner logic, or randomness.
- **No randomness in domain logic**: `grep -rn "Math.random\|setTimeout"` over
  `server/src` matches only the comment that names them. The one legitimate timer
  is the per-session 250 ms `setInterval` that does nothing but call `advance()`.

### Not verified

- **Concurrent sessions.** Everything was exercised with one session at a time.
  The stores are keyed by id and the tick is per-session, so I expect it to work,
  but I did not test two sessions running simultaneously and will not claim it.
- **Browsers other than Chromium.** No Firefox or Safari run.
- **Mobile devices.** There are CSS breakpoints; I never opened it on a phone.
- **Load or long-running behaviour.** The longest run observed was about 25
  seconds. No memory or timer-leak testing beyond asserting the interval is
  cleared.
- **Accessibility.** Checkboxes have labels and errors use `role="alert"`; there
  has been no screen-reader or automated audit.
- **Restart resilience beyond the 404 path.** I verified the UI recovers from a
  lost session; I did not test a restart *mid-call*.
