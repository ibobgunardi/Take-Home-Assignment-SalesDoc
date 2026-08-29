import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { seed } from '../src/seed.js';
import { CALL_STATUS, CALL_PHASE } from '../src/models/call.js';
import { SESSION_STATUS, COMPLETION_REASON } from '../src/models/session.js';
import {
  createDialerSession,
  startSession,
  stopSession,
  advance,
  configureDialer,
  resetDialer,
  isTicking,
} from '../src/services/dialer.js';
import { createScriptedSimulator } from '../src/services/simulator.js';
import { fakeClock } from '../src/services/clock.js';
import * as callStore from '../src/store/calls.js';
import * as leadStore from '../src/store/leads.js';
import * as appActivityStore from '../src/store/crm-activities.js';
import * as mockCrm from '../src/services/mock-crm.js';
import { assertSessionLegal, assertMetricsBalance } from './helpers/invariants.js';

const { CONNECTED, NO_ANSWER, BUSY, VOICEMAIL, CANCELED_BY_DIALER } = CALL_STATUS;

let clock;
let leadIds;

/**
 * Every test drives advance() directly against a fake clock. The per-session
 * setInterval is never started (autoTick: false, R-39a), so "same tick" is
 * produced deliberately - by making two events fall due before one advance()
 * call - rather than by hoping two real timers coincide.
 */
function setup(plans, { leadCount = plans.length } = {}) {
  clock = fakeClock(10_000);
  configureDialer({
    clock,
    simulator: createScriptedSimulator(plans),
    autoTick: false,
  });
  leadIds = leadStore.list().slice(0, leadCount).map((l) => l.id);
  return createDialerSession({ agentId: 'agent-1', leadIds });
}

/** Move time forward, then apply what fell due. */
function tick(session, ms) {
  clock.advance(ms);
  advance(session);
  assertSessionLegal(session, `after +${ms}ms`);
  return session;
}

const callsOf = (session) => session.callIds.map((id) => callStore.get(id));
const activeCalls = (session) => session.activeCallIds.map((id) => callStore.get(id));

beforeEach(() => {
  seed();
  resetDialer();
});
afterEach(() => resetDialer());

// ---------------------------------------------------------------------------

describe('session creation (R-21, R-27, R-36, R-38)', () => {
  it('rejects an empty selection with a validation error (D-11)', () => {
    configureDialer({ clock: fakeClock(0), simulator: createScriptedSimulator([]), autoTick: false });
    expect(() => createDialerSession({ agentId: 'agent-1', leadIds: [] })).toThrow(
      /at least one lead/i,
    );
  });

  it('rejects unknown lead ids rather than creating a broken session', () => {
    configureDialer({ clock: fakeClock(0), simulator: createScriptedSimulator([]), autoTick: false });
    expect(() => createDialerSession({ leadIds: ['lead-does-not-exist'] })).toThrow(/Unknown lead/);
  });

  it('preserves the selection order in leadQueue', () => {
    const session = setup([{ outcome: BUSY }, { outcome: BUSY }, { outcome: BUSY }]);
    expect(session.leadQueue).toEqual(leadIds);
  });

  it('is STOPPED with startedAt null before it is started (D-14)', () => {
    const session = setup([{ outcome: BUSY }, { outcome: BUSY }]);
    expect(session.status).toBe(SESSION_STATUS.STOPPED);
    expect(session.startedAt).toBeNull();
    expect(session.activeCallIds).toEqual([]);
    assertSessionLegal(session, 'created, not started');
  });

  it('defaults agentId to the seeded demo agent when absent (D-14)', () => {
    clock = fakeClock(0);
    configureDialer({ clock, simulator: createScriptedSimulator([]), autoTick: false });
    const session = createDialerSession({ leadIds: [leadStore.list()[0].id] });
    expect(session.agentId).toBe('agent-1');
  });
});

// ---------------------------------------------------------------------------

