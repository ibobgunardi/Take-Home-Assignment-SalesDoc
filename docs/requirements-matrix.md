# Requirements Matrix — Task 1 (BUILD)

> **Derived project guidance.** This is the implementation checklist and the
> audit trail. It covers **Workstream A (Task 1) only**. Task 2 is tracked
> separately in §4 and is deliberately kept out of the working checklist.

## How to use this file

- **While implementing:** find the row, build it, then update `Status`.
- **While auditing:** every row must be defensible with evidence you can point
  at. A row is not `Done` because the code exists.
- **Never** mark a row `Done` on the strength of reading the code. `Done`
  requires the `Verification` column to have actually been performed.

**Status values**

| Value | Means |
| --- | --- |
| `Todo` | not started |
| `Impl` | code written, not yet proven |
| `Tested` | an automated test covers it **and was executed and passed** |
| `Verified` | additionally exercised end-to-end (API call or browser) and observed |
| `Done` | `Tested` and, where the row needs it, `Verified` |
| `N/A` | does not apply; say why |

**Source keys**

- `T1-Sub` — Submission section
- `T1-P1` — Part 1, Backend / Data Models
- `T1-P2` — Part 2, CRM Integration
- `T1-P3` — Part 3, Frontend
- `D-nn` — a decision in `docs/decisions.md` (**derived, not client-required**)
- `` `.claude/rules/*.md` `` — guidance that lives only in a rule file
  (**derived**); used where no spec line and no decision applies

---

## 1. Task 1 implementation checklist

### 1.1 Data models

| ID | Requirement | Source | Implementation Area | Test | Verification | Status |
| -- | ----------- | ------ | ------------------- | ---- | ------------ | ------ |
| R-00 | Stack is Node.js (**Express or Fastify**) + React (**Vite or Next**) as specified — not another framework | T1-Sub | `server/`, `client/` | — | check `package.json` deps in both | Done |
| R-01 | `Lead` has `id, name, company, phone, email` | T1-P1 | `models/lead` | model/seed unit test | `GET /leads` returns all fields | Tested |
| R-02 | `Lead.crmExternalId` optional, absent until first CRM sync | T1-P1, D-01 | `models/lead` | unit: starts undefined, set after sync | inspect lead after a call | Tested |
| R-03 | `Call` has `id, leadId, sessionId, status, startedAt, endedAt, providerCallId` | T1-P1 | `models/call` | unit: shape on create | session payload shows fields | Tested |
| R-04 | `Call.status` is exactly `CONNECTED \| NO_ANSWER \| BUSY \| VOICEMAIL \| CANCELED_BY_DIALER` — no invented values | T1-P1, D-03 | `models/call` | unit: enum has exactly 5 values | grep for stray statuses | Tested |
| R-05 | Call `phase` (`DIALING\|LIVE\|ENDED`) is separate from `status`; `status`+`endedAt` set atomically on ENDED only | D-03 | `services/dialer` | unit: no call has status without endedAt; no `DIALING`/`LIVE` in `Call_Status` | UI shows Dialing / Connected-live | Tested |
| R-06 | `providerCallId` populated as a string by the simulated provider | T1-P1 | `services/simulator` | unit: non-empty string, unique | session payload | Tested |
| R-07 | `DialerSession` has `id, agentId, leadQueue, activeCallIds, winnerCallId, status, metrics` | T1-P1 | `models/session` | unit: shape on create | `GET /sessions/:id` | Tested |
| R-08 | `concurrency` fixed to 2 and not user-configurable | T1-P1 | `models/session` | unit: constant is 2 | no API accepts concurrency | Tested |
| R-09 | `session.status` is exactly `RUNNING \| STOPPED` | T1-P1, D-02 | `models/session` | unit: enum has exactly 2 values | — | Tested |
| R-10 | `metrics` has `attempted, connected, failed, canceled` | T1-P1, D-04 | `models/session` | unit: all four present, start at 0 | UI metrics panel | Tested |
| R-11 | `CRMActivity` has `id, leadId, crmExternalId, type, callId, disposition, notes, createdAt` | T1-P1 | `models/crm-activity` | unit: shape | `GET /leads/:id/crm-activities` | Tested |
| R-12 | Seed data: 4–8 leads | T1-P3 | `seed` | unit: count within 4..8 | Screen 1 shows them | Tested |

