# Rule — Testing

Full scenario catalogue: `docs/test-strategy.md`. This file is the working
discipline.

---

## What to test

Test **behaviour and invariants**, not implementation details. Assert that
observable state is legal — not that a function was called.

Priority order, if time runs short:

1. **INV-1** — `activeCallIds.length <= 2` on every path
2. **INV-2** — one `callId` → at most one CRMActivity, in **both** stores
3. Queue advancement and metrics correctness
4. The three specified CRM endpoints at their literal paths
5. Everything else

The first two are non-negotiable. A submission without a passing test for each
is not finished, whatever else is done.

---

## Determinism is a prerequisite

Dialer tests only mean something if outcomes and timing are controlled (D-06).

- Inject a **scripted** `CallSimulator`: the test declares which lead gets which
  outcome and drives completion explicitly.
- Inject time. **Never `sleep` in a test.** A test that waits on a real timer is
  slow, flaky, and proves less.
- **Never start the session `setInterval` in a test** (D-16). Advance a fake
  clock and call `advance()` directly — that is how "same tick" scenarios are
  produced deliberately rather than by luck.
- Reset in-memory stores between tests so ordering cannot matter.

If a test needs randomness to pass, the design is wrong — fix the seam, not the
test.

---

## The invariant helper

Write one helper and call it after **every** transition in **every** dialer test:

**The assertion list lives in `docs/test-strategy.md` §2 and is not repeated
here** — same reason D-09 keeps one copy of `advance()`: two copies drift.

One dedicated invariant test is a test. The same assertion everywhere is a
safety net that catches the bug in whichever scenario actually triggers it.

Pair it with the metrics balance whenever nothing is in flight:

```text
connected + failed + canceled === attempted
```

---

## Scenarios that must exist

Do not ship without these:

- 0 / 1 / 2 / >2 selected leads
- **two calls terminal in the same tick** → exactly 2 promoted, never 3
- a `LIVE` call has `status === null` and no CRM activity until it ends
- **two calls due to answer in the same tick** → exactly one enters `LIVE`; the
  loser ends `CANCELED_BY_DIALER`, never `CONNECTED`
- winner cancels the other line
- no promotion while the winner is `LIVE`; promotion **resumes** once it ends
- stop with both lines `DIALING` → both `CANCELED_BY_DIALER`, 0 active, nothing
  promoted
- **stop while the winner is `LIVE`** → winner ends `CONNECTED`, not cancelled
- stop twice → idempotent, no extra CRM activities
- queue exhausted with none answered → `STOPPED`, `winnerCallId === null`
- **same terminal event handled 3× → 1 activity in each store**, for **each** of
  the five statuses
- lead with and without `crmExternalId` → create vs update, never 2 contacts
- total activities across a session == total calls created

---

## Regression discipline

Every bug found — by you, by a review agent, or by the user — gets a failing
test **first**, then the fix. Especially concurrency and idempotency bugs: they
are precisely the ones that come back, and a reviewer who sees a test named for
the bug reads it as evidence of engineering judgement.

Never delete or weaken a test to make a suite green. If a test is wrong, fix the
assertion and say why in the session report.

---

## Frontend tests

Component-level with a mocked API. Keep them cheap. No browser-automation
harness for a 24-hour take-home — the cost is not repaid.

Must cover: 2 line slots always rendered; name/phone/status on a card; create
button disabled at 0 selected; **poll interval asserted between 1000–2000 ms**;
polling cleared on `STOPPED` and on unmount; a failed poll shows an error and
does not crash.

---

## Reporting results

Run the suite. Report the **real** summary line. If tests fail, say which and
why — a failing test honestly reported is fine; a fabricated pass is not.

Use the labels every time:

```text
Implemented / Tested / Manually verified / Not verified
```

**Never** claim "tests pass" without having just run them in this session and
seen the output. Never invent test output, coverage numbers, or timings. If you
did not run it, the answer is "not verified" — and that is an acceptable answer.
