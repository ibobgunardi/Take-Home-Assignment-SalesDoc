# V2 Prioritized Product Backlog

Companion to [01-product-refinement.md](01-product-refinement.md) and
[03-capability-matrix.md](03-capability-matrix.md).

Grouped **pilot-critical → required before production → later → out of scope**.
Pilot-critical items carry acceptance criteria; the rest carry intent, because
writing detailed criteria for work that may never be scheduled is waste.

**Scope discipline.** The exercise warns against defining V2 as a
general-purpose BPO platform. This backlog is deliberately narrow: one campaign,
one segment, one operator pool, one telephony region. Everything that would make
it a platform is in §4.

---

## 0. Gate — evidence before engineering

**Nothing below is committed until these pass.** They are the conditions on the
recommendation in P-01 §8.5. Roughly three weeks, and they can kill the
programme cheaply — which is the point.

| ID | Gate | Question it answers | Kill condition |
| --- | --- | --- | --- |
| **G-1** | Legal and compliance review | May we place AI-initiated outbound calls in the pilot market, with what disclosure and recording rules? | A "no" stops the programme. Ask in week 1 |
| **G-2** | Lead-management API spike | Can we read signals and write structured outcomes at the required rate, with the statuses P-02 §2 needs? | Missing write path or statuses reshapes the timeline |
| **G-3** | E1 — controlled PBX transfer, 100 calls | Does gatekeeper→hold→PIC→attended transfer survive real PBXs? | >5% failure with no mitigation |
| **G-4** | E2 — AI leg over ARI External Media | Is the attachment viable, and is PIC-verify-to-human-audio fast enough? | p95 > 5s that cannot be reduced |
| **G-5** | E6 — managed-platform benchmark, 2 days | Does anything off the shelf already do provisional reservation? | If yes, revisit the whole build decision |
| **G-6** | Manual baseline measurement, 2 weeks, parallel | What are today's dials, contacts and conversations per caller-hour? | Not a kill gate, but **without it the pilot cannot prove anything** |

---

## 1. Pilot-critical

The smallest set that produces a real conversation with a real PIC and a correct
lead record. If any of these is missing, there is no pilot.

---

### EPIC A — Selection and eligibility

**A-1 · Read eligible leads and signals from lead management**
As a campaign manager, I want V2 to read leads, company context, segment fields
and likely-to-buy signals from the system of record, so that V2 never becomes a
second source of truth.

*Acceptance criteria*
- Reads lead identity, company context, segment fields, signal type, signal date, and current status.
- Handles API failure without dropping a lead: retried with backoff, surfaced to the supervisor after N failures.
- Never writes lead identity fields — V2 is a reader for everything except attempt outcomes and next actions.
- Field mapping is configuration, not code.

**A-2 · Screen on approved, current signals**
As a compliance owner, I want every call to be backed by an approved signal
within its freshness window, so V2 is demonstrably not a cold mass dialer.

*Acceptance criteria*
- A company with no approved signal is **never** queued; outcome `NOT_ELIGIBLE_NO_SIGNAL`.
- Signal older than its per-type freshness window → `SIGNAL_STALE`, status `AWAITING_SIGNAL_REFRESH`.
- Freshness window configurable per signal type without deployment.
- Contradictory signals resolve by documented precedence; the losing signal is recorded.
- **100% of queued companies carry a signal id, verifiable by query.** This is metric M-guardrail and a release blocker.

**A-3 · Contactability gate**
As a compliance owner, I want DNC, suppression, calling hours and retry caps
enforced before dialing.

*Acceptance criteria*
- DNC list checked at queue time **and again immediately before dial** — the list can change in between.
- Calling-hours enforced in the **company's** local time zone, not ours.
- Retry cap per lead per campaign enforced; exceeding it → `NOT_CONTACTABLE`.
- Any block produces an auditable reason.

---

### EPIC B — Two-level tailoring

