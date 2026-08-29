# Test Strategy — Task 1

> **Derived project guidance.** Not part of the client's assignment.
>
> The assignment says: *"AI tools allowed: Yes ... **Show what you verified.**"*
> That makes verification a graded deliverable. This file defines what "verified"
> means here.

---

## 0. Principle

A take-home is not correct because it compiles or because the UI looks right in
one lucky run. The dialer's interesting behaviour is **concurrent and
event-driven**, which is exactly the kind of behaviour that appears to work in a
demo and fails under a reviewer's second try.

So: test **behaviour and invariants**, not implementation details. Do not write
tests that assert a function was called; assert that the system's observable
state is legal.

---

## 1. What makes this testable at all

**Everything depends on the simulator seam (D-06).** If call outcomes and
timings are real timers and `Math.random()`, none of the tests below can exist
in a reliable form.

Required before writing dialer tests:

- `CallSimulator` interface deciding `(outcome, durationMs)`.
- A **scripted** test implementation: the test states exactly which lead gets
  which outcome and drives completion explicitly.
- **Injected time.** Tests never `sleep`. They advance a fake clock and call
  `advance()` directly — **the `setInterval` is never started in tests** (D-16).
- **"Same tick" is produced deliberately**, not hoped for: make two events fall
  due before a single `advance()` call. That is the entire point of the tick
  model (D-16) — it turns the race the invariants must survive into something a
  test can create on demand.

Rule: `Math.random()` and bare `setTimeout` must not appear in domain logic.
This is greppable and should be checked in review. The one legitimate timer is
the per-session `setInterval` of D-16, which does nothing but call `advance()`.

---

## 2. Core invariants (highest priority)

These get their own dedicated tests and are asserted as a helper inside every
other dialer scenario.

### INV-1 — `activeCallIds.length <= 2`

Write an assertion helper, e.g. `assertSessionLegal(session)`, checking:

- `activeCallIds.length <= 2`
- no duplicate ids in `activeCallIds`
- every id in `activeCallIds` refers to a call with `endedAt === null`
- no call with `endedAt !== null` appears in `activeCallIds`
- phase/status agree: `phase === ENDED` iff `status !== null` iff
  `endedAt !== null` (a `DIALING` or `LIVE` call must have `status === null`)
- at most one call has `phase === LIVE`; if one does, it is `winnerCallId`
  (the converse does not hold - `winnerCallId` may name an ENDED call)

Call it after **every** state transition in **every** dialer test. An invariant
checked in one test is a test; checked everywhere, it is a safety net.

### INV-2 — one `callId` → at most one CRMActivity

The explicit test: reach a terminal outcome, then invoke the terminal handling
for that same call **three times**, then assert:

- app `CRMActivity` count for that `callId` is exactly `1`
- mock CRM activity count for that `callId` is exactly `1`
- the lead has exactly one contact in the mock CRM

Do this for **each** of the five statuses, not just `CONNECTED`.

---

## 3. Dialer scenarios

Each ends with `assertSessionLegal` and a metrics-balance assertion
(`connected + failed + canceled == attempted` once nothing is in flight).

| Scenario | Expected |
| --- | --- |
| 0 leads selected | session creation rejected `400` |
| 1 lead | exactly 1 active call; 1 line idle; completes cleanly |
| 2 leads | exactly 2 active; queue empty; both complete |
| 5 leads | exactly 2 active at all times; queue drains one at a time |
| session created but not started | `STOPPED` with `startedAt === null`; 0 active calls |
| start on a created session | `RUNNING`, `startedAt` set, up to 2 active |
| start on a **finished** session | `409`; no restart, no new calls (D-14) |
| `POST /sessions` without `agentId` | server defaults to the seeded demo agent (D-14) |
| start twice | no-op; still exactly 2 active, no extra calls created |
| one call terminal (non-connect) | line freed, next lead promoted, still ≤ 2 active |
| **two calls terminal in the same tick** | exactly 2 promoted, **never 3**; both terminal calls synced once each |
| first call **answered** | `winnerCallId` set at the answer moment, while the call is still `LIVE` |
| winner while other line in flight | other call becomes `CANCELED_BY_DIALER`; metrics `canceled` +1 |
| **two calls due to answer in the same tick** | exactly one enters `LIVE` and becomes winner; the other never reaches `LIVE` and ends `CANCELED_BY_DIALER` (never `CONNECTED`) |
| while the winner is `LIVE` | no further promotion from the queue |
| winner call ends | `status=CONNECTED` with `endedAt`, CRM synced once, next round promoted, **`winnerCallId` still points at it** |
| a later call is answered | `winnerCallId` moves to the new call |
| session finishes | `winnerCallId` names the last connected call, so the winner panel is still populated (D-18) |
| 5 leads where lead 2 answers | **all 5 are dialed**; session `STOPPED` only after the queue empties |
| session finishes | `connected` may exceed 1 across rounds |
| queue exhausted **with none answered** | all calls terminal, 0 active, session `STOPPED`, `winnerCallId === null` |
| a `LIVE` call | is still in `activeCallIds`, has `status === null` and `endedAt === null`, and has produced **no** CRM activity yet |
| stop mid-session (both lines `DIALING`) | both → `CANCELED_BY_DIALER`, 0 active, nothing promoted |
| **stop while the winner is `LIVE`** | winner → `CONNECTED` (not cancelled), **`winnerCallId` still points at it** (D-18), `connected` metric +1 |
| stop twice | idempotent; no extra cancellations, no extra CRM activities |
| stop on an already-finished session | no-op, no error |

