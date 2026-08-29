# CLAUDE.md — Project Operating Policy

This repository holds a **24-hour take-home assignment** with **two separate
workstreams**. Read this file first, then `docs/assignment-scope.md`.

## Project status — read before planning

```text
STATE:  configuration complete, IMPLEMENTATION NOT STARTED
CODE:   none - no package.json, no server/, no client/, no README.md, no NOTES.md
GIT:    not a repository yet (R-109 requires one; `git init` early)
MATRIX: all rows Todo
```

**The deadline can be derived, so derive it rather than asking first.**
`emailRaw.txt` reads "8:00 PM (3 hours ago)" and was saved **2026-08-29 23:37**,
putting the email at **~20:00 on 2026-08-29** and the 24-hour deadline at
**~20:00 on 2026-08-30**.

Compute the remaining time from the current date, state it, and say which parts
of the `implement-task1` Step 3b budget still fit — then ask the user only to
**confirm**, and carry on rather than blocking on the answer.

Budget both workstreams: **~11h Task 1** (Step 3b) + **~4.5h Task 2**
(`plan-task2` Step 0) = **~15.5h of work**. Against a deadline under ~19h away
from a standing start with no sleep, **the slack is thin — roughly 3 hours, and
only if nothing goes wrong.** Say so to the user up front rather than letting
them discover it at hour 18. If time is lost, cut using Step 3b's list; do not
silently extend Task 1 into Task 2's budget — both are graded.

If the derivation ever conflicts with what the user says, the user wins.

---

## The one rule that matters most

```text
WORKSTREAM A (Task 1) = BUILD    -> Multi-Line Dialer (2 lines) + CRM MVP
WORKSTREAM B (Task 2) = PLAN     -> V2 AI-to-Human Dialer product proposal
```

**Task 1 is the implementation target. Task 2 is a written product-strategy
deliverable and is never implemented as code.**

Unless the user explicitly says they are working on Task 2, assume every
request is Task 1.

If you catch yourself about to write code for AI voice agents, gatekeeper
navigation, PIC verification, human-worker pools, live handoff, briefing cards,
likely-to-buy scoring, PII redaction, supervisor consoles, or real telephony —
**stop**. That is Task 2 leaking into Task 1. See `.claude/rules/scope.md`.

---

## Authoritative sources

| Source | Covers | Status |
| --- | --- | --- |
| `Take Home Assignment.17.08.26.pdf` (repo root) | Task 1 **and** a Task 2 summary | **Authoritative** |
| `docs/source/task1-multi-line-dialer.md` | Task 1 | Verbatim transcription of the PDF's Task 1 pages — **the working Task 1 spec** |
| `V2_PRODUCT_REFINEMENT_EXERCISE.md` | Task 2 | Authoritative, full |
| `emailRaw.txt` | Framing, 24h deadline | Authoritative |

> A file named `Take Home Assignment.17.08.26.md` previously sat in the repo
> root. It was an **incomplete PDF conversion that had silently dropped all of
> the Task 1 pages** and contained only Task 2 / V2 content, while its filename
> implied it was the whole assignment. It has been **deleted** to prevent a
> future session mistaking it for the Task 1 spec. Nothing was lost: the PDF is
> authoritative, Task 1 is transcribed in `docs/source/`, and Task 2 is covered
> in full by `V2_PRODUCT_REFINEMENT_EXERCISE.md`. **Do not recreate it.**

**Do not edit, "improve", reinterpret, or reformat any source file.** Derived
guidance goes in `docs/`, and every derived file is labelled as derived.

---

## Derived project guidance (written by us, not the client)

- `docs/assignment-scope.md` — what is Task 1, what is Task 2, what is out of scope
- `docs/requirements-matrix.md` — the Task 1 implementation + audit checklist
- `docs/decisions.md` — ambiguities and the interpretations chosen
- `docs/test-strategy.md` — what must be proven and how
- `docs/task2-reference.md` — Task 2 summary, for when Task 2 is worked on

---

## Critical Task 1 invariants

These are domain invariants, not features. They must hold at every moment, and
they must be covered by tests.

1. **Concurrency ceiling** — `activeCallIds.length <= 2`, always, in every code
   path: start, terminal transition, line release, queue promotion,
   near-simultaneous completion, stop, empty queue.
2. **CRM idempotency** — one `callId` produces **at most one** CRMActivity, in
   the app store *and* in the mock CRM store, no matter how many times the
   terminal event is handled.

Details and reasoning live in `.claude/rules/backend.md`; the canonical
`advance()` algorithm is `docs/decisions.md` D-09, and what drives it is D-16.

---

## Two things a reviewer cannot proceed without

Everything else is negotiable under time pressure. These are not:

1. **A reachable deployed URL** (R-108, D-15). Deploy a **walking skeleton on
   day one**, before feature work — step 2 of the implementation order, not the
   last step. A redeploy clears in-memory state (D-10), so seed on boot, handle
   an expired session in the UI, and disclose it.
2. **The submission email sent** to `intern1.aisalesdr@gmail.com` and
   `ellee@aisalesdr.co` with the URL and repo link (R-110). **The user sends
   this — never Claude.** Remind them; do not let it be what runs out of time.

A locally-perfect, undeployed repo scores worse than a rougher deployed one.

---

## How to work

**Inspect before modifying.** Read the relevant files first. Never assume a
file's contents from its name.

