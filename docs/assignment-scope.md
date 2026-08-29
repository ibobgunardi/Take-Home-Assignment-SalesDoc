# Assignment Scope Classification

> **Derived project guidance.** Written by us to organise the work. Not part of
> the client's assignment. Sources are listed in `CLAUDE.md`; where this file
> and a source disagree, the source wins.

---

## 0. The two workstreams

`emailRaw.txt` states plainly that there are two assignments:

> "The first is to create a Multi-line dialer app... The second one is to make a
> proposal from an ambiguous business requirement quickly."
>
> "These tasks should be completed in 24 hours."

```text
WORKSTREAM A — Task 1 — BUILD — Multi-Line Dialer (2 lines) + CRM MVP
WORKSTREAM B — Task 2 — PLAN  — V2 AI-to-Human Dialer product proposal
```

They share a *business domain* (outbound dialing) and nothing else. Task 1 is a
small, self-contained engineering exercise. Task 2 is a written product-strategy
document. Task 2 requirements are **not** Task 1 requirements.

### Source-file hazard (resolved — read this)

The PDF `Take Home Assignment.17.08.26.pdf` contains **both** tasks. A Markdown
conversion of it, `Take Home Assignment.17.08.26.md`, previously sat in the repo
root and **had silently dropped every Task 1 page**, keeping only the Task 2 /
V2 content — while its filename implied it was the entire assignment. That is
how Task 1 nearly went missing from this project.

That file has been **deleted**. Nothing was lost:

- Task 1 → transcribed verbatim in `docs/source/task1-multi-line-dialer.md`
- Task 2 → covered in full by `V2_PRODUCT_REFINEMENT_EXERCISE.md`
- The PDF remains authoritative for both.

**Do not recreate it.** If a similarly-named file reappears, treat it as
untrusted until you have confirmed it actually contains the Task 1 pages.

---

## 1. Task 1 — Build Requirements

Everything below directly determines what the application must do. Every item
here traces to `docs/source/task1-multi-line-dialer.md`.

### 1.1 Stack and delivery

- Node.js backend (Express or Fastify).
- React frontend (Vite or Next).
- AI tools are allowed; **"Show what you verified."**
- Repo with instructions: `npm install`, then `npm run dev` or separate
  client/server commands.
- `NOTES.md` covering tradeoffs, what you would do next, how AI tools were used,
  and what was verified.
- Deliverables hosted on a free webhost / free platform plans; email the URL and
  Git repo link to `intern1.aisalesdr@gmail.com` and `ellee@aisalesdr.co`.

### 1.2 Goal statement

> "Build a CRM where an agent runs a 2-line dialer session over a list of leads.
> When a call ends, the system writes a CRM activity record for that lead (mock
> CRM)."

### 1.3 Data models (in-memory is explicitly acceptable)