**Metrics tests.** For a fixed scripted scenario, assert each counter's exact
value — not just the balance. A balanced-but-wrong mapping is a real risk
(D-04).

---

## 4. CRM tests

| Scenario | Expected |
| --- | --- |
| terminal call, lead **without** `crmExternalId` | contact **created** in mock CRM; id written back to lead |
| terminal call, lead **with** `crmExternalId` | existing contact **updated**; no second contact created |
| second call for the same lead | still exactly 1 contact for that lead |
| any terminal outcome | activity created with `disposition` = the `Call_Status`, and non-empty `notes` |
| activity persistence | present in the app `CRMActivity` store **and** the mock CRM store |
| **repeat terminal handling ×3** | exactly 1 activity in **each** store (INV-2) |
| all five statuses | each produces exactly one activity (D-05) |
| full session | activities **in each store** == total calls created (per store, not summed) |

That last row is the cheapest end-to-end idempotency check and is worth
asserting after every multi-lead scenario. Count **each store separately** — a sum would read as 2x the call count and hide a missing write.

---

## 5. API tests

Integration level — real HTTP against the app, in-memory stores reset per test.

- `GET /leads` → 4–8 seeded leads with all fields
- `POST /sessions` → 201/200 with session; queue matches selection
- `POST /sessions` with `[]` → 400
- `POST /sessions/:id/start` → session `RUNNING`, ≤ 2 active
- `POST /sessions/:id/stop` → `STOPPED`, 0 active
- `GET /sessions/:id` → contains status, metrics, lines (name/phone/status),
  `winnerCallId`, per-call CRM status
- `GET /mock-crm/contacts` → **exact path, as specified**
- `GET /mock-crm/activities` → **exact path, as specified**
- `GET /leads/:id/crm-activities` → **exact path, as specified**; only that
  lead's activities
- unknown session id → `404`; unknown lead id → `404`
- shape check: the polling payload contains everything Screen 2 needs, so the
  frontend never needs a second request per tick

The three specified endpoints must be tested at their **literal paths**. A
reviewer will curl them.

---

## 6. Frontend tests

Keep these lightweight — component-level with a mocked API. Do **not** stand up
a browser-automation harness for a 24-hour take-home.

- Screen 1 renders seeded leads; checkboxes toggle selection
- "Create Dialer Session" disabled with 0 selected, enabled with ≥ 1
- Screen 2 renders exactly 2 line slots
- a line card shows lead name, phone, and status
- a `DIALING` call and a `LIVE` call render differently, both driven by
  `phase` rather than by a `Call_Status` value (D-03)
- metrics render from the payload
- winner panel appears only when `winnerCallId` is set
- per-call CRM activity status renders (pending vs created)
- **polling interval is between 1000 and 2000 ms** (assert the number)
- polling is cleared when the session is `STOPPED` and on unmount
- a failed poll shows an error state and does not crash or blank the screen

---

## 7. Integration / end-to-end verification (manual, and honestly recorded)

Run once against the real running app before submission. Record the actual
result — including anything that failed.

**The full user flow (R-80..R-92):**

```text
view leads
  -> select leads (more than 2, so the queue is exercised)
  -> create session
  -> start session
  -> observe 2 active lines
  -> observe terminal outcomes appearing
  -> observe queue advancement (a new lead takes a freed line)
  -> observe metrics incrementing
  -> observe CRM activity status per call/lead
  -> session reaches STOPPED
```

Then, with the session finished:

```bash
# On Windows/PowerShell use `curl.exe` - bare `curl` is an alias for
# Invoke-WebRequest, which takes different flags and returns an object.
curl .../mock-crm/contacts        # one contact per attempted lead, no duplicates
curl .../mock-crm/activities      # count == number of calls created
curl .../leads/<id>/crm-activities
```

**Cross-check to actually perform:**
`activities count == attempted` and `contacts count == distinct leads attempted`.
If these disagree, there is an idempotency or double-count bug — investigate
before submitting.

**Clean-clone check (R-100/R-101).** In a fresh directory: clone, `npm install`,
run the documented command, load the app. This must be genuinely performed, not
assumed.

---

## 8. Final acceptance checklist

Before declaring Task 1 done:

1. Full test suite executed; **paste the real summary line** into the session
   report. If anything fails, say so.
2. Every `docs/requirements-matrix.md` row has an honest status. `Todo` and
   `Not verified` are acceptable answers; a false `Done` is not.
3. INV-1 and INV-2 each have a dedicated, passing test.
4. The full user flow above was actually walked in a browser.
5. The three specified CRM endpoints were actually curled.
6. Clean-clone setup actually performed.
7. `NOTES.md` verification claims match what was really run — nothing inflated.
8. `docs/decisions.md` reflects the code as built.

---

## 9. Verification labels

Every claim in reports, `NOTES.md`, and the matrix carries one:

```text
Implemented        code exists
Tested             an automated test covers it and was executed and passed
Manually verified  actually run and the result observed
Not verified       none of the above
```

**Never** write "tests pass", "the API works", "deployment works", or "verified"
unless that exact check ran in this session and its output was seen. Never
fabricate test output, API responses, screenshots, or deployment results.
"Not verified" is always an acceptable answer.
