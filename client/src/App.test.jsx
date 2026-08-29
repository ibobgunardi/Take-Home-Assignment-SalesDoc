import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App.jsx';
import SessionScreen from './SessionScreen.jsx';
import { POLL_INTERVAL_MS } from './useSessionPolling.js';

const LEADS = [
  { id: 'lead-1', name: 'Amelia Hartono', company: 'Nusantara Logistics', phone: '+62 811 2000 101', email: 'a@x.co', crmExternalId: null },
  { id: 'lead-2', name: 'Daniel Prasetyo', company: 'Meridian Fintech', phone: '+62 811 2000 102', email: 'd@x.co', crmExternalId: null },
  { id: 'lead-3', name: 'Grace Wijaya', company: 'Sentra Health', phone: '+62 811 2000 103', email: 'g@x.co', crmExternalId: null },
];

const leadOf = (id) => LEADS.find((l) => l.id === id);

function callFixture(id, leadId, { phase = 'DIALING', status = null, activityId = null } = {}) {
  return {
    id,
    leadId,
    sessionId: 'sess-1',
    providerCallId: `prov-${id}`,
    phase,
    status,
    startedAt: 1000,
    answeredAt: phase === 'LIVE' ? 2000 : null,
    endedAt: phase === 'ENDED' ? 3000 : null,
    lead: leadOf(leadId),
    crmActivity: activityId
      ? { state: 'created', activityId, crmExternalId: 'contact-1', disposition: status, createdAt: 3000 }
      : { state: 'pending', activityId: null, crmExternalId: null, disposition: null, createdAt: null },
  };
}

function sessionFixture(overrides = {}) {
  return {
    id: 'sess-1',
    agentId: 'agent-1',
    status: 'RUNNING',
    concurrency: 2,
    createdAt: 0,
    startedAt: 1000,
    endedAt: null,
    completionReason: null,
    metrics: { attempted: 2, connected: 0, failed: 0, canceled: 0 },
    lines: [
      { index: 0, call: callFixture('call-1', 'lead-1') },
      { index: 1, call: callFixture('call-2', 'lead-2') },
    ],
    winnerCallId: null,
    winnerCall: null,
    queue: { total: 3, dialed: 2, remaining: 1, upcoming: [leadOf('lead-3')] },
    completedCalls: [],
    ...overrides,
  };
}

/** Minimal fake API keyed on path, so no component talks to a real server. */
function mockApi(routes) {
  return vi.fn(async (url, options = {}) => {
    const path = String(url).replace('http://localhost:3200', '');
    const key = `${options.method ?? 'GET'} ${path}`;
    const handler = routes[key];
    if (!handler) throw new Error(`unmocked request: ${key}`);
    const result = typeof handler === 'function' ? handler() : handler;
    if (result instanceof Error) throw result;
    return {
      ok: result.status === undefined || result.status < 400,
      status: result.status ?? 200,
      json: async () => result.body,
    };
  });
}

beforeEach(() => vi.stubGlobal('fetch', mockApi({})));
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------

