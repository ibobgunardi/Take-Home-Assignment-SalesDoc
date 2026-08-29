# Rule — Frontend (React)

Applies to the Task 1 React client. Two screens, exactly as specified.

---

## The backend is the source of truth

The client **renders server state**. It does not simulate calls, advance the
queue, count metrics, decide winners, or track call timing locally.

The only client-side state that is legitimate:

- which lead checkboxes are ticked (before the session exists)
- the current session id
- fetch status: loading / error / last-updated

Everything else comes from `GET /sessions/:id` on each poll. If you find
yourself computing a metric in the client, that logic belongs on the server.

This matters beyond tidiness: a reviewer who sees the UI derive dialer state
locally will assume the invariants are not really enforced anywhere.

---

## Screen 1 — Leads + Session creation

- Display the seeded leads (4–8) with name, company, phone, email.
- Selection via **checkboxes** — the spec says checkboxes; use checkboxes.
- "Create Dialer Session" button — **disabled with 0 selected** (D-11).
- "Start" button.
- After creation, move to Screen 2 (a view swap is fine; a router is optional
  and not required).

---

## Screen 2 — Dialer Session

Required elements, all from the spec:

1. **Two line slots.** Always render exactly 2 — an idle line renders as an
   idle card, never a missing one.

   **Be aware of a consequence of D-02:** while a winner is `LIVE`, the other
   line is cancelled and no lead is promoted, so for most of a conversation
   *exactly one line is busy*. That is correct power-dialer behaviour, but it
   means the headline "2 lines" feature is most visible **between**
   conversations. So the idle slot must stay present and labelled — something
   like "Line 2 - idle while you're on a call" - rather than blank or absent
   (R-96). A reviewer who sees one card during a conversation and no explanation
   will read it as a broken 2-line dialer.
2. **Per line card:** lead **name**, **phone**, **status**.
   Render from `phase` while in flight - "Dialing..." for `DIALING`,
   "Connected - live" for `LIVE` - and the terminal `status` once `ENDED`
   (D-03). Never expect a `DIALING` value inside `Call_Status`.
3. **Session metrics:** attempted, connected, failed, canceled.
4. **Winner call**, shown when `winnerCallId` is set. The spec says "show winner
   call (if connected)" without defining it; we interpreted it as the **most
   recent answered call** — set at the answer moment, replaced only by a later
   answer, never cleared (D-18). So the panel fills on the first connect and
   stays populated, including after the session ends. Label it **"Last
   connected"** once that call has ended; "Winner" reads wrong on a finished
   call.
5. **CRM activity creation status per call/lead** — e.g. `pending` vs
   `activity created`, ideally with the activity id. This is a graded
   requirement and is easy to forget; make it plainly visible.
6. A **Stop** control.
7. A completed-calls list so queue advancement is observable (R-95). **Not
   spec-required** — ours, because a reviewer needs to *see* the queue draining.
   First thing to cut if time runs short (`implement-task1` Step 3b).

---

## Polling

- Poll `GET /sessions/:id` every **1–2 seconds**. Use a named constant
  (e.g. `POLL_INTERVAL_MS = 1500`) so a test can assert the value.
- **Stop polling** when the session is `STOPPED`, and clear the interval on
  unmount. A runaway poll after the session ends is a visible defect.
- Do not overlap requests — skip a tick if one is still in flight.
- Do not clear rendered state while a request is in flight; a poll failure must
  not blank the screen.

Do **not** replace polling with WebSockets or SSE. The spec requires polling at
1–2s; "upgrading" it removes a graded requirement.

---

## UI states

Handle all four, on both screens: **loading**, **empty**, **error**, **success**.

- Loading: a simple indicator, never a blank page.
- Empty: 0 leads selected, or a session with no calls yet.
- Error: a failed fetch shows a readable message and keeps the last good data.
  It must not crash or white-screen.
- Never render `undefined`, `NaN`, or `[object Object]`.

---

## Styling and dependencies

Plain CSS or one lightweight approach. No component library, no Redux, no
state-management framework, no data-fetching library unless it saves real time.
`useState` + `useEffect` + `fetch` is sufficient and reads well.

Aim for **clear and legible**, not decorative. A reviewer spends about two
minutes here: they should immediately see the two lines, the metrics, the
winner, and the CRM status without hunting.

Keep the layout stable across polls — values updating in place, not elements
jumping. Flicker reads as instability.

---

## Not in scope

No auth, no routing framework requirement, no dark-mode system, no charts, no
animations beyond a spinner, no briefing cards, no human-handoff UI. See
`.claude/rules/scope.md`.
