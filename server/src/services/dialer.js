import { CALL_STATUS, CALL_PHASE, createCall, isInFlight } from '../models/call.js';
import { SESSION_STATUS, COMPLETION_REASON, createSession } from '../models/session.js';
import * as callStore from '../store/calls.js';
import * as sessionStore from '../store/sessions.js';
import * as leadStore from '../store/leads.js';
import { syncTerminalCall } from './crm-sync.js';
import { systemClock } from './clock.js';
import { createSeededSimulator } from './simulator.js';
import { ValidationError, NotFoundError, ConflictError } from './errors.js';
import { CONCURRENCY, TICK_MS, SIM_SEED, DEMO_AGENT_ID } from '../config.js';

/**
 * The dialer session state machine.
 *
 * THIS IS THE ONLY MODULE THAT MUTATES SESSION STATE. Routes and the tick
 * timer call in here; nothing else touches session.activeCallIds, metrics or
 * winnerCallId.
 *
 * INVARIANT 1 - activeCallIds.length <= 2, always.
 *
 * It is guaranteed by the SHAPE of the code, not by vigilance: every
 * transition happens inside advance(), which is synchronous from top to
 * bottom. There is no `await` anywhere between reading activeCallIds and
 * writing it. Node runs one callback at a time, so with no interleaving point
 * there is no race that could produce a third active call. Promotion is a
 * while-loop bounded by `activeCallIds.length < CONCURRENCY`, so the ceiling
 * is the loop condition itself rather than a check that could be bypassed.
 *
 * If you ever need to await inside this file, the design is wrong - do the
 * async work outside and call advance() when it finishes.
 *
 * The canonical algorithm is docs/decisions.md D-09.
 */

// ---------------------------------------------------------------------------
// Runtime seams (D-06): time and the call simulator are injected so tests can
// drive the machine deterministically without sleeping.
// ---------------------------------------------------------------------------

const defaultRuntime = () => ({
  clock: systemClock(),
  simulator: createSeededSimulator({ seed: SIM_SEED }),
  autoTick: true,
});

let runtime = defaultRuntime();

/** Per-session tick timers (D-16). One interval per RUNNING session. */
const intervals = new Map();

/** Simulator bookkeeping, kept off the Call model so it stays the spec shape. */
const plans = new Map();

export function configureDialer(overrides = {}) {
  runtime = { ...runtime, ...overrides };
}

export function resetDialer() {
  for (const handle of intervals.values()) clearInterval(handle);
  intervals.clear();
  plans.clear();
  runtime = defaultRuntime();
}

// ---------------------------------------------------------------------------
// Session lifecycle (D-14)
// ---------------------------------------------------------------------------

export function createDialerSession({ agentId, leadIds }) {
  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    // D-11: an empty selection is rejected at the boundary rather than
    // creating a session that could never do anything.
    throw new ValidationError('Select at least one lead to create a dialer session');
  }

  const unknown = leadIds.filter((id) => !leadStore.get(id));
  if (unknown.length > 0) {
    throw new NotFoundError(`Unknown lead id(s): ${unknown.join(', ')}`);
  }

  const session = createSession({
    agentId: agentId || DEMO_AGENT_ID,
    leadIds,
    now: runtime.clock.now(),
  });
  return sessionStore.put(session);
}

export function startSession(session) {
  // Starting an already-running session is a no-op returning current state.
  if (session.status === SESSION_STATUS.RUNNING) return session;

  // D-14: STOPPED means two different things. startedAt tells them apart -
  // null is "created, never started", set is "finished". There is no restart.
  if (session.startedAt !== null) {
    throw new ConflictError(
      'This session has already run. Create a new session to dial the list again.',
    );
  }

  session.startedAt = runtime.clock.now();
  session.status = SESSION_STATUS.RUNNING;

  // Dial immediately rather than waiting a tick, so Start fills both lines at
  // once (R-22).
  advance(session);

  if (runtime.autoTick) startTicking(session);
  return session;
}

