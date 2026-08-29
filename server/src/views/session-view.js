import { CALL_PHASE } from '../models/call.js';
import * as callStore from '../store/calls.js';
import * as leadStore from '../store/leads.js';
import { getActivityForCall } from '../services/crm-sync.js';
import { CONCURRENCY } from '../config.js';

/**
 * The read model behind GET /sessions/:id - the single polling endpoint (D-08).
 *
 * It deliberately returns everything Screen 2 needs in ONE response: session
 * status, metrics, the winner, both line slots with lead name/phone/status,
 * completed calls, and per-call CRM activity status. The frontend must never
 * stitch a consistent view together from several responses read at different
 * instants; with one payload the view is consistent by construction.
 */
export function sessionView(session) {
  const calls = session.callIds.map((id) => callStore.get(id)).filter(Boolean);
  const completed = calls.filter((c) => c.phase === CALL_PHASE.ENDED);

  return {
    id: session.id,
    agentId: session.agentId,
    status: session.status,
    concurrency: CONCURRENCY,

    // The server's clock. A call's elapsed time is the gap between two server
    // timestamps, so the UI must not measure it against the viewer's clock -
    // any skew makes the timer jump, stall, or disappear entirely.
    now: Date.now(),

    createdAt: session.createdAt,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    completionReason: session.completionReason,
    metrics: { ...session.metrics },

    // Always exactly 2 slots. An idle line is an idle card, never a missing
    // one (R-84, R-96) - during a conversation the other line is cancelled and
    // nothing is promoted, so one slot is legitimately idle and must still be
    // visible and labelled.
    lines: session.lineSlots.map((callId, index) => ({
      index,
      call: callId ? callView(callStore.get(callId)) : null,
    })),

    winnerCallId: session.winnerCallId,
    winnerCall: session.winnerCallId ? callView(callStore.get(session.winnerCallId)) : null,

    queue: {
      total: session.callIds.length + session.leadQueue.length,
      dialed: session.callIds.length,
      remaining: session.leadQueue.length,
      upcoming: session.leadQueue.map((leadId) => leadSummary(leadId)),
    },

    completedCalls: completed.map(callView),
  };
}

export function callView(call) {
  if (!call) return null;
  const activity = getActivityForCall(call.id);

  return {
    id: call.id,
    leadId: call.leadId,
    sessionId: call.sessionId,
    providerCallId: call.providerCallId,
    // status is the FINAL outcome and is null until the call ends; phase is
    // where it is now (D-03). The UI renders phase while in flight.
    status: call.status,
    phase: call.phase,
    startedAt: call.startedAt,
    answeredAt: call.answeredAt,
    endedAt: call.endedAt,
    lead: leadSummary(call.leadId),

    // R-88: per-call CRM activity status, plainly visible.
    crmActivity: activity
      ? {
          state: 'created',
          activityId: activity.id,
          crmExternalId: activity.crmExternalId,
          disposition: activity.disposition,
          createdAt: activity.createdAt,
        }
      : { state: 'pending', activityId: null, crmExternalId: null, disposition: null, createdAt: null },
  };
}

function leadSummary(leadId) {
  const lead = leadStore.get(leadId);
  if (!lead) return null;
  return {
    id: lead.id,
    name: lead.name,
    company: lead.company,
    phone: lead.phone,
    email: lead.email,
    crmExternalId: lead.crmExternalId,
  };
}