### 1.2 Dialer session behaviour — **core invariants**

| ID | Requirement | Source | Implementation Area | Test | Verification | Status |
| -- | ----------- | ------ | ------------------- | ---- | ------------ | ------ |
| **R-20** | **`activeCallIds.length <= 2` at every observable moment — never violated on any path** | **T1-P1** | `services/dialer` | **dedicated concurrency suite (R-22, R-24, R-26, R-30, R-32)** | assert on every poll of a live session | Tested |
| R-21 | Session created from selected leads; `leadQueue` preserves the selection | T1-P3, D-08 | `services/dialer` | unit | `POST /sessions` response | Tested |
| R-22 | Start dials up to 2 leads immediately; not 1, not 3 | T1-P1 | `services/dialer` | unit: 5 leads → exactly 2 active | Screen 2 shows 2 lines | Tested |
| R-23 | Terminal call frees its line and the next queued lead is promoted | T1-P1 | `services/dialer` | unit: queue advances by one | observe line swap in UI | Tested |
| R-24 | Two calls ending in the **same tick** promote exactly two, never three | T1-P1 | `services/dialer` | unit: near-simultaneous terminal | — | Tested |
| R-25 | Queue exhausted → no promotion, no crash, session ends `STOPPED` | D-02 | `services/dialer` | unit | run a 3-lead session to completion | Tested |
| R-26 | Fewer leads than lines (1 selected) → exactly 1 active call | T1-P1 | `services/dialer` | unit | UI shows 1 line busy, 1 idle | Tested |
| R-27 | `POST /sessions` with 0 leads rejected `400` | D-11 | `routes/sessions` | unit | button disabled in UI | Todo |
| R-28 | First **answered** call (`DIALING`→`LIVE`) sets `winnerCallId` for that round; it takes `status=CONNECTED` later, when it ends | T1-P1, D-02, D-03 | `services/dialer` | unit: winner set at answer, not at terminal | Screen 2 winner panel | Tested |
| R-29 | On a winner, every other in-flight call (all `DIALING`) becomes `CANCELED_BY_DIALER`; a same-tick answer loser never reaches `LIVE` | D-02, D-03 | `services/dialer` | unit: other line cancelled; same-tick loser ends `CANCELED_BY_DIALER`, not `CONNECTED` | observe in UI | Tested |
| R-30 | No new leads promoted while the winner is `LIVE` | D-02 | `services/dialer` | unit | — | Tested |
| R-31 | Winner call ending → `status=CONNECTED`, CRM sync, next round promoted; **`winnerCallId` keeps naming that call** (D-18) | D-02, D-18 | `services/dialer` | unit: dialing resumes after a connect; winner not cleared | observe a 2nd round in UI | Tested |
| R-31a | Session reaches `STOPPED` only when queue exhausted **and** no active calls (or explicit stop) — never merely because a call connected | D-02 | `services/dialer` | unit: 5 leads with a connect still dials all 5 | full run in UI | Tested |
| R-31b | Every selected lead is eventually dialed unless the agent stops early | D-02 | `services/dialer` | unit: calls created == leads selected | completed-calls list | Tested |
| R-32 | Stop terminates all in-flight calls and promotes nothing; `DIALING`->`CANCELED_BY_DIALER`, `LIVE`->`CONNECTED` | D-11, D-03 | `services/dialer` | unit: 0 active after stop; stop during a LIVE winner yields `CONNECTED` | Stop button in UI | Tested |
| R-33 | Stop is idempotent; start on a `RUNNING` session is a no-op | D-11 | `routes/sessions` | unit: double stop / double start | — | Todo |
| R-34 | Metrics map per D-04 and satisfy `connected+failed+canceled == attempted` at rest | D-04 | `services/dialer` | unit: invariant asserted after each scenario | UI metrics vs call list | Tested |
| R-35 | Call simulation is deterministic and injectable; no `Math.random`/bare `setTimeout` in domain logic | D-06 | `services/simulator` | scripted simulator used by all dialer tests | `grep -rn "Math.random"` in domain | Tested |
| R-36 | Created-but-unstarted session is `STOPPED` with `startedAt === null`; start is legal only then | D-14 | `services/dialer` | unit: 3 lifecycle states distinguishable | — | Tested |
| R-37 | Start on a **finished** session → `409`; there is no restart | D-14 | `routes/sessions` | unit | UI offers "New session", not Start | Todo |
| R-38 | `agentId` supplied by a seeded hardcoded demo agent (`agent-1`); server defaults it when absent | D-14 | `seed`, `routes/sessions` | unit: default applied | `POST /sessions` without agentId works | Tested |
| R-39 | One `setInterval` per `RUNNING` session at `TICK_MS = 250` calling only `advance()`; cleared on stop; no per-call timers | D-16 | `services/dialer` | unit: interval cleared on stop | no timer leak after session ends | Tested |
| R-39a | Tests drive `advance()` directly with a fake clock; the interval is never started in tests | D-16 | tests | the suite itself | — | Tested |
| R-39b | Simulator uses the D-17 ring/talk durations and outcome mix | D-17 | `services/simulator` | unit: draws within bounds | a 5-lead demo runs ~60–90s and reaches `STOPPED`; **1 connect is a normal run, not a defect** | Tested |