export function stopSession(session) {
  // Idempotent, and a no-op on a session that was never started (R-33).
  if (session.status !== SESSION_STATUS.RUNNING) return session;

  const now = runtime.clock.now();
  session.status = SESSION_STATUS.STOPPED;
  session.completionReason = COMPLETION_REASON.STOPPED_BY_AGENT;
  session.endedAt = now;

  // Terminate every in-flight call - a stopped session must not leave calls
  // dangling, or the metrics never balance. Each runs the normal, idempotent
  // CRM sync.
  for (const callId of [...session.activeCallIds]) {
    const call = callStore.get(callId);
    if (call && isInFlight(call)) {
      endCall(session, call, statusForForcedTermination(call), now);
    }
  }
  session.activeCallIds = [];

  stopTicking(session.id);
  return session;
}

// ---------------------------------------------------------------------------
// The transition function (D-09)
// ---------------------------------------------------------------------------

/**
 * Apply everything that has fallen due, then promote. One tick = one call of
 * this function. Synchronous from top to bottom - see INVARIANT 1 above.
 */
export function advance(session) {
  if (session.status !== SESSION_STATUS.RUNNING) return session;

  const now = runtime.clock.now();
  const active = () => session.activeCallIds.map((id) => callStore.get(id)).filter(Boolean);

  // 1. Calls whose ANSWER is due this tick. Derived from activeCallIds, which
  //    is insertion-ordered, so the order is deterministic - never Map or Set
  //    iteration luck.
  const answering = active().filter(
    (c) => c.phase === CALL_PHASE.DIALING && c.answerDueAt !== null && c.answerDueAt <= now,
  );

  let newWinner = null;

  // 2. Resolve the race. At most one call may ever be LIVE, so if two answers
  //    fall due in the same tick exactly one wins; the other stays DIALING and
  //    is cancelled in step 3. The gate is "is any call LIVE", NOT "is
  //    winnerCallId set" - winnerCallId stays set forever after the first
  //    connect (D-18), so gating on it would stop every later call winning.
  const someoneLive = active().some((c) => c.phase === CALL_PHASE.LIVE);
  if (!someoneLive && answering.length > 0) {
    const winner = answering[0];
    winner.phase = CALL_PHASE.LIVE;
    winner.answeredAt = now;
    winner.endDueAt = now + (plans.get(winner.id)?.talkMs ?? 0);
    session.winnerCallId = winner.id; // replaces whatever it held (D-02, D-18)
    newWinner = winner;
  }

  // 3. A winner means the agent is now on a call, so every other in-flight
  //    call is cancelled - one agent holds one conversation (D-02).
  const forcedCancel = new Set();
  if (newWinner) {
    for (const call of active()) {
      if (call.id !== newWinner.id && isInFlight(call)) forcedCancel.add(call.id);
    }
  }

  // 4./5. Apply due terminal transitions. Metrics and the idempotent CRM sync
  //       both happen inside endCall, so no terminal path can forget either.
  for (const call of active()) {
    if (!isInFlight(call)) continue;

    if (forcedCancel.has(call.id)) {
      endCall(session, call, statusForForcedTermination(call), now);
      continue;
    }
    if (call.endDueAt !== null && call.endDueAt <= now) {
      const outcome =
        call.phase === CALL_PHASE.LIVE
          ? CALL_STATUS.CONNECTED
          : plans.get(call.id)?.outcome ?? CALL_STATUS.NO_ANSWER;
      endCall(session, call, outcome, now);
    }
  }

  // 6. Release ended calls from the lines they were holding.
  session.activeCallIds = session.activeCallIds.filter((id) => {
    const call = callStore.get(id);
    return call && isInFlight(call);
  });

  // 7. Promote. The ceiling is the loop condition, so it cannot be bypassed.
  //    The LIVE gate (not a winnerCallId gate) is what makes dialing resume
  //    after a conversation ends instead of stalling forever (D-18).
  while (
    session.activeCallIds.length < CONCURRENCY &&
    session.leadQueue.length > 0 &&
    session.status === SESSION_STATUS.RUNNING &&
    !hasLiveCall(session)
  ) {
    promoteNextLead(session, now);
  }

  // 8. Nothing left to dial and nothing in flight - the run is over. Note this
  //    is NOT triggered by a call connecting (D-02 step 6).
  if (
    session.status === SESSION_STATUS.RUNNING &&
    session.activeCallIds.length === 0 &&
    session.leadQueue.length === 0
  ) {
    session.status = SESSION_STATUS.STOPPED;
    session.completionReason = COMPLETION_REASON.QUEUE_EXHAUSTED;
    session.endedAt = now;
    stopTicking(session.id);
  }

  return session;
}

