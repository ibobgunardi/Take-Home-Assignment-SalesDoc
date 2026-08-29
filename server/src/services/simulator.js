import { CALL_STATUS } from '../models/call.js';

/**
 * CallSimulator seam (D-06).
 *
 * A simulator decides, for one call, what the "provider" is going to do:
 *
 *   plan({ leadId }) -> { outcome, ringMs, talkMs, providerCallId }
 *
 *   outcome  the Call_Status this call ends with, EXCEPT that CONNECTED means
 *            "it gets answered" - the dialer decides the rest (D-03).
 *   ringMs   dial -> answer, or dial -> give up
 *   talkMs   answer -> hangup; 0 for outcomes that never answer
 *
 * CANCELED_BY_DIALER is never drawn here: it is imposed by the dialer (D-02),
 * not returned by a provider.
 *
 * Math.random() and bare setTimeout must not appear in domain logic (R-35).
 * This module is the only place randomness lives, and it is seeded.
 */

/** D-17 defaults. All configurable; changing them changes only the demo feel. */
export const DEFAULT_PROFILE = Object.freeze({
  ringMs: [2000, 5000],
  talkMs: [6000, 15000],
  outcomes: [
    [CALL_STATUS.CONNECTED, 0.35],
    [CALL_STATUS.NO_ANSWER, 0.25],
    [CALL_STATUS.VOICEMAIL, 0.2],
    [CALL_STATUS.BUSY, 0.2],
  ],
});

/** mulberry32 - small, fast, and fully determined by its seed (D-13). */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSeededSimulator({ seed, profile = DEFAULT_PROFILE } = {}) {
  const random = mulberry32(seed);
  let n = 0;

  const pickInt = ([lo, hi]) => lo + Math.floor(random() * (hi - lo + 1));

  const pickOutcome = () => {
    const roll = random();
    let acc = 0;
    for (const [outcome, weight] of profile.outcomes) {
      acc += weight;
      if (roll < acc) return outcome;
    }
    return profile.outcomes[profile.outcomes.length - 1][0];
  };

  return {
    plan() {
      const outcome = pickOutcome();
      n += 1;
      return {
        outcome,
        ringMs: pickInt(profile.ringMs),
        talkMs: outcome === CALL_STATUS.CONNECTED ? pickInt(profile.talkMs) : 0,
        providerCallId: `prov-${seed}-${n}`,
      };
    },
  };
}

/**
 * Test simulator: the test states exactly what each call does, in the order
 * calls are created (queue order, which is deterministic).
 *
 *   createScriptedSimulator([
 *     { outcome: 'CONNECTED', ringMs: 1000, talkMs: 5000 },
 *     { outcome: 'BUSY',      ringMs: 1000 },
 *   ])
 *
 * Running off the end of the script throws rather than silently inventing a
 * plan - a test that dials more than it scripted should fail loudly.
 */
export function createScriptedSimulator(plans) {
  const queue = [...plans];
  let n = 0;

  return {
    plan({ leadId } = {}) {
      const next = queue.shift();
      if (!next) {
        throw new Error(
          `scripted simulator exhausted: no plan for call ${n + 1}` +
            (leadId ? ` (lead ${leadId})` : ''),
        );
      }
      n += 1;
      return {
        ringMs: 1000,
        talkMs: next.outcome === CALL_STATUS.CONNECTED ? 5000 : 0,
        providerCallId: `prov-test-${n}`,
        ...next,
      };
    },
    get remaining() {
      return queue.length;
    },
  };
}
