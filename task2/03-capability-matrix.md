# V2 Capability Decision Matrix

Companion to [01-product-refinement.md](01-product-refinement.md). One row per
capability named in the exercise, each with exactly one decision, a rationale,
the evidence behind it, and a confidence.

**Decisions:** `adopt as-is` · `configure` · `extend` · `integrate` · `build` ·
`validate first` · `defer`

**Confidence:** **High** = verified against a primary source this session, or a
judgement about our own product that needs no external evidence · **Medium** =
sourced but secondary, or a reasonable inference · **Low** = assumption; would
change with evidence.

> **Read §3 before §1.** The per-candidate coverage assessment is deliberately
> partial, and §3 says exactly which cells were assessed and which were not.
> A complete grid would be 25 capabilities × 6 candidates × 21 criteria; most of
> it would be invention. The exercise asks for product judgment over exhaustive
> research, and for assumptions to be labelled rather than dressed up.

---

## 1. The 25 capabilities

### Group A — Signal and selection

| # | Capability | Decision | Rationale | Evidence | Conf. |
| --- | --- | --- | --- | --- | --- |
| 1 | Likely-to-buy signal ingestion | **integrate** | Requirement 11 makes lead management the system of record for signals. V2 reads them; it must not become a second source of truth for what a signal is. | Requirement 11; assumption A6 on API capability | Medium |
| 2 | Signal quality and freshness rules | **build** | Thin but genuinely ours: a freshness window per signal type, precedence for contradictory signals, and a "stale" transition. No dialer product has a concept of signal freshness because no dialer product screens on signals. | Product judgement | High |
| 3 | Lead and company eligibility | **build** | Composes signal state, DNC/suppression, calling hours, and retry caps into one eligibility decision. Small, and it is the gate that keeps V2 from being a cold mass dialer — requirement 5. | Requirement 5 | High |
| 4 | Pre-call company research | **defer** | Explicitly *not* needed for the AI phase — requirement 6 bounds the AI to segment fields. The human briefing is assembled from existing lead-management fields. Automated research is a later enhancement and a large scope risk. | Requirement 6 | High |
| 5 | Campaign and lead selection | **build** | Campaign definition, segment membership, list ordering. Simple CRUD; the value is in the eligibility rules it composes, not the CRUD. | Product judgement | High |

### Group B — Two-level tailoring

| # | Capability | Decision | Rationale | Evidence | Conf. |
| --- | --- | --- | --- | --- | --- |
| 6 | Segment-level AI script configuration | **build** | The heart of requirement 6: a bounded, versioned, approvable set of opening variants keyed on industry / company type / size band / campaign / target role. Approval workflow is required because compliance owns what the machine says. Tens of variants, not thousands. | Requirement 6 | High |
| 7 | Company-specific human briefing generation | **build** | Requirement 7 fixes the minimum content. Assembled from lead-management fields plus the AI's *structured* outcome — never from call text, which is what keeps requirement 12 enforceable. | Requirements 7, 12 | High |
| 8 | Claim provenance / source visibility | **build** | Every briefing fact carries its source field and an as-of timestamp, rendered next to the claim. This is what stops an operator confidently repeating an eight-month-old "recent expansion". Cheap to build, and the mitigation for a brand-damaging failure. | Exercise §3 "prevent unsupported or stale claims" | High |
| 9 | Suggested conversation angle | **build**, with review | Generated from the signal type plus segment, drawn from an approved phrasing library rather than free generation. Reviewed by the campaign manager. Free-form generation here would reintroduce the unsupported-claim risk that (8) exists to remove. | Exercise §3 | Medium |

### Group C — Telephony

