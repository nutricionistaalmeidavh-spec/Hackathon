import { describe, expect, it, vi } from 'vitest';
import worker from './index';

const makeEnv = () => ({
  PLUGGY_CLIENT_ID: undefined,
  PLUGGY_CLIENT_SECRET: undefined,
  ASSETS: {
    fetch: vi.fn(async () => new Response('asset-response')),
  },
});

describe('Worker router', () => {
  it('reports Pluggy as unconfigured when secrets are absent', async () => {
    const env = makeEnv();
    const response = await worker.fetch(
      new Request('https://example.com/api/open-finance/status'),
      env,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      configured: false,
      authenticated: false,
      code: 'missing',
      provider: 'Pluggy',
      environment: 'sandbox',
    });
  });

  it('returns 405 for a known route with the wrong method', async () => {
    const response = await worker.fetch(
      new Request('https://example.com/api/open-finance/status', { method: 'POST' }),
      makeEnv(),
    );

    expect(response.status).toBe(405);
    expect(await response.json()).toEqual({ error: 'Method not allowed.' });
  });

  it('returns JSON 404 for an unknown API route', async () => {
    const response = await worker.fetch(
      new Request('https://example.com/api/unknown'),
      makeEnv(),
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({ error: 'Not found.' });
  });

  it('delegates non-API requests to ASSETS', async () => {
    const env = makeEnv();
    const request = new Request('https://example.com/dashboard');
    const response = await worker.fetch(request, env);

    expect(env.ASSETS.fetch).toHaveBeenCalledWith(request);
    expect(await response.text()).toBe('asset-response');
  });

  it('keeps data request validation', async () => {
    const response = await worker.fetch(
      new Request('https://example.com/api/open-finance/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      }),
      makeEnv(),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'itemId is required.' });
  });
});
