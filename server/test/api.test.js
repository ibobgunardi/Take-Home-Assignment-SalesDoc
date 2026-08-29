import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { seed } from '../src/seed.js';
import { CALL_STATUS } from '../src/models/call.js';
import { configureDialer, resetDialer, advance } from '../src/services/dialer.js';
import { createScriptedSimulator } from '../src/services/simulator.js';
import { fakeClock } from '../src/services/clock.js';
import * as sessionStore from '../src/store/sessions.js';

const { CONNECTED, NO_ANSWER, BUSY, VOICEMAIL } = CALL_STATUS;

let app;
let clock;

beforeEach(() => {
  seed();
  resetDialer();
  app = createApp();
});
afterEach(() => resetDialer());

/** Same discipline as the dialer tests: fake clock, scripted outcomes, no interval. */
function useScript(plans) {
  clock = fakeClock(10_000);
  configureDialer({ clock, simulator: createScriptedSimulator(plans), autoTick: false });
}

async function createSession(leadIds, agentId) {
  const body = agentId === undefined ? { leadIds } : { agentId, leadIds };
  return request(app).post('/sessions').send(body);
}

const leadIdsFrom = (res, n) => res.body.leads.slice(0, n).map((l) => l.id);

// ---------------------------------------------------------------------------

describe('GET /leads (R-63)', () => {
  it('returns the seeded leads with every display field', async () => {
    const res = await request(app).get('/leads');
    expect(res.status).toBe(200);
    expect(res.body.leads.length).toBeGreaterThanOrEqual(4);
    expect(res.body.leads.length).toBeLessThanOrEqual(8);
    for (const lead of res.body.leads) {
      for (const field of ['id', 'name', 'company', 'phone', 'email']) {
        expect(lead[field]).toBeTruthy();
      }
      expect(lead).toHaveProperty('crmExternalId');
    }
  });
});

describe('POST /sessions (R-64, R-27, R-38)', () => {
  it('creates a session whose queue matches the selection', async () => {
    useScript([]);
    const leads = await request(app).get('/leads');
    const ids = leadIdsFrom(leads, 3);

    const res = await createSession(ids, 'agent-1');

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('STOPPED');
    expect(res.body.startedAt).toBeNull();
    expect(res.body.queue.remaining).toBe(3);
    expect(res.body.queue.upcoming.map((l) => l.id)).toEqual(ids);
    expect(res.body.lines).toHaveLength(2);
  });

  it('rejects an empty selection with 400 (D-11)', async () => {
    useScript([]);
    const res = await createSession([]);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at least one lead/i);
  });

  it('rejects a missing leadIds field with 400, not a 500', async () => {
    useScript([]);
    const res = await request(app).post('/sessions').send({});
    expect(res.status).toBe(400);
  });

  it('rejects unknown lead ids with 404', async () => {
    useScript([]);
    const res = await createSession(['lead-nope']);
    expect(res.status).toBe(404);
  });

  it('defaults agentId to the seeded demo agent when omitted (D-14)', async () => {
    useScript([]);
    const leads = await request(app).get('/leads');
    const res = await createSession(leadIdsFrom(leads, 1));
    expect(res.body.agentId).toBe('agent-1');
  });
});

