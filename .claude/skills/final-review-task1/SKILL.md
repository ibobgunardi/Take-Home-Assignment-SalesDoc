---
name: final-review-task1
description: Final hiring-engineer-style review of the Task 1 submission — judges correctness, completeness, architecture, test quality, UX, documentation, setup experience, scope discipline, and AI-usage disclosure. Use immediately before submitting.
---

# Final Review — Task 1 Submission

Review this as **the engineer who will decide whether to hire this candidate**.
You have roughly 30 minutes, you did not write any of it, and you will clone it,
run it, click around, read some code, and form a judgement.

Run `verify-task1` first if verification has not been done in this session — this
skill judges the submission; it does not re-derive whether it works.

**Do not modify code.** Produce a verdict and a prioritised fix list.

---

## What is actually being assessed

From the assignment itself:

> "what we want to know is your ability to build **complete products in a short
> time**" — `emailRaw.txt`
>
> "AI tools allowed: Yes ... **Show what you verified.**" — Task 1 spec

So the question is not "is this beautiful code". It is:

**Does this convincingly demonstrate someone who can ship a complete, correct,
demonstrable product quickly with AI assistance — and who knows the difference
between what they proved and what they assumed?**

A polished small product beats an ambitious unfinished one. Every time.

---

## Review dimensions

### 1. Correctness (highest weight)

- Is `activeCallIds.length <= 2` genuinely unbreakable, including when two calls
  complete in the same tick?
- Does one `callId` produce exactly one CRMActivity in **both** stores?
- Does the queue advance correctly, with **every selected lead eventually
  dialed** and none silently dropped?
- Do the metrics add up, with each counter mapped correctly?
- Is the winner logic coherent — exactly one winner, chosen at the **answer**
  moment, with the other line `CANCELED_BY_DIALER`?
- Does stop leave the system in a consistent state — including stopping during a
  live call, where the winner must end `CONNECTED`, not cancelled?

A defect in either invariant is **blocking**. These are the two things the
assignment is actually testing.

### 2. Completeness

Walk `docs/requirements-matrix.md`. Is every spec requirement implemented?
Specifically the easily-missed ones:

- the required **stack** — Node.js (Express/Fastify) + React (Vite/Next) (R-00)
- `providerCallId` populated
- the **three CRM endpoints at their exact literal paths**
- activity written to **both** the app store and the mock CRM store
- **CRM activity status shown per call/lead in the UI**
- winner call displayed
- poll interval genuinely 1–2 seconds
- 4–8 seeded leads

### 3. Architecture

Is it simple, explicit, and readable? Can a stranger find the dialer state
machine in under a minute? Are routes thin? Is session state mutated in exactly
one place?

Then the opposite failure: **is it over-engineered?** Unnecessary abstraction
layers, a DB where in-memory was permitted, WebSockets where polling was
required, Redux for two screens, speculative interfaces — all read as poor
judgement against a 24-hour deadline, not as seniority. Flag them.

### 4. Test quality

Not the count — the coverage of what matters. Is there a real max-2 test? A real
repeat-terminal-event idempotency test? A same-tick test? Are tests
deterministic, or do they sleep and hope? Would these tests catch a regression,
or do they assert that mocks were called?

### 5. UX and demo quality

Open Screen 2. Within seconds, can you see the two lines, the metrics, the
winner, and the CRM status? Is the queue visibly advancing? Does it look
finished, or like a debug page? Any flicker, layout jumping, blank states, or
raw `undefined` on screen?

Would this demo well over a screen-share? That is close to the real bar.

### 6. Documentation

- README: does `npm install` + the documented run command actually work?
- Is the demo path explained so a reviewer reproduces it without guessing?
- `NOTES.md`: are all four required sections present — tradeoffs, what's next,
  how AI was used, what was verified?

### 7. Setup experience

The most common take-home killer. Clean clone, install, run. Anything that fails
or needs an undocumented step is high severity regardless of code quality.

### 8. Scope discipline

Did Task 2 leak in? Any AI agents, gatekeepers, PIC verification, worker pools,
handoff, briefings, signal scoring, or PII machinery in the Task 1 code is a
**scope-discipline failure** — it signals someone who cannot hold a boundary
under deadline pressure.

Equally: is deliberately-omitted scope *recorded* in `NOTES.md`? Unstated
restraint is invisible; stated restraint is judgement.

### 9. AI disclosure and verification honesty

The assignment explicitly asks. Check that the disclosure is specific and, more
importantly, that **the verification claims are true**. Cross-check every claim
in `NOTES.md` against evidence.

An overclaim here is severe: it is the one failure mode that makes a reviewer
distrust the entire submission. A stated gap ("not verified under concurrent
sessions") is a *strength*.

### 10. Reviewer experience

Overall: does this feel like a finished product from someone who ships, or an
unfinished prototype with good intentions?

---

## Output

```markdown
# Final Review — Task 1

## Verdict
Ready to submit | Ready after listed fixes | Not ready
<2-3 sentences: how a hiring engineer would read this>

## Would I want to interview this person?
<honest answer and why — this is the real question>

## Scores (1-5)
Correctness | Completeness | Architecture | Tests | UX/demo
Documentation | Setup | Scope discipline | AI disclosure honesty

## Blocking issues
<must fix before submitting>

## High-value fixes
<biggest improvement per minute spent — this is a timeboxed submission>

## Nice to have
<only if time remains>

## What is strong
<genuinely — do not manufacture praise, but do not omit real strengths>

## Overclaims found
<any statement in NOTES.md or the matrix not backed by evidence>
```

Rank the fix list by **impact per minute**, and say roughly how long each takes.
There is a 24-hour deadline; a correct list in the wrong order is not useful.

Be honest rather than kind. A soft review that lets a broken invariant or a
failing `npm install` reach the reviewer is a failure of this skill.
