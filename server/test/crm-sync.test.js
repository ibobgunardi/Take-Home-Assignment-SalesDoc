import { describe, it, expect, beforeEach } from 'vitest';
import { seed } from '../src/seed.js';
import { CALL_STATUS, CALL_PHASE, createCall } from '../src/models/call.js';
import { syncTerminalCall, getActivityForCall } from '../src/services/crm-sync.js';
import * as leadStore from '../src/store/leads.js';
import * as appActivityStore from '../src/store/crm-activities.js';
import * as mockCrm from '../src/services/mock-crm.js';

const ALL_STATUSES = Object.values(CALL_STATUS);

function endedCall(leadId, status, { startedAt = 0, endedAt = 4000, answeredAt = null } = {}) {
  const call = createCall({ leadId, sessionId: 'sess-1', providerCallId: 'prov-1', startedAt });
  call.phase = CALL_PHASE.ENDED;
  call.status = status;
  call.endedAt = endedAt;
  call.answeredAt = answeredAt;
  return call;
}

beforeEach(() => seed());

describe('CRM sync - contact upsert (R-41, R-42, R-50, D-01)', () => {
  it('creates a contact when the lead has no crmExternalId, and writes the id back', () => {
    const lead = leadStore.list()[0];
    expect(lead.crmExternalId).toBeNull();

    const activity = syncTerminalCall(endedCall(lead.id, CALL_STATUS.NO_ANSWER), 1000);

    const contacts = mockCrm.listContacts();
    expect(contacts).toHaveLength(1);
    expect(lead.crmExternalId).toBe(contacts[0].id);
    expect(activity.crmExternalId).toBe(contacts[0].id);
  });

  it('updates the existing contact on a later call - never a second contact', () => {
    const lead = leadStore.list()[0];
    syncTerminalCall(endedCall(lead.id, CALL_STATUS.BUSY), 1000);
    const firstContactId = lead.crmExternalId;

    lead.name = 'Amelia Hartono-Wijaya';
    syncTerminalCall(endedCall(lead.id, CALL_STATUS.NO_ANSWER), 2000);

    const contacts = mockCrm.listContacts();
    expect(contacts).toHaveLength(1);
    expect(contacts[0].id).toBe(firstContactId);
    expect(contacts[0].name).toBe('Amelia Hartono-Wijaya');
    expect(contacts[0].updatedAt).toBe(2000);
  });

  it('keeps one contact per lead across several leads', () => {
    const leads = leadStore.list().slice(0, 3);
    leads.forEach((lead, i) => syncTerminalCall(endedCall(lead.id, CALL_STATUS.BUSY), 1000 + i));
    leads.forEach((lead, i) => syncTerminalCall(endedCall(lead.id, CALL_STATUS.VOICEMAIL), 2000 + i));
    expect(mockCrm.listContacts()).toHaveLength(3);
  });
});

describe('CRM sync - activity creation (R-43, R-44, R-45, R-48, R-49)', () => {
  it('writes the activity to the app store AND the mock CRM store', () => {
    const lead = leadStore.list()[0];
    const activity = syncTerminalCall(endedCall(lead.id, CALL_STATUS.VOICEMAIL), 1000);

    expect(appActivityStore.list()).toHaveLength(1);
    expect(mockCrm.listActivities()).toHaveLength(1);
    expect(appActivityStore.list()[0].id).toBe(activity.id);
    expect(mockCrm.listActivities()[0].id).toBe(activity.id);
  });

  it('sets disposition to the Call_Status and writes non-empty notes', () => {
    const lead = leadStore.list()[0];
    const activity = syncTerminalCall(endedCall(lead.id, CALL_STATUS.NO_ANSWER), 1000);
    expect(activity.disposition).toBe(CALL_STATUS.NO_ANSWER);
    expect(activity.type).toBe('CALL');
    expect(activity.notes).toContain(lead.name);
    expect(activity.notes).toContain(CALL_STATUS.NO_ANSWER);
    expect(activity.notes.length).toBeGreaterThan(10);
  });

  it.each(ALL_STATUSES)('produces exactly one activity for terminal status %s (D-05)', (status) => {
    const lead = leadStore.list()[0];
    syncTerminalCall(endedCall(lead.id, status), 1000);
    expect(appActivityStore.list()).toHaveLength(1);
    expect(mockCrm.listActivities()).toHaveLength(1);
    expect(appActivityStore.list()[0].disposition).toBe(status);
  });
});

describe('INVARIANT 2 - one callId, at most one CRMActivity (R-46, R-47)', () => {
  it.each(ALL_STATUSES)(
    'handling the same terminal event 3x leaves exactly 1 activity in each store - %s',
    (status) => {
      const lead = leadStore.list()[0];
      const call = endedCall(lead.id, status);

      const first = syncTerminalCall(call, 1000);
      const second = syncTerminalCall(call, 2000);
      const third = syncTerminalCall(call, 3000);

      expect(second).toBe(first);
      expect(third).toBe(first);

      expect(appActivityStore.listByCall(call.id)).toHaveLength(1);
      expect(mockCrm.listActivitiesByCall(call.id)).toHaveLength(1);
      expect(appActivityStore.list()).toHaveLength(1);
      expect(mockCrm.listActivities()).toHaveLength(1);
      expect(mockCrm.listContacts()).toHaveLength(1);
    },
  );

  it('writes nothing at all on a repeat - the contact is not even touched', () => {
    const lead = leadStore.list()[0];
    const call = endedCall(lead.id, CALL_STATUS.CONNECTED, { answeredAt: 2000 });

    syncTerminalCall(call, 1000);
    const contactAfterFirst = { ...mockCrm.listContacts()[0] };

    lead.name = 'Changed After First Sync';
    syncTerminalCall(call, 9999);

    // If the repeat had fallen through to upsertContact, updatedAt and name
    // would have changed. They must not.
    expect(mockCrm.listContacts()[0]).toEqual(contactAfterFirst);
  });

  it('keys idempotency on callId, so two different calls for one lead give two activities', () => {
    const lead = leadStore.list()[0];
    const a = endedCall(lead.id, CALL_STATUS.BUSY);
    const b = endedCall(lead.id, CALL_STATUS.NO_ANSWER);

    syncTerminalCall(a, 1000);
    syncTerminalCall(b, 2000);

    expect(appActivityStore.list()).toHaveLength(2);
    expect(mockCrm.listActivities()).toHaveLength(2);
    expect(mockCrm.listContacts()).toHaveLength(1);
  });

  it('exposes the activity for a call, for the per-call CRM status on Screen 2 (R-88)', () => {
    const lead = leadStore.list()[0];
    const call = endedCall(lead.id, CALL_STATUS.BUSY);
    expect(getActivityForCall(call.id)).toBeNull();
    const activity = syncTerminalCall(call, 1000);
    expect(getActivityForCall(call.id)).toBe(activity);
  });
});