describe('POST /sessions/:id/start and /stop (R-65, R-66, R-33, R-37)', () => {
  it('start dials 2 of 4 and reports RUNNING', async () => {
    useScript([
      { outcome: NO_ANSWER, ringMs: 9000 },
      { outcome: BUSY, ringMs: 9000 },
      { outcome: BUSY, ringMs: 9000 },
      { outcome: BUSY, ringMs: 9000 },
    ]);
    const leads = await request(app).get('/leads');
    const created = await createSession(leadIdsFrom(leads, 4));

    const res = await request(app).post(`/sessions/${created.body.id}/start`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('RUNNING');
    expect(res.body.startedAt).not.toBeNull();
    expect(res.body.lines.filter((l) => l.call).length).toBe(2);
    expect(res.body.metrics.attempted).toBe(2);
    expect(res.body.queue.remaining).toBe(2);
  });

  it('stop terminates in-flight calls and leaves no active lines', async () => {
    useScript([
      { outcome: NO_ANSWER, ringMs: 9000 },
      { outcome: BUSY, ringMs: 9000 },
      { outcome: BUSY, ringMs: 9000 },
    ]);
    const leads = await request(app).get('/leads');
    const created = await createSession(leadIdsFrom(leads, 3));
    await request(app).post(`/sessions/${created.body.id}/start`);

    const res = await request(app).post(`/sessions/${created.body.id}/stop`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('STOPPED');
    expect(res.body.completionReason).toBe('STOPPED_BY_AGENT');
    expect(res.body.lines.every((l) => l.call === null)).toBe(true);
    expect(res.body.metrics.canceled).toBe(2);
  });

  it('stop is idempotent over HTTP', async () => {
    useScript([{ outcome: NO_ANSWER, ringMs: 9000 }, { outcome: BUSY, ringMs: 9000 }]);
    const leads = await request(app).get('/leads');
    const created = await createSession(leadIdsFrom(leads, 2));
    await request(app).post(`/sessions/${created.body.id}/start`);

    const first = await request(app).post(`/sessions/${created.body.id}/stop`);
    const second = await request(app).post(`/sessions/${created.body.id}/stop`);

    expect(second.status).toBe(200);
    expect(second.body.metrics).toEqual(first.body.metrics);
    const activities = await request(app).get('/mock-crm/activities');
    expect(activities.body.activities).toHaveLength(2);
  });

  it('start on a finished session returns 409 - there is no restart (R-37)', async () => {
    useScript([{ outcome: BUSY, ringMs: 1000 }, { outcome: NO_ANSWER, ringMs: 1000 }]);
    const leads = await request(app).get('/leads');
    const created = await createSession(leadIdsFrom(leads, 2));
    await request(app).post(`/sessions/${created.body.id}/start`);

    clock.advance(1000);
    advance(sessionStore.get(created.body.id));

    const res = await request(app).post(`/sessions/${created.body.id}/start`);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already run/i);
  });
});

describe('GET /sessions/:id - the polling payload (R-67)', () => {
  it('carries everything Screen 2 needs in one response', async () => {
    useScript([
      { outcome: CONNECTED, ringMs: 1000, talkMs: 5000 },
      { outcome: NO_ANSWER, ringMs: 9000 },
      { outcome: BUSY, ringMs: 9000 },
      { outcome: VOICEMAIL, ringMs: 9000 },
    ]);
    const leads = await request(app).get('/leads');
    const created = await createSession(leadIdsFrom(leads, 4));
    await request(app).post(`/sessions/${created.body.id}/start`);

    clock.advance(1000);
    advance(sessionStore.get(created.body.id)); // one answers, the other cancels

    const res = await request(app).get(`/sessions/${created.body.id}`);
    expect(res.status).toBe(200);

    // session + metrics
    expect(res.body.status).toBe('RUNNING');
    expect(res.body.metrics).toEqual({ attempted: 2, connected: 0, failed: 0, canceled: 1 });

    // always exactly 2 line slots, idle ones present as null (R-84, R-96)
    expect(res.body.lines).toHaveLength(2);
    const live = res.body.lines.find((l) => l.call)?.call;
    expect(live.phase).toBe('LIVE');
    expect(live.status).toBeNull(); // a LIVE call has no final status yet (D-03)
    expect(live.lead.name).toBeTruthy();
    expect(live.lead.phone).toBeTruthy();

    // winner (R-87)
    expect(res.body.winnerCallId).toBe(live.id);
    expect(res.body.winnerCall.id).toBe(live.id);

    // per-call CRM activity status (R-88)
    expect(live.crmActivity.state).toBe('pending');
    expect(live.crmActivity.activityId).toBeNull();
    const cancelled = res.body.completedCalls[0];
    expect(cancelled.status).toBe('CANCELED_BY_DIALER');
    expect(cancelled.crmActivity.state).toBe('created');
    expect(cancelled.crmActivity.activityId).toBeTruthy();

    // queue progress, so advancement is observable (R-95)
    expect(res.body.queue).toMatchObject({ total: 4, dialed: 2, remaining: 2 });
  });

  it('returns 404 for an unknown session id, so the client can recover (R-68, R-93)', async () => {
    const res = await request(app).get('/sessions/sess-gone');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/Unknown session/);
  });
});