- **Lead** — `id`, `name`, `company`, `phone`, `email`, `crmExternalId` (optional)
- **Call** — `id`, `leadId`, `sessionId`, `status`, `startedAt`, `endedAt`,
  `providerCallId` (string)
  - `Call_Status`: `CONNECTED | NO_ANSWER | BUSY | VOICEMAIL | CANCELED_BY_DIALER`
  - *(the implementation adds a non-spec `phase` field — see D-03; the fields
    listed here are the spec's)*
- **DialerSession** — `id`, `agentId`, `leadQueue` (array of leadIds),
  concurrency fixed to 2, `activeCallIds` (max 2), `winnerCallId` (nullable),
  `status`: `RUNNING | STOPPED`, `metrics`: `attempted, connected, failed, canceled`
- **CRMActivity** — `id`, `leadId`, `crmExternalId`, `type` (e.g. `CALL`),
  `callId`, `disposition`, `notes`, `createdAt`

### 1.4 Mock CRM (inside the backend, in memory)

- Endpoints that "represent an external CRM system".
- On a call reaching a terminal outcome: contact upsert, then create activity
  with disposition + basic notes.
- The activity is saved in **both** the app's own store (`CRMActivity`) and the
  mock CRM store.
- **Idempotency:** the same terminal call event must not create duplicate CRM
  activities; use a simple idempotency key such as `callId`.

### 1.5 Required API endpoints (named explicitly in the spec)

- `GET /mock-crm/contacts`
- `GET /mock-crm/activities`
- `GET /leads/:id/crm-activities` (the app's own view)

Dialer/session endpoints are **not** enumerated in the spec but are implied by
the frontend requirements. See `docs/decisions.md` D-08 for the chosen surface.

### 1.6 Frontend

**Screen 1 — Leads + Session creation**

- Display a seeded leads list (4–8 leads)
- Select leads via checkboxes
- "Create Dialer Session" and "Start"

**Screen 2 — Dialer Session**

- Show 2 active "lines" (call cards) with lead name, phone, status
- Show session metrics
- Show winner call (if connected)
- Show CRM activity creation status per call/lead
- Poll the backend every 1–2 seconds

### 1.7 Seed data

4–8 leads, seeded. Enough to exercise: fewer than 2 selected, exactly 2, and
more than 2 (so queue advancement is demonstrable).

---

## 2. Task 2 — Planning Requirements

These belong to the **written proposal only**. Summary in
`docs/task2-reference.md`. Source: `V2_PRODUCT_REFINEMENT_EXERCISE.md` (full and
authoritative). The PDF also carries a one-page Task 2 summary, reproduced at
the end of `docs/source/task1-multi-line-dialer.md`.

Deliverables are documents, not software:

1. Product refinement document (~8–15 pages excl. appendices)
2. Workflow diagram (main path + important exceptions)
3. Capability decision matrix (adopt / configure / extend / integrate / build /
   validate first / defer)
4. Prioritized product backlog with acceptance criteria for pilot-critical items
5. 15-minute decision presentation

Subject areas: likely-to-buy signal screening, two-level tailoring, AI
gatekeeper handling, PIC verification, human briefing, human-worker pool and
availability, live handoff, retries and callbacks, dispositions, compliance and
PII minimisation, lead-management continuity, open-source candidate evaluation
(VICIdial, Asterisk, ICTDialer, OSDial, CallHippo, DialerHQ), MVP scope,
backlog, success metrics, risks and validation plan.

---

## 3. Shared Context

Background that explains *why* the assignments exist, but which creates no
Task 1 implementation requirement:

- SalesDoc has a POC multiline outbound dialer using AI voice agents. It is
  evidence the concept is technically possible, and is explicitly excluded from
  assessment or reverse-engineering.
- SalesDoc's lead-management system is the system of record in the V2 vision.
  In **Task 1**, the "CRM" is a mock store the candidate writes. They are not
  the same system, and Task 1 does not integrate with SalesDoc.
- Both tasks are due within 24 hours of the email, so both must be scoped for
  speed.
- The word "dialer" appears in both tasks. Shared vocabulary, separate scope.

---

## 4. Explicitly Out of Scope for Task 1

None of the following becomes a Task 1 implementation requirement merely because
it appears in Task 2 material. Task 1 is a mocked 2-line dialer with a mock CRM.

- AI voice agents / LLM-driven conversation of any kind
- Gatekeeper navigation logic
- PIC verification
- Human-worker pool, availability states, wrap-up states
- Live human handoff / call transfer
- Briefing cards, suggested opening angles, screen-pop
- Likely-to-buy signal ingestion or scoring
- PII redaction pipelines, compliance controls, do-not-call suppression
- Supervisor consoles, audit logs, authorization, RBAC
- BPO operating-model workflow, campaign management
- Real telephony (Asterisk, SIP, Twilio, etc.) or any real call provider
- Real CRM vendors (HubSpot, Salesforce, etc.)
- Open-source dialer evaluation
- Retry/callback scheduling policy, lead exhaustion rules
- Durable persistence, failure recovery, high availability
- Voicemail *detection* as an ML/audio problem (Task 1 needs `VOICEMAIL` only as
  a simulated outcome value)

**Exception rule:** an item leaves this list only if a direct quote from
`docs/source/task1-multi-line-dialer.md` requires it. Quote the line in
`docs/decisions.md` before building it.

---

## 5. Preserved ambiguities

These are genuinely unclear in the Task 1 source. They are **not** resolved
here — they are catalogued here and interpreted, with reasoning, in
`docs/decisions.md`. The ambiguity is preserved so a reviewer can see we noticed
it rather than papered over it.

| # | Ambiguity | Where |
| --- | --- | --- |
| A-1 | "If lead has no `crmExternalId`, update contact" — literally says *update* in the *no-id* branch; the else-branch is unstated. | Part 2, CRM Sync behavior |
| A-2 | `winnerCallId` is declared but never defined. What makes a call the winner? | Part 1, DialerSession |
| A-3 | What happens to the other line when one call connects? `CANCELED_BY_DIALER` exists but its trigger is unstated. | Part 1, Call_Status |
| A-4 | Does the session keep dialing after a winner exists, or stop? | Part 1 / Part 3 |
| A-5 | `Call_Status` has no in-flight value (no `DIALING`/`RINGING`), yet Screen 2 must show a status on an active line. Compounding this, `CONNECTED` conflates two different moments — *answered* (which must cancel the other line) and *finished as a connection* (the CRM disposition). | Part 1 / Part 3 |
| A-6 | `metrics` names four counters but does not define which statuses map to `failed` vs `canceled`. | Part 1, DialerSession |
| A-7 | Which outcomes count as "terminal" for CRM sync — all five, or only some? | Part 2 |
| A-8 | No dialer/session endpoints are specified, though the frontend requires them. | Part 1 / Part 3 |
| A-9 | Call outcome and duration are "mocked" with no distribution specified. | Goal |
| A-10 | Title reads "Multi-Line Dialer (2 lines) + Update CRM **(or Lead Management MVP)**" — an either/or framing. | Title |
| A-11 | "These **endpoints** represent an external CRM system", but only three `GET` inspection routes are named. Must the *write* path (contact upsert, activity create) also go over HTTP, or may it be an in-process call? | Part 2 |
| A-12 | `status` is only `RUNNING \| STOPPED`, so a created-but-unstarted session and a finished session share one value. Start-on-`STOPPED` must be legal, but whether it *begins* or *restarts* is unstated. | Part 1 |
| A-13 | `agentId` is a required `DialerSession` field, but nothing in the spec seeds, selects, or supplies an agent. | Part 1 |
| A-14 | Submission requires hosting on "any free webhost service" but names no platform, and free-tier cold starts interact badly with the in-memory permission. | Submission |
| A-15 | Calls are "mocked" and must advance over time, but nothing says what drives the simulation — so "two events in the same tick", which both invariants are stated in terms of, had no definition. | Goal / Part 1 |
| A-16 | With a per-round winner (D-02), the spec never says whether `winnerCallId` clears when its call ends or keeps naming the most recent connect. | Part 1 |
| A-17 | The spec offers stack choices — "Express/Fastify", "Vite/Next" — and names no host, but hour 1 cannot begin until both are settled. | Header / Submission |

---

## 6. Scope guard for the future session

Before writing any Task 1 code, ask:

1. Which row of `docs/requirements-matrix.md` does this satisfy?
2. If none — does a direct quote from the Task 1 source require it?
3. If neither — is this actually a Task 2 concept? Stop and say so.
