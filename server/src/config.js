// Central configuration. Everything tunable lives here so a reviewer can find
// it in one place, and so tests can import the same constants the app uses.

export const PORT = Number(process.env.PORT) || 3200;

// D-16: one setInterval per RUNNING session, 250ms, calling only advance().
// Independent of the 1-2s UI poll (R-89) - do not couple them.
export const TICK_MS = Number(process.env.TICK_MS) || 250;

// D-13: fixed default seed so `npm run dev` and a demo replay identically.
export const SIM_SEED = Number(process.env.SIM_SEED) || 20260830;

// D-14: single hardcoded demo agent. No login, no agent picker.
export const DEMO_AGENT_ID = 'agent-1';

// T1-P1: "concurrency fixed to 2". Not user-configurable (R-08).
export const CONCURRENCY = 2;

export const IS_PRODUCTION = process.env.NODE_ENV === 'production';
