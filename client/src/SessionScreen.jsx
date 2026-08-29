import { useState } from 'react';
import { apiPost } from './api.js';
import { useSessionPolling } from './useSessionPolling.js';

/** Screen 2 - the live dialer session (R-84..R-96). */
export default function SessionScreen({ sessionId, onExpired, onNewSession }) {
  const { session, error, lastUpdated } = useSessionPolling(sessionId, { onExpired });
  const [stopError, setStopError] = useState(null);
  const [stopping, setStopping] = useState(false);

  async function stop() {
    setStopping(true);
    setStopError(null);
    try {
      await apiPost(`/sessions/${sessionId}/stop`);
    } catch (err) {
      setStopError(err.message);
    } finally {
      setStopping(false);
    }
  }

  // Never a blank screen while the first poll is in flight (R-92).
  if (!session) {
    return (
      <section className="panel">
        <h2>Dialer session</h2>
        {error ? (
          <p className="error" role="alert">
            Could not load the session: {error}
          </p>
        ) : (
          <p className="muted">Loading session…</p>
        )}
      </section>
    );
  }

  const finished = session.status === 'STOPPED';

  return (
    <div>
      <section className="panel">
        <div className="panel-head">
          <h2>
            Session <code>{session.id}</code>
          </h2>
          <span className={`pill pill-${finished ? 'stopped' : 'running'}`}>{session.status}</span>
        </div>

        <div className="actions">
          {!finished && (
            <button type="button" onClick={stop} disabled={stopping}>
              Stop
            </button>
          )}
          {/* R-94: a finished session is not restartable (D-14), so offer a new
              one rather than a Start button that would 409. */}
          {finished && (
            <button type="button" className="primary" onClick={onNewSession}>
              New session
            </button>
          )}
          <span className="muted small">
            {session.queue.dialed} of {session.queue.total} leads dialed
            {lastUpdated && ` · updated ${new Date(lastUpdated).toLocaleTimeString()}`}
          </span>
        </div>

        {finished && session.completionReason && (
          <p className="muted small">
            {session.completionReason === 'QUEUE_EXHAUSTED'
              ? 'Every selected lead was dialed.'
              : 'Stopped by the agent.'}
          </p>
        )}
        {/* A failed poll shows a message and keeps the last good data (R-92). */}
        {error && (
          <p className="error" role="alert">
            Lost contact with the server ({error}). Showing the last known state.
          </p>
        )}
        {stopError && (
          <p className="error" role="alert">
            {stopError}
          </p>
        )}
      </section>

      <section className="panel">
        <h2>Lines</h2>
        <div className="lines">
          {/* Always exactly 2 slots (R-84). */}
          {session.lines.map((line) => (
            <LineCard key={line.index} index={line.index} call={line.call} session={session} />
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Metrics</h2>
        <div className="metrics">
          <Metric label="Attempted" value={session.metrics.attempted} />
          <Metric label="Connected" value={session.metrics.connected} tone="ok" />
          <Metric label="Failed" value={session.metrics.failed} tone="warn" />
          <Metric label="Canceled" value={session.metrics.canceled} tone="muted" />
        </div>
      </section>

      <section className="panel">
        {/* D-18: winnerCallId names the most recent answered call and is never
            cleared, so "Winner" reads wrong once that call has ended - but
            "Last connected" must not be claimed before anything has connected
            at all, which is the state for the whole first round. */}
        <h2>
          {session.winnerCall && session.winnerCall.phase !== 'LIVE'
            ? 'Last connected'
            : 'Winner call'}
        </h2>
        {session.winnerCall ? (
          <div className="winner">
            <strong>{session.winnerCall.lead.name}</strong>{' '}
            <span className="muted">{session.winnerCall.lead.company}</span>
            <div className="mono">{session.winnerCall.lead.phone}</div>
            <div className="small">
              <code>{session.winnerCall.id}</code> ·{' '}
              {session.winnerCall.phase === 'LIVE' ? 'on the call now' : session.winnerCall.status}
            </div>
          </div>
        ) : (
          <p className="muted">No call has been answered yet.</p>
        )}
      </section>

      <section className="panel">
        {/* R-95: not spec-required. A reviewer needs to SEE the queue draining. */}
        <h2>Completed calls</h2>
        {session.completedCalls.length === 0 ? (
          <p className="muted">Nothing has completed yet.</p>
        ) : (
          <table className="calls">
            <thead>
              <tr>
                <th>Lead</th>
                <th>Phone</th>
                <th>Outcome</th>
                <th>CRM activity</th>
              </tr>
            </thead>
            <tbody>
              {session.completedCalls.map((call) => (
                <tr key={call.id}>
                  <td>{call.lead.name}</td>
                  <td className="mono">{call.lead.phone}</td>
                  <td>
                    <span className={`status status-${call.status}`}>{call.status}</span>
                  </td>
                  <td>
                    <CrmStatus call={call} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function LineCard({ index, call, session }) {
  const label = `Line ${index + 1}`;

  if (!call) {
    // R-96: an idle line stays visible and labelled. Under D-02 the other line
    // is cancelled while a call is live and nothing new is promoted, so for
    // most of a conversation exactly one line is busy - that is power-dialer
    // behaviour, and an unexplained empty slot reads as a broken 2-line dialer.
    const live = session.lines.some((l) => l.call?.phase === 'LIVE');
    return (
      <article className="line line-idle">
        <header>{label}</header>
        <p className="muted">
          {live
            ? 'Idle while you are on a call'
            : session.status === 'RUNNING'
              ? 'Idle - waiting for the next lead'
              : 'Idle'}
        </p>
      </article>
    );
  }

  // Render the PHASE while in flight and the terminal status once ended (D-03).
  // Call_Status has no in-flight value, so there is nothing else to show here.
  const phaseLabel =
    call.phase === 'DIALING' ? 'Dialing…' : call.phase === 'LIVE' ? 'Connected — live' : call.status;

  return (
    <article className={`line line-${call.phase.toLowerCase()}`}>
      <header>
        {label}
        <span className={`status status-${call.phase}`}>{phaseLabel}</span>
      </header>
      <strong>{call.lead.name}</strong>
      <div className="muted small">{call.lead.company}</div>
      <div className="mono">{call.lead.phone}</div>
      <footer>
        <CrmStatus call={call} />
      </footer>
    </article>
  );
}

/** R-88: per-call CRM activity creation status, plainly visible. */
function CrmStatus({ call }) {
  if (call.crmActivity.state === 'created') {
    return (
      <span className="crm crm-created">
        CRM activity created <code>{call.crmActivity.activityId}</code>
      </span>
    );
  }
  return <span className="crm crm-pending">CRM activity pending</span>;
}

function Metric({ label, value, tone }) {
  return (
    <div className={`metric${tone ? ` metric-${tone}` : ''}`}>
      <div className="metric-value">{value}</div>
      <div className="metric-label">{label}</div>
    </div>
  );
}
