# Rule — Workstream Scope

```text
WORKSTREAM A = Task 1 = BUILD  -> Multi-Line Dialer (2 lines) + mock CRM MVP
WORKSTREAM B = Task 2 = PLAN   -> V2 product proposal (documents only)
```

Default assumption: **every request is Task 1** unless the user says otherwise.

---

## Never do this

Do not write code for anything on this list as part of Task 1:

AI voice agents · gatekeeper navigation · PIC verification · human-worker pool ·
human handoff / live transfer · briefing cards or suggested openings ·
likely-to-buy signal scoring · PII redaction · supervisor consoles · audit logs ·
authorization/RBAC · BPO workflow · campaign management · retry/callback policy ·
lead exhaustion rules · SalesDoc integration · real telephony (Asterisk, SIP,
Twilio) · real CRM vendors · open-source dialer evaluation · durable persistence
or failure recovery.

These belong to Task 2, which produces **documents**, not software.

---

## The one exception

A Task 2 concept enters Task 1 **only** if a direct quote from
`docs/source/task1-multi-line-dialer.md` requires it. Before building it:

1. Quote the exact line from the Task 1 source.
2. Add a row to `docs/requirements-matrix.md`.
3. Record the reasoning in `docs/decisions.md`.

Vocabulary overlap is not a requirement. Task 1 has a "queue" and Task 2 has a
"calling queue"; they are not the same feature. Task 1's mock CRM is not
SalesDoc's lead-management system.

---

## Where the Task 1 spec lives

**`docs/source/task1-multi-line-dialer.md`** — a verbatim transcription of the
Task 1 pages of `Take Home Assignment.17.08.26.pdf`, which is authoritative.

If you find yourself reading about gatekeepers and PICs while trying to build
the dialer, you have opened the wrong file — Task 2 material is not the spec.

---

## Scope check before writing code

1. Which row of `docs/requirements-matrix.md` does this satisfy?
2. If none — is it required by a direct quote from the Task 1 source?
3. If neither — say so and stop. Do not build it "while you are in there".

Scope creep is a **defect** here, not generosity. There is a 24-hour deadline,
and a complete small product beats an incomplete large one. When something is
not required, the right instinct is to leave it out and note it under "what I'd
do next" in `NOTES.md`.

---

## Working on Task 2

When the user explicitly asks for Task 2, switch to `docs/task2-reference.md`
and produce **written deliverables only**: proposal, workflow diagram,
capability decision matrix, prioritized backlog, presentation. Do not create
application code, scaffolding, schemas, or APIs for V2 — not even as
"illustration". Do not modify the Task 1 codebase during Task 2 work.