describe('INVARIANT 1 - the concurrency ceiling (R-20, R-22, R-24, R-26)', () => {
  it('start dials exactly 2 of 5 leads - not 1, not 3', () => {
    const session = setup(Array.from({ length: 5 }, () => ({ outcome: NO_ANSWER, ringMs: 3000 })));
    startSession(session);
    assertSessionLegal(session, 'immediately after start');
    expect(session.activeCallIds).toHaveLength(2);
    expect(session.leadQueue).toHaveLength(3);
    expect(session.metrics.attempted).toBe(2);
  });

  it('never exceeds 2 active calls across a whole 6-lead run', () => {
    const session = setup([
      { outcome: NO_ANSWER, ringMs: 1000 },
      { outcome: BUSY, ringMs: 2000 },
      { outcome: CONNECTED, ringMs: 1000, talkMs: 3000 },
      { outcome: VOICEMAIL, ringMs: 1500 },
      { outcome: BUSY, ringMs: 1000 },
      { outcome: NO_ANSWER, ringMs: 1000 },
    ]);
    startSession(session);
    assertSessionLegal(session, 'start');

    for (let i = 0; i < 60; i += 1) {
      tick(session, 250);
      expect(session.activeCallIds.length).toBeLessThanOrEqual(2);
    }

    expect(session.status).toBe(SESSION_STATUS.STOPPED);
    assertMetricsBalance(session, 'end of run');
  });

  it('TWO CALLS TERMINAL IN THE SAME TICK promote exactly two, never three', () => {
    // Both first-round calls end at exactly +1000ms, so both fall due before a
    // single advance(). This is the classic 3-active bug.
    const session = setup([
      { outcome: NO_ANSWER, ringMs: 1000 },
      { outcome: BUSY, ringMs: 1000 },
      { outcome: NO_ANSWER, ringMs: 5000 },
      { outcome: BUSY, ringMs: 5000 },
      { outcome: NO_ANSWER, ringMs: 5000 },
    ]);
    startSession(session);
    const firstRound = [...session.activeCallIds];

    tick(session, 1000);

    expect(session.activeCallIds).toHaveLength(2);
    expect(session.activeCallIds).not.toContain(firstRound[0]);
    expect(session.activeCallIds).not.toContain(firstRound[1]);
    expect(session.metrics.attempted).toBe(4);
    expect(session.leadQueue).toHaveLength(1);

    // Both terminal calls synced exactly once each.
    expect(appActivityStore.list()).toHaveLength(2);
    expect(mockCrm.listActivities()).toHaveLength(2);
  });

  it('one selected lead gives exactly one active call, leaving a line idle (R-26)', () => {
    const session = setup([{ outcome: NO_ANSWER, ringMs: 1000 }]);
    startSession(session);
    assertSessionLegal(session, 'single lead');
    expect(session.activeCallIds).toHaveLength(1);

    tick(session, 1000);
    expect(session.activeCallIds).toHaveLength(0);
    expect(session.status).toBe(SESSION_STATUS.STOPPED);
    assertMetricsBalance(session, 'single lead complete');
  });

  it('two selected leads fill both lines and leave an empty queue', () => {
    const session = setup([
      { outcome: BUSY, ringMs: 1000 },
      { outcome: BUSY, ringMs: 1000 },
    ]);
    startSession(session);
    expect(session.activeCallIds).toHaveLength(2);
    expect(session.leadQueue).toHaveLength(0);
    assertSessionLegal(session, 'two leads');
  });
});

// ---------------------------------------------------------------------------