| # | Capability | Decision | Rationale | Evidence | Conf. |
| --- | --- | --- | --- | --- | --- |
| 10 | Outbound dialing | **adopt as-is** (Asterisk) | Commodity. Asterisk originates calls natively; nothing about V2's dialing is special except its *pacing*, which is capability 17 and separate. | Asterisk actively released 2026-08-27 | High |
| 11 | Parallel / multi-line dialing | **configure** (Asterisk) | Concurrency is a configuration and resource question, not a feature to build. The interesting constraint is capacity-aware pacing, not raw parallelism. | Asterisk core capability | High |
| 12 | Voicemail detection | **validate first** | Asterisk ships AMD, but AMD accuracy is notoriously poor across the industry, and a false "human" wastes a reservation while a false "machine" throws away a real contact. Modern practice is to let the AI leg's own speech understanding make the call. **Measure both in E2 before choosing.** | VICIdial's own AMD accuracy is widely reported as weak (vendor sources, low confidence); AMD's general difficulty is well established | Medium |
| 13 | Live-call transfer | **adopt as-is + validate first** (Asterisk) | Asterisk's bridging and attended-transfer primitives are mature and are not the risk. The risk is behaviour across *other people's* PBXs after an internal transfer. **E1 exists solely for this.** | Asterisk core; risk R2 | High on primitive, **Low on real-world reliability** |
| 14 | Call controls (hold, mute, record) | **adopt as-is** (Asterisk) | Commodity. | Asterisk core | High |

### Group D — AI leg

| # | Capability | Decision | Rationale | Evidence | Conf. |
| --- | --- | --- | --- | --- | --- |
| 15 | AI conversation and gatekeeper navigation | **integrate** + **validate first** | Not a differentiator to build, and building a voice model is far outside V2's scope. Integrate a vendor. **Validate first** because vendor latency, interruption handling, and gatekeeper performance are entirely unproven for this use case — and `p` (§9 M2) depends on it. | Requirement 3; assumption A1 | Medium on approach, **Low on any vendor's real performance** |
| 16 | AI-leg attachment to telephony | **integrate** (ARI External Media) | Asterisk's `externalMedia` channel forwards bridge audio over RTP/UDP to an external host and accepts audio back — exactly the primitive needed, with no PBX modification. Documented limits: RTP/UDP only, client connection type only, synchronous DNS on the POST. | [Asterisk official docs](https://docs.asterisk.org/Development/Reference-Information/Asterisk-Framework-and-API-Examples/External-Media-and-ARI/) — introduced 16.6 | **High** — primary docs |
| 17 | PIC verification | **build** | Role-based verification with **no identity capture** is specific to requirement 12 and has no off-the-shelf equivalent. The verification *policy* is ours; the AI executes it within a closed intent set. | Requirements 3, 12 | High |

### Group E — Orchestration (the product)

| # | Capability | Decision | Rationale | Evidence | Conf. |
| --- | --- | --- | --- | --- | --- |
| 18 | Queue and retry orchestration | **build** | Dialer products have queues and retries, but theirs are shaped around "agent takes next call". V2 needs three distinct queues — calling, AI retry, **human callback** — and the distinction between them is load-bearing (see P-02 §2). Adapting a product's single queue model costs more than building three explicit ones. | P-02 §2; exercise §4 | High |
| 19 | Operator presence | **build** | Presence itself is simple. What makes it ours is that pacing consumes it in real time and `Provisional` must count as committed capacity rather than spare. | Requirement 9 | High |
| 20 | **Pre-alert and provisional operator reservation** | **build** | **The single capability with no equivalent in any candidate.** Reserving an operator at the *internal hold* — before the PIC is even on the line — is what makes requirement 8 achievable. It is the core of the design and the core of the build case. | P-02 §3; requirement 8 | **High** |
| 21 | Human acceptance | **build** | Explicit accept, bounded timeout, release-and-retry-once, then the no-operator path. The bounded, defined-failure behaviour is the requirement; an implicit "agent gets the call" model cannot express it. | Requirement 9; scenario 2 | High |
| 22 | Capacity-aware dialing | **build** | Pacing on *observed operator availability*, not statistical prediction. Deliberately simpler and safer than predictive pacing (see P-01 §6.2), and directly bounded by the abandonment ceiling. | P-01 §4.4 | High |