describe('Screen 1 - leads and session creation (R-80..R-83)', () => {
  it('renders the seeded leads with name, company and phone', async () => {
    vi.stubGlobal('fetch', mockApi({ 'GET /leads': { body: { leads: LEADS } } }));
    render(<App />);

    expect(await screen.findByText('Amelia Hartono')).toBeInTheDocument();
    expect(screen.getByText('Nusantara Logistics')).toBeInTheDocument();
    expect(screen.getByText('+62 811 2000 101')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
  });

  it('disables "Create Dialer Session" with nothing selected, and enables it on a tick', async () => {
    vi.stubGlobal('fetch', mockApi({ 'GET /leads': { body: { leads: LEADS } } }));
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Amelia Hartono');

    const create = screen.getByRole('button', { name: /create dialer session/i });
    expect(create).toBeDisabled();

    await user.click(screen.getByRole('checkbox', { name: /select amelia/i }));
    expect(create).toBeEnabled();

    await user.click(screen.getByRole('checkbox', { name: /select amelia/i }));
    expect(create).toBeDisabled();
  });

  it('creates a session, then starts it and moves to Screen 2', async () => {
    vi.stubGlobal(
      'fetch',
      mockApi({
        'GET /leads': { body: { leads: LEADS } },
        'POST /sessions': { status: 201, body: sessionFixture({ status: 'STOPPED', startedAt: null }) },
        'POST /sessions/sess-1/start': { body: sessionFixture() },
        'GET /sessions/sess-1': { body: sessionFixture() },
      }),
    );
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Amelia Hartono');

    await user.click(screen.getByRole('checkbox', { name: /select amelia/i }));
    expect(screen.getByRole('button', { name: /^start$/i })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /create dialer session/i }));
    await screen.findByText(/press start to begin dialing/i);

    await user.click(screen.getByRole('button', { name: /^start$/i }));
    expect(await screen.findByRole('button', { name: /stop/i })).toBeInTheDocument();
  });

  it('shows an error instead of crashing when the leads request fails', async () => {
    vi.stubGlobal('fetch', mockApi({ 'GET /leads': () => new Error('network down') }));
    render(<App />);
    expect(await screen.findByText(/could not load leads/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------

describe('Screen 2 - the dialer session (R-84..R-88, R-96)', () => {
  function renderSession(session, extra = {}) {
    vi.stubGlobal('fetch', mockApi({ 'GET /sessions/sess-1': { body: session } }));
    return render(<SessionScreen sessionId="sess-1" onExpired={() => {}} onNewSession={() => {}} {...extra} />);
  }

  it('always renders exactly 2 line slots', async () => {
    renderSession(sessionFixture());
    expect(await screen.findByText('Line 1')).toBeInTheDocument();
    expect(screen.getByText('Line 2')).toBeInTheDocument();
  });

  it('shows lead name, phone and status on a line card', async () => {
    renderSession(sessionFixture());
    await screen.findByText('Line 1');
    expect(screen.getByText('Amelia Hartono')).toBeInTheDocument();
    expect(screen.getByText('+62 811 2000 101')).toBeInTheDocument();
    expect(screen.getAllByText(/dialing/i).length).toBeGreaterThan(0);
  });

  it('renders DIALING and LIVE differently, both driven by phase not by Call_Status (D-03)', async () => {
    renderSession(
      sessionFixture({
        lines: [
          { index: 0, call: callFixture('call-1', 'lead-1', { phase: 'LIVE' }) },
          { index: 1, call: callFixture('call-2', 'lead-2', { phase: 'DIALING' }) },
        ],
      }),
    );
    await screen.findByText('Line 1');
    expect(screen.getByText(/connected — live/i)).toBeInTheDocument();
    expect(screen.getByText(/dialing/i)).toBeInTheDocument();
  });

  it('keeps the idle line visible and labelled while a call is live (R-96)', async () => {
    renderSession(
      sessionFixture({
        lines: [
          { index: 0, call: callFixture('call-1', 'lead-1', { phase: 'LIVE' }) },
          { index: 1, call: null },
        ],
      }),
    );
    await screen.findByText('Line 2');
    expect(screen.getByText(/idle while you are on a call/i)).toBeInTheDocument();
  });

  it('renders the metrics from the payload', async () => {
    renderSession(sessionFixture({ metrics: { attempted: 5, connected: 2, failed: 2, canceled: 1 } }));
    await screen.findByText('Line 1');
    for (const label of ['Attempted', 'Connected', 'Failed', 'Canceled']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    const attempted = screen.getByText('Attempted').closest('.metric');
    expect(within(attempted).getByText('5')).toBeInTheDocument();
  });

  it('shows no winner until one exists, then shows the winning call', async () => {
    const { unmount } = renderSession(sessionFixture());
    expect(await screen.findByText(/no call has been answered yet/i)).toBeInTheDocument();
    unmount();

    const live = callFixture('call-1', 'lead-1', { phase: 'LIVE' });
    renderSession(sessionFixture({ winnerCallId: 'call-1', winnerCall: live, lines: [{ index: 0, call: live }, { index: 1, call: null }] }));
    expect(await screen.findByText(/winner call/i)).toBeInTheDocument();
    expect(screen.getByText(/on the call now/i)).toBeInTheDocument();
  });

  it('does not claim "Last connected" before anything has connected', async () => {
    renderSession(sessionFixture({ winnerCallId: null, winnerCall: null }));
    expect(await screen.findByText(/no call has been answered yet/i)).toBeInTheDocument();
    // Heading must not assert a connection that never happened.
    expect(screen.queryByText(/last connected/i)).not.toBeInTheDocument();
  });

  it('labels a finished winner "Last connected" rather than "Winner" (D-18)', async () => {
    const ended = callFixture('call-1', 'lead-1', { phase: 'ENDED', status: 'CONNECTED', activityId: 'act-1' });
    renderSession(
      sessionFixture({ status: 'STOPPED', winnerCallId: 'call-1', winnerCall: ended, lines: [{ index: 0, call: null }, { index: 1, call: null }] }),
    );
    expect(await screen.findByText(/last connected/i)).toBeInTheDocument();
    expect(screen.queryByText(/winner call/i)).not.toBeInTheDocument();
  });

  it('shows per-call CRM activity status, pending and created (R-88)', async () => {
    renderSession(
      sessionFixture({
        completedCalls: [
          callFixture('call-2', 'lead-2', { phase: 'ENDED', status: 'NO_ANSWER', activityId: 'act-7' }),
        ],
      }),
    );
    await screen.findByText('Line 1');
    expect(screen.getAllByText(/crm activity pending/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/crm activity created/i)).toBeInTheDocument();
    expect(screen.getByText('act-7')).toBeInTheDocument();
  });

  it('offers "New session" rather than Start once the session is finished (R-94)', async () => {
    renderSession(sessionFixture({ status: 'STOPPED', completionReason: 'QUEUE_EXHAUSTED' }));
    expect(await screen.findByRole('button', { name: /new session/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /stop/i })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------

describe('polling (R-89, R-90, R-92, R-93)', () => {
  it('polls on an interval between 1000 and 2000 ms', () => {
    expect(POLL_INTERVAL_MS).toBeGreaterThanOrEqual(1000);
    expect(POLL_INTERVAL_MS).toBeLessThanOrEqual(2000);
  });

  it('keeps polling a RUNNING session', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchMock = mockApi({ 'GET /sessions/sess-1': { body: sessionFixture() } });
    vi.stubGlobal('fetch', fetchMock);

    render(<SessionScreen sessionId="sess-1" onExpired={() => {}} onNewSession={() => {}} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
    });
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('stops polling once the session is STOPPED (R-90)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchMock = mockApi({ 'GET /sessions/sess-1': { body: sessionFixture({ status: 'STOPPED' }) } });
    vi.stubGlobal('fetch', fetchMock);

    render(<SessionScreen sessionId="sess-1" onExpired={() => {}} onNewSession={() => {}} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 5);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('stops polling on unmount', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchMock = mockApi({ 'GET /sessions/sess-1': { body: sessionFixture() } });
    vi.stubGlobal('fetch', fetchMock);

    const { unmount } = render(<SessionScreen sessionId="sess-1" onExpired={() => {}} onNewSession={() => {}} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    unmount();
    const afterUnmount = fetchMock.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 5);
    });
    expect(fetchMock).toHaveBeenCalledTimes(afterUnmount);
  });

  it('a failed poll shows an error and keeps the last good data on screen (R-92)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let fail = false;
    const fetchMock = mockApi({
      'GET /sessions/sess-1': () => (fail ? new Error('connection reset') : { body: sessionFixture() }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<SessionScreen sessionId="sess-1" onExpired={() => {}} onNewSession={() => {}} />);
    expect(await screen.findByText('Amelia Hartono')).toBeInTheDocument();

    fail = true;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2);
    });

    expect(await screen.findByText(/lost contact with the server/i)).toBeInTheDocument();
    // The last known state is still rendered - the screen did not blank.
    expect(screen.getByText('Amelia Hartono')).toBeInTheDocument();
  });

  it('a 404 poll returns to Screen 1 with a session-expired notice (R-93)', async () => {
    vi.stubGlobal(
      'fetch',
      mockApi({
        'GET /leads': { body: { leads: LEADS } },
        'GET /sessions/sess-1': { status: 404, body: { error: 'Unknown session: sess-1' } },
        'POST /sessions': { status: 201, body: sessionFixture({ status: 'STOPPED', startedAt: null }) },
        'POST /sessions/sess-1/start': { body: sessionFixture() },
      }),
    );
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Amelia Hartono');
    await user.click(screen.getByRole('checkbox', { name: /select amelia/i }));
    await user.click(screen.getByRole('button', { name: /create dialer session/i }));
    await screen.findByText(/press start to begin dialing/i);
    await user.click(screen.getByRole('button', { name: /^start$/i }));

    expect(await screen.findByText(/that session expired/i)).toBeInTheDocument();
    expect(screen.getByText('Amelia Hartono')).toBeInTheDocument();
  });
});
