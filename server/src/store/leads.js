// In-memory lead store (D-10). The spec explicitly permits in-memory storage.
const leads = new Map();

export function put(lead) {
  leads.set(lead.id, lead);
  return lead;
}

export function get(id) {
  return leads.get(id) ?? null;
}

export function list() {
  return [...leads.values()];
}

export function clear() {
  leads.clear();
}