### Group F — Human desktop

| # | Capability | Decision | Rationale | Evidence | Conf. |
| --- | --- | --- | --- | --- | --- |
| 23 | Briefing card and screen-pop | **build** | Thin web client. Must render *during* the hold window, which is a latency requirement, not a UI one — and it is the difference between the system working and operators hating it. | Requirement 7; risk R5 | High |
| 24 | Transcript / summary to the operator | **build**, minimal | The operator needs the AI's *structured* outcome so the PIC never repeats themselves — not a raw transcript. Showing raw transcript would also work against requirement 12. Keep it to the structured summary. | Requirements 7, 12 | High |
| 25 | Dispositions | **build** | Disposition taxonomy must map cleanly onto lead-management next actions (capability 27). Borrow the *shape* of VICIdial's taxonomy — decades of operational learning — without adopting the product. | P-02 §2 | High |

### Group G — System of record and operability

| # | Capability | Decision | Rationale | Evidence | Conf. |
| --- | --- | --- | --- | --- | --- |
| 26 | Lead-management read/write integration | **integrate** | Requirement 11. **The largest unknown in the whole plan** — no access to the system, so field availability, write semantics, and rate limits are all assumption A6. Spike it in week 1 (E0). | Requirement 11; assumption A6 | **Low — unverified** |
| 27 | Attempt-outcome and next-action mapping | **build** | The 18-exit contract in P-02 §2, plus the machine-may-set vs needs-human-confirmation split. Entirely V2's, and a release blocker. | P-02 §2 | High |
| 28 | Supervisor controls | **build** | Live view of AI calls, operator states, abandonment and no-operator counters, campaign pause, emergency stop. Emergency stop is a release blocker. | Requirement 10 | High |
| 29 | Reporting | **build**, minimal | Only the five metrics in P-01 §9.1 plus guardrails for the pilot. Resist a reporting suite; it is the classic scope sink. | P-01 §9 | High |
| 30 | Audit and compliance | **build** | Script-version provenance, who approved what, redaction evidence, DNC enforcement, retention. Requirement 12 needs auditable proof, not assertions. | Requirements 10, 12 | High |
| 31 | PII redaction and data minimisation | **build** | Architectural: closed intent set, no identity fields in the schema, ephemeral transcripts, redaction before any persistence boundary. Deliberately not a policy control — a prompt instruction is not a control. | Requirement 12; P-01 §4.5 | High |
| 32 | Failure recovery | **build** on adopted infrastructure | Durable attempt state, reconciliation after restart, orphaned-call detection, stuck-provisional-reservation release. Requirement 10, and the thing that separates a demo from a service. | Requirement 10 | High |

**Decision tally:** build 20 · integrate 4 · adopt as-is 3 · configure 1 ·
validate first 3 (two shared with another decision) · defer 1.

The build column is heavily concentrated in Groups E and F — orchestration and
the human-facing layer. Nothing in Group C is built. That is the shape of a
focused product rather than a platform rebuild, and it is the argument for the
recommendation in one table.

---

## 2. Candidate coverage for the decisive capabilities

Eight capabilities decide adopt-vs-build. If a candidate covered these, adopting
it would be right regardless of the rest.

**Legend:** `A` provides as-is · `C` via configuration · `E` needs extension ·
`I` needs integration · `N` not provided · `?` **not assessed**

| Capability | Asterisk | VICIdial | ICTDialer | OSDial | Greenfield |
| --- | --- | --- | --- | --- | --- |
| 16 AI-leg attachment | **A** (ARI External Media) | E / I | ? | — | I |
| 13 Live-call transfer | **A** | A | ? | — | I via Asterisk |
| 20 **Provisional operator reservation** | **N** | **N** | **N** | — | **build** |
| 22 Capacity-aware dialing on observed availability | N | **C**-ish (its own pacing model) | N | — | build |
| 19 Operator presence | N | **A** | N | — | build |
| 23 Briefing card / screen-pop | N | **E** (screen-pop exists; briefing semantics do not) | N | — | build |
| 26 Lead-management integration | N | **E/I** | ? | — | I |
| 18 Queue and retry orchestration | N | **A** for its own model, **E** for V2's three-queue model | ? | — | build |

