import { useEffect, useState } from 'react';
import { apiGet } from './api.js';

// Walking skeleton (slice 1/2): proves the deployed process serves both the
// bundle and the API from one origin. Replaced by Screen 1 / Screen 2.
export default function App() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiGet('/health')
      .then(setHealth)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <main className="app">
      <header className="app-header">
        <h1>Multi-Line Dialer</h1>
        <p className="subtitle">2-line power dialer with a mock CRM</p>
      </header>
      <section className="panel">
        <h2>API connection</h2>
        {!health && !error && <p className="muted">Checking…</p>}
        {error && <p className="error">Could not reach the API: {error}</p>}
        {health && (
          <p className="ok">
            API reachable — <code>{health.status}</code> at {health.time}
          </p>
        )}
      </section>
    </main>
  );
}
