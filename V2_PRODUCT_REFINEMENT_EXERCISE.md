# Product Refinement Exercise: V2 AI-to-Human Outbound Dialer

## Background

SalesDoc currently has a proof-of-concept multiline outbound dialer using AI
voice agents. The POC demonstrates the business concept: an AI voice agent
calls a target company, attempts to navigate a gatekeeper such as a front
office or customer-service representative, reaches the relevant PIC, and then
hands the valuable conversation to a human caller.

Treat the POC as evidence that the core multiline AI-calling concept is
technically possible. It is not a production system, and its implementation is
outside the scope of this exercise.

V2 is a **greenfield product exercise**. Begin from the required business flow
below. No existing POC code, provider, workflow, infrastructure, or architecture
is an input to the V2 decision.

For V2, SalesDoc is considering a BPO-style operating model in which AI voice
agents handle the repetitive first portion of outbound calls and a pool of
human callers handles the valuable conversation after the relevant
person-in-charge (PIC) has been reached.

A technical adviser suggested studying established contact-centre and dialer
products and approaches, including:

- VICIdial;
- CallHippo;
- DialerHQ;
- ICTDialer;
- OSDial; and
- Asterisk-based contact-centre systems.

SalesDoc needs to determine whether V2 should:

- adopt and configure an existing open-source product;
- extend an open-source product with SalesDoc-specific modules;
- integrate several open-source or managed components;
- build a focused new system; or
- use a hybrid approach.

No product or technical foundation has been selected. Start with the product
requirements and evaluate candidate solutions against them rather than
starting with a preferred vendor or architecture.

The product-refinement problem is how to turn the demonstrated concept into a
production-ready BPO-style operation. Focus on calling and worker queues,
operator capacity, live assignment and handoff, company briefing, retries,
dispositions, supervision, lead-management continuity, reliability, security,
compliance, and operational control.

## Required V2 business flow

V2 is not intended to be a cold mass-calling system. Calls should be made only
to companies selected using meaningful likely-to-buy or ready-to-buy signals.
The automated opening should use reusable segment-level context such as
industry, company type, size band, campaign, and target role. Deeper
company-specific context should be reserved for the human caller's briefing and
substantive conversation. Lead and company context comes from SalesDoc's lead
management system, which remains the authoritative source for lead data,
attempt outcomes, and next-action status.

The required business flow is:

```text
Read eligible leads and company context from the lead management system
  -> screen companies using likely-to-buy signals
  -> prepare reusable segment context and a company-specific human briefing
  -> add eligible company to the calling queue
  -> AI voice agent places a segment-tailored call
  -> call is answered
  -> verify the intended company
  -> navigate the gatekeeper, if one is present
  -> wait through the company's internal hold or transfer
  -> reach and verify the relevant PIC
  -> present a concise company and signal briefing to a ready human
  -> human accepts and takes over the live call
  -> human conducts the substantive conversation and records the outcome
  -> persist attempt outcome and next-action status in the lead management system
```

### Fixed business requirements

The following are baseline requirements for the exercise:

1. **There is a calling queue.** It contains eligible companies or leads
   awaiting an outbound attempt.
2. **AI voice agents process the calling queue.** Human callers should not
   spend their time dialing, waiting for answers, or routinely navigating
   gatekeepers.
3. **The AI handles the initial call segment.** Its job is to detect that a
   call has been answered, verify the intended company, navigate a gatekeeper,
   request the target role or PIC, remain connected through an internal hold
   or transfer, and verify that the PIC has been reached.
4. **The AI does not conduct the substantive sales conversation.** Once the
   PIC is verified, the live call should be transferred to a human caller.
5. **V2 must not operate as a cold mass dialer.** Companies must be screened
   using approved likely-to-buy signals before entering the calling queue.
6. **The automated stage uses bounded segment-level tailoring.** The AI may use
   approved reusable fields such as industry, company type, size band,
   campaign, and target role. V2 should not require a uniquely researched or
   generated AI opening for every company.
7. **The human conversation uses company-specific context.** The human must
   receive a concise briefing before taking over. At a
   minimum, it should show:
   - the company on the line;
   - why the company was selected;
   - the relevant likely-to-buy signal;
   - the target PIC or role;
   - what occurred during the AI conversation; and
   - a recommended opening or discussion angle.
8. **The handoff must minimize waiting for the PIC.** The system must not
   reach a PIC and leave that person waiting while an unprepared human reads a
   long company profile.