**B-1 · Segment-level AI script configuration**
As a campaign manager, I want a bounded set of approved opening variants keyed on
segment, so the AI never improvises and no per-company generation is required.

*Acceptance criteria*
- Variants keyed on industry, company type, size band, campaign, target role.
- Every variant has an explicit approver and approval timestamp.
- An unapproved variant **cannot** be used on a live call — enforced, not documented.
- Variants are versioned; each attempt records the version used.
- **No company-specific field can be interpolated into an AI script** — requirement 6, enforced by the template engine rejecting non-segment fields.

**B-2 · Human briefing card**
As a human caller, I want the required briefing before I speak, so I can open
well without making the PIC repeat themselves.

*Acceptance criteria*
- Shows all six required elements: company, why selected, the signal, target role, what the AI established, suggested opening.
- Assembled from lead-management fields plus the AI's **structured** outcome — never from call text.
- **Renders within 2 seconds of provisional reservation** (p95), measured.
- Every fact displays its source field and as-of date next to it.
- Degrades honestly: a missing field renders "not available", never blank and never a guess.

**B-3 · Claim provenance**
As a human caller, I want to see how old each fact is, so I never confidently
repeat a stale claim.

*Acceptance criteria*
- Each briefing fact carries source + as-of date.
- Facts older than the campaign's staleness threshold are visually marked.
- No fact appears without provenance.

---

### EPIC C — AI leg

**C-1 · Place calls and detect answer state**
*Acceptance criteria*
- Distinguishes answered, no answer, busy, invalid number; each maps to the P-02 §2 outcome.
- Voicemail detection decided by E2 evidence (AMD vs AI-leg judgement) — whichever wins, false-human and false-machine rates are both measured and reported.
- Every attempt gets a durable record before dialing, so a crash mid-call cannot lose it.

**C-2 · AI conversation within a closed intent set**
As a compliance owner, I want the AI incapable of collecting PII, not merely
instructed against it.

*Acceptance criteria*
- Permitted intents are an enumerated closed set: confirm company, request role, identify caller, accept hold, confirm PIC role, close.
- **The structured-outcome schema contains no field for name, phone, email or messaging handle.**
- Volunteered identifying information is not repeated, not solicited further, and has nowhere to be stored.
- Approved closing wording used on every close path, version recorded.

**C-3 · Company and PIC verification**
*Acceptance criteria*
- Company verified before any role request; failure → `WRONG_COMPANY`, status `DATA_QUALITY_ISSUE`, no AI retry.
- PIC verified **by role**, never by identity.
- Verification result recorded as an enum with a timestamp.

---

### EPIC D — Orchestration (the core build)

**D-1 · The reservation ladder** — *the highest-risk and highest-value item in the backlog*
As a human caller, I want to be reserved and briefed while the company is still
transferring, so I am ready when the PIC arrives.

*Acceptance criteria*
- Internal hold detected → one operator provisionally reserved → briefing renders.
- Provisional reservation is **time-bounded and always releases** — a call that dies during hold returns the operator to `Available` within 2 seconds, and a stuck reservation is impossible.
- PIC verified → hard commit → explicit accept prompt.
- Accept within the configured window → bridge. Decline or timeout → release, try **one** further operator, then the no-operator path.
- An operator is `Live` on at most one call, always.
- **Provisional-to-actual conversion rate is measured and reported** — E3.

**D-2 · Capacity-aware pacing**
*Acceptance criteria*
- Concurrency derives from **observed** available-operator count, never a prediction.
- Configurable ratio, defaulting to **3 concurrent AI calls per available operator** (P-01 §4.4).
- **Hard floor: no new call initiated when zero operators are reservable.**
- Concurrency reduces automatically as free-operator count falls.
- Every pacing decision is logged with its inputs, so a bad hour can be explained afterwards.

