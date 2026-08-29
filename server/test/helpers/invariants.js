import { expect } from 'vitest';
import { CALL_PHASE } from '../../src/models/call.js';
import * as callStore from '../../src/store/calls.js';
import { CONCURRENCY } from '../../src/config.js';

/**
 * Call this after EVERY state transition in EVERY dialer test.
 *
 * An invariant checked in one dedicated test is a test. The same assertion
 * everywhere is a safety net that catches the bug in whichever scenario
 * actually triggers it - which is rarely the one you wrote for it.
 *
 * Assertion list: docs/test-strategy.md section 2.
 */
export function assertSessionLegal(session, label = '') {
  const where = label ? ` [${label}]` : '';
  const active = session.activeCallIds.map((id) => callStore.get(id));

  // INVARIANT 1
  expect(session.activeCallIds.length, `active call ceiling${where}`).toBeLessThanOrEqual(
    CONCURRENCY,
  );

  expect(new Set(session.activeCallIds).size, `duplicate ids in activeCallIds${where}`).toBe(
    session.activeCallIds.length,
  );

  active.forEach((call, i) => {
    expect(call, `activeCallIds[${i}] refers to a real call${where}`).toBeTruthy();
    expect(call.endedAt, `active call ${call.id} must not have ended${where}`).toBeNull();
    expect(call.phase, `active call ${call.id} must not be ENDED${where}`).not.toBe(
      CALL_PHASE.ENDED,
    );
  });

  // lineSlots is presentation-only, but it is maintained alongside
  // activeCallIds in the same synchronous steps, so any drift between them is
  // a bug in advance() - catch it here rather than as a UI oddity.
  expect(session.lineSlots.length, `always exactly 2 line slots${where}`).toBe(CONCURRENCY);
  expect(
    [...session.lineSlots].filter((id) => id !== null).sort(),
    `lineSlots agrees with activeCallIds${where}`,
  ).toEqual([...session.activeCallIds].sort());

  // phase and status must agree, on every call in the session - not just the
  // active ones. A call with a status but no endedAt (or vice versa) means the
  // terminal transition was not atomic (D-03).
  for (const call of callStore.listBySession(session.id)) {
    const ended = call.phase === CALL_PHASE.ENDED;
    expect(call.status !== null, `${call.id}: status set iff ENDED${where}`).toBe(ended);
    expect(call.endedAt !== null, `${call.id}: endedAt set iff ENDED${where}`).toBe(ended);
    if (!ended) {
      expect(call.status, `in-flight ${call.id} must have a null status${where}`).toBeNull();
    }
  }

  // At most one LIVE call, and if one exists it is the winner. The converse
  // does not hold - winnerCallId may name an ENDED call (D-18).
  const live = callStore
    .listBySession(session.id)
    .filter((c) => c.phase === CALL_PHASE.LIVE);
  expect(live.length, `at most one LIVE call${where}`).toBeLessThanOrEqual(1);
  if (live.length === 1) {
    expect(session.winnerCallId, `the LIVE call must be the winner${where}`).toBe(live[0].id);
    expect(session.activeCallIds, `the LIVE call must hold a line${where}`).toContain(live[0].id);
  }
}

/**
 * connected + failed + canceled === attempted, valid only when nothing is in
 * flight. A break here almost always means a terminal transition ran twice -
 * the same defect class as a duplicate CRM activity.
 */
export function assertMetricsBalance(session, label = '') {
  const where = label ? ` [${label}]` : '';
  const { attempted, connected, failed, canceled } = session.metrics;
  expect(connected + failed + canceled, `metrics balance${where}`).toBe(attempted);
  expect(attempted, `attempted equals calls created${where}`).toBe(
    callStore.listBySession(session.id).length,
  );
}
