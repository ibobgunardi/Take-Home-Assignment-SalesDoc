# V2 AI-to-Human Dialer — 15-Minute Decision Presentation

**Audience:** SalesDoc management, deciding whether to fund V2 and on what basis.
**Format:** 13 slides, ~15 minutes, then questions.
**Designed to stand alone** — nobody needs to have read
[the full proposal](01-product-refinement.md) first.

**The narrative in one line:** *here is the recommendation → here is why the
obvious cheaper option does not work → here is the one mechanism that makes V2
different → here is the three-week test that could prove us wrong before we spend
real money.*

---

## Slide 1 · The decision in front of you — 0:30

> ### We are asking for three weeks and a small team.
> Not for a commitment to build V2.
>
> At the end of three weeks you will have evidence to approve or cancel — and
> cancelling then costs three weeks instead of nine months.

**Speaker notes.** Open by lowering the stakes of *today's* decision. Management
approves a cheap, time-boxed evidence phase, not a programme. That framing makes
every subsequent slide easier to hear, and it is also honest — we genuinely
should not commit to build yet.

---

## Slide 2 · The recommendation, up front — 1:30

> ### Build the orchestration. Buy everything else.
>
> | Layer | Decision |
> | --- | --- |
> | Phone calls, audio, transfer | **Adopt Asterisk** — mature, free, actively released |
> | AI voice agent | **Integrate a vendor** — not our differentiator |
> | **Reserving, briefing and connecting the human** | **Build** — nothing on the market does this |
> | Lead data and statuses | **Integrate** the existing lead management system |
>
> **Do not adopt VICIdial, ICTDialer or OSDial as the platform.**
>
> *Conditional on two experiments. Three weeks.*

**Speaker notes.** Put the answer on screen at 90 seconds and leave it there. The
rest of the presentation is justification, and an audience that already knows the
conclusion listens to justification far better than an audience waiting for it.

Name the conditionality now, so it does not later look like backtracking.

---

## Slide 3 · The problem, in one number — 1:00

> ### A caller's hour is mostly not selling.
>
> Dialing · ringing · voicemail · receptionists · hold music
> **→ then, occasionally, a real conversation.**
>
> V2 moves the first part to a machine so the hour is spent on the last part.
>
> **The metric that matters: useful conversations per human calling hour.**
> Not calls dialed. Not automation coverage.

**Speaker notes.** Resist any technology talk here. If someone remembers one
sentence from this deck, it should be the metric. It is also the metric that will
later justify — or kill — the programme, so establish it before anyone becomes
attached to a different one.

---

## Slide 4 · Why we can't just buy a dialer — 2:00

> ### Every product we evaluated solves a different problem.
>
> **What dialers do:** *"an available agent takes the next call."*
> Agent is free → connect a call. Decades of refinement. Excellent.
>
> **What V2 needs:** *"a **specific**, **prepared** human is reserved, briefed,
> and connected to a call that is **already in progress**."*
>
> The AI holds the line for a minute or two. At an unpredictable moment a
> decision-maker appears. Somebody must already know who they are and why we
> called — **within seconds**, or we lose them.
>
> **No open-source dialer has this. Not by oversight — it is meaningless in a
> world where a human does the dialing.**

**Speaker notes.** This is the slide the whole recommendation rests on. If the
room accepts this framing, everything else follows; if they do not, they will
keep asking "but why not just use VICIdial" for the rest of the meeting.

Anticipate that question here rather than deflecting it — the next slide answers
it with evidence.

---

## Slide 5 · What we actually checked — 2:00

> ### Four findings, all verified against the projects themselves.
>
> | | |
> | --- | --- |
> | **OSDial** | **Dead.** Last code change **2014**. Last release **March 2014**. Twelve years |
> | **ICTDialer** | Maintained, but it is a **broadcasting** tool — the opposite of live transfer to a prepared human |
> | **VICIdial** | Actively developed and widely used — **but** its recommended install ships **Asterisk 18, which is End of Life and gets no security patches**. Licence is AGPL, which forces source disclosure on a system we would heavily modify. Public unauthenticated-to-root exploit chain in 2024 **(CVSS 9.8)**, plaintext passwords in the database by default |
> | **Asterisk** | **Healthy.** Three release lines updated **this month**. Has exactly the hook the AI needs |
>
> *Full sources and confidence levels in the appendix of the written proposal.*

**Speaker notes.** Be scrupulous on VICIdial. Say out loud: *"those CVEs are from
2024 and are almost certainly patched — I did not verify that, and I am not
claiming VICIdial is vulnerable today."* The argument is about **posture and
maintenance burden**, not a live vulnerability. Overstating it would be the
fastest way to lose credibility with anyone technical in the room.