describe('queue advancement (R-23, R-25, R-31a, R-31b)', () => {
  it('a terminal call frees its line and promotes the next queued lead', () => {
    const session = setup([
      { outcome: NO_ANSWER, ringMs: 1000 },
      { outcome: BUSY, ringMs: 9000 },
      { outcome: VOICEMAIL, ringMs: 9000 },
    ]);
    startSession(session);
    const [first, second] = session.activeCallIds;

    tick(session, 1000);

    expect(session.activeCallIds).toHaveLength(2);
    expect(session.activeCallIds).toContain(second);
    expect(session.activeCallIds).not.toContain(first);
    expect(session.leadQueue).toHaveLength(0);
    expect(callStore.get(first).status).toBe(NO_ANSWER);
  });

  it('an exhausted queue promotes nothing, does not loop, and ends STOPPED', () => {
    const session = setup([
      { outcome: BUSY, ringMs: 1000 },
      { outcome: BUSY, ringMs: 1000 },
    ]);
    startSession(session);
    tick(session, 1000);

    expect(session.status).toBe(SESSION_STATUS.STOPPED);
    expect(session.completionReason).toBe(COMPLETION_REASON.QUEUE_EXHAUSTED);
    expect(session.activeCallIds).toHaveLength(0);
    expect(session.winnerCallId).toBeNull();

    // Ticking a finished session is a harmless no-op.
    tick(session, 1000);
    tick(session, 1000);
    expect(callsOf(session)).toHaveLength(2);
    assertMetricsBalance(session, 'exhausted');
  });

  it('dials every selected lead even when one connects mid-run (R-31a, R-31b)', () => {
    const session = setup([
      { outcome: NO_ANSWER, ringMs: 1000 },
      { outcome: CONNECTED, ringMs: 1500, talkMs: 4000 },
      { outcome: BUSY, ringMs: 1000 },
      { outcome: VOICEMAIL, ringMs: 1000 },
      { outcome: NO_ANSWER, ringMs: 1000 },
    ]);
    startSession(session);
    for (let i = 0; i < 60; i += 1) tick(session, 250);

    expect(session.status).toBe(SESSION_STATUS.STOPPED);
    expect(callsOf(session)).toHaveLength(5);
    expect(new Set(callsOf(session).map((c) => c.leadId)).size).toBe(5);
    expect(session.metrics.connected).toBeGreaterThanOrEqual(1);
    assertMetricsBalance(session, 'all leads dialed');
  });
});

// ---------------------------------------------------------------------------

