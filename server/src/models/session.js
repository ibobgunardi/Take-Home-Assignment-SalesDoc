import { nextId } from './ids.js';
import { CONCURRENCY } from '../config.js';

/** Exactly the two specified values (R-09). No third state - see D-14. */
export const SESSION_STATUS = Object.freeze({
  RUNNING: 'RUNNING',
  STOPPED: 'STOPPED',
});

/** Added, non-spec field, for UI clarity only (D-02). */
export const COMPLETION_REASON = Object.freeze({
  QUEUE_EXHAUSTED: 'QUEUE_EXHAUSTED',
  STOPPED_BY_AGENT: 'STOPPED_BY_AGENT',
});

/**
 * DialerSession.
 *
 * D-14: `status` is only RUNNING|STOPPED, so "created but not started" and
 * "finished" share the value STOPPED. They are told apart by `startedAt`
 * (an added field): null means never started, set means started.
 */
export function createSession({ agentId, leadIds, now }) {
  return {
    id: nextId('sess'),
    agentId,
    leadQueue: [...leadIds],
    concurrency: CONCURRENCY,
    activeCallIds: [],
    // Which call is holding each of the 2 lines. Presentation only: it keeps a
    // card in the same slot across polls instead of sliding left when the other
    // line frees. activeCallIds stays the authority for INVARIANT 1.
    lineSlots: [null, null],
    winnerCallId: null,
    status: SESSION_STATUS.STOPPED,
    metrics: { attempted: 0, connected: 0, failed: 0, canceled: 0 },
    createdAt: now,
    startedAt: null,
    endedAt: null,
    completionReason: null,
    callIds: [],
  };
}
