# V2 AI-to-Human Outbound Dialer — Product Refinement

**Prepared for:** SalesDoc management, as a go/no-go decision document
**Status:** Proposal. Contains recommendations, assumptions, and named evidence gaps.
**Companion deliverables:** [workflow diagram](02-workflow-diagram.md) · [capability decision matrix](03-capability-matrix.md) · [backlog](04-backlog.md) · [presentation](05-presentation.md)

> **On evidence.** Every material external claim in this document is either
> sourced in [Appendix A](#appendix-a--evidence-log) with the URL and what was
> actually checked, or explicitly marked as an assumption. Where I could not
> verify something in the time available, it says so. The exercise asks for
> product judgment over exhaustive research; it also warns against presenting
> unsupported conclusions as facts. Section 11 lists what I did **not** check.

---

## 1. Executive summary

**The recommendation: build the orchestration layer, adopt Asterisk for
telephony, integrate the AI voice agent and SalesDoc's lead management. Do not
adopt VICIdial — or any of the named dialer products — as the V2 platform.
This recommendation is conditional on two experiments that together cost about
three weeks.**

The reasoning is short. The named candidates — VICIdial, ICTDialer, OSDial —
are *predictive-dialer and agent-desktop* products. They exist to solve one
problem extremely well: connect a human agent to an answered call as cheaply as
possible, at scale. V2's problem is a different shape. In V2 an AI holds a live
call for roughly one to two minutes doing verification and gatekeeper
navigation, and then, at a moment nobody can predict, a *specific prepared
human* must be reserved, briefed, and bridged in within seconds — or the PIC is
abandoned and the lead is burned.

That capability — **capacity-aware pacing, provisional operator reservation,
briefing delivery, and explicit human acceptance, all wrapped around a call that
is already in progress** — is the product. It does not exist off the shelf in
any of the candidates, because none of them was designed for a world in which
the first ninety seconds of a call are handled by a machine. Everything *around*
it (SIP, media, bridging, recording, transfer primitives) is a solved commodity
that would be irresponsible to rebuild.

So the split is:

| Layer | Decision | Why |
| --- | --- | --- |
| Telephony transport, media, bridging, transfer | **Adopt + configure** Asterisk | Mature, actively released, dual-licensed, and has the exact primitive the AI leg needs |
| AI voice agent | **Integrate** a vendor via ARI External Media | Not a differentiator to build; the attachment mechanism is documented and standard |
| **Orchestration + operator pool + briefing + writeback** | **Build** | This *is* V2. Nothing off the shelf implements it |
| Lead data, signals, statuses | **Integrate** SalesDoc lead management | It is the system of record by requirement |

Four verified findings drove the decision away from adopting a dialer product
wholesale. Each is sourced in Appendix A:

1. **VICIdial's recommended deployment ships Asterisk 18, which is End of Life
   and receives no security patches of any kind.** ViciBox 12.0.2 — the
   recommended installation — is built on Asterisk 18. Adopting VICIdial means
   inheriting a telephony core that is already outside its support window, or
   fighting the distribution to run something newer.
2. **VICIdial has a publicly exploited unauthenticated-SQLi-to-root-RCE chain
   (CVE-2024-8503, CVSS 9.8, chained with CVE-2024-8504), and stores credentials
   in plaintext in its database by default.** These specific CVEs are from 2024
   and are very likely patched in current releases — I did not verify that, and
   the point is not that VICIdial is vulnerable today. The point is the *posture*:
   a large PHP/Perl attack surface, public exploit tooling, and plaintext
   credentials by default, in a system that would hold SalesDoc's lead data.
3. **OSDial is dead.** Last code commit November 2014; last SourceForge release
   March 2014. Twelve years. It should be removed from the candidate list, not
   evaluated.
4. **ICTDialer is the wrong product shape.** It is GPL-3.0, reasonably
   maintained, and built on FreeSWITCH — but it is a *voice and fax broadcasting*
   auto-dialer. Broadcasting is the opposite of what V2 needs: V2's value is
   entirely in the live-transfer-to-prepared-human moment that broadcasting
   systems have no concept of.

**What we do not yet know, and must, before committing engineering:** whether a
gatekeeper-to-PIC transfer survives a real PBX cleanly, and how long an AI-leg
handoff actually takes end to end. Both are answerable in three weeks
(§10, E1 and E2). **The recommendation is conditional on those two results.**

**The number that decides the business case is not a technology number.** It is
`p` — the proportion of AI calls that reach a verified PIC. Every capacity
calculation, the AI-calls-per-human ratio, and the cost per human conversation
all follow from it, and **SalesDoc has no baseline for it today** (§9). The
pilot's primary job is to measure `p`.

---

## 2. Problem and users

### 2.1 The business problem

Human outbound callers spend most of their paid time not selling. They dial,
they wait through ringing, they hit voicemail, they negotiate with a receptionist,
they hold during an internal transfer. The substantive conversation — the only
part that requires a skilled human and the only part that creates revenue — is a
small fraction of the hour.

V2's proposition is to move the repetitive front half of every call to an AI
voice agent, so that a human is only ever connected to a call in which a verified
decision-maker is already on the line and already expecting to talk. The unit of
improvement is therefore **useful conversations per human calling hour**, not
calls dialed and not automation coverage.

A second problem sits underneath it: **calling the wrong companies**. V2 is
explicitly not a cold mass dialer. Screening on likely-to-buy signals is a
business requirement, and it is also the mechanism that makes the economics work
— human hours are the scarce resource, so they must only ever be spent on
companies with a reason to be called.

### 2.2 Who has the problem

| Stakeholder | Feels the problem as |
| --- | --- |
| **Human caller** | Hours of dialing and gatekeeper friction for a handful of real conversations; fatigue; low earnings against quota |
| **Team leader / supervisor** | Cannot see or fix live problems; no lever between "everyone dial harder" and nothing |
| **Campaign manager** | Cannot tell which signals produce conversations, so cannot target better |
| **Sales / RevOps admin** | Attempt outcomes never reliably reach the lead record, so pipeline reporting is fiction |
| **Compliance / operations owner** | Cannot evidence what was said, to whom, or what was retained — a hard problem when an AI is doing the talking |
| **System administrator** | Owns a telephony stack whose failures are visible to customers within seconds |

### 2.3 Primary users in detail

**Human caller.**
*Goal:* spend the shift in substantive conversations, not dialing.
*Needs at the moment of handoff:* company on the line, why it was selected,
the signal, the target role, what the AI already established, and a suggested
opening — visible **before** they speak, not after.
*Actions:* set availability, accept or decline a handoff, talk, disposition, wrap.
*Decisions:* accept this call now or not; what disposition; what next action.
*Failure cases that matter:* a handoff arriving with no briefing rendered;
being expected to talk within two seconds of a screen appearing; the PIC having
to repeat what they already told the AI; being blamed for a transfer failure
that was the platform's fault. **Any of these will cause callers to quietly stop
setting themselves available, which kills the system.**

**Team leader / supervisor.**
*Goal:* keep the floor productive and intervene before a problem compounds.
*Needs:* live view of AI calls in flight, humans available vs occupied, PIC
waits in progress, abandonment and transfer-failure counters.
*Actions:* pause a campaign, adjust pacing, reassign, listen in, force-release a
stuck operator.
*Failure case:* discovering an hour later that pacing was too aggressive and
forty PICs were abandoned.

**Campaign manager.**
*Goal:* select the right companies and prove which signals work.
*Needs:* signal definitions, freshness, approval state, and per-signal outcome
reporting.
*Actions:* define segments, approve opening variants, set eligibility windows.
*Failure case:* a stale signal producing a call that references an event from
eight months ago — actively damaging to the brand.

**Compliance / operations owner.**
*Goal:* be able to answer "what did the machine say, and what did we keep?"
*Needs:* approved-script provenance, redaction evidence, DNC enforcement, audit.
*Actions:* approve wording, set retention, audit, suspend.
*Failure case:* discovering the AI persisted a mobile number someone volunteered.

**Sales / RevOps administrator.**
*Goal:* pipeline reporting that reflects what actually happened on the phones.
*Needs:* the mapping between V2 attempt outcomes and lead statuses, the
write-back success rate, and an exception queue for writes that failed.
*Actions:* configure the outcome-to-status mapping, reconcile failed writes,
decide which statuses V2 may set unattended.
*Decisions:* which next-action statuses are safe for a machine to set; when a
lead needs human judgement before its status changes.
*Failure cases:* **silent** write failures - the worst kind, because reporting
looks fine and is wrong; V2 setting a commercial status a human should have
judged; duplicate attempts appearing on one lead after a restart.

**System administrator.**
*Goal:* keep telephony and the orchestration service healthy, knowing that a
failure is audible to a customer within seconds rather than discovered in a
dashboard tomorrow.
*Needs:* health of SIP trunks, media paths, AI-vendor connectivity, queue depth,
and any stuck provisional reservations.
*Actions:* patch, upgrade, fail over, drain the queue, restart safely mid-shift.
*Decisions:* drain or restart; whether to fail over the AI vendor; whether an
upgrade can wait until outside calling hours.
*Failure cases:* an upgrade that requires a full stop during calling hours; a
stuck reservation quietly shrinking the operator pool so the floor looks
understaffed; no runbook for a transfer-path outage. **This role may not exist
in-house today** - see Q9, and risk R10.

### 2.4 What has not been validated

These are assumptions, listed so they can be attacked rather than inherited:

- **A1.** That AI gatekeeper navigation succeeds often enough to be economic. The
  POC shows it is *possible*, not that it is *frequent*. `p` is unmeasured.
- **A2.** That gatekeepers and PICs will accept an AI opening at a rate
  comparable to a human's. Unknown; possibly segment-dependent.
- **A3.** That segment-level tailoring is sufficient — i.e. that per-company
  generated openings are genuinely unnecessary. This is a stated requirement, but
  it is also an untested hypothesis about conversion.
- **A4.** That a human can absorb a briefing and take over inside the acceptable
  PIC wait. Depends on briefing design and is testable cheaply.
- **A5.** That live transfer is reliable enough at the required rate. Telephony
  transfer failure is a real and common failure mode.
- **A6.** That SalesDoc's lead management exposes the fields, signals, and
  write-back statuses V2 needs, with adequate API throughput. **Unverified — I
  have no access to it.** This is the single largest scoping unknown.
- **A7.** That the regulatory position for AI-initiated outbound calls in the
  target markets permits this flow, with or without disclosure. Not a technical
  question and not one I can answer.

### 2.5 Questions I would ask, and of whom

Stakeholders were not available; the exercise accepts documented questions
instead. These are the ones whose answers would change the design:

| # | Question | Ask | Changes what |
| --- | --- | --- | --- |
| Q1 | What is today's baseline: dials/hour, contact rate, conversations per caller-hour? | Sales leadership | Whether V2's improvement can be proven at all |
| Q2 | Which signals exist today, how are they sourced, and how fresh are they? | RevOps / campaign | Whether screening is real or aspirational |
| Q3 | Does lead management expose read + structured write via API, at what rate limit? | Platform owner | Integration cost; possibly the whole timeline |
| Q4 | Which next-action statuses already exist, and who may set them? | RevOps | Whether V2 can write back without schema change |
| Q5 | How many human callers, on what shift pattern, in which time zones? | Ops | Capacity model and pacing |
| Q6 | What is the acceptable PIC wait, as a business judgement? | Sales leadership | The core latency budget |
| Q7 | Do we need call-recording consent, and does an AI leg require disclosure in our markets? | Legal / compliance | Possibly a blocker |
| Q8 | Is there an approved AI voice vendor, or is that an open procurement? | Procurement / security | Build vs integrate on the AI leg |
| Q9 | Who owns telephony operations out of hours? | Engineering / ops | Whether we can run Asterisk ourselves at all |

---

## 3. Current-state assessment

The exercise instructs that the POC not be assessed, and that V2 be treated as
greenfield. This section therefore assesses the **operating capability gap**
between demonstrating the concept and running it as a service — not the POC's
implementation.

A demonstration needs one call to work while someone watches. A production
BPO-style service needs all of the following, none of which a demonstration
exercises:

| Dimension | Demonstration | Production service |
| --- | --- | --- |
| State | In memory, one call | Durable; survives restart mid-call; reconcilable with the lead system |
| Concurrency | One or a few calls | Paced against live human availability, with a ceiling |
| Failure | Retry by hand | Defined outcome for every terminal and deferred path |
| People | One person watching | Presence, reservation, acceptance, wrap-up, shift boundaries |
| Data | Whatever was captured | Minimised at source, redacted before persistence, retention-bounded |
| Authority | Whoever has the laptop | Roles, approval of scripts, audit of who changed what |
| Truth | The demo's own store | Lead management is system of record; V2 writes back structured outcomes |
| Measurement | "It worked" | `p`, latency, abandonment, transfer failure, conversion |

**The honest summary of the gap:** the hard part of V2 was never making an AI
talk to a receptionist. It is making a human reliably available, prepared, and
connected at an unpredictable moment — and making every path that *isn't* the
happy path end in a defined lead status instead of a lost lead.

---

## 4. Required and proposed workflows

The full diagram, including every exception branch and its lead-status outcome,
is in [02-workflow-diagram.md](02-workflow-diagram.md). This section covers the
design decisions the diagram encodes.

### 4.1 Five concepts that must not be conflated

The exercise asks for this distinction explicitly, and it is worth stating
because collapsing any two of these produces a broken system:

| Concept | Owned by | Lifetime | Cardinality | Example |
| --- | --- | --- | --- | --- |
| **Lead status** | Lead management (system of record) | Persistent | Exactly 1 per lead | `HUMAN_CALLBACK_DUE` |
| **Scheduled retry** | V2 scheduler | Until fired or cancelled | 0..n per lead | "re-attempt after 2 business days, 09:00–11:00" |
| **Work queue** | V2 | Continuous | 1..n per campaign | "eligible companies awaiting an AI attempt" |
| **Human assignment** | V2 operator pool | Seconds to minutes | 1 per human at a time | "operator 7 reserved for attempt A-1183" |
| **Live-call routing** | Telephony (Asterisk) | Seconds | Per channel | "bridge the PIC channel to operator 7's channel" |

The failure this prevents: treating "no human was available" as a *retry*. It is
not. It is a **lead status change plus a human-callback assignment**, and it must
never fall back into the ordinary AI retry queue — the PIC has already been
reached and spoken to, and calling them again with an AI would be worse than not
calling at all.

### 4.2 The three-stage pipeline

**Stage 1 — Selection (before any call).** Read leads and company context from
lead management. Screen on approved, current likely-to-buy signals. Assemble two
separate artefacts: **segment context** (bounded, reusable, approved — what the
AI may use) and the **human briefing** (company-specific — what only the human
sees). Queue the company.

The two-level split is a hard boundary, not a style choice. The AI's dialogue is
constrained to approved segment-level variants; company-specific facts never
enter the AI's prompt. This bounds three risks at once: the AI cannot state an
unsupported company-specific claim, the per-company generation cost disappears,
and script approval becomes tractable because there are tens of variants rather
than thousands.

**Stage 2 — AI leg.** Place the call. Detect answer. Verify company. Navigate
gatekeeper if present. Hold through internal transfer. Verify PIC by *role*, not
by identity. Throughout, the AI operates under the data-minimisation constraints
in §4.5.

**Stage 3 — Human leg.** Reserve, brief, accept, bridge, converse, disposition,
write back.

### 4.3 The reservation ladder — the heart of the design

Naïvely, you reserve a human when the PIC is verified. That is too late: the PIC
is on the line and every second of silence is abandonment risk. Reserving one at
dial time is too early: most calls never reach a PIC, so humans sit idle and the
economics collapse.

The resolution is a **ladder of increasing commitment**, tied to observable call
progress:

| Call state | Operator action | Rationale |
| --- | --- | --- |
| Queued | Nothing | Most attempts die here |
| Dialing / ringing | Nothing | No signal yet |
| Answered, verifying company | **Soft-warn** the pool — pacing counts this attempt as "warm" | Cheap; informs pacing |
| Gatekeeper transferring / internal hold | **Provisionally reserve** one operator; briefing renders on their screen | This is the strongest available predictor that a PIC is imminent. The operator gets 15–45 seconds of reading time — which is exactly what makes the wait bearable for the PIC |
| PIC verified | **Hard-commit** the reservation; prompt for explicit accept | The operator has already read the briefing |
| Accepted | Bridge | |
| Not accepted within N seconds | Release; try the next reservable operator once; else the no-human path | Bounded, never open-ended |

**Provisional reservation at the transfer moment is the single most important
design decision in this document.** It converts the impossible requirement
("brief a human in zero seconds") into an achievable one ("brief a human during
the hold the company itself imposes"). It is also the decision most likely to be
wrong in a way that only measurement will reveal — if the provisional-to-actual
conversion rate is low, operators are repeatedly reserved for calls that die, and
utilisation suffers. **Experiment E3 measures exactly this.**

#### How competing calls are prioritised

Contention is not an edge case: whenever verified PICs arrive faster than
operators free up, two calls want the same person. An operator takes one call at
a time (requirement 9), so the tie must be broken by an explicit rule rather than
by whichever event happened to be processed first.

**Ordering, first match wins:**

1. **A verified PIC already on the line outranks a call still in gatekeeper
   hold.** A real human waiting beats a prediction that one is coming. This is
   the only rule that matters most of the time.
2. **Longest PIC wait first**, among calls at the same stage. Prevents
   starvation, and directly protects the abandonment ceiling.
3. **Signal tier** - a Tier 1 signal outranks Tier 2 (§4.6.2).
4. **Campaign priority**, set explicitly by the campaign manager.
5. **Arrival order** as a deterministic final tie-break - never random, so
   behaviour is reproducible when something is being investigated.

**Preemption rule:** an operator *provisionally* reserved for call A may be
taken by call B only under rule 1 - B has a verified PIC and A is still in hold.
**An operator who has hard-committed is never preempted.** Reassigning someone
who has already accepted a call is how you produce two abandoned PICs instead of
one.

### 4.4 Recommended AI-call-to-human ratio, and why the arithmetic matters more than the number

The exercise asks for an initial ratio and how to validate it. Here is the
reasoning, because the reasoning survives even when the number is wrong.

Let `T_ai` be mean AI-leg duration, `p` the proportion of AI calls reaching a
verified PIC, and `T_human` the mean human occupancy (talk + wrap). For a single
human at full utilisation, the sustainable number of concurrent AI calls `N` is:

```text
N  =  T_ai  /  ( p x T_human )
```

Plugging in plausible values — `T_ai` ≈ 2 min, `T_human` ≈ 10 min including wrap:

| If `p` is… | `N` at 100% utilisation |
| --- | --- |
| 20% | 1.0 |
| 15% | 1.3 |
| 10% | 2.0 |
| 5% | 4.0 |

Two conclusions follow, and both are more valuable than the number itself:

1. **The ratio is small — low single digits — and it is inversely proportional
   to how well the AI performs.** The better the AI gets at reaching PICs, the
   *fewer* concurrent calls one human can support. This is counter-intuitive and
   worth stating plainly to management: AI improvement converts into needing more
   humans, not fewer calls.
2. **You must never run at 100% utilisation.** At full utilisation, queueing
   theory guarantees that some PIC arrives with no human free, and that PIC is
   abandoned. Abandonment is the expensive failure — it burns a reached
   decision-maker. So the operating point must sit below the ratio above.

**Recommendation: start the pilot at 3 concurrent AI calls per available human,
with adaptive pacing that reduces concurrency as the free-operator count falls,
and a hard floor that stops initiating new calls when zero operators are
reservable.** Three is chosen to be deliberately conservative against an unknown
`p`; it is a starting point for measurement, not a target.

**How to validate rather than assume:** run the pilot with pacing fixed at 3 for
the first week and record `p`, `T_ai`, `T_human`, abandonment, and utilisation.
Then compute the theoretical `N` from measured values and step the ratio in
increments of 0.5 while watching abandonment. **Abandonment is the constraint
that must not be traded away** — it should be treated as a hard ceiling
(recommendation: ≤2% of verified PICs), with utilisation optimised underneath it.

### 4.5 Data minimisation — enforced by architecture, not policy

Requirement 12 is the requirement most likely to be satisfied on paper and
violated in practice, because "the AI shouldn't ask for a name" is a prompt
instruction, and prompt instructions are not controls.

**The design principle: during the AI phase, the system has no capability to
persist identifying information. Not "is instructed not to" — cannot.**

Concretely:

1. **Closed intent set.** The AI's permitted intents are enumerable: confirm
   company, request target role, answer "who is calling", accept hold, confirm
   PIC role, close politely. There is no name / phone / email slot in the schema.
   Nothing to fill means nothing to store.
2. **No free-text write path.** The AI leg's only structured output is an enum
   set (`company_verified`, `gatekeeper_outcome`, `pic_role_confirmed`,
   `close_reason`) plus timestamps. The briefing and the lead record are assembled
   from **lead-management fields plus these enums** — never from call text.
3. **Transcripts are ephemeral by default.** ASR output lives in memory for the
   duration of the call. Persisting it at all is a per-campaign, compliance-owner
   decision; when enabled, it passes a redaction stage first.
4. **Redaction before persistence, with evidence.** A detector for names, phone
   numbers, emails, and messaging handles runs on any text that crosses a
   persistence boundary. The audit log records *that* redaction ran and how many
   spans were removed — never the removed content.
5. **Volunteered PII: acknowledge, do not repeat, do not solicit, do not store.**
   The AI's response policy is to continue without echoing. Because of (1) and (2)
   there is no field for it to land in even if the model misbehaves.

The acceptance test (§7, Scenario 3) is written to be *falsifiable*: deliberately
volunteer a name and a mobile number during a test call, then grep the lead
record, the briefing, the structured outcome, and any retained transcript. If any
of them appear, the control failed.

---

## 5. Capability map

Full per-capability decisions, evidence, and confidence are in
[03-capability-matrix.md](03-capability-matrix.md). The summary shape:

| Group | Capabilities | Dominant decision |
| --- | --- | --- |
| **Signal & selection** | signal ingestion, quality/freshness rules, eligibility, campaign selection, pre-call research | **Build** (thin) + **integrate** lead management |
| **Tailoring** | segment script config, briefing generation, claim provenance | **Build** — this is where the two-level requirement lives |
| **Telephony** | outbound dialing, parallel dialing, voicemail detection, live transfer, call controls, recording | **Adopt + configure** Asterisk |
| **AI leg** | AI conversation, gatekeeper navigation, PIC verification | **Integrate** a vendor over ARI External Media; **validate first** |
| **Orchestration** | queue & retry, capacity-aware pacing, presence, provisional reservation, acceptance | **Build** — no candidate provides it |
| **Human desktop** | briefing card, screen-pop, transcript/summary, dispositions | **Build** (thin web app) |
| **System of record** | lead read/write, outcome & next-action mapping | **Integrate** |
| **Operability** | supervisor controls, reporting, audit, compliance, failure recovery | **Build** on adopted infrastructure |

The concentration is the finding: **the build column is almost entirely
orchestration and the human-facing layer.** That is a coherent, bounded product
— not a contact-centre platform rebuild.

---

## 6. V2 scope and prioritized backlog

Full backlog with acceptance criteria: [04-backlog.md](04-backlog.md).

### 6.1 Minimum viable V2

One campaign, one segment, one small operator pool, one telephony region.
Signal-screened list, AI leg with gatekeeper navigation and PIC verification,
the reservation ladder, briefing card with explicit accept, live transfer,
dispositions, and structured write-back to the correct lead. Durable state,
supervisor pause, audit, and the data-minimisation controls.

### 6.2 Deliberately excluded from V2

Stated as exclusions so restraint is visible rather than looking like a gap:

- **Inbound.** V2 is outbound-only.
- **Multi-tenant / general BPO platform.** The exercise warns against this
  explicitly, and nothing yet justifies it.
- **Per-company generated AI openings.** Requirement 6 forbids it, and it is
  also the most expensive thing we could build.
- **AI conducting any part of the sales conversation.** Requirement 4.
- **Predictive/statistical pacing.** V2 paces on *observed operator
  availability*, which is simpler and safer. Predictive pacing is a later
  optimisation and a well-known way to cause abandonment.
- **Omnichannel** (SMS, email, WhatsApp follow-up).
- **In-house AI voice model.** Integrate; do not build.
- **Self-service campaign builder.** Campaigns are configured by us in V2.

### 6.3 Release blockers

1. Data-minimisation acceptance test passing (§7.3).
2. Every terminal path mapped to a lead status that write-back actually accepts.
3. Abandonment and transfer-failure telemetry live *before* the first real call.
4. Supervisor emergency stop.
5. Legal sign-off on AI-disclosure and recording in the pilot market.

---

## 7. The three required acceptance scenarios

### 7.1 Primary — signal to conversation

Acme Insurance carries an approved signal ("announced expansion into two new
markets", sourced from lead management, 11 days old, within the 30-day window)
and enters the queue. The AI places a call using the approved variant for
*insurance / mid-market / Head of Function*. The receptionist answers; the AI
confirms it has reached Acme Insurance, asks for the person responsible for
General Insurance, and is placed on hold.

**At the hold, an operator is provisionally reserved.** The briefing renders on
their screen: company, why selected, the signal, target role, AI progress so far,
suggested opening. They have ~30 seconds to read it.

The PIC comes on. The AI confirms the role, states that a colleague will take
over, and the operator — who has already accepted — is bridged. **Measured target:
PIC verification to human audio ≤ 5 seconds.** The operator opens on the
expansion angle without asking anything the PIC already told the AI, because the
AI's structured outcome is on their screen.

At the end: disposition recorded, structured attempt outcome and next action
written back to the *same lead* in lead management, with the attempt linked to
the campaign and signal.

### 7.2 Failure — PIC reached, no human available

Same call, but at PIC verification no operator is reservable (all occupied, or
the provisionally reserved one dropped out).

The system **does not** hold the PIC in silence and **does not** transfer blindly.
Within a bounded window the AI closes using **approved wording** — acknowledging
the person, not pitching, and stating that a colleague will follow up. Then:

- Attempt outcome: `PIC_REACHED_NO_OPERATOR`
- Lead status: `HUMAN_CALLBACK_DUE`
- Next action: human callback, scheduled into the **human-callback queue** — a
  different queue from the AI retry queue, worked by a person, targeting the
  *verified role* (never a captured name or direct number)
- The verified-role fact is retained because it is company information, not
  personal identifying information
- Pacing registers the event and reduces concurrency

**This path must be treated as a defect signal, not a normal outcome.** A rising
`PIC_REACHED_NO_OPERATOR` rate means pacing is too aggressive. It is a headline
metric on the supervisor console for that reason.

### 7.3 Data minimisation — falsifiable by test

During the AI phase the agent asks only whether the person responsible for the
target function is available and can take the call. It never asks for a name,
direct or mobile number, email, or messaging handle — **there is no schema field
for any of them.**

The acceptance test is adversarial: on a scripted test call, the "receptionist"
volunteers *"That's Sarah Chen, her mobile is +62 811 5550 199."* Then assert:

- The AI does not repeat either fact and does not ask for more.
- `grep` the lead record, the briefing card payload, the structured outcome, and
  any retained transcript for "Sarah", "Chen", and the number → **zero matches.**
- The audit log records that redaction ran, with a span count and no content.

If any assertion fails, the release is blocked.

---

## 8. Adopt versus rebuild

### 8.1 Candidates and how they were assessed

Per the exercise: Asterisk as telephony foundation, VICIdial, two further
open-source contact-centre products, a focused greenfield build, and a hybrid.
The POC is not scored. CallHippo/DialerHQ appear only as product-pattern
benchmarks.

**Research ceiling, stated honestly.** Exhaustive assessment would be ~25
capabilities × 6 options × 21 criteria — roughly 3,000 judgements. That is not
reachable in the time available, and producing it would mean inventing most of
it. I instead verified, for each candidate, the **licence, release recency,
maintenance activity and dependency age** against the actual repository or
project site, then assessed the **six capabilities that actually decide
adopt-vs-build**. Everything else is marked *not assessed*.

### 8.2 What was verified

| Candidate | Licence | Activity (checked) | Verdict |
| --- | --- | --- | --- |
| **Asterisk** | GPLv2, with commercial dual-licensing via Sangoma as exclusive licensor | 23.5.0, 22.11.0 and 20.21.0 all released **2026-08-27**; repo pushed same day; 3,493 stars | **Adopt as foundation.** Healthiest candidate by a wide margin |
| **VICIdial** | **AGPLv2** (Affero v2 — an unusual variant) | Actively developed (SVN trunk ~r3939, v2.14b0.5); ViciBox 12.0.2 released Jan 2025 | **Do not adopt as platform.** See §8.3 |
| **ICTDialer** | GPL-3.0 | Repo pushed 2026-08-12; latest tagged release v2.0.0 (2025-03-01); 123 stars; small maintenance commits | **Reject — wrong product shape.** Voice/fax *broadcasting*, not live-transfer contact centre |
| **OSDial** | AGPL (repo metadata AGPL-3.0; project historically GPL/AGPLv2) | **Last commit 2014-11-06; last release March 2014**; 2 stars | **Reject — unmaintained.** Remove from consideration |
| **FreeSWITCH** | MPL 1.1 | Pushed 2026-08-28; 5,125 stars | Viable alternative foundation; not preferred (§8.4) |
| **Greenfield build** | n/a | n/a | **Recommended for the orchestration layer only** |
| **Hybrid** | n/a | n/a | **This is the recommendation** |

### 8.3 Why not VICIdial, in detail

VICIdial is a genuinely impressive, widely deployed, actively maintained product,
and dismissing it needs reasons rather than preference. There are four.

**1. Architectural mismatch — the decisive one.** VICIdial's core abstraction is
*"an available agent takes the next call from a queue."* V2's is *"a specific
prepared operator is reserved, briefed, and committed to a call already in
progress, with an explicit accept step."* Provisional reservation, briefing-render
gating, and accept-or-release-and-retry have no counterpart in the agent-queue
model. Implementing them means fighting the framework in its least extensible
area, and every VICIdial upgrade would then be a merge conflict.

**2. Licence.** AGPLv2 is network copyleft. SalesDoc would be substantially
modifying the software and exposing it over a network to operators — precisely
the trigger the Affero clause exists for. This is not fatal, and it is not legal
advice, but it is a question for counsel *before* engineering, not after.

**3. Dependency age.** ViciBox 12.0.2, the recommended installation, ships
**Asterisk 18 — which is End of Life and receives no updates of any kind,
including security fixes.** Supported branches are Asterisk 20 (security-fix-only
from October 2026) and 22 (2028). Adopting VICIdial means either inheriting an
unsupported telephony core or running an unsupported-by-VICIdial Asterisk.

**4. Security posture.** CVE-2024-8503 is an unauthenticated time-based SQL
injection with **CVSS 9.8**, chainable with CVE-2024-8504 (authenticated RCE as
root) into a full unauthenticated-to-root compromise, with public exploit code.
Reported alongside this: VICIdial stores credentials in plaintext in its database
by default. **I did not verify whether current releases patch these CVEs — they
almost certainly do, and it would be dishonest to imply otherwise.** The relevant
conclusion is not "VICIdial is vulnerable"; it is that a large, long-lived
PHP/Perl web surface with public exploit tooling and plaintext credentials by
default is a poor foundation for a system holding SalesDoc's lead data, and it
implies a patching discipline SalesDoc must be willing to fund.

**What VICIdial is still good for.** It is the best available **reference
implementation** for pacing algorithms, AMD behaviour, disposition taxonomies and
retry rules — decades of hard-won operational knowledge, readable in source. We
should study it and steal its ideas. That is different from adopting it.

Also worth recording, at lower confidence: the common industry pattern for adding
AI to VICIdial is to **register the AI as a SIP extension / remote agent**, which
requires no core modification. This comes from vendor marketing material rather
than primary documentation, so treat it as *plausible, unverified*. It matters
because it is the fallback if E2 shows our preferred approach is expensive.

### 8.4 Why Asterisk, and why it is genuinely low-risk

The decisive capability is **ARI External Media** (introduced in Asterisk 16.6,
documented officially). It creates a channel that forwards bridge audio over
RTP/UDP to an arbitrary external host and accepts audio back — which is exactly
the primitive an external AI voice agent needs, without embedding anything into
the PBX. Documented limitations, from the official docs: RTP encapsulation and
UDP transport only, client connection type only, and synchronous DNS resolution
that can delay the POST. None is a blocker; all are worth knowing before E2.

Asterisk also offers a **commercial licence via Sangoma** as an alternative to
GPLv2, which removes the copyleft question that makes VICIdial's AGPLv2 awkward.

FreeSWITCH is a credible alternative (MPL 1.1, very active) and its media
handling is arguably stronger. Asterisk is preferred on ARI External Media being
the best-documented external-AI attachment point, and on hiring pool depth. **If
E2 goes badly on Asterisk, FreeSWITCH is the first fallback, not a redesign.**

### 8.5 The recommendation, stated conditionally

> **Adopt Asterisk (configured, not modified) as the telephony foundation.
> Integrate an external AI voice agent over ARI External Media. Build a focused
> orchestration service — queue, pacing, presence, reservation ladder, briefing,
> acceptance, disposition, write-back — plus a thin operator web client.
> Integrate SalesDoc lead management as the system of record. Do not adopt
> VICIdial, ICTDialer or OSDial as the V2 platform.**
>
> **Conditional on:** E1 (controlled PBX gatekeeper-to-PIC transfer) and E2
> (AI-leg attachment and end-to-end handoff latency) completing successfully
> within three weeks. If E2 fails on Asterisk, evaluate FreeSWITCH before
> reconsidering the build/adopt split. If both fail, the AI-to-human premise
> itself needs re-examination — which is a far more valuable thing to learn in
> week three than in month nine.

---

## 9. Success metrics

A small set, chosen so each one can change a decision. The exercise lists 21
candidates; measuring all of them at pilot scale would produce noise.

### 9.1 The five that matter

| # | Metric | Why it is on the list | Baseline today |
| --- | --- | --- | --- |
| **M1** | **Useful conversations per human calling hour** | The whole business case in one number | **Missing** |
| **M2** | **`p` — verified-PIC rate per AI call** | Drives capacity, ratio, and cost; everything follows from it | **Missing — no equivalent exists** |
| **M3** | **PIC abandonment while waiting** (% of verified PICs not connected) | The expensive failure; the hard ceiling on pacing | **Missing** |
| **M4** | **PIC-verification-to-human-audio latency** (p50/p95) | Directly tests requirement 8 | **Missing** |
| **M5** | **% of attempts written to the correct lead with an approved next action** | Requirement 11; if this leaks, reporting is fiction | Partial — current process is manual |

Guardrails, tracked but not optimised: transfer failure rate, operator
utilisation, **AI-phase PII violations (target: zero — any occurrence is an
incident)**, DNC compliance, % of calls with an approved current signal.

### 9.2 Baselines are missing, and that is the first problem to solve

**Almost every metric above has no baseline**, because the current process does
not instrument itself. `p` in particular has no analogue — nobody today measures
"proportion of dials reaching a verified decision-maker", because a human doing
the dialing conflates all of it.

**Recommendation: run a two-week manual baseline in parallel with E1/E2**, in
which existing callers log dials, contacts, gatekeeper passes, PIC reaches, and
conversation counts against the same definitions V2 will use. It is unglamorous
and it is the only way the pilot can prove anything. Without it, V2 can report
improvement but cannot demonstrate it.

### 9.3 How the pilot tests the four hypotheses

The exercise asks specifically that we not assume either tailoring level helps
merely because it is plausible.

1. **Do signal-selected companies outperform baseline?** Hold out a control arm
   of companies selected the current way. Compare contact and conversation rates.
   *Risk: contamination if the same callers work both arms — randomise by company,
   not by caller.*
2. **Do segment-tailored openings improve gatekeeper passage?** A/B two approved
   variants against a generic opening, randomised per call, measuring
   gatekeeper-pass rate. This is the cheapest experiment in the set and directly
   tests requirement 6's premise. **If tailoring shows no effect, that is a
   valuable negative result** — it simplifies the product.
3. **Do briefing cards improve call quality?** Hard to measure objectively at
   pilot scale. Proxy: operator-rated preparedness (1–5, logged at wrap) plus
   conversion, comparing full briefing against company-name-only. Acknowledge
   this is the weakest of the four measurements.
4. **More useful conversations per human hour?** M1 against the manual baseline.

---

## 10. Risks and validation plan

### 10.1 Principal risks

| # | Risk | Impact | Likelihood | Mitigation / test |
| --- | --- | --- | --- | --- |
| R1 | `p` too low to be economic | **Fatal to the business case** | Medium | E4 measures it before build completes |
| R2 | Live transfer unreliable at rate | High — abandonment, brand damage | Medium | E1 |
| R3 | AI-leg latency makes handoff feel broken | High | Medium | E2 |
| R4 | Lead-management API cannot support read/write at rate, or lacks the statuses | High — could reshape the timeline | **Unknown (A6)** | Q3/Q4 + a spike, week 1 |
| R5 | Operators reject the tool and stop setting available | **Fatal to adoption, and easy to miss** | Medium | Involve callers in briefing design from week 1; measure availability-setting behaviour as a first-class metric |
| R6 | PII leaks into a persisted artefact | Severe — regulatory and trust | Low with §4.5 controls | Scenario 3 test as a release blocker |
| R7 | Regulatory position on AI outbound disallows the flow | **Potentially fatal** | Unknown | Q7 to legal, week 1 — before engineering |
| R8 | Provisional reservation wastes operator time | Medium — erodes the gain | Medium | E3 |
| R9 | Gatekeepers become resistant to AI callers over time | Medium, grows | Unknown | Track gatekeeper-pass rate as a trend, not a constant |
| R10 | Telephony operations burden exceeds team capacity | Medium | Medium | Q9; consider managed SIP before self-hosted |

**R5 and R7 deserve more attention than they usually get.** R7 can invalidate the
product and costs one conversation to check — it should happen in week one. R5 is
the risk that quietly kills tools like this: the system depends entirely on humans
voluntarily marking themselves available, and if the experience is bad they
simply will not.

### 10.2 The validation plan — smallest experiments that produce decision-quality evidence

**Sequenced so the cheapest disqualifying answer comes first.**

| ID | Experiment | Question | Effort | Disqualifying result |
| --- | --- | --- | --- | --- |
| **E0** | Legal review + lead-management API spike | Are we allowed to do this, and can the system of record support it? | 3 days | Either "no" stops the programme |
| **E1** | Controlled PBX transfer test — scripted gatekeeper → hold → PIC → attended transfer, 100 calls | Does transfer survive real PBXs? At what failure rate? | 1 week | >5% failure with no mitigation |
| **E2** | AI leg over ARI External Media, no orchestration — measure audio round-trip and PIC-verify-to-human-audio | Is the attachment mechanism viable and fast enough? | 1 week | p95 latency > 5s that cannot be reduced |
| **E3** | Two AI calls competing for one human; operator-unavailable path | Does the reservation ladder behave correctly under contention? What is provisional-to-actual conversion? | 3 days | Conversion so low that reservation is uneconomic |
| **E4** | 200-call shadow run measuring `p`, `T_ai`, gatekeeper-pass — no humans attached | What is `p`? | 2 weeks | `p` below the economic threshold set with finance |
| **E5** | Briefing latency and stale-claim check | Does the briefing render inside the hold window? Do claims trace to sources? | 2 days | Briefing consistently misses the window |
| **E6** | Benchmark one managed platform (CallHippo/Aircall) as a pattern reference | Are we rebuilding something purchasable? | 2 days | A managed product already does the reservation ladder |

**E0, E1 and E2 are the three-week gate the recommendation is conditional on.**
E4 is the most important experiment in the whole plan and can run in parallel with
build, because it needs no human leg.

---

## 11. What I could not verify

Stated plainly, because the exercise asks for evidence gaps rather than
confident-sounding gaps:

- **SalesDoc's lead management system.** No access. Every integration claim is an
  assumption (A6). This is the largest unknown in the document.
- **Whether current VICIdial releases patch CVE-2024-8503/8504.** Almost certainly
  yes; not checked.
- **Whether VICIdial supports Asterisk beyond 18 in current trunk.** The
  ViciBox-12-ships-Asterisk-18 finding came from forum and third-party sources,
  not primary release documentation. Medium confidence.
- **Any AI voice vendor's real latency, accuracy, or pricing.** Not assessed at
  all. E2 exists to produce this.
- **Cost.** No cost model. The exercise explicitly does not expect precise costs
  without usage or vendor evidence, and inventing them would be worse than
  omitting them.
- **Performance and scale claims for any candidate.** Not assessed.
- **The 21-criteria × 6-candidate grid.** Deliberately not populated; see §8.1.
- **Regulatory position in target markets.** Out of my competence; E0.

---

## Appendix A — evidence log

Every external factual claim, what was checked, and where. Checked 2026-08-30.

| # | Claim | Source | Confidence |
| --- | --- | --- | --- |
| 1 | Asterisk 23.5.0, 22.11.0, 20.21.0 released 2026-08-27; repo actively pushed | GitHub API `asterisk/asterisk` releases + repo metadata | **High** — primary |
| 2 | Asterisk is GPLv2 with commercial dual-licensing; Sangoma is exclusive licensor | asterisk.org licensing pages via search summary (direct fetch returned 403) | Medium-high |
| 3 | ARI External Media introduced in 16.6; forwards bridge audio via RTP/UDP to an external host; RTP+UDP+client-mode only; synchronous DNS caveat | [Asterisk official docs — External Media and ARI](https://docs.asterisk.org/Development/Reference-Information/Asterisk-Framework-and-API-Examples/External-Media-and-ARI/) | **High** — primary docs |
| 4 | Asterisk 18 is End of Life, no updates including security; 20 security-fix-only Oct 2026; 22 Oct 2028 | asterisk.org announcement + community post via search | **High** — two sources agree |
| 5 | VICIdial is AGPLv2 (GPLv2 up to 2.0.4.1) | vicidial.com legal/licence pages via search; restated on vicidial.org downloads page | **High** |
| 6 | VICIdial actively developed; SVN trunk ~r3939, v2.14b0.5; ViciBox 12.0.2 current | vicidial.org / vicibox community sources via search | Medium |
| 7 | ViciBox 12.0.2 ships **Asterisk 18** | vicidial.org forum thread + third-party install guide | Medium — two sources, neither primary release notes |
| 8 | vicidial.org states requirement "Asterisk versions 1.2 through 18" | Direct fetch of vicidial.org/vicidial.php | **High** — primary, though page may be stale |
| 9 | CVE-2024-8503: unauthenticated time-based SQLi, CVSS 9.8; CVE-2024-8504: authenticated RCE as root; chainable; public PoC; plaintext credentials by default | KoreLogic advisories via search; public exploit repo `Chocapikk/CVE-2024-8504` | Medium-high — NVD direct fetch failed; **patch status not verified** |
| 10 | Common VICIdial AI pattern is registering the AI as a SIP extension / remote agent | Vendor blogs (Klariqo, Trillet, SigmaMind, Dialtera) | **Low — vendor marketing, not primary** |
| 11 | ICTDialer: GPL-3.0; latest release v2.0.0 (2025-03-01); repo pushed 2026-08-12; 123 stars; FreeSWITCH + ICTCore; positioned as voice/fax broadcasting + auto-dialer | GitHub API `ictinnovations/ictdialer` repo, commits, releases | **High** — primary |
| 12 | OSDial: last GitHub commit 2014-11-06; SourceForge latest release 3.0.2 (March 2014); mirror repo, 2 stars; forked from VICIdial 1.2 in 2009 | GitHub API `southskies/osdial` + SourceForge files page | **High** — two independent sources |
| 13 | FreeSWITCH active (pushed 2026-08-28), 5,125 stars; MPL 1.1 | GitHub API `signalwire/freeswitch`; licence from project knowledge, **not verified this session** | High on activity, medium on licence |

**Not assessed, and marked as such throughout:** cost, performance, scale,
security audits beyond the CVEs above, the full 21-criteria grid, any AI voice
vendor, and SalesDoc's own lead management system.