9. **There is a human-worker pool and assignment queue.** Human callers expose
   availability, receive work only when eligible and prepared, accept one live
   handoff at a time, and complete wrap-up before returning to the pool.
10. **V2 must be production-operable.** It requires durable state, controlled
    retries, dispositions, authorization, audit, supervision, capacity limits,
    failure recovery, security, compliance controls, and measurable service
    outcomes—not only a successful call demonstration.
11. **The lead management system remains the system of record.** It supplies
    lead identity, company context, segment fields, likely-to-buy signals,
    contact eligibility, and current status. V2 must write structured attempt
    outcomes and approved next-action statuses back to the same lead.
12. **The AI phase must not collect PII.** The AI may ask whether the person
    responsible for the target function is available, whether they can accept
    the call, and request an internal transfer. It must not ask for the PIC's
    name, direct or mobile number, email address, WhatsApp details, or other new
    identifying contact information. Any information required during the human
    conversation is handled under the approved human process after takeover.
    If someone volunteers identifying information during the AI phase, the AI
    must not solicit more or repeat it, and it must not be added to the lead,
    briefing, structured call outcome, or retained transcript. If transient
    speech processing captures it, it must be redacted before persistence.

An illustrative briefing could look like this:

```text
Company: Acme Insurance
PIC: Head of General Insurance
Reason selected: Recently announced expansion into two new markets
Relevant offering: Ready-to-buy market and account signals
AI outcome: Company confirmed; gatekeeper transferred the call; current
            speaker confirmed responsibility for General Insurance
Suggested opening: Reference the expansion and explain how SalesDoc can
                   identify accounts showing active insurance-purchase intent
```

This is a short operational aid, not a complete research report.

## Assignment

Refine this concept into a product proposal that management can use to decide:

1. what V2 should deliver;
2. how its operating workflow should work;
3. whether it is feasible;
4. whether an existing open-source solution can satisfy the requirements;
5. which capabilities should be adopted, configured, extended, integrated, or
   built;
6. what the smallest valuable V2 release should contain; and
7. what evidence is required before implementation is approved.

This is a **product-refinement and decision-framing exercise**. You are not
expected to implement the product or produce a low-level production
architecture.

## Questions to address

### 1. Problem definition

Explain:

- the business problem V2 solves;
- who experiences that problem;
- which product and operational capabilities are required to move from a POC
  to a production-ready BPO-style service;
- what improvement V2 is expected to create; and
- which V2 production and operating assumptions have not yet been validated.

Separate user and business problems from proposed features or technologies.
Do not include an assessment of the existing POC implementation.

### 2. Users and operating model

Identify the relevant users and stakeholders, which may include:

- human caller;
- team leader or supervisor;
- campaign manager;
- Sales or RevOps administrator;
- compliance or operations owner; and
- system administrator.

For each primary user, describe their goal, required information, actions,
decisions, and important failure or frustration cases.

### 3. Company selection and two-level tailoring

Refine the process that occurs before a company enters the calling queue:

- Which lead-management fields are authoritative for eligibility, segment,
  company context, likely-to-buy signal, and current status?
- What qualifies as a likely-to-buy signal?
- Which signals are reliable enough to permit a call?
- Who approves the company and campaign?
- How fresh must a signal be?
- How should weak, stale, or contradictory signals be treated?
- Is selection automated, human-approved, or hybrid?
- Which reusable segment fields may the AI use?
- Which segment-specific opening variants are required, and who approves them?
- Which company-specific facts and signals should be reserved for the human
  briefing and conversation?
- How are unsupported or stale company claims prevented?
- How is the suggested human discussion angle generated and reviewed?
- Which attempt outcomes and next-action statuses must be written back, and
  which status changes require human confirmation?

Distinguish sourced facts from generated recommendations.

### 4. End-to-end workflow

Map the complete lifecycle from company selection to final outcome. At a
minimum, consider:

- signal screening and call eligibility;
- AI call initiation;
- no answer, busy, and voicemail;
- company verification;
- gatekeeper interaction;
- internal hold or transfer;
- PIC verification;
- human preparation and availability;
- live handoff;
- rejected, failed, or abandoned handoff;
- human conversation;
- call disposition;
- retry and callback scheduling;
- wrong company or wrong number;
- refusal and do-not-call;
- dropped calls; and
- exhausted or stale leads.

For every terminal or deferred path, show the attempt outcome and resulting
lead-management status or next action. For example, if the PIC is reached but
no human is available, the AI should close the call using approved wording and
the lead should enter a clearly defined human-callback state rather than being
lost or returned to the ordinary AI retry queue.

