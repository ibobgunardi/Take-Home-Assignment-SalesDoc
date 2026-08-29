// The APP's own CRMActivity store. Deliberately separate from the mock CRM's
// store (services/mock-crm) - the spec requires the activity to be saved in
// both, so they must genuinely be two stores (R-40, R-44, R-45).
const activities = new Map();

export function put(activity) {
  activities.set(activity.id, activity);
  return activity;
}

export function list() {
  return [...activities.values()];
}

export function listByLead(leadId) {
  return [...activities.values()].filter((a) => a.leadId === leadId);
}

export function listByCall(callId) {
  return [...activities.values()].filter((a) => a.callId === callId);
}

export function clear() {
  activities.clear();
}
