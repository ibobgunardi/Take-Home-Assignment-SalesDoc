# Task 2 Reference — V2 AI-to-Human Outbound Dialer (PLAN ONLY)

> **Task 2 is a separate product-refinement exercise and is not part of the
> Task 1 implementation scope.**
>
> Nothing in this document is a coding requirement. The V2 source says it
> directly: *"This is a product-refinement and decision-framing exercise. You
> are not expected to implement the product or produce a low-level production
> architecture."*
>
> **Do not read this file during a Task 1 implementation session.** It exists so
> that when Task 2 is worked on, the material is already organised. If you are
> building the dialer app, close this file and go back to
> `docs/requirements-matrix.md`.
>
> When you *are* working on Task 2, use the **`plan-task2`** skill — it carries
> the timebox, the output structure, and the honesty rules for research claims.

**Derived project guidance.** Summary only. Authoritative source:
`V2_PRODUCT_REFINEMENT_EXERCISE.md` (complete). The assignment PDF also carries
a one-page Task 2 summary, reproduced at the end of
`docs/source/task1-multi-line-dialer.md`.

---

## 1. What Task 2 asks for

Turn an ambiguous business requirement into a proposal management can decide
from. Per `emailRaw.txt`: *"make a proposal from an ambiguous business
requirement quickly ... transform it to a tangible proposal that we can use to
build a product from."*

The decision the proposal must support: should V2 **adopt** an open-source
product as-is, **configure** it, **extend** it, **integrate** components,
**build** focused, or use a **hybrid** — and what evidence is needed first.

---

## 2. The required V2 business flow

```text
read eligible leads + company context from the lead management system
  -> screen companies using likely-to-buy signals
  -> prepare reusable segment context + a company-specific human briefing
  -> add eligible company to the calling queue
  -> AI voice agent places a segment-tailored call
  -> call answered
  -> verify the intended company
  -> navigate the gatekeeper, if present
  -> wait through internal hold or transfer
  -> reach and verify the relevant PIC
  -> present a concise briefing to a ready human
  -> human accepts and takes over the live call
  -> human conducts the conversation and records the outcome
  -> persist attempt outcome + next-action status in the lead management system
```

---

## 3. Fixed business requirements (12)

1. There is a calling queue of eligible companies/leads.
2. AI voice agents process the queue; humans do not dial or wait.
3. AI handles the initial segment: detect answer, verify company, navigate
   gatekeeper, request the target role/PIC, hold through transfer, confirm PIC.
4. AI does **not** conduct the substantive sales conversation.
5. **Not a cold mass dialer** — approved likely-to-buy signals gate every call.
6. AI tailoring is **segment-level only** (industry, company type, size band,
   campaign, target role) — no per-company generated opening.
7. The human conversation uses **company-specific** context, briefed before
   takeover.
8. Handoff must minimise PIC wait time.
9. Human-worker pool + assignment queue: availability, one live handoff at a
   time, wrap-up before returning to the pool.
10. Production-operable: durable state, controlled retries, dispositions,
    authorization, audit, supervision, capacity limits, failure recovery,
    security, compliance, measurable outcomes.
11. The **lead management system remains the system of record**; V2 writes
    structured attempt outcomes and approved next actions back to the same lead.
12. **The AI phase must not collect PII.** It may ask whether the responsible
    person is available and request a transfer. It must not ask for name, direct
    or mobile number, email, WhatsApp, or other identifying contact details.
    Volunteered PII must not be solicited further, repeated, or persisted in the
    lead, briefing, structured outcome, or retained transcript; transient
    capture must be redacted before persistence.

### Required human briefing minimum

Company on the line · why selected · the relevant likely-to-buy signal · target
PIC/role · what occurred during the AI conversation · a recommended opening or
discussion angle. A short operational aid, not a research report.

---

## 4. Questions the proposal must address

1. **Problem definition** — business problem, who has it, capabilities needed to
   go POC → production BPO service, expected improvement, unvalidated
   assumptions. Separate user/business problems from features. Do **not** assess
   the existing POC.
2. **Users and operating model** — human caller, team leader/supervisor,
   campaign manager, Sales/RevOps admin, compliance/operations owner, system
   admin. Per user: goal, required information, actions, decisions, failure and
   frustration cases.
3. **Company selection and two-level tailoring** — authoritative fields; what
   qualifies as a likely-to-buy signal; reliability and freshness; who approves;
   handling weak/stale/contradictory signals; automated vs human-approved vs
   hybrid; which segment fields the AI may use; approval of opening variants;
   what stays reserved for the human briefing; preventing unsupported or stale
   claims; how the suggested angle is generated and reviewed; which outcomes and
   next-action statuses are written back and which need human confirmation.
   **Distinguish sourced facts from generated recommendations.**
4. **End-to-end workflow** — signal screening, call initiation, no answer /
   busy / voicemail, company verification, gatekeeper, hold/transfer, PIC
   verification, human preparation and availability, live handoff, rejected /
   failed / abandoned handoff, human conversation, disposition, retry and
   callback scheduling, wrong company or number, refusal and do-not-call,
   dropped calls, exhausted or stale leads. For **every** terminal or deferred
   path: the attempt outcome and the resulting lead status / next action. Also
   clarify the difference between a lead status, a scheduled retry, a work
   queue, a human assignment, and routing an active live call.