describe('the winner (R-28, R-29, R-30, R-31, D-02, D-03, D-18)', () => {
  it('sets winnerCallId at the ANSWER moment, while the call is still LIVE', () => {
    const session = setup([
      { outcome: CONNECTED, ringMs: 1000, talkMs: 5000 },
      { outcome: NO_ANSWER, ringMs: 9000 },
      { outcome: BUSY, ringMs: 9000 },
    ]);
    startSession(session);
    const winnerId = session.activeCallIds[0];
    expect(session.winnerCallId).toBeNull();

    tick(session, 1000);

    const winner = callStore.get(winnerId);
    expect(session.winnerCallId).toBe(winnerId);
    expect(winner.phase).toBe(CALL_PHASE.LIVE);
    expect(winner.answeredAt).toBe(clock.now());
    // A LIVE call has NOT ended: no status, no endedAt, no CRM activity yet.
    expect(winner.status).toBeNull();
    expect(winner.endedAt).toBeNull();
    expect(appActivityStore.listByCall(winnerId)).toHaveLength(0);
    expect(session.metrics.connected).toBe(0);
  });

  it('cancels the other in-flight line the moment a call is answered', () => {
    const session = setup([
      { outcome: CONNECTED, ringMs: 1000, talkMs: 5000 },
      { outcome: NO_ANSWER, ringMs: 9000 },
      { outcome: BUSY, ringMs: 9000 },
    ]);
    startSession(session);
    const [winnerId, loserId] = session.activeCallIds;

    tick(session, 1000);

    const loser = callStore.get(loserId);
    expect(loser.phase).toBe(CALL_PHASE.ENDED);
    expect(loser.status).toBe(CANCELED_BY_DIALER);
    expect(session.metrics.canceled).toBe(1);
    expect(session.activeCallIds).toEqual([winnerId]);
    // The cancelled call is still recorded in the CRM (D-05).
    expect(appActivityStore.listByCall(loserId)).toHaveLength(1);
  });

  it('TWO ANSWERS IN THE SAME TICK: exactly one goes LIVE, the other is CANCELED_BY_DIALER', () => {
    const session = setup([
      { outcome: CONNECTED, ringMs: 1000, talkMs: 5000 },
      { outcome: CONNECTED, ringMs: 1000, talkMs: 5000 },
      { outcome: BUSY, ringMs: 9000 },
    ]);
    startSession(session);
    const [firstId, secondId] = session.activeCallIds;

    tick(session, 1000);

    const first = callStore.get(firstId);
    const second = callStore.get(secondId);

    expect(first.phase).toBe(CALL_PHASE.LIVE);
    expect(session.winnerCallId).toBe(firstId);

    // The loser must never have reached LIVE, and must not end CONNECTED -
    // that would double-count the connect and misreport the disposition.
    expect(second.phase).toBe(CALL_PHASE.ENDED);
    expect(second.status).toBe(CANCELED_BY_DIALER);
    expect(second.answeredAt).toBeNull();
    expect(session.metrics.connected).toBe(0);
    expect(session.metrics.canceled).toBe(1);
  });

  it('promotes nothing while the winner is LIVE', () => {
    const session = setup([
      { outcome: CONNECTED, ringMs: 1000, talkMs: 5000 },
      { outcome: NO_ANSWER, ringMs: 9000 },
      { outcome: BUSY, ringMs: 1000 },
      { outcome: BUSY, ringMs: 1000 },
    ]);
    startSession(session);
    tick(session, 1000);

    expect(session.leadQueue).toHaveLength(2);
    for (let i = 0; i < 10; i += 1) {
      tick(session, 250);
      expect(session.activeCallIds).toHaveLength(1);
      expect(session.leadQueue).toHaveLength(2);
    }
  });

  it('winner ends CONNECTED, dialing resumes, and winnerCallId still names it (D-18)', () => {
    const session = setup([
      { outcome: CONNECTED, ringMs: 1000, talkMs: 3000 },
      { outcome: NO_ANSWER, ringMs: 9000 },
      { outcome: BUSY, ringMs: 1000 },
      { outcome: VOICEMAIL, ringMs: 1000 },
    ]);
    startSession(session);
    const winnerId = session.activeCallIds[0];

    tick(session, 1000); // answered
    tick(session, 3000); // hung up

    const winner = callStore.get(winnerId);
    expect(winner.phase).toBe(CALL_PHASE.ENDED);
    expect(winner.status).toBe(CONNECTED);
    expect(winner.endedAt).not.toBeNull();
    expect(session.metrics.connected).toBe(1);
    expect(appActivityStore.listByCall(winnerId)).toHaveLength(1);

    // Not cleared - it keeps naming the most recent connect (D-18).
    expect(session.winnerCallId).toBe(winnerId);

    // And the next round was promoted: the gate is "no LIVE call", not
    // "winnerCallId is null".
    expect(session.activeCallIds).toHaveLength(2);
    expect(session.status).toBe(SESSION_STATUS.RUNNING);
  });

  it('a later answer replaces winnerCallId', () => {
    const session = setup([
      { outcome: CONNECTED, ringMs: 1000, talkMs: 2000 },
      { outcome: NO_ANSWER, ringMs: 9000 },
      { outcome: CONNECTED, ringMs: 1000, talkMs: 2000 },
      { outcome: NO_ANSWER, ringMs: 9000 },
    ]);
    startSession(session);
    tick(session, 1000);
    const firstWinner = session.winnerCallId;

    tick(session, 2000); // first winner hangs up, round 2 promoted
    tick(session, 1000); // second call answers

    expect(session.winnerCallId).not.toBe(firstWinner);
    expect(callStore.get(session.winnerCallId).phase).toBe(CALL_PHASE.LIVE);
    expect(session.metrics.connected).toBe(1);
  });

  it('winnerCallId stays populated after the session finishes, so the panel is not empty', () => {
    const session = setup([
      { outcome: CONNECTED, ringMs: 1000, talkMs: 2000 },
      { outcome: NO_ANSWER, ringMs: 9000 },
    ]);
    startSession(session);
    for (let i = 0; i < 40; i += 1) tick(session, 250);

    expect(session.status).toBe(SESSION_STATUS.STOPPED);
    expect(session.winnerCallId).not.toBeNull();
    expect(callStore.get(session.winnerCallId).status).toBe(CONNECTED);
  });

  it('leaves winnerCallId null when a whole queue completes with no answer', () => {
    const session = setup([
      { outcome: NO_ANSWER, ringMs: 1000 },
      { outcome: BUSY, ringMs: 1000 },
      { outcome: VOICEMAIL, ringMs: 1000 },
      { outcome: BUSY, ringMs: 1000 },
    ]);
    startSession(session);
    for (let i = 0; i < 30; i += 1) tick(session, 250);

    expect(session.status).toBe(SESSION_STATUS.STOPPED);
    expect(session.winnerCallId).toBeNull();
    expect(session.metrics.connected).toBe(0);
    assertMetricsBalance(session, 'no answers');
  });
});

// ---------------------------------------------------------------------------

