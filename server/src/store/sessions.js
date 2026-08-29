const sessions = new Map();

export function put(session) {
  sessions.set(session.id, session);
  return session;
}

export function get(id) {
  return sessions.get(id) ?? null;
}

export function list() {
  return [...sessions.values()];
}

export function clear() {
  sessions.clear();
}
