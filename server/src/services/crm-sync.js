import { createCrmActivity } from '../models/crm-activity.js';
import * as leadStore from '../store/leads.js';
import * as appActivityStore from '../store/crm-activities.js';
import * as mockCrm from './mock-crm.js';

/**
 * INVARIANT 2 - one callId produces at most one CRMActivity, in the app store
 * AND in the mock CRM store, however many times the terminal event is handled.
 *
 * Terminal handling can legitimately run more than once: a stop that
 * re-terminates a call, a retry, a duplicated timer. The system absorbs that
 * here rather than asking every caller to be careful.
 *
 * The guarantee has two halves:
 *
 *   1. The index is checked BEFORE any write, so a repeat returns the existing
 *      activity and writes nothing to either store.
 *   2. Both stores are written, and the index set, in one synchronous block
 *      with no `await` between them. A partial write - present in one store,
 *      missing from the other - is the exact failure this invariant exists to
 *      prevent, and an await is the only thing that could produce it.
 */
const activityByCallId = new Map();

export function syncTerminalCall(call, now) {
  const existing = activityByCallId.get(call.id);
  if (existing) return existing;

  const lead = leadStore.get(call.leadId);
  if (!lead) {
    throw new Error(`cannot sync call ${call.id}: lead ${call.leadId} not found`);
  }

  // D-01: create when the lead has no crmExternalId, otherwise update. Either
  // branch leaves exactly one contact per lead (R-50).
  const contact = mockCrm.upsertContact(lead, now);
  lead.crmExternalId = contact.id;

  const activity = createCrmActivity({
    leadId: lead.id,
    crmExternalId: contact.id,
    callId: call.id,
    disposition: call.status,
    notes: buildNotes(call, lead),
    createdAt: now,
  });

  appActivityStore.put(activity);
  mockCrm.createActivity(activity);
  activityByCallId.set(call.id, activity);

  return activity;
}

/** What the UI shows per call/lead on Screen 2 (R-88). */
export function getActivityForCall(callId) {
  return activityByCallId.get(callId) ?? null;
}

export function clear() {
  activityByCallId.clear();
}

function buildNotes(call, lead) {
  const seconds = call.endedAt !== null && call.startedAt !== null
    ? ((call.endedAt - call.startedAt) / 1000).toFixed(1)
    : '0.0';
  const talked = call.answeredAt !== null ? ' Call was answered.' : '';
  return `Outbound call to ${lead.name} at ${lead.company}. Disposition: ${call.status}. Duration ${seconds}s.${talked}`;
}
