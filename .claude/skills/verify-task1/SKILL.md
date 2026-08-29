---
name: verify-task1
description: Skeptical QA and acceptance pass over the Task 1 dialer + CRM implementation — audit against the requirements matrix, execute the tests, exercise the API, and prove the max-2 concurrency and callId idempotency invariants. Use before final review or whenever the implementation is claimed complete.
---

# Verify Task 1

You are the **skeptical acceptance gate** for Workstream A. Your job is to find
out what is actually true.

## The rule that defines this skill

> **"The code looks correct" is not evidence.**

Reading a function and concluding it works is not verification. Verification is
running something and observing the result. If you cannot run it, the honest
output is **`Not verified`** — and that is a perfectly acceptable finding.

Assume every claim in the matrix, `NOTES.md`, and any prior session report is
**unproven until you re-establish it**. Prior sessions overclaim; that is
exactly what you are here to catch.

**Do not fix anything.** Report findings. (The user may ask for fixes after.)

---

## Step 1 — Establish the checklist

Read `docs/requirements-matrix.md`, `docs/decisions.md`, and
`docs/source/task1-multi-line-dialer.md`.

The matrix is your checklist. Also check the **matrix itself** for completeness:
does every requirement in the spec have a row? A missing row is a finding.

---

## Step 2 — Execute the tests

Run the suite. Capture the **real** output.

Record: total, passed, failed, skipped. Name any failures. If the suite does not
run at all, that is a top-severity finding — stop and report it.

Then check test **quality**, not just the count:

- Is there a test that actually asserts `activeCallIds.length <= 2`?
- Is there a test that handles the **same terminal event 3×** and asserts one
  activity in **each** store?
- Is there a **two-calls-terminal-in-the-same-tick** test?
- Is there a **two-calls-answered-in-the-same-tick** test?
- Is there a **stop-while-the-winner-is-LIVE** test? (D-11)
- Do tests `sleep` or depend on real timers? (flaky — finding)
- Does any test use unseeded randomness? (finding)
- Do tests assert mock call counts instead of observable state? (weak coverage)

A green suite that never exercises the invariants is a **false sense of
security** — report it as such.

---

## Step 3 — Prove INV-1 (max 2 concurrency)

Do not take the ceiling on trust. Read `services/dialer` and trace every path
that can add to `activeCallIds`:

- session start
- promotion after a terminal call
- promotion after a stop/restart
- any timer callback

For each, answer concretely:

1. Is there an `await` between reading and writing `activeCallIds`? **Any yes is
   a finding** — it is an interleaving point.
2. Is promotion bounded by the ceiling in the loop condition itself, or by a
   separate check that a code path could bypass?
3. Does a timer callback mutate session state directly instead of calling
   `advance()`?
4. What happens when **two calls complete in the same tick**? Trace it.

Then verify at runtime: run a multi-lead session and assert on every poll that
no more than 2 calls are active and no terminal call is still listed as active.

---

## Step 4 — Prove INV-2 (CRM idempotency)

Trace `crm-sync`:

1. Is the idempotency index checked **before** any write?
2. On a hit, does it write to **neither** store?
3. Is there an `await` between the app-store write and the mock-CRM write?
   (A partial write is the exact bug this invariant exists to prevent.)
4. Is the contact upsert also idempotent — two calls for one lead giving **one**
   contact?
5. Do all five statuses sync, including `CANCELED_BY_DIALER`?

Runtime check, after a completed session:

```text
mock-crm activities count == total calls created
app CRMActivity count     == total calls created
mock-crm contacts count   == distinct leads attempted
```

Any mismatch is a duplicate-write or double-count bug. Report it with numbers.

---

## Step 5 — Exercise the API

Start the server and actually call the endpoints. Record real responses.

The three **specified** paths, at their literal paths — a reviewer will curl
these:

```text
GET /mock-crm/contacts
GET /mock-crm/activities
GET /leads/:id/crm-activities
```

Then: `GET /leads`; `POST /sessions` (and with `[]` → expect `400`);
`POST /sessions/:id/start`; `GET /sessions/:id`; `POST /sessions/:id/stop`;
unknown ids → expect `404`, not `500`.

Check that `GET /sessions/:id` really contains everything Screen 2 needs in one
response: status, metrics, `winnerCallId`, 2 lines with name/phone/status, and
per-call CRM status.

---

## Step 6 — Queue progression and metrics

Run a session with **more than 2 leads** and observe across polls:

- exactly 2 active while the queue has depth
- a freed line is filled by the next queued lead
- **every selected lead is eventually dialed** (D-02: the session works the whole
  list). Leads still queued when the session reports `STOPPED` are a defect
  unless the agent stopped it early
- `connected + failed + canceled == attempted` once nothing is in flight
- each counter's mapping matches D-04 (a balanced total can still hide a wrong
  mapping — check the individual counters)
- the winner is set at the **answer** moment (`DIALING` → `LIVE`), not at
  terminal status, and the other line becomes `CANCELED_BY_DIALER` (D-03)
- a `LIVE` call has `status === null`, `endedAt === null`, and **no** CRM
  activity yet; it gets `status = CONNECTED` and syncs only when it ends
- the session reaches `STOPPED`

---

## Step 7 — Frontend behaviour

Where it can be run, exercise the real flow:

```text
view leads -> select >2 -> create session -> start
  -> observe 2 active lines
  -> observe terminal outcomes
  -> observe queue advancement
  -> observe metrics
  -> observe CRM activity status per call/lead
  -> observe session completion
```

Check specifically: 2 line slots always rendered (idle shows as idle);
name/phone/status present; **poll interval is 1–2s** (read the constant and
watch the network); polling **stops** at `STOPPED`; winner panel appears; a
failed poll does not blank or crash the screen; no dialer logic in the client.

If a browser is unavailable, say so — inspect the polling hook and components
statically and label the result **`Not verified`**. Do not describe a browser
session you did not have.

---

## Step 8 — Setup

Verify `npm install` and the documented run command **actually work**, ideally
from a clean checkout. Every command in the README must have been run. A broken
setup instruction is a top-severity finding.

---

## Step 9 — Hunt for unverified claims

Compare `NOTES.md`, the matrix, and any prior report against what you just
established. Flag:

- matrix rows marked `Done`/`Tested` with no corresponding test
- `NOTES.md` claims of verification that no test or run supports
- "tests pass" claims where the suite fails or does not exist
- claimed manual/browser verification with no evidence it happened
- requirements in the spec with **no matrix row at all**

---

## Output

```markdown
## Verification summary
Ran: <what you actually executed>   Not run: <what you could not, and why>

## Test execution
<real output summary; failures named>

## INV-1 max-2 concurrency
Verdict: Verified | Violated | Not verified
<evidence — traced paths, runtime observations>

## INV-2 CRM idempotency
Verdict: Verified | Violated | Not verified
<evidence — counts, traced writes>

## API
<endpoint: status, real response shape>

## Queue, metrics, winner
<observations>

## Frontend
<observations, or Not verified + why>

## Setup
<what was run and the result>

## Findings
Severity | Requirement | What is wrong | Evidence

## Unverified claims found
<claims that were not backed by evidence>

## Missing requirements
<spec items with no row or no implementation>
```

Never fabricate output, responses, screenshots, or results. Where something was
not checked, say **`Not verified`** and why.