**The decisive row is 20.** Every candidate is `N`. Provisional reservation at
the internal hold is not a feature any of them lacks by oversight — it is
meaningless in a world where a human dials. It exists only because an AI holds
the call first. That is why V2 is a build.

**Row 19 and 23 are the honest counter-argument.** VICIdial genuinely provides
operator presence and screen-pop, and building them again is real cost. The
counter is P-01 §8.3: adopting VICIdial for those two means inheriting AGPLv2
network copyleft, an EOL Asterisk 18 baseline, and a large PHP/Perl attack
surface — to get two capabilities that are among the simplest in the build.

**OSDial is struck through, not scored.** Its last commit was 2014-11-06 and its
last release March 2014. Scoring a twelve-year-dead project against 21 criteria
would be theatre.

---

## 3. What was assessed, and what was not

Stated plainly, because the difference between a confident-looking grid and an
honest one is entirely in this section.

### Assessed, and how

| What | Method | Confidence |
| --- | --- | --- |
| Licence for Asterisk, VICIdial, ICTDialer, OSDial | Project sites and GitHub repo metadata | High (medium for Asterisk's commercial terms — the licensing page returned 403 and I relied on a search summary) |
| Release recency and maintenance activity, all candidates | GitHub API — releases, commits, `pushed_at` — plus SourceForge for OSDial | **High** — primary |
| Asterisk version support and EOL status | asterisk.org announcements + community, two agreeing sources | High |
| ARI External Media mechanism and limits | Official Asterisk documentation | **High** — primary |
| VICIdial CVE chain and default credential storage | KoreLogic advisories via search; public exploit repository | Medium-high; **patch status not checked** |
| ICTDialer product category | Repository description and release notes | High |
| Capability decisions in §1 | Product judgement against the 12 fixed requirements | High for our own product; the requirements are given |

### Not assessed — and what would be needed to close each gap

| Gap | Why it is open | What would close it |
| --- | --- | --- |
| **Per-capability feature depth for VICIdial and ICTDialer** | Would require standing each up and testing. The `?` and inferred cells in §2 reflect this. | ~1 week hands-on per product |
| **Cost — licensing, infrastructure, vendor** | No usage model, no vendor quotes. The exercise explicitly does not expect costs without evidence, and invented figures would be worse than none. | Usage model + two vendor quotes |
| **Performance and scale** for any candidate | Not tested | Load test at target concurrency |
| **Any AI voice vendor** — latency, accuracy, interruption handling, price | Not assessed at all. This is a large gap and E2 exists to close it. | E2, plus a bake-off of two vendors |
| **SalesDoc lead management** — fields, write semantics, rate limits | **No access.** Assumption A6. The largest unknown in the plan. | E0 spike, week 1 |
| Security audit beyond the published CVEs | Out of scope for a product exercise | Third-party review before production |
| Whether current VICIdial patches CVE-2024-8503/8504 | Not checked. Almost certainly yes. | Read the release notes |
| The full 21-criteria × 6-candidate grid | Deliberately not attempted — see the note at the top | ~2 weeks of evaluation |

### The one thing that would overturn the recommendation

If a candidate — or a managed platform such as CallHippo or Aircall used as a
pattern benchmark — turned out to implement **capability 20, provisional
operator reservation against a call already in progress**, the build case would
shrink dramatically and this document's conclusion should be revisited.
**Experiment E6 exists specifically to check that**, and it costs two days. It is
cheap insurance against the most expensive way this recommendation could be
wrong.
