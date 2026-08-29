import { describe, it, expect, beforeEach } from 'vitest';
import { CALL_STATUS, CALL_PHASE, createCall } from '../src/models/call.js';
import { SESSION_STATUS, createSession } from '../src/models/session.js';
import { createLead } from '../src/models/lead.js';
import { createCrmActivity } from '../src/models/crm-activity.js';
import { seed } from '../src/seed.js';
import * as leadStore from '../src/store/leads.js';
import { CONCURRENCY } from '../src/config.js';

beforeEach(() => seed());

describe('Lead (R-01, R-02)', () => {
  it('has every specified field', () => {
    const lead = createLead({ name: 'A', company: 'B', phone: 'C', email: 'D' });
    expect(Object.keys(lead).sort()).toEqual(
      ['company', 'crmExternalId', 'email', 'id', 'name', 'phone'].sort(),
    );
  });

  it('starts with no crmExternalId', () => {
    expect(createLead({ name: 'A' }).crmExternalId).toBeNull();
  });
});

describe('Call (R-03, R-04, R-05)', () => {
  it('has every specified field', () => {
    const call = createCall({ leadId: 'lead-1', sessionId: 'sess-1', providerCallId: 'p1', startedAt: 0 });
    for (const field of ['id', 'leadId', 'sessionId', 'status', 'startedAt', 'endedAt', 'providerCallId']) {
      expect(call).toHaveProperty(field);
    }
  });

  it('Call_Status has exactly the five specified values', () => {
    expect(Object.values(CALL_STATUS).sort()).toEqual(
      ['BUSY', 'CANCELED_BY_DIALER', 'CONNECTED', 'NO_ANSWER', 'VOICEMAIL'],
    );
  });

  it('never puts a phase value inside Call_Status', () => {
    for (const phase of Object.values(CALL_PHASE)) {
      expect(Object.values(CALL_STATUS)).not.toContain(phase);
    }
  });

  it('starts DIALING with a null status and no endedAt', () => {
    const call = createCall({ leadId: 'lead-1', sessionId: 'sess-1', providerCallId: 'p1', startedAt: 0 });
    expect(call.phase).toBe(CALL_PHASE.DIALING);
    expect(call.status).toBeNull();
    expect(call.endedAt).toBeNull();
  });
});

describe('DialerSession (R-07, R-08, R-09, R-10)', () => {
  const build = () => createSession({ agentId: 'agent-1', leadIds: ['lead-1', 'lead-2'], now: 0 });

  it('has every specified field', () => {
    const s = build();
    for (const field of ['id', 'agentId', 'leadQueue', 'activeCallIds', 'winnerCallId', 'status', 'metrics']) {
      expect(s).toHaveProperty(field);
    }
  });

  it('fixes concurrency to 2', () => {
    expect(CONCURRENCY).toBe(2);
    expect(build().concurrency).toBe(2);
  });

  it('session status has exactly the two specified values', () => {
    expect(Object.values(SESSION_STATUS).sort()).toEqual(['RUNNING', 'STOPPED']);
  });

  it('starts STOPPED with startedAt null - created but not started (D-14)', () => {
    const s = build();
    expect(s.status).toBe(SESSION_STATUS.STOPPED);
    expect(s.startedAt).toBeNull();
  });

  it('has all four metrics at zero', () => {
    expect(build().metrics).toEqual({ attempted: 0, connected: 0, failed: 0, canceled: 0 });
  });

  it('preserves the selection order in leadQueue (R-21)', () => {
    const s = createSession({ agentId: 'a', leadIds: ['lead-3', 'lead-1', 'lead-2'], now: 0 });
    expect(s.leadQueue).toEqual(['lead-3', 'lead-1', 'lead-2']);
  });
});

describe('CRMActivity (R-11)', () => {
  it('has every specified field', () => {
    const a = createCrmActivity({
      leadId: 'lead-1', crmExternalId: 'contact-1', callId: 'call-1',
      disposition: CALL_STATUS.BUSY, notes: 'n', createdAt: 0,
    });
    expect(Object.keys(a).sort()).toEqual(
      ['callId', 'createdAt', 'crmExternalId', 'disposition', 'id', 'leadId', 'notes', 'type'].sort(),
    );
    expect(a.type).toBe('CALL');
  });
});

describe('seed (R-12, R-108c)', () => {
  it('seeds between 4 and 8 leads', () => {
    const count = leadStore.list().length;
    expect(count).toBeGreaterThanOrEqual(4);
    expect(count).toBeLessThanOrEqual(8);
  });

  it('gives every lead all five display fields', () => {
    for (const lead of leadStore.list()) {
      for (const field of ['id', 'name', 'company', 'phone', 'email']) {
        expect(lead[field]).toBeTruthy();
      }
    }
  });

  it('is idempotent - re-seeding does not duplicate leads', () => {
    const before = leadStore.list().length;
    seed();
    expect(leadStore.list().length).toBe(before);
  });
});
