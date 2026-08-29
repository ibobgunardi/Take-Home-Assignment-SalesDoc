import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App.jsx';

afterEach(() => vi.restoreAllMocks());

describe('client skeleton', () => {
  it('renders the app title', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    render(<App />);
    expect(screen.getByRole('heading', { name: /multi-line dialer/i })).toBeInTheDocument();
  });

  it('shows an error rather than crashing when the API is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network down'))));
    render(<App />);
    expect(await screen.findByText(/could not reach the api/i)).toBeInTheDocument();
  });
});