**D-3 · Live transfer**
*Acceptance criteria*
- **PIC-verification to human audio ≤ 5 s at p95**, measured on every call, not sampled.
- Transfer failure detected within 3 s → `TRANSFER_FAILED`, status `HUMAN_CALLBACK_DUE`, high priority.
- The AI leg detaches cleanly on success; no residual audio path.

**D-4 · The no-operator path** — *required acceptance scenario 2*
*Acceptance criteria*
- No reservable operator at PIC verification → bounded close begins on a timer.
- **Dead air never exceeds 8 s; the call closes within 20 s of PIC verification.**
- Approved wording used, version recorded.
- Outcome `PIC_REACHED_NO_OPERATOR`; status `HUMAN_CALLBACK_DUE`; enters the **human callback queue at high priority**, targeting the verified role.
- **Never enters the AI retry queue** — asserted by an automated test.
- Increments a defect counter visible on the supervisor console.

**D-5 · Three distinct queues**
*Acceptance criteria*
- Calling queue, AI retry queue, and human callback queue are separately inspectable.
- A lead can be in at most one at a time; transitions are logged.
- The five concepts of P-01 §4.1 are distinct in the data model — a lead status is not a queue membership.

---

### EPIC E — Operator experience

**E-1 · Presence and availability**
*Acceptance criteria*
- Operator sets Available / Unavailable; state changes are instant and logged.
- `Provisional` counts as committed capacity for pacing, not spare.
- Wrap-up **must** complete before returning to Available.
- Disconnection releases any reservation within 5 s so the pool does not silently shrink.

**E-2 · Accept, converse, disposition**
*Acceptance criteria*
- Explicit accept action; no implicit auto-answer.
- Disposition is mandatory before returning to the pool.
- Disposition list maps 1:1 onto lead-management next actions.
- The AI's structured outcome stays visible during the call, so the PIC is never asked to repeat.

---

### EPIC F — Write-back and operability

**F-1 · Structured write-back** — *completes acceptance scenario 1*
*Acceptance criteria*
- **Every** terminal and deferred path writes an attempt outcome and a next action to the **correct** lead — all 18 exits in P-02 §2.
- Machine-settable vs human-confirmation split enforced per P-02 §2.
- `DO_NOT_CALL` written immediately and irreversibly by the system.
- Write failure is retried durably; a lost write raises an alert, never fails silently.
- **≥99% of attempts written to the correct lead** — metric M5, and a release blocker.

**F-2 · Durable state and recovery**
*Acceptance criteria*
- Attempt state survives process restart; in-flight calls are reconciled, not orphaned.
- Orphaned calls and stuck provisional reservations are detected and released automatically.
- Restart mid-call never produces a duplicate attempt record on the lead.

**F-3 · Supervisor console and emergency stop**
*Acceptance criteria*
- Live view: AI calls in flight, operator states, abandonment, no-operator count, transfer failures.
- Campaign pause takes effect within one pacing cycle.
- **Emergency stop halts all new dialing immediately** and is reachable in one click. Release blocker.

**F-4 · Audit and redaction evidence**
*Acceptance criteria*
- Script version, approver, and closing-wording version recorded per attempt.
- Redaction runs before **any** persistence boundary; the audit records that it ran and a span count, **never the removed content**.
- **The adversarial data-minimisation test passes** (P-01 §7.3): a volunteered name and mobile number appear in zero of {lead record, briefing payload, structured outcome, retained transcript}. Release blocker.

**F-5 · Pilot metrics instrumentation**
*Acceptance criteria*
- M1–M5 emitted from first call: conversations per human hour, `p`, abandonment, handoff latency, write-back accuracy.
- Guardrails emitted: transfer failure, utilisation, PII violations, DNC compliance, signal coverage.
- **Instrumentation is live before the first real call** — release blocker. Metrics added afterwards cannot describe the beginning of the pilot.

---

## 2. Required before production

Not needed to learn from a pilot; needed before this carries real volume.