**Work incrementally.** Small vertical slices that end in a runnable, tested
state. Do not write the whole backend before running anything.

**Scope does not expand silently.** If something is not in
`docs/requirements-matrix.md`, it is not being built. If you believe a
requirement is missing from the matrix, add the row and say so — don't just
build it.

**Keep the matrix current.** When a requirement lands, update its row. The
matrix is the audit trail for the final review.

**Document decisions, not rationalisations.** Any ambiguity you resolve goes
in `docs/decisions.md` with the ambiguity, the interpretation, why it's
reasonable, and the tradeoff. Never present your assumption as if the source
required it.

**Prefer simple.** This is a 24-hour take-home reviewed by a hiring engineer.
When two designs both satisfy the requirements, take the one with fewer moving
parts, fewer dependencies, and easier debugging. Complexity added to look
senior reads as poor judgement.

---

## Version control

The repo is initialised and **must stay committed** — R-109 requires a pushed
repo, and a reviewer reads the history.

**Commit at the end of each vertical slice, not after each edit.** A slice is
the unit `implement-task1` already works in: something runnable, with its tests
passing. That yields a history a reviewer can follow ("dialer state machine +
concurrency tests", "CRM sync with callId idempotency") instead of forty
`wip` commits.

- Commit before starting the next slice, so work is never more than one slice
  from a known-good state — this matters across sessions, which start cold.
- Message: what changed and why, present tense. If tests ran, say what passed;
  **do not claim green tests you did not run** — the honesty rule applies to
  commit messages too.
- Never commit secrets. `.gitignore` covers `.env*`, keys, `node_modules/`, and
  `emailRaw.txt` (a personal phone number that must not be published).
- Push at least once per working session, not only at the end. An unpushed repo
  at hour 23 is the same as no repo.

---

## Verification discipline

AI-assisted development is explicitly allowed by the assignment, and the
assignment explicitly asks you to **"show what you verified."** That makes
honest verification a graded deliverable, not a nicety.

Every claim carries one of these labels, and you must be able to point at the
evidence:

```text
Implemented        code exists
Tested             an automated test covers it and was executed
Manually verified  a human/agent actually ran it and observed the result
Not verified       none of the above
```

**Never** write "tests pass", "the API works", "deployment works", or "verified"
unless that exact check was actually run in this session and you saw the output.

**Never** fabricate test output, API responses, screenshots, browser results, or
deployment results. If you did not run it, say "not verified" — that is an
acceptable answer and a fabrication is not.

`NOTES.md` in the final submission must be factual on this point.

---

## Anti-scope for Task 1 architecture

Do not introduce, unless the Task 1 spec explicitly requires it: Kubernetes,
Redis, message brokers, PostgreSQL or any external DB, WebSockets, Redux/heavy
state libraries, authentication, real telephony/call providers, real CRM
vendors, or microservices. In-memory storage is explicitly permitted by the
spec. Polling (1–2s) is explicitly required — do not "upgrade" it to WebSockets.

---

## Specialised guidance

All five rule files are injected into **every** session automatically — they are
already in context, so there is nothing to load. What follows is a map of which
one owns what, not an instruction to fetch them. (This also means the backend
and frontend rules are present during Task 2 work, where they do not apply —
ignore them there; `.claude/rules/scope.md` still governs.)

- `.claude/rules/scope.md` — workstream boundary enforcement
- `.claude/rules/backend.md` — models, state machine, queue, concurrency, CRM
- `.claude/rules/frontend.md` — React screens, polling, UI state
- `.claude/rules/testing.md` — what to test and how to keep it deterministic
- `.claude/rules/documentation.md` — README, NOTES.md, matrix, decisions

## Which review, when

They are not interchangeable, and you do not need all of them every time. Each
runs **once**, in this order, and does not re-do the one before it.

| # | Use | When | What it uniquely does |
| --- | --- | --- | --- |
| 1 | `backend-reviewer` / `frontend-reviewer` (agents) | as each layer lands | **Static** read of *that layer only*. Traces code paths, cites `file:line`. May grep or run the suite to check a specific claim, but its product is analysis, not an execution report. |
| 2 | `verify-task1` (skill) | once the app runs end to end | **Execution.** Runs the suite, curls the API, drives the flow, proves INV-1 and INV-2 with real output. |
| 3 | `qa-reviewer` (agent) | after `verify-task1` | **Audit of claims, not of code.** Walks every matrix row, checks each status against evidence `verify-task1` produced, finds spec requirements with no row, flags overclaims in `NOTES.md`. Re-runs only what it must to settle a disputed claim. |
| 4 | `final-review-task1` (skill) | immediately before sending | **Judgement.** Hiring-engineer verdict and a fix list ranked by impact per minute. Assumes 1–3 already established the facts. |

Short on time? **`verify-task1` then `final-review-task1`** is the minimum.

Skills: `implement-task1`, `verify-task1`, `final-review-task1`, `plan-task2`.
Review agents: `backend-reviewer`, `frontend-reviewer`, `qa-reviewer`.

**Task 2 is half the assignment.** Most of this configuration serves Task 1
because building is where the invariants and the failure modes are — not because
Task 2 matters less. It is graded separately, needs ~4.5 hours, and produces five
written deliverables. Use `plan-task2`; the material is organised in
`docs/task2-reference.md`.
