// In production the Express process serves this bundle, so the API is
// same-origin and the base is empty. In `npm run dev` the Vite dev server is a
// different origin, so we point at the API port directly (R-69 enables CORS
// there).
export const API_BASE = import.meta.env.DEV ? 'http://localhost:3200' : '';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiGet(path) {
  return request(path, { method: 'GET' });
}

export async function apiPost(path, body) {
  return request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function request(path, options) {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const payload = await res.json();
      if (payload?.error) message = payload.error;
    } catch {
      // response had no JSON body; keep the status-based message
    }
    throw new ApiError(message, res.status);
  }
  return res.json();
}
