# Rule — Documentation

Two of the graded deliverables are documents: the README (setup instructions)
and `NOTES.md`. The assignment asks explicitly for tradeoffs, next steps, how AI
tools were used, and **what you verified**.

---

## README.md — optimise for the reviewer's first five minutes

The reviewer will clone, install, run, and click. Every friction point costs
more than a missing feature.

Must contain:

1. One-paragraph description of what the app does.
2. **Setup:** `npm install`, then `npm run dev` (or the separate client/server
   commands) — exactly as the spec requires. State Node version if it matters.
3. The URLs the app runs on (client and API ports).
4. **How to demo the flow**, in order: open leads → select 3+ → create session →
   start → watch 2 lines → watch the queue advance → watch metrics → see CRM
   activity status → session stops.
5. How to run the tests.
6. The API endpoint list, including the three specified CRM endpoints, with a
   couple of copy-pasteable `curl` examples.
7. The deployed URL.
8. A short architecture note: where the dialer state machine lives, where CRM
   sync lives, and the two invariants.

**Every command in the README must have been actually run.** A README with a
command that does not work is the single most damaging defect in a take-home.

---

## NOTES.md — required by the spec

The spec asks for four things, in two bullets: *"tradeoffs, what you'd do next"*
and *"how you used AI tools + what you verified"*. Splitting them into four
headed sections is **our** structure, not a spec requirement — but all four
contents are required.

### Tradeoffs
What was chosen and what was given up. In-memory storage, mocked calls, polling
over sockets, the winner policy, Express+Vite over Fastify/Next (D-19), the
scope held back. Say *why* — a tradeoff without a reason reads as an accident.

**Include one sentence on the two-lines-but-one-busy behaviour.** The spec says
"Show 2 active lines"; under D-02 the other line is cancelled during a
conversation, so a reviewer skimming for two minutes may see one busy line and
read it as a bug. The UI label (R-96) helps, but say it here too — something
like: *"Both lines dial in parallel; when one is answered the other is
cancelled (`CANCELED_BY_DIALER`), so during a conversation exactly one line is
busy. That is power-dialer behaviour, not a broken second line."*

### What I'd do next
Concrete and prioritised. Persistence, real telephony provider, retry/callback
policy, auth, richer dispositions. This is also where deliberately-omitted scope
goes, which turns restraint into visible judgement rather than an apparent gap.

### How I used AI tools
Honest and specific. Which tools, for what (scaffolding, tests, review, docs),
what you had to correct, and how you checked the output. The assignment
explicitly permits AI tools, so a vague answer here wastes an opportunity —
this is partly what is being assessed.

### What I verified
**The most important section, and the one most easily damaged by overclaiming.**

Use the labels, and be concrete:

```text
Tested             automated tests, executed, passing  (name the suites)
Manually verified  actually ran it and observed the result
Not verified       honest gap
```

Good: "Ran the full suite (N tests, all passing) including the max-2 concurrency
and callId idempotency cases. Manually walked the full flow in Chrome with 5
leads and confirmed the queue advanced and per-call CRM status appeared. Curled
all three mock-CRM endpoints. **Not verified:** behaviour under many concurrent
sessions; only tested single-session."

Bad: "Everything works and is fully tested."

A stated gap is a strength — it shows you know the difference between tested and
untested. A fabricated claim, once caught, discredits the whole submission.

---

## Derived docs — keep them true

`docs/requirements-matrix.md` is the audit trail. Update the row when the
requirement lands. A matrix that says `Done` where the code is absent is worse
than no matrix — it converts a gap into a false claim.

`docs/decisions.md` must match the code as built. If an interpretation changes
during implementation, edit the decision **in the same change**.

Do not edit source files (`docs/source/*`, `V2_PRODUCT_REFINEMENT_EXERCISE.md`,
`emailRaw.txt`). They are the client's words. Every derived file states that it
is derived.

---

## Ambiguity write-ups

When documenting an interpretation, keep the four parts: **ambiguity →
interpretation → why reasonable → tradeoff.**

Never phrase an assumption as though the spec required it. Write "the spec does
not define X; I interpreted it as Y because Z" — not "as required, X works
like Y". Surfacing a genuine ambiguity is a positive signal to a reviewer; being
caught presenting a guess as a requirement is not.

---

## Code comments

Comment the non-obvious. Two places deserve a short comment explaining *why*:

- the concurrency ceiling and why the transition is synchronous
- the idempotency check and why both stores are written together

Skip narration of what the code plainly does.
