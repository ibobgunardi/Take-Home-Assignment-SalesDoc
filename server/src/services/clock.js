// Time is injected (D-06) so tests never sleep. Domain code reads clock.now()
// and never Date.now() directly.

export function systemClock() {
  return { now: () => Date.now() };
}

export function fakeClock(startAt = 0) {
  let t = startAt;
  return {
    now: () => t,
    advance(ms) {
      t += ms;
      return t;
    },
    set(value) {
      t = value;
      return t;
    },
  };
}
