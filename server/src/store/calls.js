const calls = new Map();

export function put(call) {
  calls.set(call.id, call);
  return call;
}

export function get(id) {
  return calls.get(id) ?? null;
}

export function list() {
  return [...calls.values()];
}

export function listBySession(sessionId) {
  return [...calls.values()].filter((c) => c.sessionId === sessionId);
}

export function clear() {
  calls.clear();
}