| ID | Item | Why it can wait |
| --- | --- | --- |
| P-1 | Role-based authorization and SSO | A pilot team is small and trusted; production is not |
| P-2 | High availability and failover for telephony | Pilot can tolerate a restart window; production cannot |
| P-3 | Multi-region / multi-time-zone calling | Pilot is one region |
| P-4 | Retry policy tuning from real data | The pilot **produces** the data this needs |
| P-5 | Full disposition taxonomy | Pilot runs a deliberately minimal set |
| P-6 | Operator scheduling and shift management | Pilot is manually rostered |
| P-7 | Recording storage, retention and legal hold | Depends on G-1 |
| P-8 | Load testing at target concurrency | Pilot concurrency is single digits |
| P-9 | Third-party security review | Before real lead data at volume |
| P-10 | Runbooks and on-call | Needs the failure modes the pilot will reveal |
| P-11 | Second AI vendor / failover | Avoids lock-in; needs vendor-1 evidence first |

---

## 3. Later

| ID | Item | Trigger that would promote it |
| --- | --- | --- |
| L-1 | Predictive pacing | Only once abandonment is understood and stable |
| L-2 | Automated pre-call research | Only if evidence shows briefings are materially thin |
| L-3 | Per-company AI opening generation | Only if E-hypothesis 2 shows segment tailoring is insufficient — **and note requirement 6 currently forbids it** |
| L-4 | Real-time coaching / whisper | Supervisor demand |
| L-5 | Self-service campaign builder | More than a handful of campaigns |
| L-6 | Multi-tenant | Only if SalesDoc sells this as a service |
| L-7 | Omnichannel follow-up | Separate product decision |
| L-8 | Conversation analytics on human calls | Volume makes it meaningful |
| L-9 | Automated signal discovery | RevOps capability question, not a V2 one |

---

## 4. Out of scope for V2

Recorded so the restraint is visible rather than looking like an oversight.

| Item | Why |
| --- | --- |
| **Inbound calling** | V2 is outbound. Inbound is a different product |
| **AI conducting the sales conversation** | Requirement 4 forbids it |
| **Per-company generated AI openings** | Requirement 6 forbids it |
| **A general-purpose BPO platform** | The exercise warns against it explicitly; no evidence justifies the scope |
| **Building an AI voice model** | Integrate. Building one is a company, not a feature |
| **Replacing the lead management system** | Requirement 11 — it is the system of record |
| **Adopting VICIdial / ICTDialer / OSDial as the platform** | P-01 §8.3; OSDial is dead, ICTDialer is a broadcasting product, VICIdial is an architectural mismatch with licence and dependency problems |
| **AI collecting any identifying information** | Requirement 12 |
| **Leaving voicemail messages** | Adds compliance surface for unproven value |
| **Cost model in this document** | The exercise does not expect costs without usage or vendor evidence, and invented figures are worse than none |

---

## 5. Dependencies and critical path

```text
G-1 legal ──────────────┐
G-2 lead-mgmt spike ────┼──> EPIC A ──> EPIC B ──┐
G-3 E1 transfer ────────┤                        ├──> EPIC D ──> EPIC F ──> PILOT
G-4 E2 AI leg ──────────┴──> EPIC C ─────────────┘        │
G-5 E6 benchmark ───────> (may invalidate the build)      │
G-6 manual baseline ─────────────────────────────────────┘ (must precede pilot
                                                             or nothing is provable)
```

**The critical path runs through EPIC D**, and within it through **D-1, the
reservation ladder** — the one capability no candidate provides, the one with no
reference implementation to copy, and the one whose failure mode (a stuck
reservation silently shrinking the operator pool) is easy to ship and hard to
notice. It should be built first, tested hardest, and instrumented most.

**G-6 is the dependency most likely to be skipped and most expensive to skip.**
It is unglamorous manual measurement with no engineering content, it must start
early because it takes two weeks of real calling, and without it the pilot can
report numbers but cannot demonstrate improvement against anything.