Also credit VICIdial properly: it is genuinely good software and we intend to
learn from its pacing and disposition design. Rejecting it as a *foundation* is
not the same as dismissing it.

---

## Slide 6 · The one mechanism that makes V2 work — 2:00

> ### Reserve the human while the company is still transferring the call.
>
> ```text
> AI dials ─→ receptionist answers ─→ "putting you through…"
>                                            │
>                     ┌──────────────────────┘
>                     ▼
>        RESERVE A HUMAN NOW.  Show them the briefing.
>        They get 15–45 seconds to read — during the hold
>        the company itself is imposing.
>                     │
>                     ▼
>        Decision-maker picks up ─→ human is already ready ─→ connect
> ```
>
> **Target: decision-maker on the line to human speaking — under 5 seconds.**
>
> Reserve at the *hold*, not at the pickup. That is the whole trick.

**Speaker notes.** This is the slide to slow down on. The insight is that the
*company's own internal transfer* gives us a free preparation window, and using
it converts an impossible requirement ("brief a human instantly") into an easy
one.

It is also the highest-risk item to build, and the honest thing is to say so:
if the call dies during the hold — which will happen often — we have occupied a
human for nothing. Experiment E3 measures exactly how often.

---

## Slide 7 · The uncomfortable arithmetic — 1:30

> ### A better AI needs *more* humans, not fewer.
>
> Concurrent AI calls one human can support:
>
> | If the AI reaches a decision-maker on… | …one human supports |
> | --- | --- |
> | 20% of calls | ~1 call |
> | 10% of calls | ~2 calls |
> | 5% of calls | ~4 calls |
>
> **Human talk time is the bottleneck — not AI capacity.**
>
> We propose starting at **3 concurrent calls per available human** and tuning
> from measurement. **We will not run at full utilisation:** a decision-maker who
> reaches us and gets nobody is the most expensive failure in the system.

**Speaker notes.** This surprises people and it is better surprising them now
than in month six. The natural assumption is that AI means fewer humans; here,
AI improvement converts directly into needing more human capacity to absorb the
conversations it creates.

Land the second point firmly: abandonment is a hard ceiling, not a dial. We will
sacrifice utilisation to protect it.

---

## Slide 8 · The number nobody has — 1:00

> ### What proportion of AI calls will reach a verified decision-maker?
>
> Call it **`p`**. Every capacity number, staffing plan and cost-per-conversation
> figure depends on it.
>
> **We do not know it. Nobody does — the current process cannot measure it,
> because a human doing the dialing conflates every step.**
>
> **The pilot's first job is to measure `p`.**
> Its second is a two-week manual baseline of what we do today — otherwise we can
> report V2's numbers but cannot prove they are better.

**Speaker notes.** Do not skip the baseline point, however unglamorous. It has no
engineering content, so it is the thing that gets dropped, and dropping it means
the pilot can never demonstrate improvement — only describe itself.

---

## Slide 9 · What could go wrong — 1:30

> | Risk | If it is true |
> | --- | --- |
> | **Regulation forbids AI outbound calls in our market** | Programme stops. **One conversation with legal, week 1** |
> | **`p` is too low** | Business case collapses. Measured by week 5 |
> | **Transfers fail across other companies' phone systems** | Core flow unreliable. Tested week 2 |
> | **Callers dislike the tool and stop marking themselves available** | System quietly dies. **Involve them from week 1** |
> | **PII leaks into a saved record** | Regulatory and trust damage. Blocked by design + a release-blocking test |
>
> **The cheapest disqualifying answer comes first.**

**Speaker notes.** The legal risk is deliberately at the top: it can invalidate
everything and costs one meeting to check. It is embarrassing to discover in
month four.

The caller-adoption risk is the one that gets underweighted in rooms like this.
The entire system depends on humans *voluntarily* marking themselves available.
If the experience is poor, they stop, and no amount of engineering fixes it.

---

## Slide 10 · How the AI is prevented from collecting personal data — 1:00

> ### Not a rule the AI is asked to follow. Something it cannot do.
>
> - The AI has a **closed set of things it can say** — confirm the company, ask
>   for a role, request a transfer, close politely.
> - **There is no field in the system for a name, phone number, email or
>   WhatsApp.** Nothing to fill in means nothing to store.
> - Transcripts are not kept by default; anything saved is redacted first.
> - If someone volunteers a name, the AI does not repeat it and has nowhere to
>   put it.
>
> **We test this adversarially:** on a test call we deliberately volunteer a name
> and a mobile number, then search every saved record for them.
> **Zero matches, or the release is blocked.**

