# V2 Workflow — Main Path and Exceptions

Companion to [01-product-refinement.md](01-product-refinement.md). Diagrams are
Mermaid and render in GitHub, GitLab, VS Code and most Markdown viewers.

**The design rule this document exists to enforce:** *every* terminal and
deferred path ends in a defined attempt outcome **and** a lead status in the
system of record. A path that ends without one is a lost lead, and lost leads
are the failure mode that quietly destroys trust in a system like this.

---

## 1. Main path with exceptions

```mermaid
flowchart TD
    subgraph SEL["Stage 1 - Selection, before any call"]
        A1[Read leads and company context<br/>from lead management] --> A2{Approved likely-to-buy<br/>signal present?}
        A2 -->|No| X1[/"OUT: NOT_ELIGIBLE_NO_SIGNAL"/]
        A2 -->|Yes| A3{Signal fresh enough?<br/>within campaign window}
        A3 -->|Stale| X2[/"OUT: SIGNAL_STALE"/]
        A3 -->|Fresh| A4{Contactable?<br/>DNC, suppression, hours, retry cap}
        A4 -->|Blocked| X3[/"OUT: NOT_CONTACTABLE"/]
        A4 -->|Clear| A5[Build segment context - approved, reusable<br/>Build human briefing - company specific]
        A5 --> A6[Enqueue on the calling queue]
    end

    A6 --> B1{Pacing allows a new call?<br/>free operators, concurrency ceiling}
    B1 -->|No| B0[Hold in queue<br/>no state change] --> B1
    B1 -->|Yes| B2[AI places segment-tailored call]

    subgraph AI["Stage 2 - AI leg"]
        B2 --> C1{Answered?}
        C1 -->|No answer| X4[/"OUT: NO_ANSWER"/]
        C1 -->|Busy| X5[/"OUT: BUSY"/]
        C1 -->|Voicemail| X6[/"OUT: VOICEMAIL"/]
        C1 -->|Invalid number| X7[/"OUT: BAD_NUMBER"/]
        C1 -->|Answered| C2{Correct company?}
        C2 -->|No| X8[/"OUT: WRONG_COMPANY"/]
        C2 -->|Yes| C3{Gatekeeper present?}

        C3 -->|No, PIC direct| C6
        C3 -->|Yes| C4[AI requests the target role<br/>no PII requested]
        C4 --> C5{Gatekeeper outcome}
        C5 -->|Refuses| X9[/"OUT: GATEKEEPER_REFUSED"/]
        C5 -->|Asks for do-not-call| X10[/"OUT: DNC_REQUESTED"/]
        C5 -->|Not available now| X11[/"OUT: PIC_UNAVAILABLE"/]
        C5 -->|Transferring| C5a[SOFT SIGNAL: internal hold<br/>PROVISIONALLY RESERVE AN OPERATOR<br/>render briefing on their screen]
        C5a --> C5b{Hold resolves?}
        C5b -->|Dropped during hold| X12[/"OUT: DROPPED_IN_TRANSFER"/]
        C5b -->|Connected| C6{PIC role verified?}
        C6 -->|No, wrong person| X13[/"OUT: PIC_NOT_VERIFIED"/]
        C6 -->|Refuses to talk| X14[/"OUT: PIC_REFUSED"/]
        C6 -->|Verified| D1
    end

    subgraph HUM["Stage 3 - Human leg"]
        D1{Operator reservable<br/>and briefing rendered?}
        D1 -->|No operator| X15[/"OUT: PIC_REACHED_NO_OPERATOR"/]
        D1 -->|Yes| D2{Operator accepts<br/>within N seconds?}
        D2 -->|Declines or times out| D3{Another operator<br/>reservable? one retry}
        D3 -->|Yes| D2
        D3 -->|No| X15
        D2 -->|Accepts| D4[Bridge PIC to operator]
        D4 --> D5{Transfer succeeded?}
        D5 -->|Failed| X16[/"OUT: TRANSFER_FAILED"/]
        D5 -->|Dropped after bridge| X17[/"OUT: CALL_DROPPED"/]
        D5 -->|Connected| D6[Human conversation<br/>AI leg detaches]
        D6 --> D7[Operator dispositions and wraps]
        D7 --> D8[/"OUT: CONVERSATION_HELD<br/>+ human disposition"/]
    end

    X1 & X2 & X3 & X4 & X5 & X6 & X7 & X8 & X9 & X10 & X11 & X12 & X13 & X14 & X15 & X16 & X17 & D8 --> W1

    W1[Write structured attempt outcome<br/>+ next action to the SAME lead] --> W2{Next action}
    W2 -->|Schedule AI retry| W3[(AI retry queue)]
    W2 -->|Needs a person| W4[(Human callback queue)]
    W2 -->|Terminal| W5[(No further attempts)]

    classDef out fill:#fdf3e3,stroke:#b45309,color:#7c3d06
    classDef good fill:#e8f6ed,stroke:#15803d,color:#0f5132
    classDef key fill:#e6effc,stroke:#1f6feb,color:#0b3d91
    class X1,X2,X3,X4,X5,X6,X7,X8,X9,X10,X11,X12,X13,X14,X15,X16,X17 out
    class D8 good
    class C5a,D1,D2 key
```

