import { nextId } from './ids.js';

export const ACTIVITY_TYPE = Object.freeze({ CALL: 'CALL' });

/**
 * CRMActivity - spec fields: id, leadId, crmExternalId, type, callId,
 * disposition, notes, createdAt.
 *
 * `disposition` is the Call_Status the call ended with (D-05).
 */
export function createCrmActivity({ leadId, crmExternalId, callId, disposition, notes, createdAt }) {
  return {
    id: nextId('act'),
    leadId,
    crmExternalId,
    type: ACTIVITY_TYPE.CALL,
    callId,
    disposition,
    notes,
    createdAt,
  };
}
