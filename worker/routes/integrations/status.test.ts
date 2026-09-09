import { describe, expect, it } from 'vitest';
import { handleIntegrationsStatus } from './status';
import type { Env } from '../../types';

function env(overrides: Partial<Env> = {}): Env {
  return {
    ASSETS: { fetch: async () => new Response('asset') },
    ...overrides,
  };
}

describe('integration readiness status', () => {
  it('reports missing runtime secrets without echoing sensitive values', async () => {
    const response = await handleIntegrationsStatus(new Request('https://example.com/api/integrations/status'), env());
    const body = await response.json();

    expect(body).toEqual({
      openFinance: { configured: false, provider: 'pluggy' },
      ai: { configured: false, provider: 'gemini' },
    });
    expect(JSON.stringify(body)).not.toContain('secret');
  });

  it('reports both integrations configured when Worker bindings exist', async () => {
    const response = await handleIntegrationsStatus(new Request('https://example.com/api/integrations/status'), env({
      PLUGGY_CLIENT_ID: 'client-id',
      PLUGGY_CLIENT_SECRET: 'client-secret',
      GEMINI_API_KEY: 'gemini-key',
    }));
    const body = await response.json();

    expect(body).toEqual({
      openFinance: { configured: true, provider: 'pluggy' },
      ai: { configured: true, provider: 'gemini' },
    });
    expect(JSON.stringify(body)).not.toContain('client-id');
    expect(JSON.stringify(body)).not.toContain('client-secret');
    expect(JSON.stringify(body)).not.toContain('gemini-key');
  });
});
