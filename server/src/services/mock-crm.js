/**
 * The mock CRM (D-12).
 *
 * It stands in for an external CRM system: it owns its own store, and nothing
 * outside this module touches that store. The dialer and crm-sync go through
 * these functions only. The three specified GET routes are thin readers over
 * the same data.
 *
 * Calls are in-process function calls, not HTTP requests to our own server.
 * An app that HTTP-calls itself would put an `await` in the middle of the
 * terminal transition, which is precisely what D-09 forbids - and that `await`
 * is what would let INV-1 and INV-2 break.
 */
import { nextId } from '../models/ids.js';

const contacts = new Map();
const activities = new Map();
/** leadId -> contactId, so an upsert can find an existing contact (R-50). */
const contactIdByLead = new Map();

/**
 * D-01: create a contact when the lead has no crmExternalId, otherwise update
 * the existing one. Either way exactly one contact per lead (R-50).
 */
export function upsertContact(lead, now) {
  const existingId = lead.crmExternalId ?? contactIdByLead.get(lead.id) ?? null;

  if (existingId && contacts.has(existingId)) {
    const contact = contacts.get(existingId);
    contact.name = lead.name;
    contact.company = lead.company;
    contact.phone = lead.phone;
    contact.email = lead.email;
    contact.updatedAt = now;
    return contact;
  }

  const contact = {
    id: nextId('contact'),
    leadId: lead.id,
    name: lead.name,
    company: lead.company,
    phone: lead.phone,
    email: lead.email,
    createdAt: now,
    updatedAt: now,
  };
  contacts.set(contact.id, contact);
  contactIdByLead.set(lead.id, contact.id);
  return contact;
}

export function createActivity(activity) {
  activities.set(activity.id, { ...activity });
  return activities.get(activity.id);
}

export function listContacts() {
  return [...contacts.values()];
}

export function listActivities() {
  return [...activities.values()];
}

export function listActivitiesByCall(callId) {
  return [...activities.values()].filter((a) => a.callId === callId);
}

export function clear() {
  contacts.clear();
  activities.clear();
  contactIdByLead.clear();
}
