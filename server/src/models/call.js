import { nextId } from './ids.js';

/**
 * The five specified Call_Status values. Exactly these - no additions (R-04).
 * DIALING and LIVE are NOT statuses; they are phases (D-03).
 */
export const CALL_STATUS = Object.freeze({
  CONNECTED: 'CONNECTED',
  NO_ANSWER: 'NO_ANSWER',
  BUSY: 'BUSY',
  VOICEMAIL: 'VOICEMAIL',
  CANCELED_BY_DIALER: 'CANCELED_BY_DIALER',
});

/**
 * `phase` is an added, non-spec field (D-03). It answers "where is this call
 * now", which Call_Status cannot: the spec enum has no in-flight value, yet
 * Screen 2 must show a status on an active line.
 *
 *   DIALING --answered--> LIVE --hangup--> ENDED
 *        \__ no answer / busy / voicemail / cancel __> ENDED
 *
 * `status` stays null until the call enters ENDED, at which point `status` and
 * `endedAt` are set together, in one step, and never again.
 */
export const CALL_PHASE = Object.freeze({
  DIALING: 'DIALING',
  LIVE: 'LIVE',
  ENDED: 'ENDED',
});

export function createCall({ leadId, sessionId, providerCallId, startedAt }) {
  return {
    id: nextId('call'),
    leadId,
    sessionId,
    providerCallId,
    status: null,
    phase: CALL_PHASE.DIALING,
    startedAt,
    answeredAt: null,
    endedAt: null,
    // When the simulator says this call's answer and end fall due. Read by
    // advance() each tick; they are data, not timers of their own (D-16).
    answerDueAt: null,
    endDueAt: null,
  };
}

export function isInFlight(call) {
  return call.phase !== CALL_PHASE.ENDED;
}
