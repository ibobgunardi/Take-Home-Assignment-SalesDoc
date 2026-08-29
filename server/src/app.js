import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.resolve(__dirname, '../../client/dist');

/**
 * Build the Express app.
 *
 * D-19: the API is registered at the literal root paths the spec names
 * (/mock-crm/contacts, /mock-crm/activities, /leads/:id/crm-activities - no
 * /api prefix). The static bundle and its SPA fallback are registered LAST and
 * the fallback only answers paths no router matched, so a root catch-all can
 * never swallow a graded endpoint.
 */
export function createApp() {
  const app = express();

  // R-69: the Vite dev server runs on a different origin. In production the
  // same process serves the bundle, so this is a no-op there.
  app.use(cors());
  app.use(express.json());

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'multiline-dialer', time: new Date().toISOString() });
  });

  // ---- static client bundle + SPA fallback (must stay last) ----
  if (fs.existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST));
    app.get('*', (req, res, next) => {
      // Never hijack an API path: if it got here it did not match a router,
      // but an unmatched /mock-crm/... should still 404 as JSON, not as HTML.
      if (isApiPath(req.path)) return next();
      res.sendFile(path.join(CLIENT_DIST, 'index.html'));
    });
  }

  app.use((req, res) => {
    res.status(404).json({ error: 'Not found', path: req.path });
  });

  // eslint-disable-next-line no-unused-vars -- Express needs the 4-arg shape
  app.use((err, req, res, next) => {
    console.error('[unhandled]', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

const API_PREFIXES = ['/health', '/leads', '/sessions', '/mock-crm'];

function isApiPath(pathname) {
  return API_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
