---
name: implement-task1
description: Implement Workstream A — the Multi-Line Dialer (2 lines) + mock CRM MVP — incrementally, in tested vertical slices. Use when building, extending, or fixing the Task 1 application. Explicitly excludes Task 2 (V2 product proposal), which is planning only.
---

# Implement Task 1 — Multi-Line Dialer + CRM MVP

You are building **Workstream A only**.

```text
Task 1 = BUILD    <- this skill
Task 2 = PLAN     <- not this skill, not now, not "while you're in there"
```

If you are about to write code for AI voice agents, gatekeepers, PIC
verification, human-worker pools, handoff, briefings, likely-to-buy signals, PII
redaction, or real telephony — **stop**. That is Task 2. See
`.claude/rules/scope.md`.

---

## Loop

Work in **vertical slices**. Each slice ends runnable and tested. Do not write
the whole backend before running anything.

```text
inspect -> understand scope -> plan -> implement -> test -> verify
        -> update documentation -> continue
```

---

## Step 1 — Inspect (do this before proposing anything)

Read, in order:

1. `CLAUDE.md`
2. `docs/assignment-scope.md`
3. `docs/requirements-matrix.md`
4. `docs/decisions.md` — **all** of it; these are the interpretations already
   chosen, and skipping the later ones loses deployment (D-15), the tick model
   (D-16), and session lifecycle (D-14)
5. `docs/source/task1-multi-line-dialer.md` — **the actual spec**

Then inspect the repository as it actually is. Do not assume a file's contents
from its name.

**The only Task 1 spec is `docs/source/task1-multi-line-dialer.md`** (verbatim
from the authoritative PDF).

---

## Step 2 — Plan

Identify which matrix rows the next slice covers. State the slice, the rows, and
how you will prove it. Keep the plan short — this is a 24-hour build, not an
architecture exercise.

If you hit an ambiguity the decisions file does not cover: pick the
simplest defensible reading, add a `D-nn` entry, and continue. Do not stall, and
do not silently guess.

---

## Step 3 — Implementation order

Roughly this order; deviate if the repo makes a better sequence obvious, but
keep two principles: **the domain and its invariants come before the HTTP and
UI layers**, and **the two things a reviewer cannot proceed without are
scheduled first, not last.**

1. **Project skeleton** — `server/` + `client/`, root scripts so `npm install`
   and `npm run dev` work. Verify it starts *before* building on it.
2. **Deploy the walking skeleton** (D-15, R-108a/b) — get *anything* on the free
   host now, from one process serving API + built bundle. Deployment breaks at
   hour 2 or hour 23; choose hour 2.
3. **Domain models + stores + seed** (R-00…R-12) — exact field names and enums.
4. **Call simulator seam** (D-06, R-35) — interface, seeded impl, scripted impl.
   Build this **before** the dialer; it is what makes the dialer testable.
5. **Dialer session state machine** (R-20…R-38) — the single synchronous
   `advance()`. Ceiling, queue promotion, per-round winner, lifecycle (D-14).
6. **CRM sync + mock CRM** (R-40…R-50) — contact upsert, activity to **both**
   stores, idempotency index keyed by `callId`.
7. **Backend tests** — INV-1 and INV-2 first, then queue, metrics, winner, stop.
   Run them.
8. **API routes** (R-60…R-69) — the three specified paths verbatim, plus session
   endpoints. Thin handlers.
9. **API integration tests** — run them.
10. **Frontend Screen 1** (R-80…R-83).
11. **Frontend Screen 2 + polling** (R-84…R-93).
12. **Redeploy and walk the flow on the deployed URL**, not just locally.
13. **Frontend tests** where they are cheap and meaningful.
14. **Documentation** — README, `NOTES.md`, matrix statuses, decisions.
15. **Reviews** — `backend-reviewer`, `frontend-reviewer`, `qa-reviewer`; fix
    findings; re-verify.
16. **Send the submission email** (R-110) — *the user sends this, not Claude.*
    Remind them; do not let it be the thing that ran out of time.

---

## Step 3b — Timebox and triage

The deadline is **24 hours from the assignment email**, covering *both* tasks.
Task 2 is a separate written deliverable that also needs hours. Rough shape:

| Phase | Target |
| --- | --- |
| Skeleton + deployed walking skeleton | first ~1h |
| Backend domain, dialer, CRM, tests | ~4h |
| API + integration tests | ~1h |
| Frontend both screens + polling | ~3h |
| Verification, docs, reviews, fixes | ~2h |

**If you are running out of time, cut in this order** — and say what you cut in
`NOTES.md` rather than leaving it silently missing:

1. Frontend component tests (backend tests are the ones that prove the
   invariants)
2. Styling polish beyond legible
3. The completed-calls list on Screen 2 (R-95 — ours, not spec-required)
4. `GET /leads/:id/crm-activities` niceties beyond returning the list

**Never cut, in any circumstance:**

- the two invariants and their tests (INV-1, INV-2)
- the three specified CRM endpoints at their literal paths
- both screens with the specified elements and 1–2s polling
- a working `npm install` + `npm run dev`
- the deployed URL (R-108) and the emailed submission (R-110)
- honest `NOTES.md` verification claims

**Minimum viable submission**, if everything goes wrong: a deployed app where a
reviewer can select leads, start a session, watch 2 lines with the queue
advancing and metrics moving, see CRM activity status per call, and curl the
three CRM endpoints — with `npm install && npm run dev` working and an honest
`NOTES.md`. That beats a feature-complete local-only repo every time.

---

## Step 4 — The two things that must not break

**INV-1 — `activeCallIds.length <= 2`.** Guaranteed by shape, not vigilance: one
synchronous transition function, no `await` between reading and writing
`activeCallIds`, and promotion inside a `while` loop bounded by the ceiling
itself. Reason explicitly about: start, terminal transition, freeing a line,
promoting, **two calls completing in the same tick**, winner cancellation, stop,
exhausted queue.

**INV-2 — one `callId` → at most one CRMActivity.** Check the idempotency index
before any write; on a hit, write nothing. Both stores written together, no
`await` between them.

Details in `.claude/rules/backend.md`.

---

## Step 5 — Test as you go

Do not batch testing to the end. Each slice gets its tests before the next
begins.

Use the scripted simulator and injected time — **never sleep in a test**. Call
`assertSessionLegal()` after every transition in every dialer test.

**Run the tests and read the output.** A slice is not done because the code
looks right.

---

## Step 6 — Update documentation

After each slice: update the matrix `Status` honestly, and add any new `D-nn`.

---

## Constraints

**Simplicity.** In-memory stores, plain Express/Fastify, plain React with
`useState`/`useEffect`/`fetch`. No DB, Redis, broker, WebSockets, auth,
Kubernetes, Redux, or component library. In-memory is explicitly permitted by
the spec. Polling at 1–2s is explicitly required — do not upgrade it.

When two designs both satisfy the requirement, take the one with fewer moving
parts. Complexity added to look senior reads as poor judgement.

**Scope.** If it is not in the matrix and not in a direct spec quote, do not
build it. Note it under "what I'd do next" in `NOTES.md` instead — restraint,
recorded, reads as judgement; unrequested features read as an inability to
prioritise against a deadline.

**Honesty.** Never say "tests pass", "the API works", or "verified" unless that
check ran in this session and you saw the output. Never fabricate test output,
API responses, screenshots, or deployment results. Label every claim
`Implemented` / `Tested` / `Manually verified` / `Not verified`.

---

## Finishing a slice

Report: what was built, which rows it covers, what was actually run and its real
output, what is still unverified, and what is next. Keep it short.