describe('start and stop (R-32, R-33, R-37, R-39)', () => {
  it('stop with both lines DIALING cancels both and promotes nothing', () => {
    const session = setup([
      { outcome: NO_ANSWER, ringMs: 9000 },
      { outcome: BUSY, ringMs: 9000 },
      { outcome: BUSY, ringMs: 9000 },
      { outcome: BUSY, ringMs: 9000 },
    ]);
    startSession(session);
    const [a, b] = session.activeCallIds;

    clock.advance(500);
    stopSession(session);
    assertSessionLegal(session, 'after stop');

    expect(session.status).toBe(SESSION_STATUS.STOPPED);
    expect(session.completionReason).toBe(COMPLETION_REASON.STOPPED_BY_AGENT);
    expect(session.activeCallIds).toHaveLength(0);
    expect(callStore.get(a).status).toBe(CANCELED_BY_DIALER);
    expect(callStore.get(b).status).toBe(CANCELED_BY_DIALER);
    expect(session.metrics.canceled).toBe(2);
    expect(callsOf(session)).toHaveLength(2); // nothing promoted
    assertMetricsBalance(session, 'stopped while dialing');
  });

  it('STOP DURING A LIVE CALL ends the winner CONNECTED, not cancelled (D-11)', () => {
    const session = setup([
      { outcome: CONNECTED, ringMs: 1000, talkMs: 9000 },
      { outcome: NO_ANSWER, ringMs: 9000 },
      { outcome: BUSY, ringMs: 9000 },
    ]);
    startSession(session);
    tick(session, 1000);
    const winnerId = session.winnerCallId;

    clock.advance(500);
    stopSession(session);
    assertSessionLegal(session, 'stopped mid-conversation');

    const winner = callStore.get(winnerId);
    expect(winner.status).toBe(CONNECTED);
    expect(session.metrics.connected).toBe(1);
    expect(session.winnerCallId).toBe(winnerId);
    assertMetricsBalance(session, 'stopped mid-conversation');
  });

  it('stop is idempotent - a second stop adds no cancellations and no CRM activities', () => {
    const session = setup([
      { outcome: NO_ANSWER, ringMs: 9000 },
      { outcome: BUSY, ringMs: 9000 },
    ]);
    startSession(session);
    stopSession(session);

    const metricsAfterFirst = { ...session.metrics };
    const appCount = appActivityStore.list().length;
    const crmCount = mockCrm.listActivities().length;

    stopSession(session);
    stopSession(session);
    assertSessionLegal(session, 'stopped three times');

    expect(session.metrics).toEqual(metricsAfterFirst);
    expect(appActivityStore.list()).toHaveLength(appCount);
    expect(mockCrm.listActivities()).toHaveLength(crmCount);
  });

  it('stopping a never-started session is a harmless no-op', () => {
    const session = setup([{ outcome: BUSY }, { outcome: BUSY }]);
    stopSession(session);
    expect(session.status).toBe(SESSION_STATUS.STOPPED);
    expect(session.startedAt).toBeNull();
    expect(callsOf(session)).toHaveLength(0);
  });

  it('starting a RUNNING session is a no-op that creates no extra calls', () => {
    const session = setup([
      { outcome: NO_ANSWER, ringMs: 9000 },
      { outcome: BUSY, ringMs: 9000 },
      { outcome: BUSY, ringMs: 9000 },
    ]);
    startSession(session);
    const before = [...session.activeCallIds];

    startSession(session);
    startSession(session);
    assertSessionLegal(session, 'started three times');

    expect(session.activeCallIds).toEqual(before);
    expect(callsOf(session)).toHaveLength(2);
    expect(session.metrics.attempted).toBe(2);
  });

  it('starting a FINISHED session is a conflict - there is no restart (D-14, R-37)', () => {
    const session = setup([
      { outcome: BUSY, ringMs: 1000 },
      { outcome: BUSY, ringMs: 1000 },
    ]);
    startSession(session);
    tick(session, 1000);
    expect(session.status).toBe(SESSION_STATUS.STOPPED);

    expect(() => startSession(session)).toThrow(/already run/i);
    expect(callsOf(session)).toHaveLength(2);
  });

  it('never starts the tick interval when autoTick is off (R-39a)', () => {
    const session = setup([{ outcome: BUSY, ringMs: 1000 }, { outcome: BUSY, ringMs: 1000 }]);
    startSession(session);
    expect(isTicking(session.id)).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe('metrics (R-34, D-04)', () => {
  it('maps every status to the right counter with exact values', () => {
    const session = setup([
      { outcome: NO_ANSWER, ringMs: 1000 },
      { outcome: BUSY, ringMs: 1000 },
      { outcome: VOICEMAIL, ringMs: 1000 },
      { outcome: CONNECTED, ringMs: 1000, talkMs: 2000 },
      { outcome: NO_ANSWER, ringMs: 9000 },
      { outcome: BUSY, ringMs: 1000 },
    ]);
    startSession(session);
    for (let i = 0; i < 60; i += 1) tick(session, 250);

    // 3 failed from round 1-2 (NO_ANSWER, BUSY, VOICEMAIL), 1 connected,
    // 1 cancelled (the partner of the connect), 1 more failed (BUSY).
    expect(session.metrics.attempted).toBe(6);
    expect(session.metrics.connected).toBe(1);
    expect(session.metrics.canceled).toBe(1);
    expect(session.metrics.failed).toBe(4);
    assertMetricsBalance(session, 'exact mapping');
  });

  it('counts attempted at creation, so it leads the terminal counters', () => {
    const session = setup([
      { outcome: NO_ANSWER, ringMs: 5000 },
      { outcome: BUSY, ringMs: 5000 },
    ]);
    startSession(session);
    expect(session.metrics.attempted).toBe(2);
    expect(session.metrics.failed).toBe(0);
    expect(session.metrics.connected).toBe(0);
    expect(session.metrics.canceled).toBe(0);
  });
});

// ---------------------------------------------------------------------------

describe('CRM integration through a whole session (INV-2 end to end)', () => {
  it('produces exactly one activity per call in EACH store, and one contact per lead', () => {
    const session = setup([
      { outcome: NO_ANSWER, ringMs: 1000 },
      { outcome: CONNECTED, ringMs: 1200, talkMs: 3000 },
      { outcome: BUSY, ringMs: 1000 },
      { outcome: VOICEMAIL, ringMs: 1000 },
      { outcome: NO_ANSWER, ringMs: 1000 },
      { outcome: BUSY, ringMs: 1000 },
    ]);
    startSession(session);
    for (let i = 0; i < 80; i += 1) tick(session, 250);

    expect(session.status).toBe(SESSION_STATUS.STOPPED);
    const calls = callsOf(session);

    // Counted per store, not summed - a sum would read as 2x and hide a
    // missing write to one of them.
    expect(appActivityStore.list()).toHaveLength(calls.length);
    expect(mockCrm.listActivities()).toHaveLength(calls.length);
    expect(mockCrm.listContacts()).toHaveLength(new Set(calls.map((c) => c.leadId)).size);

    for (const call of calls) {
      expect(appActivityStore.listByCall(call.id)).toHaveLength(1);
      expect(mockCrm.listActivitiesByCall(call.id)).toHaveLength(1);
      expect(appActivityStore.listByCall(call.id)[0].disposition).toBe(call.status);
    }
    assertMetricsBalance(session, 'full session');
  });

  it('re-advancing after the run adds no further activities', () => {
    const session = setup([
      { outcome: BUSY, ringMs: 1000 },
      { outcome: NO_ANSWER, ringMs: 1000 },
    ]);
    startSession(session);
    tick(session, 1000);
    const appCount = appActivityStore.list().length;

    for (let i = 0; i < 10; i += 1) tick(session, 250);

    expect(appActivityStore.list()).toHaveLength(appCount);
    expect(mockCrm.listActivities()).toHaveLength(appCount);
  });

  it('a call that is still DIALING has produced no CRM activity', () => {
    const session = setup([
      { outcome: NO_ANSWER, ringMs: 9000 },
      { outcome: BUSY, ringMs: 9000 },
    ]);
    startSession(session);
    tick(session, 250);

    expect(activeCalls(session).every((c) => c.phase === CALL_PHASE.DIALING)).toBe(true);
    expect(appActivityStore.list()).toHaveLength(0);
    expect(mockCrm.listActivities()).toHaveLength(0);
  });
});