5. **Human preparation and handoff** — PIC side: what the AI says before
   handoff, how long the PIC may wait, no-human-available, transfer failure.
   Human side: when the briefing appears, minimum information to take over,
   availability representation, provisional reservation before PIC is reached,
   explicit acceptance, non-response, prioritising competing live calls,
   avoiding making the PIC repeat themselves. **Recommend an initial ratio of
   simultaneous AI calls per available human, and how to validate it rather than
   assume it.**
6. **Product and capability decomposition** — 25 named capabilities, from
   signal ingestion through failure recovery. For each: does a candidate
   open-source product provide it as-is, via configuration, via extension or
   integration, or not at all — with edition, version, evidence source, and
   confidence.
7. **Adopt-versus-rebuild assessment** — compare at minimum: Asterisk as a
   telephony foundation; VICIdial; at least two of ICTDialer / OSDial / another
   relevant product; a focused greenfield build on open-source components; and
   one hybrid. Aircall/CallHippo may serve as a **product-pattern benchmark
   only**. The POC is **not** an option and must not be scored. 21 evaluation
   criteria (workflow fit, parallel dialing, external AI voice leg, APIs and
   webhooks, live transfer, presence/reservation/routing, screen-pop,
   lead-management integration, customisation limits, reliability, security and
   compliance, licence obligations, project activity and release recency,
   supported OS and dependency age, upgrade/patching/HA burden, implementation
   effort, maintenance, lock-in, indicative cost, time to controlled pilot).
   Conclude with a recommendation — which may be conditional.
8. **V2 scope and prioritization** — minimum viable V2, deliberate exclusions,
   later enhancements, dependencies, release blockers, prioritized backlog,
   acceptance criteria for pilot-critical items. Group as **pilot-critical /
   required before production / later / out of scope**. Avoid defining V2 as a
   general-purpose BPO platform.
9. **Success measurement** — a **small** set of measurable outcomes drawn from
   the 21 candidate metrics. State which baselines are missing. Do not assume
   either tailoring level helps merely because it is plausible. Describe how a
   pilot would test: signal-selected vs historical baseline; segment-tailored
   openings improving gatekeeper passage; briefing cards improving call quality;
   more useful conversations per human hour.
10. **Risks and validation plan** — largest product, workflow, technical,
    operational, compliance, and adoption risks; for each consequential
    uncertainty, the **smallest** experiment that resolves it.

---

## 5. Required acceptance scenarios

The proposal must address all three:

1. **Primary.** Eligible company enters the queue on an approved current signal;
   AI places a segment-tailored call, navigates the gatekeeper, verifies the
   PIC; a ready human has a concise source-backed briefing, accepts, connects
   within the waiting threshold, and continues a personalized conversation;
   attempt and outcome are written to the correct lead.
2. **Failure.** AI reaches the PIC but **no prepared human is available.** The
   system does not leave the PIC waiting indefinitely or perform an uncontrolled
   transfer. It closes with approved wording, records the attempt, and assigns a
   clearly defined human-callback status or next action.
3. **Data minimization.** During the automated phase the AI asks only whether
   the responsible person is available and can accept the call. It does not ask
   for name, direct or mobile number, email, WhatsApp, or other identifying
   information. Volunteered identifying information is not repeated or persisted
   in the lead, briefing, structured outcome, or retained transcript.

---

## 6. Deliverables

| ID | Deliverable | Notes |
| --- | --- | --- |
| P-01 | Product refinement document, ~8–15 pages excl. appendices | Sections: executive summary; problem and users; current-state assessment; required and proposed workflows; capability map; V2 scope and prioritized backlog; adopt-vs-rebuild comparison; recommendation; risks; success metrics; validation plan |
| P-02 | Workflow diagram | Main path **and** important exceptions, signal screening → final disposition |
| P-03 | Capability decision matrix | Per capability: adopt as-is / configure / extend / integrate / build / validate first / defer — with rationale, evidence, confidence |
| P-04 | Prioritized product backlog | Epics/major stories by priority; acceptance criteria for pilot-critical items |
| P-05 | 15-minute decision presentation | Understandable without reading the full document first |

---

## 7. Working expectations

**Expected to:** start from the required business flow and focus on
productionization; document the questions you would ask and assumptions needing
validation if stakeholders are unavailable (interviews are optional and unscored);
identify contradictions and missing decisions; challenge assumptions
constructively; distinguish requirements from suggested solutions; use evidence
when comparing vendors; inspect open-source docs, repos, release activity,
licences, and deployment requirements; **state uncertainty honestly**; recommend
the smallest next step producing decision-quality evidence.

**Not expected to:** write production code; review or reverse-engineer the POC;
produce a complete low-level system design; recreate every contact-centre
feature; accept a suggested architecture without evaluation; produce precise
cost estimates without usage or vendor evidence.

**Turnaround.** Due with Task 1 inside the 24-hour window. The source says:
prioritize clear product judgment over exhaustive research, and state
assumptions and evidence gaps rather than presenting unsupported conclusions as
facts.

---

## 8. Boundary restated

Every concept on this page — AI voice agents, gatekeeper navigation, PIC
verification, human-worker pools, live handoff, briefing cards, likely-to-buy
signals, PII redaction, supervisor controls, open-source dialer evaluation — is
**PLAN ONLY**.

None of it enters the Task 1 codebase. Task 1 is a mocked 2-line dialer with an
in-memory mock CRM, and nothing more. See `docs/assignment-scope.md` §4.