describe('the three SPECIFIED CRM endpoints, at their literal paths (R-60, R-61, R-62)', () => {
  async function runToCompletion(leadCount, plans) {
    useScript(plans);
    const leads = await request(app).get('/leads');
    const ids = leadIdsFrom(leads, leadCount);
    const created = await createSession(ids);
    await request(app).post(`/sessions/${created.body.id}/start`);
    const session = sessionStore.get(created.body.id);
    for (let i = 0; i < 80; i += 1) {
      clock.advance(250);
      advance(session);
    }
    return { sessionId: created.body.id, leadIds: ids };
  }

  it('GET /mock-crm/contacts returns one contact per lead attempted', async () => {
    const { leadIds } = await runToCompletion(4, [
      { outcome: NO_ANSWER, ringMs: 1000 },
      { outcome: BUSY, ringMs: 1000 },
      { outcome: VOICEMAIL, ringMs: 1000 },
      { outcome: BUSY, ringMs: 1000 },
    ]);

    const res = await request(app).get('/mock-crm/contacts');
    expect(res.status).toBe(200);
    expect(res.body.contacts).toHaveLength(4);
    expect(new Set(res.body.contacts.map((c) => c.leadId))).toEqual(new Set(leadIds));
  });

  it('GET /mock-crm/activities returns exactly one activity per call', async () => {
    const { sessionId } = await runToCompletion(5, [
      { outcome: NO_ANSWER, ringMs: 1000 },
      { outcome: CONNECTED, ringMs: 1200, talkMs: 3000 },
      { outcome: BUSY, ringMs: 1000 },
      { outcome: VOICEMAIL, ringMs: 1000 },
      { outcome: BUSY, ringMs: 1000 },
    ]);

    const session = await request(app).get(`/sessions/${sessionId}`);
    const res = await request(app).get('/mock-crm/activities');

    expect(res.status).toBe(200);
    // The cross-check a reviewer performs by hand: activities == attempted.
    expect(res.body.activities).toHaveLength(session.body.metrics.attempted);
    expect(new Set(res.body.activities.map((a) => a.callId)).size).toBe(
      res.body.activities.length,
    );
  });

  it('GET /leads/:id/crm-activities returns only that lead\'s activities', async () => {
    const { leadIds } = await runToCompletion(4, [
      { outcome: NO_ANSWER, ringMs: 1000 },
      { outcome: BUSY, ringMs: 1000 },
      { outcome: VOICEMAIL, ringMs: 1000 },
      { outcome: BUSY, ringMs: 1000 },
    ]);

    const res = await request(app).get(`/leads/${leadIds[0]}/crm-activities`);
    expect(res.status).toBe(200);
    expect(res.body.activities).toHaveLength(1);
    expect(res.body.activities[0].leadId).toBe(leadIds[0]);
    expect(res.body.crmExternalId).toBeTruthy();

    const other = await request(app).get(`/leads/${leadIds[1]}/crm-activities`);
    expect(other.body.activities[0].leadId).toBe(leadIds[1]);
    expect(other.body.activities[0].id).not.toBe(res.body.activities[0].id);
  });

  it('GET /leads/:id/crm-activities returns 404 for an unknown lead', async () => {
    const res = await request(app).get('/leads/lead-nope/crm-activities');
    expect(res.status).toBe(404);
  });

  it('the app store and the mock CRM store agree call-for-call', async () => {
    const { leadIds } = await runToCompletion(4, [
      { outcome: NO_ANSWER, ringMs: 1000 },
      { outcome: CONNECTED, ringMs: 1000, talkMs: 2000 },
      { outcome: BUSY, ringMs: 1000 },
      { outcome: VOICEMAIL, ringMs: 1000 },
    ]);

    const crm = await request(app).get('/mock-crm/activities');
    const perLead = await Promise.all(
      leadIds.map((id) => request(app).get(`/leads/${id}/crm-activities`)),
    );
    const appActivityIds = perLead.flatMap((r) => r.body.activities.map((a) => a.id));

    expect(new Set(appActivityIds)).toEqual(new Set(crm.body.activities.map((a) => a.id)));
  });
});

describe('CORS for the Vite dev origin (R-69)', () => {
  it('sends an allow-origin header', async () => {
    const res = await request(app).get('/leads').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });
});