The three blue nodes are the mechanism that distinguishes V2 from a
conventional dialer: **reserve provisionally at the internal hold, gate the
handoff on an explicit accept, and have a defined path when no operator is
available.**

---

## 2. Every exit, its outcome, and what happens to the lead

This is the contract with the system of record. `OUT` values are attempt
outcomes written by V2; lead status and next action are what V2 sets on the lead.

| # | Exit | Attempt outcome | Lead status | Next action | Notes |
| --- | --- | --- | --- | --- | --- |
| X1 | No approved signal | `NOT_ELIGIBLE_NO_SIGNAL` | unchanged | none | Never entered the queue; no attempt recorded |
| X2 | Signal stale | `SIGNAL_STALE` | `AWAITING_SIGNAL_REFRESH` | re-evaluate when a new signal lands | Not a call failure |
| X3 | DNC / suppressed / outside hours / retry cap | `NOT_CONTACTABLE` | `SUPPRESSED` | none while suppression holds | Compliance-owned |
| X4 | No answer | `NO_ANSWER` | `ATTEMPTED` | **AI retry**, backoff, different daypart | Cheapest retry |
| X5 | Busy | `BUSY` | `ATTEMPTED` | **AI retry**, short backoff | Busy implies someone is there |
| X6 | Voicemail | `VOICEMAIL` | `ATTEMPTED` | **AI retry**, different daypart; no message left in V2 | Leaving messages is out of scope |
| X7 | Invalid / unobtainable number | `BAD_NUMBER` | `DATA_QUALITY_ISSUE` | **human** data fix; no AI retry | Retrying a bad number wastes capacity forever |
| X8 | Wrong company answered | `WRONG_COMPANY` | `DATA_QUALITY_ISSUE` | **human** data fix; no AI retry | Same reasoning |
| X9 | Gatekeeper refused | `GATEKEEPER_REFUSED` | `ATTEMPTED` | **AI retry**, capped attempts, try a different daypart | Cap tightly - repeat refusals damage the brand |
| X10 | Do-not-call requested | `DNC_REQUESTED` | `DO_NOT_CALL` | **none, permanently** | **Immediate, irreversible by the system.** Compliance-critical |
| X11 | PIC not available now | `PIC_UNAVAILABLE` | `ATTEMPTED` | **AI retry**, honour any stated better time | Capture the time window, never a name |
| X12 | Dropped during internal hold | `DROPPED_IN_TRANSFER` | `ATTEMPTED` | **AI retry**, short backoff | Likely the company's PBX, not ours |
| X13 | Reached a person, role not verified | `PIC_NOT_VERIFIED` | `ATTEMPTED` | **AI retry** with refined role wording | Also a signal that targeting is wrong |
| X14 | PIC refused to talk | `PIC_REFUSED` | `NURTURE` | no AI retry this campaign | A verified rejection is real information |
| **X15** | **PIC reached, no operator available** | **`PIC_REACHED_NO_OPERATOR`** | **`HUMAN_CALLBACK_DUE`** | **human callback queue, priority high, targets the verified ROLE** | **Never the AI retry queue.** See §4 |
| X16 | Transfer failed after accept | `TRANSFER_FAILED` | `HUMAN_CALLBACK_DUE` | **human callback**, priority high | Our fault; the PIC was ready |
| X17 | Call dropped after bridge | `CALL_DROPPED` | `HUMAN_CALLBACK_DUE` | **human callback**, priority high | Operator has partial context already |
| D8 | Conversation held | `CONVERSATION_HELD` | set by the operator's disposition | per disposition | The only success path |

### Which status changes need human confirmation

Not all of these should be machine-settable. Recommended split:

| Machine may set directly | Requires human confirmation |
| --- | --- |
| `ATTEMPTED`, `AWAITING_SIGNAL_REFRESH`, `DATA_QUALITY_ISSUE`, `HUMAN_CALLBACK_DUE` | Anything that **ends** pursuit or changes commercial meaning: `NURTURE`, `DISQUALIFIED`, opportunity creation, or any stage advance |
| `DO_NOT_CALL` — **machine-set immediately**, because a compliance obligation must not wait for a human | Reversing `DO_NOT_CALL` — compliance owner only |

The principle: **V2 may record what happened; only a human may decide what a
lead now means commercially.** The single exception is DNC, where the safe
default runs the other way.

---

## 3. The reservation ladder over time

This is the timing that makes requirement 8 — "must not leave the PIC waiting" —
achievable rather than aspirational.

