# Multi-Line Dialer (2 lines) + Mock CRM

Take Home Assignment 1. An agent runs a **2-line dialer session** over a list of
leads. Two calls dial in parallel; the first one answered wins and the other
line is cancelled; when a call ends the system writes a **CRM activity** for
that lead into both the app's own store and a mock external CRM. Call outcomes
and durations are simulated — there is no real telephony.

**Live app: <https://72.61.214.167.sslip.io>**

> **State is in memory.** The spec explicitly permits this. A server restart or
> redeploy clears sessions and CRM data; the seeded leads come back
> automatically, so the app is immediately usable again. If you had a session
> open across a restart, the UI tells you it expired and returns you to the
> leads screen — create a new one, it takes a second.

---

## Setup

Requires **Node 20+** (developed on 22).

```bash
npm install     # installs both workspaces
npm run dev     # API on :3200, client on :5173
```

Then open **<http://localhost:5173>**.

| Command | What it does |
| --- | --- |
| `npm run dev` | server + client together (this is the one you want) |
| `npm run dev:server` | API only, on `:3200` |
| `npm run dev:client` | Vite dev server only, on `:5173` |
| `npm test` | the whole suite — 116 tests |
| `npm run test:server` | server suite only (96) |
| `npm run test:client` | client suite only (20) |
| `npm run build` | build the client bundle |
| `npm start` | production mode: one process serves API + bundle on `:3200` |

---

## Demo the flow in about a minute

1. **Open the app.** Six seeded leads with name, company, phone, email.
2. **Tick 5 or 6 leads.** More than two is the point — that is what makes the
   queue advance. `Create Dialer Session` stays disabled until you tick at least
   one.
3. **Create Dialer Session**, then **Start**. You move to the session screen.
4. **Watch two lines dial at once.** Both cards show `Dialing…`.
5. **Watch a call get answered.** That card turns green and reads
   `Connected — live`, the winner panel fills, and **the other line is cancelled
   with `CANCELED_BY_DIALER`**. While the conversation runs, **line 2 sits idle
   and says so** — that is correct power-dialer behaviour, not a broken second
   line. One agent, one conversation.
6. **Watch the conversation end** and dialing resume with the next two leads.
7. **Watch the metrics move** — attempted, connected, failed, canceled. Note
   `connected` only increments when the call *ends*, not when it is answered.
8. **Watch the CRM column.** Each completed call goes from `CRM activity
   pending` to `CRM activity created act-N`.
9. **The session stops on its own** once every selected lead has been dialed.
   A whole 6-lead run takes roughly 25 seconds.

You can press **Stop** at any point. A call that was ringing becomes
`CANCELED_BY_DIALER`; a call that was live becomes `CONNECTED`, because a
conversation did happen.

The simulator is seeded with a fixed default (`SIM_SEED`), so the same run
replays identically. Set `SIM_SEED` to any number for a different run.

---

## API

No `/api` prefix — the three CRM endpoints are at the literal paths the
assignment names.

| Method | Path | |
| --- | --- | --- |
| `GET` | `/mock-crm/contacts` | **specified** |
| `GET` | `/mock-crm/activities` | **specified** |
| `GET` | `/leads/:id/crm-activities` | **specified** — the app's own view |
| `GET` | `/leads` | Screen 1 |
| `POST` | `/sessions` | `{ agentId?, leadIds[] }` — `400` if empty |
| `POST` | `/sessions/:id/start` | `409` if the session already ran |
| `POST` | `/sessions/:id/stop` | idempotent |
| `GET` | `/sessions/:id` | **the polling endpoint** — one response has everything Screen 2 needs |
| `GET` | `/health` | |

```bash
# against the deployed app (use curl.exe on Windows PowerShell)
curl https://72.61.214.167.sslip.io/mock-crm/contacts
curl https://72.61.214.167.sslip.io/mock-crm/activities
curl https://72.61.214.167.sslip.io/leads/lead-1/crm-activities

# run a whole session from the shell
BASE=https://72.61.214.167.sslip.io
curl -s $BASE/leads
curl -s -X POST $BASE/sessions -H 'Content-Type: application/json' \
     -d '{"leadIds":["lead-1","lead-2","lead-3","lead-4","lead-5"]}'
curl -s -X POST $BASE/sessions/sess-1/start
curl -s $BASE/sessions/sess-1          # poll this
```

**The cross-check worth doing:** after a session finishes, the number of
activities in `/mock-crm/activities` should equal `metrics.attempted`, and the
number of contacts should equal the number of distinct leads dialed. If those
disagree, something double-counted.

---

## Architecture

```text
server/src/
  models/           spec data shapes + the enums
  store/            in-memory Maps, one module per collection
  services/
    dialer.js       THE state machine - the only place session state mutates
    crm-sync.js     terminal call -> contact upsert -> activity (idempotent)
    mock-crm.js     the "external" CRM: its own store, its own boundary
    simulator.js    seeded PRNG for dev, scripted for tests
    clock.js        injected time, so tests never sleep
  views/            the read model behind GET /sessions/:id
  routes/           thin HTTP: parse, call a service, serialize
client/src/
  LeadsScreen       Screen 1
  SessionScreen     Screen 2
  useSessionPolling 1.5s poll, stops on STOPPED and unmount
```

### Two invariants hold this together

**1. Never more than 2 active calls.** Every transition runs inside one
synchronous function, [`advance()`](server/src/services/dialer.js) — there is no
`await` between reading `activeCallIds` and writing it. Node runs one callback at
a time, so with no interleaving point there is no race that could produce a
third call. Promotion is a `while` loop bounded by
`activeCallIds.length < CONCURRENCY`, so the ceiling *is* the loop condition
rather than a check something could skip. A single 250ms `setInterval` per
running session is the only thing that drives it.

**2. One `callId` produces at most one CRM activity.**
[`syncTerminalCall()`](server/src/services/crm-sync.js) checks an index keyed on
`callId` *before* any write and returns early on a hit, so a repeated terminal
event writes nothing. Both stores are written in the same synchronous block —
a record present in one store and missing from the other is exactly the failure
that check exists to prevent.

Both are covered by tests that were mutation-checked: four deliberate bugs were
introduced and each was caught. See `NOTES.md`.

### Design decisions

The assignment leaves real ambiguities — what makes a call the "winner", what
happens to the other line, whether dialing continues after a connect, which
statuses map to which metric. Each one is written up in
[`docs/decisions.md`](docs/decisions.md) as *ambiguity → interpretation → why →
tradeoff*. `NOTES.md` summarises the ones that change observable behaviour.

Deployment (VPS, systemd, nginx, Let's Encrypt) is in
[`DEPLOYMENT.md`](DEPLOYMENT.md).
