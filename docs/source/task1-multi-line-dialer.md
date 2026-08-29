# SOURCE (recovered verbatim) — Take Home Assignment 1: Multi-Line Dialer

> **Provenance / why this file exists.**
> The Task 1 specification lives in `Take Home Assignment.17.08.26.pdf` (emailed
> attachment). A Markdown conversion of that PDF once sat in the repo root as
> `Take Home Assignment.17.08.26.md` and **had lost the Task 1 pages entirely**,
> containing only the Task 2 / V2 product-refinement content despite its
> filename. That file has since been deleted to remove the trap; **this file is
> now the working Task 1 spec.**
>
> This file is a **verbatim transcription of the Task 1 pages of the PDF**. It is
> reproduced without edits, additions, corrections, or reordering. Typos and
> ambiguities in the original are preserved deliberately (see
> `docs/decisions.md` for how they are interpreted).
>
> **The PDF remains authoritative.** If this transcription and the PDF ever
> disagree, the PDF wins. Do not "fix" this file.

---

Take Home Assignment, 1
Multi-Line Dialer (2 lines) + Update CRM (or Lead Management MVP)
Stack: Node.js (Express/Fastify) + React (Vite/Next)
AI tools allowed: Yes (Codex/Copilot/Cursor/Claude/etc.). Show what you verified.

Goal

Build a CRM where an agent runs a 2-line dialer session over a list of leads. When a call ends,
the system writes a CRM activity record for that lead (mock CRM).

Submission

Deliverables shall be hosted on any free webhost service, CRM tool and utilize any
other free existing platform plans. Email the url, Git repo links to
intern1.aisalesdr@gmail.com and ellee@aisalesdr.co

- Repo with instructions:
  - npm install
  - npm run dev (or separate client/server commands)
- NOTES.md:
  - tradeoffs, what you'd do next
  - how you used AI tools + what you verified

Take Home Assignment, 1

Part 1 - Backend (node.js)

Data Models (it is okay for this to be in memory)

- Lead
  - id, name, company, phone, email
  - crmExternalId (optional)
- Call
  - id, leadId, sessionId, status
  - startedAt, endedAt
  - Call_Status: CONNECTED | NO_ANSWER | BUSY | VOICEMAIL | CANCELED_BY_DIALER
  - providerCallId (string)
- DialerSession
  - id, agentId
  - leadQueue (array of leadIds)
  - concurrency fixed to 2
  - activeCallIds (max 2)
  - winnerCallId (nullable)
  - status: RUNNING | STOPPED
  - metrics: attempted, connected, failed, canceled
- CRMActivity
  - id, leadId, crmExternalId, type (e.g., CALL)
  - callId, disposition, notes, createdAt

Take Home Assignment, 1

Part 2 – CRM Integration

Implement Mock CRM inside backend

These endpoints represent an external CRM system (store data in memory):

CRM Sync behavior (required)

When a call reaches a terminal outcome:

- If lead has no crmExternalId, update contact
- Then create activity with disposition + basic notes
- Save the activity in your own app DB (CRMActivity model) and the mock
  CRM store.

Idempotency requirement

- The same terminal call event should not create duplicate CRM
  activities. (Use a simple idempotency key like callId.)

API endpoints to inspect CRM results

- GET /mock-crm/contacts
- GET /mock-crm/activities
- GET /leads/:id/crm-activities (your app's view)

Part 3 – Frontend (REACT)

Screen 1: Leads + Session creation

- Display seeded leads list (4–8 leads)
- Select leads (checkboxes)
- "Create Dialer Session" + "Start"

Screen 2: Dialer Session

- Show 2 active "lines" (call cards):
  - lead name, phone, status
- Show session metrics
- Show winner call (if connected)
- Show CRM activity creation status (per call/lead)
- Poll backend every 1–2 seconds

---

## Task 2 summary page (present in the same PDF, reproduced for completeness)

Take Home Assignment 2
Product Refinement Exercise: V2 AI-to-Human Dialer

Objective:
Define a production-ready BPO-style V2 and recommend whether to adopt, extend, integrate, or build.

Flow:
SalesDoc lead → AI navigates gatekeeper → PIC reached → informed human takes over → outcome saved to SalesDoc.

Requirements:
- Call only leads with likely-to-buy signals.
- Show company context to the human before handoff.
- Match call volume to human availability.
- AI must not collect PII.
- If no human is available, end safely and mark for callback.

Deliverables:
Product proposal, workflow, solution comparison, prioritized backlog, and 15-minute presentation.

See `V2_PRODUCT_REFINEMENT_EXERCISE.md` for the complete assignment.