// ---------------------------------------------------------------------------
// Helpers - every one of these is synchronous by design
// ---------------------------------------------------------------------------

function hasLiveCall(session) {
  return session.activeCallIds.some((id) => callStore.get(id)?.phase === CALL_PHASE.LIVE);
}

/**
 * D-11: what a force-terminated call ends as depends on its PHASE, not on why
 * it ended. A LIVE call was answered and a conversation happened, so ending it
 * - by a winner elsewhere, or by Stop - is a connection. CANCELED_BY_DIALER
 * therefore only ever lands on a call that was never answered.
 */
function statusForForcedTermination(call) {
  return call.phase === CALL_PHASE.LIVE
    ? CALL_STATUS.CONNECTED
    : CALL_STATUS.CANCELED_BY_DIALER;
}

/** The single terminal transition. status and endedAt are set together (D-03). */
function endCall(session, call, status, now) {
  call.phase = CALL_PHASE.ENDED;
  call.status = status;
  call.endedAt = now;

  bumpTerminalMetric(session, status);
  syncTerminalCall(call, now);
}

/** D-04. attempted moves at creation; the other three only here. */
function bumpTerminalMetric(session, status) {
  if (status === CALL_STATUS.CONNECTED) session.metrics.connected += 1;
  else if (status === CALL_STATUS.CANCELED_BY_DIALER) session.metrics.canceled += 1;
  else session.metrics.failed += 1;
}

function promoteNextLead(session, now) {
  const leadId = session.leadQueue.shift();
  const plan = runtime.simulator.plan({ leadId });

  const call = createCall({
    leadId,
    sessionId: session.id,
    providerCallId: plan.providerCallId,
    startedAt: now,
  });

  if (plan.outcome === CALL_STATUS.CONNECTED) {
    // It will be answered; its end time is not known until it is, because
    // talkMs runs from the answer rather than from the dial.
    call.answerDueAt = now + plan.ringMs;
    call.endDueAt = null;
  } else {
    call.answerDueAt = null;
    call.endDueAt = now + plan.ringMs;
  }

  plans.set(call.id, plan);
  callStore.put(call);
  session.activeCallIds.push(call.id);
  session.callIds.push(call.id);
  session.metrics.attempted += 1;

  return call;
}

// ---------------------------------------------------------------------------
// The tick (D-16)
// ---------------------------------------------------------------------------

/**
 * One setInterval per RUNNING session whose callback does nothing but call
 * advance(). No per-call timers: two events are "in the same tick" only if
 * they fall due before the same invocation, which is exactly the race the
 * invariants have to survive - and with one driver a test can produce it on
 * purpose. Tests never start this (R-39a); they advance a fake clock and call
 * advance() directly.
 */
function startTicking(session) {
  if (intervals.has(session.id)) return;
  const handle = setInterval(() => advance(session), TICK_MS);
  if (typeof handle.unref === 'function') handle.unref();
  intervals.set(session.id, handle);
}

function stopTicking(sessionId) {
  const handle = intervals.get(sessionId);
  if (handle) {
    clearInterval(handle);
    intervals.delete(sessionId);
  }
}

export function isTicking(sessionId) {
  return intervals.has(sessionId);
}
