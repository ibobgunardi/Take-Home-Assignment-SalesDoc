---
name: plan-task2
description: Produce Workstream B — the V2 AI-to-Human Dialer product-refinement proposal, workflow diagram, capability decision matrix, prioritized backlog, and 15-minute presentation. Written deliverables only; never application code. Use when working on Task 2.
---

# Plan Task 2 — V2 Product Refinement Proposal

You are producing **Workstream B**: documents that let management make a
go/no-go decision. This is **half the assignment** and is graded separately from
the dialer app.

```text
Task 1 = BUILD  <- not this skill
Task 2 = PLAN   <- this skill: writing only, zero code
```

**Write no application code, schemas, APIs, or scaffolding — not even as
illustration.** Do not touch the Task 1 codebase. See `.claude/rules/scope.md`.

Source of truth: `V2_PRODUCT_REFINEMENT_EXERCISE.md` (complete and
authoritative). Organised summary: `docs/task2-reference.md`. Matrix rows:
P-01…P-06.

---

## Step 0 — Timebox

Task 2 shares the 24-hour deadline with Task 1. Budget **~4.5 hours**, and check
the clock (see `CLAUDE.md` "Project status") before starting.

| Phase | Target |
| --- | --- |
| Read `V2_PRODUCT_REFINEMENT_EXERCISE.md` + `docs/task2-reference.md` | ~30 min |
| Candidate research (see ceiling below) | ~60 min |
| P-01 proposal (~8–15 pages) | ~90 min |
| P-02 workflow diagram | ~20 min |
| P-03 capability decision matrix | ~30 min |
| P-04 prioritized backlog | ~20 min |
| P-05 15-minute presentation | ~20 min |

### Research ceiling — state this in the proposal

Exhaustive coverage is 25 capabilities × 6 options × 21 criteria. That is not
reachable in 60 minutes and pretending otherwise produces invented facts. The
source licenses the narrower scope: *"prioritize clear product judgment over
exhaustive research."*

**Attempt:** a decision-quality shortlist — for each of the 6 options, the
licence, latest release date, and apparent activity, checked against the actual
repo or docs; then the ~6–8 capabilities that actually decide the
adopt-vs-build question (AI voice leg, live transfer, operator presence and
reservation, capacity-aware dialing, lead-management integration, briefing/
screen-pop) assessed against those options. Every cell gets a confidence.

**Do not attempt:** a fully populated 25×6×21 grid, cost modelling, or
performance claims. Mark those cells "not assessed — requires X" rather than
guessing.

Say in P-01 which cells were verified, which were inferred, and what evidence
would close the gaps. A shortlist with honest confidence beats a full grid of
plausible-looking fabrication — and the source explicitly asks for exactly
that.

---

## Step 1 — Read

1. `V2_PRODUCT_REFINEMENT_EXERCISE.md` in full — it is the assignment
2. `docs/task2-reference.md` — the 10 question areas, 12 fixed requirements,
   3 required acceptance scenarios, 5 deliverables
3. `emailRaw.txt` — *"transform it to a tangible proposal that we can use to
   build a product from"*

Do **not** read the Task 1 rule files for this work; they do not apply.

---

## Step 2 — Deliverables

Write to `task2/`, one file per deliverable, Markdown:

```text
task2/
  01-product-refinement.md    P-01  the main document
  02-workflow-diagram.md      P-02  mermaid, main path + exceptions
  03-capability-matrix.md     P-03  one row per capability
  04-backlog.md               P-04  grouped, with acceptance criteria
  05-presentation.md          P-05  15-minute deck outline
```

**P-01 sections** (from the source, in order): executive summary; problem and
users; current-state assessment; required and proposed workflows; capability
map; V2 scope and prioritized backlog; adopt-vs-rebuild comparison;
recommendation; risks; success metrics; validation plan.

**P-02** must show the main path *and* the important exceptions — no answer,
busy, voicemail, wrong company, gatekeeper blocked, PIC reached but no human
available, transfer failure, refusal/DNC. Mermaid renders in most viewers.

**P-03** — one row per capability, each recommending exactly one of: *adopt
open source as-is / configure / extend / integrate / build / validate first /
defer*, with rationale, evidence, and **confidence**. The source names 25
capabilities; cover them, grouping where that reads better.

**P-04** — grouped **pilot-critical / required before production / later / out
of scope**, with acceptance criteria on the pilot-critical items.

**P-05** — understandable without reading P-01 first. Lead with the
recommendation, then the reasoning, then the evidence needed.

---

## Step 3 — The three scenarios that must be answered

The proposal is incomplete without all three (P-06):

1. **Primary** — signal-selected company, AI navigates the gatekeeper, PIC
   verified, briefed human accepts within the waiting threshold, outcome written
   back to the right lead.
2. **No human available** — PIC reached, nobody ready. The system must not leave
   the PIC waiting or transfer blindly: close with approved wording, record the
   attempt, set a defined human-callback status.
3. **Data minimization** — during the AI phase, no name, direct/mobile number,
   email, or WhatsApp is requested; volunteered PII is not repeated or persisted
   in the lead, briefing, structured outcome, or retained transcript.

---

## Step 4 — Adopt-vs-rebuild

Compare at minimum: **Asterisk** (telephony foundation), **VICIdial**, **at
least two** of ICTDialer / OSDial / another open-source contact-centre product,
a **focused greenfield build** on open-source components, and **one hybrid**.
Aircall/CallHippo may be a product-pattern benchmark only. **The POC is not an
option and must not be scored.**

Where you inspect a project, note edition, version, licence, release recency and
activity. Where you did not verify a claim, **say so and mark confidence** —
the source explicitly asks you to distinguish documented facts from assumptions
and warns against presenting unsupported conclusions as facts.

Conclude with a recommendation. **It may be conditional** ("build the
orchestration layer, defer the telephony decision pending evidence X") — a
conditional recommendation with a named next experiment is stronger than false
certainty.

---

## Step 5 — Honesty, same as Task 1

The verification discipline applies to research claims:

- Cite what you actually read; do not invent version numbers, licences, release
  dates, or feature support.
- If you could not check whether a project is maintained, write that.
- Where stakeholders were unavailable, **document the questions you would ask,
  who you would ask, and the assumptions needing validation** — the source
  explicitly accepts this and does not score interviews.
- State evidence gaps as gaps. "This needs a controlled PBX transfer test before
  we commit" is a strong sentence, not a weak one.

---

## Step 6 — Finish

Update P-01…P-06 in `docs/requirements-matrix.md` §4, and tell the user what was
written, what is assumption versus sourced fact, and what you could not verify.