```mermaid
sequenceDiagram
    autonumber
    participant Q as Calling queue
    participant P as Pacing
    participant AI as AI voice agent
    participant GK as Gatekeeper / PIC
    participant OP as Operator pool
    participant H as Human caller
    participant LM as Lead management

    Q->>P: company eligible
    P->>P: free operators >= threshold?
    P->>AI: authorise call
    AI->>GK: dial
    GK-->>AI: answered
    AI->>GK: verify company
    AI->>GK: ask for the target ROLE - no PII
    GK-->>AI: "putting you through"

    rect rgb(230, 239, 252)
    Note over AI,H: The hold window - this is the whole trick
    AI->>OP: internal hold detected
    OP->>H: PROVISIONAL reservation + render briefing
    H->>H: reads briefing - typically 15-45s
    H->>OP: pre-accept
    end

    GK-->>AI: PIC on the line
    AI->>AI: verify role
    AI->>OP: hard commit
    OP-->>AI: operator ready
    AI->>GK: "connecting you to my colleague now"
    AI->>H: bridge
    Note over GK,H: target: PIC verified to human audio <= 5s
    H->>GK: substantive conversation
    H->>LM: disposition + next action
    AI-->>LM: structured attempt outcome
```

**If the hold is short or absent** — the PIC picks up immediately — there is no
reading window. The operator then receives the briefing and the accept prompt
simultaneously, and the latency budget is tighter. This case must be measured
separately in E2; it is the worst case for requirement 8 and the most likely
source of poor operator experience.

---

## 4. The no-operator path, in detail

Required acceptance scenario 2. Deliberately drawn on its own because it is the
path most likely to be implemented badly.

```mermaid
flowchart TD
    S1[PIC verified] --> S2{Operator reservable?}
    S2 -->|Yes| S3[Normal handoff]
    S2 -->|No| S4[Start bounded close<br/>hard limit on dead air]
    S4 --> S5[AI speaks APPROVED closing wording<br/>acknowledge, do not pitch,<br/>state a colleague will follow up]
    S5 --> S6[End call cleanly]
    S6 --> S7[Attempt outcome:<br/>PIC_REACHED_NO_OPERATOR]
    S7 --> S8[Lead status:<br/>HUMAN_CALLBACK_DUE]
    S8 --> S9[(Human callback queue<br/>HIGH priority<br/>targets the verified ROLE)]
    S7 --> S10[Pacing: register the event<br/>reduce concurrency]
    S10 --> S11[Supervisor console:<br/>increment a DEFECT counter]

    classDef bad fill:#fdeceb,stroke:#b42318,color:#7a1b12
    classDef key fill:#e6effc,stroke:#1f6feb,color:#0b3d91
    class S7,S11 bad
    class S4,S5,S9 key
```

Four properties that matter:

1. **Bounded.** The close begins on a timer, not on hope. Recommended: dead air
   never exceeds ~8 seconds; the call is closed within ~20 seconds of PIC
   verification.
2. **Approved wording.** Compliance-owned, versioned, and auditable — not
   model-improvised.
3. **A different queue.** `HUMAN_CALLBACK_DUE` goes to a **human** callback
   queue. It must never re-enter the AI retry queue: this person has already
   been reached and spoken to, and calling them again with a machine would be
   worse than not calling.
4. **Counted as a defect.** A rising rate here means pacing is too aggressive.
   It appears on the supervisor console next to abandonment, not buried in a
   report.

**What is retained:** the verified *role* ("Head of General Insurance") and the
company. **What is not:** any name, direct number, or other identifier the
gatekeeper may have said aloud — P-01 §4.5.

---

## 5. Operator states

```mermaid
stateDiagram-v2
    [*] --> Offline
    Offline --> Available: sets available
    Available --> Provisional: provisionally reserved<br/>briefing rendered
    Provisional --> Available: call died before PIC<br/>briefing discarded
    Provisional --> Committed: PIC verified
    Available --> Committed: direct PIC, no hold window
    Committed --> Available: declined or timed out<br/>reservation released
    Committed --> Live: accepted and bridged
    Live --> WrapUp: call ends
    WrapUp --> Available: disposition submitted
    WrapUp --> Offline: end of shift
    Available --> Offline: sets unavailable
    Live --> WrapUp: transfer failed or dropped
```

Invariants the implementation must guarantee:

- An operator is `Live` on **at most one** call — requirement 9.
- `WrapUp` **must** complete before returning to `Available`; disposition is not
  optional, because an un-dispositioned call is a lost outcome.
- `Provisional` is always time-bounded and always releases — a stuck provisional
  reservation silently removes an operator from the pool, which is the kind of
  bug that looks like "we need more staff".
- Only `Available` operators are counted by pacing. `Provisional` counts as
  committed capacity, not spare.

---

## 6. Where each concept lives

Restating the P-01 §4.1 distinction against the diagrams above, because conflating
these is what produces lost leads:

| Concept | Appears above as | Owned by |
| --- | --- | --- |
| Lead status | the `W1` write-back and the §2 table | Lead management — system of record |
| Scheduled retry | `W3` AI retry queue | V2 scheduler |
| Work queue | the calling queue, `W4` human callback queue | V2 |
| Human assignment | `Provisional` / `Committed` in §5 | V2 operator pool |
| Live-call routing | the bridge step in §3 | Asterisk |