**Speaker notes.** Compliance stakeholders have heard "the AI is instructed not
to" before, and they are right to distrust it. The distinction between a *policy*
control and an *architectural* one is the entire point of this slide, and it is
the answer that will satisfy them.

---

## Slide 11 · The three-week gate — 1:30

> | | Test | Kills the plan if… |
> | --- | --- | --- |
> | **Week 1** | Legal review | AI outbound is not permitted |
> | **Week 1** | Can the lead system give us data and take results back? | It cannot |
> | **Week 2** | 100 controlled transfer tests through a real phone system | Failures above ~5% |
> | **Week 3** | AI attached to the phone system, end-to-end timing | Handoff cannot get under 5 seconds |
> | **2 days** | Check whether any product on the market already does the reservation trick | **If one does, we should buy it instead — and we want to know** |
>
> **Then** we ask you to fund the build.

**Speaker notes.** The last row matters more than it looks. It is us actively
trying to falsify our own recommendation, for two days of effort. Saying that out
loud buys a lot of credibility — and if the answer comes back "yes, product X
does this", we have saved the company a great deal of money.

---

## Slide 12 · What we are asking for today — 1:00

> ### Approve the evidence phase.
>
> - **Three weeks**, small team
> - **One conversation with legal, this week** — it is the cheapest thing that can stop us
> - **Access to the lead management system** for a technical spike
> - **Two callers' time**, part-time, to shape the briefing card
> - **Start the manual baseline now**, in parallel
>
> **We come back in three weeks with:** transfer reliability, handoff latency,
> a first read on `p`, and either a confirmed recommendation or a documented
> reason to stop.

**Speaker notes.** Make the asks concrete and small. The two that people
under-deliver are legal access and caller time — name them explicitly and get a
commitment in the room.

---

## Slide 13 · What we deliberately are not building — 0:30

> - The AI never conducts the sales conversation
> - No per-company AI scripts — segment-level only
> - Not a general-purpose contact-centre platform
> - Not replacing the lead management system
> - No cost model yet — we have no vendor quotes, and invented numbers are worse
>   than none

**Speaker notes.** Closing on restraint reads as judgement. The last bullet
pre-empts the "where's the budget number?" question and frames its absence as
discipline rather than an omission — which it is.

---

## Anticipated questions

Prepared answers for the hard ones. Honesty is the strategy: several of these
have no confident answer, and pretending otherwise is how credibility is lost.

**"Why not just buy Aircall or CallHippo?"**
They are strong products for human-dialed calling and we use them as a design
benchmark. Neither is built around an AI holding the first ninety seconds and
handing to a reserved, briefed human. **We are checking this properly in a
two-day experiment** — if one of them does do it, buying beats building and we
will say so.

**"VICIdial is free and thousands of call centres run it. Why rebuild?"**
We are not rebuilding it — we are not building a dialer at all. Asterisk, which
VICIdial itself is built on, gives us the calling. What we build is the
reservation and briefing layer, which VICIdial does not have. And adopting
VICIdial would mean inheriting an AGPL obligation, a telephony core that is
already End of Life, and a large web attack surface — to get features that are
among the simplest parts of our build.

**"How much will it cost?"**
We do not have a defensible number and I would rather tell you that than invent
one. We have no vendor quotes and no usage model. Both come out of the evidence
phase, and cost is the first thing we bring back after it.

**"What if `p` is terrible?"**
Then V2 does not work in this form, and we will know by about week five for the
cost of a shadow-calling exercise rather than a full build. That is the single
best reason to fund the evidence phase rather than the programme.

**"Can we skip the three weeks and start building?"**
You can. The risk is concentrated in two questions — legal permission and
transfer reliability — and both are cheap to answer and expensive to get wrong.
Building first means finding out in month four.

**"Who owns this if the phones break at 9am?"**
An open question and a real one. Running telephony is an operational commitment
we should not assume we have. If we do not have on-call capability, we should
look at managed SIP before self-hosting — it changes the plan, and it is better
raised now.

**"Is the AI going to sound like a robot and embarrass us?"**
Unknown, and it is not a question a document can answer. It is one of the things
the shadow-calling exercise is for — we listen to recordings before we ever
attach a human. Gatekeeper acceptance may also decay over time as AI callers
become common, so we track it as a trend rather than a fixed number.

**"What happens the first time a decision-maker gets nobody?"**
It is designed for, not left to chance: the AI closes with wording compliance has
approved, we record it, and the lead goes into a **human** callback queue — never
back to the AI. We treat it as a defect and count it on the supervisor screen,
because a rising rate means we are dialing too aggressively.