### 1.3 CRM integration — **idempotency is critical**

| ID | Requirement | Source | Implementation Area | Test | Verification | Status |
| -- | ----------- | ------ | ------------------- | ---- | ------------ | ------ |
| R-40 | Mock CRM lives inside the backend, in memory, as a separate store from the app store; reached only through its module (in-process, not via self-HTTP) | T1-P2, D-12 | `services/mock-crm` | unit | two distinct stores exist | Tested |
| R-41 | Terminal outcome → contact upsert: create if lead has no `crmExternalId`, else update | T1-P2, D-01 | `services/crm-sync` | unit: both branches | `GET /mock-crm/contacts` | Tested |
| R-42 | Created contact's id written back onto the lead as `crmExternalId` | D-01 | `services/crm-sync` | unit | lead shows id after first call | Tested |
| R-43 | Then create activity with `disposition` + basic `notes` | T1-P2 | `services/crm-sync` | unit: fields populated | `GET /mock-crm/activities` | Tested |
| R-44 | Activity saved in **the app's own store** (`CRMActivity`) | T1-P2 | `services/crm-sync` | unit | `GET /leads/:id/crm-activities` | Tested |
| R-45 | Activity saved in **the mock CRM store** as well | T1-P2 | `services/crm-sync` | unit | `GET /mock-crm/activities` | Tested |
| **R-46** | **One `callId` → at most one CRMActivity, in both stores, however many times the terminal event is handled** | **T1-P2** | `services/crm-sync` | **explicit test: sync same call 3× → count stays 1 in both stores** | compare counts to call count | Tested |
| R-47 | Idempotency key is `callId` | T1-P2 | `services/crm-sync` | unit | — | Tested |
| R-48 | Every terminal status produces an activity (all 5, incl. `CANCELED_BY_DIALER`) | D-05 | `services/crm-sync` | unit: one per status | activity count == call count | Tested |
| R-49 | `disposition` on the activity is the `Call_Status` value | D-05 | `services/crm-sync` | unit | inspect activities | Tested |
| R-50 | Repeated contact upsert for one lead does not duplicate the contact | D-01 | `services/mock-crm` | unit: 2 calls, 1 lead → 1 contact | `GET /mock-crm/contacts` | Tested |

### 1.4 API endpoints

| ID | Requirement | Source | Implementation Area | Test | Verification | Status |
| -- | ----------- | ------ | ------------------- | ---- | ------------ | ------ |
| R-60 | `GET /mock-crm/contacts` (**specified verbatim**) | T1-P2 | `routes/mock-crm` | integration test | curl / browser | Todo |
| R-61 | `GET /mock-crm/activities` (**specified verbatim**) | T1-P2 | `routes/mock-crm` | integration test | curl / browser | Todo |
| R-62 | `GET /leads/:id/crm-activities` (**specified verbatim**) | T1-P2 | `routes/leads` | integration test | curl / browser | Todo |
| R-63 | `GET /leads` | D-08 | `routes/leads` | integration test | Screen 1 loads | Todo |
| R-64 | `POST /sessions` | D-08 | `routes/sessions` | integration test | Screen 1 creates | Todo |
| R-65 | `POST /sessions/:id/start` | D-08 | `routes/sessions` | integration test | Start button | Todo |
| R-66 | `POST /sessions/:id/stop` | D-08 | `routes/sessions` | integration test | Stop button | Todo |
| R-67 | `GET /sessions/:id` returns session + lines + metrics + winner + per-call CRM status in one response | D-08 | `routes/sessions` | integration test | polling payload | Todo |
| R-68 | Unknown session/lead id → `404`, not a 500 or a crash | D-08 | `routes/*` | integration test | curl a bogus id | Todo |
| R-69 | CORS configured so the Vite dev client can reach the API | D-08 | `server` | — | client loads without CORS error | Impl |

