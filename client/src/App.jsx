import { useState } from 'react';
import LeadsScreen from './LeadsScreen.jsx';
import SessionScreen from './SessionScreen.jsx';

/**
 * Two screens, swapped by state. A router would add a dependency for no
 * requirement - the spec asks for two screens, not for URLs.
 */
export default function App() {
  const [sessionId, setSessionId] = useState(null);
  const [notice, setNotice] = useState(null);

  return (
    <main className="app">
      <header className="app-header">
        <h1>Multi-Line Dialer</h1>
        <p className="subtitle">
          Two lines, a shared queue, and a mock CRM that records every call outcome.
        </p>
      </header>

      {sessionId ? (
        <SessionScreen
          sessionId={sessionId}
          // R-93: the server restarted and lost this in-memory session.
          onExpired={() => {
            setSessionId(null);
            setNotice(
              'That session expired - the server restarted and its state is held in memory. Create a new session to continue.',
            );
          }}
          onNewSession={() => {
            setSessionId(null);
            setNotice(null);
          }}
        />
      ) : (
        <LeadsScreen
          notice={notice}
          onStarted={(id) => {
            setNotice(null);
            setSessionId(id);
          }}
        />
      )}
    </main>
  );
}
