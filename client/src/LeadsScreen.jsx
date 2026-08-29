import { useEffect, useState } from 'react';
import { apiGet, apiPost } from './api.js';

const AGENT_ID = 'agent-1'; // D-14: a single hardcoded demo agent, no login.

/** Screen 1 - leads list, checkbox selection, create + start (R-80..R-83). */
export default function LeadsScreen({ notice, onStarted }) {
  const [leads, setLeads] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [session, setSession] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiGet('/leads')
      .then((data) => !cancelled && setLeads(data.leads))
      .catch((err) => !cancelled && setLoadError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(leadId) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
    // The selection changed, so a session created from the old one is stale.
    setSession(null);
  }

  async function createSession() {
    setBusy(true);
    setActionError(null);
    try {
      const created = await apiPost('/sessions', {
        agentId: AGENT_ID,
        leadIds: leads.filter((l) => selected.has(l.id)).map((l) => l.id),
      });
      setSession(created);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    setBusy(true);
    setActionError(null);
    try {
      await apiPost(`/sessions/${session.id}/start`);
      onStarted(session.id);
    } catch (err) {
      setActionError(err.message);
      setBusy(false);
    }
  }

  return (
    <div>
      {notice && <p className="banner banner-warn">{notice}</p>}

      <section className="panel">
        <div className="panel-head">
          <h2>Leads</h2>
          {leads && (
            <span className="muted">
              {selected.size} of {leads.length} selected
            </span>
          )}
        </div>

        {loadError && (
          <p className="error" role="alert">
            Could not load leads: {loadError}
          </p>
        )}
        {!leads && !loadError && <p className="muted">Loading leads…</p>}
        {leads && leads.length === 0 && <p className="muted">No leads are seeded.</p>}

        {leads && leads.length > 0 && (
          <table className="leads">
            <thead>
              <tr>
                <th aria-label="Select" />
                <th>Name</th>
                <th>Company</th>
                <th>Phone</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className={selected.has(lead.id) ? 'row-selected' : undefined}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(lead.id)}
                      onChange={() => toggle(lead.id)}
                      aria-label={`Select ${lead.name}`}
                    />
                  </td>
                  <td>{lead.name}</td>
                  <td>{lead.company}</td>
                  <td className="mono">{lead.phone}</td>
                  <td className="muted">{lead.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <h2>Dialer session</h2>
        <p className="muted hint">
          Two lines dial in parallel. Select more than two leads to watch the queue advance.
        </p>

        <div className="actions">
          <button
            type="button"
            onClick={createSession}
            // R-82 / D-11: disabled with nothing selected.
            disabled={selected.size === 0 || busy || !leads}
          >
            Create Dialer Session
          </button>
          <button type="button" className="primary" onClick={start} disabled={!session || busy}>
            Start
          </button>
        </div>

        {session && (
          <p className="ok">
            Session <code>{session.id}</code> created with {session.queue.total} lead
            {session.queue.total === 1 ? '' : 's'} queued. Press Start to begin dialing.
          </p>
        )}
        {actionError && (
          <p className="error" role="alert">
            {actionError}
          </p>
        )}
      </section>
    </div>
  );
}