Clarify the differences between:

- a lead status;
- a scheduled retry;
- a work queue;
- a human assignment; and
- routing an active live call.

### 5. Human preparation and handoff

Define the expected handoff from both sides.

For the PIC:

- What does the AI say before handoff?
- How long may the PIC wait?
- What happens when no human is available?
- What happens if transfer fails?

For the human caller:

- When is the briefing first displayed?
- What is the minimum information required to take over confidently?
- How is availability represented?
- Should a human be provisionally reserved before the PIC is reached?
- Does the human explicitly accept the call?
- What happens if the human does not respond?
- How are competing live calls prioritized?
- How does the human avoid asking the PIC to repeat information already given
  to the AI?

Recommend an initial ratio of simultaneous AI calls to each available human.
Explain how this ratio should be validated rather than assumed.

### 6. Product and capability decomposition

Break V2 into product capabilities, including:

- likely-to-buy signal ingestion;
- signal quality and freshness rules;
- lead and company eligibility;
- pre-call company research;
- segment-level AI script configuration;
- company-specific human briefing generation;
- claim provenance or source visibility;
- campaign and lead selection;
- outbound dialing;
- AI conversation and gatekeeper navigation;
- voicemail detection;
- queue and retry orchestration;
- operator presence;
- pre-alert and provisional operator reservation;
- human briefing card and suggested conversation angle;
- human acceptance;
- capacity-aware dialing;
- live-call transfer;
- screen-pop and transcript or summary;
- call controls and dispositions;
- lead-management read and write integration;
- attempt-outcome and next-action status mapping;
- supervisor controls;
- reporting, audit, and compliance; and
- failure recovery.

For each capability, indicate whether a candidate open-source product provides
it as-is, provides it through configuration, requires extension or integration,
or does not provide it. Note the edition, version, evidence source, and
confidence rather than relying on a product feature claim alone.

### 7. Adopt-versus-rebuild assessment

Study relevant open-source products and approaches. Do not assume that the
named products are automatically suitable, actively maintained, secure, or
available under terms appropriate for SalesDoc.

Compare at least:

- Asterisk as a telephony foundation;
- VICIdial as an open-source contact-centre/dialer product;
- at least two of ICTDialer, OSDial, or another relevant open-source
  contact-centre product;
- a focused greenfield build using open-source components; and
- one hybrid option.

A managed product such as Aircall or CallHippo may be used as a product-pattern
benchmark, but it is not a mandatory V2 candidate. The existing POC is not an
implementation option and must not be scored as one.

Evaluate them against consistent criteria:

- fit with the signal-selected AI-gatekeeper workflow;
- support for outbound and parallel dialing;
- support for an external or embedded AI voice-agent leg;
- API and webhook capabilities;
- AI integration;
- live-call transfer;
- operator presence, reservation, and routing;
- briefing or screen-pop integration;
- lead-management integration;
- customization limits;
- reliability and operational ownership;
- security and compliance;
- open-source license and obligations;
- project activity, release recency, and community health;
- supported operating systems and dependency age;
- upgrade, patching, high-availability, and telephony-operations burden;
- implementation effort;
- ongoing maintenance;
- vendor lock-in;
- licensing and indicative cost; and
- time to reach a controlled pilot.

Distinguish documented facts from assumptions and cite sources for material
vendor claims.

Conclude with a recommendation to adopt an open-source product as-is,
configure it, extend it, assemble a hybrid, build a focused new system, or
defer pending specific evidence. The recommendation may be conditional.

### 8. V2 scope and prioritization

Propose:

- a minimum viable V2;
- capabilities deliberately excluded from V2;
- later enhancements;
- dependencies;
- release blockers;
- a prioritized product backlog; and
- acceptance criteria for pilot-critical capabilities.

Group the backlog into:

- pilot-critical;
- required before production;
- later; and
- out of scope.

Avoid defining V2 as a general-purpose BPO platform unless the evidence
justifies that scope.

### 9. Success measurement

Define a small set of measurable product outcomes. Consider:

- calls attempted per human hour;
- percentage of calls supported by an approved likely-to-buy signal;
- company-contact rate;
- gatekeeper-bypass rate;
- verified-PIC rate;
- signal-to-PIC reach rate;
- successful human-handoff rate;
- time from PIC verification to human connection;
- PIC abandonment while waiting;
- false PIC escalations;
- transfer failure rate;
- human acceptance and utilization;
- percentage of briefing facts with traceable sources;
- briefing preparation latency;
- conversion after handoff;
- retry effectiveness;
- do-not-call compliance;
- AI-phase PII collection violations;
- percentage of attempts and next actions written to the correct lead;
- cost per successful human conversation; and
- qualified-opportunity or revenue yield per human calling hour.

