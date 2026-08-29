import { describe, it, expect } from 'vitest';
import { createSeededSimulator, createScriptedSimulator, DEFAULT_PROFILE } from '../src/services/simulator.js';
import { CALL_STATUS } from '../src/models/call.js';
import { fakeClock } from '../src/services/clock.js';

describe('seeded simulator (R-35, R-39b, D-13, D-17)', () => {
  it('is reproducible: the same seed yields the same sequence', () => {
    const a = createSeededSimulator({ seed: 12345 });
    const b = createSeededSimulator({ seed: 12345 });
    const runA = Array.from({ length: 20 }, () => a.plan());
    const runB = Array.from({ length: 20 }, () => b.plan());
    expect(runA).toEqual(runB);
  });

  it('different seeds diverge', () => {
    const a = createSeededSimulator({ seed: 1 });
    const b = createSeededSimulator({ seed: 2 });
    const runA = Array.from({ length: 20 }, () => a.plan().outcome);
    const runB = Array.from({ length: 20 }, () => b.plan().outcome);
    expect(runA).not.toEqual(runB);
  });

  it('draws ring and talk durations inside the D-17 bounds', () => {
    const sim = createSeededSimulator({ seed: 99 });
    for (let i = 0; i < 500; i += 1) {
      const plan = sim.plan();
      expect(plan.ringMs).toBeGreaterThanOrEqual(DEFAULT_PROFILE.ringMs[0]);
      expect(plan.ringMs).toBeLessThanOrEqual(DEFAULT_PROFILE.ringMs[1]);
      if (plan.outcome === CALL_STATUS.CONNECTED) {
        expect(plan.talkMs).toBeGreaterThanOrEqual(DEFAULT_PROFILE.talkMs[0]);
        expect(plan.talkMs).toBeLessThanOrEqual(DEFAULT_PROFILE.talkMs[1]);
      } else {
        expect(plan.talkMs).toBe(0);
      }
    }
  });

  it('never draws CANCELED_BY_DIALER - that is the dialer\'s decision (D-02)', () => {
    const sim = createSeededSimulator({ seed: 7 });
    for (let i = 0; i < 500; i += 1) {
      expect(sim.plan().outcome).not.toBe(CALL_STATUS.CANCELED_BY_DIALER);
    }
  });

  it('produces all four provider outcomes over a long run, so the metrics panel is exercised', () => {
    const sim = createSeededSimulator({ seed: 4242 });
    const seen = new Set(Array.from({ length: 400 }, () => sim.plan().outcome));
    expect([...seen].sort()).toEqual(['BUSY', 'CONNECTED', 'NO_ANSWER', 'VOICEMAIL']);
  });

  it('gives every call a non-empty, unique providerCallId (R-06)', () => {
    const sim = createSeededSimulator({ seed: 5 });
    const ids = Array.from({ length: 50 }, () => sim.plan().providerCallId);
    ids.forEach((id) => expect(typeof id).toBe('string'));
    expect(new Set(ids).size).toBe(50);
  });
});

describe('scripted simulator (test seam)', () => {
  it('returns the scripted plans in order', () => {
    const sim = createScriptedSimulator([
      { outcome: CALL_STATUS.BUSY, ringMs: 100 },
      { outcome: CALL_STATUS.CONNECTED, ringMs: 200, talkMs: 300 },
    ]);
    expect(sim.plan().outcome).toBe(CALL_STATUS.BUSY);
    const second = sim.plan();
    expect(second.outcome).toBe(CALL_STATUS.CONNECTED);
    expect(second.talkMs).toBe(300);
  });

  it('throws rather than inventing a plan when the script runs out', () => {
    const sim = createScriptedSimulator([{ outcome: CALL_STATUS.BUSY }]);
    sim.plan();
    expect(() => sim.plan()).toThrow(/exhausted/);
  });
});

describe('injected clock (D-06)', () => {
  it('advances only when the test says so - no sleeping', () => {
    const clock = fakeClock(1000);
    expect(clock.now()).toBe(1000);
    clock.advance(250);
    expect(clock.now()).toBe(1250);
  });
});
