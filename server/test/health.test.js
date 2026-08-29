import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('server skeleton', () => {
  it('answers GET /health', async () => {
    const res = await request(createApp()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  /**
   * Regression guard for the D-19 ordering constraint: in production the same
   * process serves the React bundle, and a root catch-all would happily answer
   * /mock-crm/contacts with index.html - turning a graded endpoint into a
   * silent HTML 200. The SPA fallback must decline API paths.
   *
   * Deliberately asserted on an API path, not an arbitrary one: an arbitrary
   * path IS a valid SPA route, so asserting 404 there would pass or fail
   * depending on whether client/dist happened to be built.
   */
  it('returns a JSON 404 for an unmatched API path, never the SPA shell', async () => {
    for (const path of ['/mock-crm/nope', '/leads/lead-1/nope', '/sessions/sess-1/nope']) {
      const res = await request(createApp()).get(path);
      expect(res.status, path).toBe(404);
      expect(res.body.error, path).toBe('Not found');
      expect(res.headers['content-type'], path).toMatch(/json/);
    }
  });
});