Explain which baseline measurements are missing. Do not assume either level of
tailoring improves outcomes merely because it is plausible. Describe how a
pilot could determine whether:

1. signal-selected companies outperform an appropriate historical baseline;
2. segment-tailored AI openings improve gatekeeper passage without requiring
   company-by-company generation;
3. company-specific briefing cards improve human-call quality; and
4. the system creates more useful conversations per human hour.

### 10. Risks and validation plan

Identify the largest product, workflow, technical, operational, compliance,
and adoption risks. For each consequential uncertainty, propose the smallest
experiment or evidence needed to resolve it.

Potential validation scenarios include:

- a controlled gatekeeper-to-PIC PBX transfer;
- a live AI-to-human handoff;
- an operator-unavailable scenario;
- two AI calls competing for one human;
- briefing, transcript, and screen-pop latency;
- unsupported or stale company briefing data;
- transfer failure recovery; and
- a comparison with one shortlisted managed platform.

## Required acceptance scenarios

The proposal must address this primary scenario:

> An eligible company enters the queue because of an approved, current
> likely-to-buy signal. An AI voice agent places a segment-tailored call,
> navigates the gatekeeper, and verifies the PIC. A ready human has received a
> concise, source-backed briefing. The human accepts the handoff, connects
> within the defined waiting threshold, and continues a personalized
> conversation. The attempt and human outcome are written to the correct lead
> in the lead management system.

It must also address this failure scenario:

> The AI reaches the PIC, but no prepared human is available. The system does
> not leave the PIC waiting indefinitely or perform an uncontrolled transfer.
> It closes the call using approved wording, records the attempt, and assigns
> the lead a clearly defined human-callback status or next action in the lead
> management system.

The proposal must also prove this data-minimization scenario:

> During the automated phase, the AI asks only whether the person responsible
> for the target function is available and can accept the call. It does not ask
> for a name, direct or mobile number, email address, WhatsApp details, or other
> identifying contact information. Volunteered identifying information is not
> repeated or persisted in the lead, briefing, structured call outcome, or
> retained transcript.

## Expected deliverables

### 1. Product refinement document

Prepare approximately 8–15 pages, excluding appendices, containing:

- executive summary;
- problem and users;
- current-state assessment;
- required and proposed workflows;
- capability map;
- V2 scope and prioritized backlog;
- adopt-versus-rebuild comparison;
- recommendation;
- risks;
- success metrics; and
- validation plan.

### 2. Workflow diagram

Show the main path and important exceptions from signal screening through final
call disposition.

### 3. Capability decision matrix

For every major capability, recommend one of:

- adopt open source as-is;
- configure;
- extend;
- integrate;
- build;
- validate first; or
- defer.

Include rationale, evidence, and confidence.

### 4. Prioritized product backlog

Provide epics or major stories grouped by priority, with acceptance criteria
for pilot-critical items.

### 5. Decision presentation

Prepare a 15-minute management presentation followed by questions. Make the
decision and trade-offs understandable without requiring the audience to read
the full document first.

## Working expectations

You are expected to:

- begin from the required business flow and focus on productionization;
- if relevant stakeholders are available, conduct brief interviews to validate
  assumptions; otherwise, document the questions you would ask, the
  stakeholders you would involve, and the assumptions requiring validation;
- identify contradictions and missing decisions;
- challenge assumptions constructively;
- distinguish requirements from suggested solutions;
- use evidence when comparing vendors;
- inspect open-source documentation, repositories, release activity, licenses,
  and deployment requirements;
- state uncertainty honestly; and
- recommend the smallest next step that produces decision-quality evidence.

Stakeholder interviews are optional and will not affect scoring.

You are not expected to:

- write production code;
- review or reverse-engineer the POC implementation;
- produce a complete low-level system design;
- recreate every feature of a contact-centre platform;
- accept a suggested architecture without evaluation; or
- produce precise cost estimates without usage or vendor evidence.

## Submission deadline

Submit the completed exercise by tomorrow.

Given the short turnaround, prioritize clear product judgment over exhaustive
research. State assumptions, evidence gaps, and questions requiring technical
validation rather than presenting unsupported conclusions as facts.