### 1.5 Frontend

| ID | Requirement | Source | Implementation Area | Test | Verification | Status |
| -- | ----------- | ------ | ------------------- | ---- | ------------ | ------ |
| R-80 | Screen 1 displays the seeded leads list | T1-P3 | `LeadsScreen` | component test | browser | Todo |
| R-81 | Leads selectable via **checkboxes** | T1-P3 | `LeadsScreen` | component test | browser | Todo |
| R-82 | "Create Dialer Session" control | T1-P3 | `LeadsScreen` | component test | browser | Todo |
| R-83 | "Start" control | T1-P3 | `LeadsScreen` / `SessionScreen` | component test | browser | Todo |
| R-84 | Screen 2 shows **2** "line" call cards | T1-P3 | `SessionScreen` | component test | browser | Todo |
| R-85 | Each line card shows lead **name, phone, status** | T1-P3 | `LineCard` | component test | browser | Todo |
| R-86 | Session metrics displayed | T1-P3 | `SessionScreen` | component test | browser | Todo |
| R-87 | Winner call displayed when connected | T1-P3 | `SessionScreen` | component test | browser | Todo |
| R-88 | CRM activity creation status shown **per call/lead** | T1-P3 | `SessionScreen` | component test | browser | Todo |
| R-89 | Backend polled every **1–2 seconds** while a session is live | T1-P3 | `useSessionPolling` | test: interval within 1000–2000ms | observe network tab | Todo |
| R-90 | Polling stops when the session is `STOPPED` (no runaway requests) | `.claude/rules/frontend.md` | `useSessionPolling` | test: interval cleared | network tab goes quiet | Todo |
| R-91 | Backend is the source of truth; UI renders server state, never simulates calls locally | `.claude/rules/frontend.md` | `SessionScreen` | — | no dialer logic in client | Todo |
| R-92 | Loading / empty / error states are handled (no blank screen, no crash on a failed poll) | `.claude/rules/frontend.md` | `SessionScreen` | component test | stop the API mid-session | Todo |
| R-93 | Poll receiving `404` (cold-started host lost the session) returns to Screen 1 with "session expired", never a crash or blank screen | D-15 | `SessionScreen` | component test: 404 -> Screen 1 | idle the deployed app, then poll | Todo |
| R-94 | Finished session offers **"New session"** (returns to Screen 1), not a re-enabled Start — the UI counterpart of R-37 | D-14 | `SessionScreen` | component test | click through after a session ends | Todo |
| R-95 | Completed-calls list on Screen 2 so queue advancement is observable | `.claude/rules/frontend.md` | `SessionScreen` | component test | watch the queue drain | Todo |
| R-96 | The second line stays visible and labelled while a winner is `LIVE` (idle, not blank) so the 2-line design stays legible | `.claude/rules/frontend.md` | `SessionScreen` | component test | observe during a conversation | Todo |

### 1.6 Setup, documentation, submission

