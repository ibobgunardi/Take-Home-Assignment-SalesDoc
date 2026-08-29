// Sequential, prefixed ids. Deterministic on purpose: with a fixed simulator
// seed (D-13) a demo replays identically, and tests can assert on ids.
const counters = new Map();

export function nextId(prefix) {
  const n = (counters.get(prefix) ?? 0) + 1;
  counters.set(prefix, n);
  return `${prefix}-${n}`;
}

export function resetIds() {
  counters.clear();
}
