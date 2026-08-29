import { useEffect, useRef, useState } from 'react';
import { apiGet, ApiError } from './api.js';

/**
 * The spec requires polling every 1-2 seconds. A named constant so a test can
 * assert the value rather than trusting a magic number (R-89).
 *
 * This is independent of the server's 250ms simulation tick (D-16): the tick
 * advances the dialer, the poll reads it. They are not coupled.
 */
export const POLL_INTERVAL_MS = 1500;

/**
 * Polls GET /sessions/:id and returns whatever the server said.
 *
 * The backend is the source of truth (R-91): this hook never advances the
 * queue, counts a metric, or decides a winner. It renders what it is given.
 */
export function useSessionPolling(sessionId, { onExpired } = {}) {
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Refs, not state: changing them must not re-run the effect and restart the
  // interval, which would reset the polling cadence on every tick.
  const inFlight = useRef(false);
  const stopped = useRef(false);
  const onExpiredRef = useRef(onExpired);
  onExpiredRef.current = onExpired;

  useEffect(() => {
    if (!sessionId) return undefined;

    let cancelled = false;
    stopped.current = false;

    async function poll() {
      // Do not overlap requests - a slow response must not queue up behind
      // itself and produce flicker.
      if (inFlight.current || cancelled) return;
      inFlight.current = true;
      try {
        const next = await apiGet(`/sessions/${sessionId}`);
        if (cancelled) return;
        setSession(next);
        setError(null);
        setLastUpdated(Date.now());

        // R-90: stop polling once the run is over. A runaway poll after the
        // session ends is a visible defect in the network tab.
        if (next.status === 'STOPPED') {
          stopped.current = true;
          clearInterval(timer);
        }
      } catch (err) {
        if (cancelled) return;
        // R-93: the server restarted and lost this in-memory session (D-10,
        // D-15). Hand back to Screen 1 rather than showing a broken screen.
        if (err instanceof ApiError && err.status === 404) {
          stopped.current = true;
          clearInterval(timer);
          onExpiredRef.current?.();
          return;
        }
        // Any other failure keeps the last good data on screen (R-92) and
        // shows a message; the next tick may well succeed.
        setError(err.message);
      } finally {
        inFlight.current = false;
      }
    }

    poll();
    const timer = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [sessionId]);

  return { session, error, lastUpdated };
}