| ID | Requirement | Source | Implementation Area | Test | Verification | Status |
| -- | ----------- | ------ | ------------------- | ---- | ------------ | ------ |
| R-100 | `npm install` works from a clean clone | T1-Sub | root | — | **actually run in a clean dir** | Impl |
| R-101 | `npm run dev` (or documented separate client/server commands) starts everything | T1-Sub | root scripts | — | **actually run** | Verified |
| R-102 | README with setup instructions, run commands, and how to demo the flow | T1-Sub | `README.md` | — | follow it verbatim | Todo |
| R-103 | `NOTES.md`: tradeoffs | T1-Sub | `NOTES.md` | — | reviewed | Todo |
| R-104 | `NOTES.md`: what you would do next | T1-Sub | `NOTES.md` | — | reviewed | Todo |
| R-105 | `NOTES.md`: how AI tools were used | T1-Sub | `NOTES.md` | — | reviewed | Todo |
| R-106 | `NOTES.md`: **what you verified** — factual, labelled, no fabrication | T1-Sub | `NOTES.md` | — | every claim traceable to a run | Todo |
| R-107 | Test suite runs green via a documented command | D-06 | `package.json` | — | **actually run, output observed** | Todo |
| R-108 | Deployed to a free host; URL reachable | T1-Sub, D-15 | deployment | — | **open the URL and use it** | Verified |
| R-108a | **Walking skeleton deployed on day one**, before feature work | D-15 | deployment | — | URL served something on day 1 | Verified |
| R-108b | Single host serves API + built React bundle from one process | D-15 | deployment | — | one URL, no CORS in prod | Verified |
| R-108c | Leads seeded on boot, so a cold instance is immediately usable | D-15 | `seed` | unit | restart the host, open the URL | Tested |
| R-108d | README + NOTES state that state is in-memory and a restart clears it | D-15 | docs | — | reviewed | Impl |
| R-109 | Git repo pushed and link available | T1-Sub | repo | — | open the link | Todo |
| R-110 | Email URL + repo link to `intern1.aisalesdr@gmail.com` and `ellee@aisalesdr.co` | T1-Sub | submission | — | **user sends this — Claude must not send email** | Todo |

---

## 2. Invariant register

Two constraints outrank every feature row above. If either can be broken, the
submission is not correct regardless of how complete it looks.

| Invariant | Statement | Rows |
| --- | --- | --- |
| **INV-1 Concurrency ceiling** | `activeCallIds.length <= 2` at every observable moment | R-20, R-22, R-24, R-26, R-30, R-32 |
| **INV-2 CRM idempotency** | one `callId` → at most one CRMActivity, in the app store **and** the mock CRM store | R-46, R-47, R-50 |

Supporting balance check: `connected + failed + canceled == attempted` when no
call is in flight (R-34). A violation here usually means a call was double-
counted or a terminal transition ran twice — the same class of bug as INV-2.

---

## 3. Reviewer-sensitive areas

Places where a hiring engineer is most likely to probe. Treat a gap here as a
defect, not a nice-to-have.

1. **Three active calls.** Any path that promotes without re-checking the
   ceiling. Especially: two terminal events in one tick.
2. **Duplicate CRM activities.** Retried terminal handling, a stop that
   re-terminates an already-terminal call, or an activity written to the app
   store but not the mock store (or vice versa).
3. **Lost lead on cancel.** A `CANCELED_BY_DIALER` lead that silently vanishes
   from the queue without an outcome recorded.
4. **Metrics that do not add up.** The fastest way for a reviewer to spot a
   double-count.
5. **Winner race.** Two calls answered in the same tick — exactly one winner,
   the other `CANCELED_BY_DIALER`.
6. **Stop during a live call.** The winner must end `CONNECTED`, not
   `CANCELED_BY_DIALER` — otherwise `winnerCallId` points at a non-connected
   call and the `connected` metric is wrong (D-11).
7. **Polling correctness.** Interval outside 1–2s, polling that never stops, or
   overlapping requests producing UI flicker.
8. **`npm install && npm run dev` failing on a clean machine.** The single most
   common take-home killer.
9. **Unverifiable claims in `NOTES.md`.** The assignment explicitly asks what
   you verified; an inflated claim is worse than a modest one.

---

## 4. Task 2 reference (PLAN ONLY — not an implementation checklist)

Tracked here only so nothing is forgotten before submission. **No row below is
built as code.** Detail: `docs/task2-reference.md`; workflow: `plan-task2`.

Task 2 is **half the assignment**, budgeted at **~4.5 hours**, written to
`task2/` as five Markdown files.

| ID | Deliverable | Source | Status |
| -- | ----------- | ------ | ------ |
| P-01 | Product refinement document, ~8–15 pages | V2 §Expected deliverables | Todo |
| P-02 | Workflow diagram — main path + exceptions | V2 §Expected deliverables | Todo |
| P-03 | Capability decision matrix (adopt/configure/extend/integrate/build/validate/defer) | V2 §Expected deliverables | Todo |
| P-04 | Prioritized backlog with acceptance criteria for pilot-critical items | V2 §Expected deliverables | Todo |
| P-05 | 15-minute decision presentation | V2 §Expected deliverables | Todo |
| P-06 | Three required acceptance scenarios addressed (primary, no-human-available, data-minimization) | V2 §Required acceptance scenarios | Todo |
