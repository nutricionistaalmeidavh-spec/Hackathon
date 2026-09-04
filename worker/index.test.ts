import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from './index';

const makeEnv = (overrides: Record<string, unknown> = {}) => ({
  PLUGGY_CLIENT_ID: undefined,
  PLUGGY_CLIENT_SECRET: undefined,
  GEMINI_API_KEY: undefined,
  ASSETS: {
    fetch: vi.fn(async () => new Response('asset-response')),
  },
  ...overrides,
});

const explainPayload = {
  startingBalance: 250000,
  minimumBalance: -18500,
  minimumDate: '2026-09-14',
  endingBalance: 94000,
  drivers: [
    { label: 'Fatura cartão', category: 'Cartão de crédito', delta: -148000, date: '2026-09-12', confidence: 96 },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
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

  it('keeps Gemini optional when its secret is absent', async () => {
    const response = await worker.fetch(
      new Request('https://example.com/api/ai/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(explainPayload),
      }),
      makeEnv(),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      code: 'AI_NOT_CONFIGURED',
      error: 'AI explanation is not configured.',
    });
  });

  it('rejects malformed AI payloads before calling Gemini', async () => {
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);

    const response = await worker.fetch(
      new Request('https://example.com/api/ai/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...explainPayload, drivers: Array.from({ length: 20 }, (_, i) => ({ label: `Driver ${i}`, category: 'Outros', delta: -100, date: '2026-09-12' })) }),
      }),
      makeEnv({ GEMINI_API_KEY: 'test-key' }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'INVALID_AI_REQUEST' });
    expect(upstream).not.toHaveBeenCalled();
  });

  it('normalizes a valid Gemini structured explanation', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      id: 'interaction-test',
      status: 'completed',
      steps: [{
        type: 'model_output',
        content: [{
          type: 'text',
          text: JSON.stringify({
            summary: 'As maiores saídas se concentram antes do próximo recebimento.',
            primaryReason: 'A fatura do cartão é o maior impacto do período.',
            actions: ['Revise a fatura prevista.'],
          }),
        }],
      }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    const response = await worker.fetch(
      new Request('https://example.com/api/ai/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(explainPayload),
      }),
      makeEnv({ GEMINI_API_KEY: 'test-key' }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      summary: 'As maiores saídas se concentram antes do próximo recebimento.',
      primaryReason: 'A fatura do cartão é o maior impacto do período.',
      actions: ['Revise a fatura prevista.'],
    });
  });

  it('requires user confirmation for Gemini category suggestions', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      status: 'completed',
      steps: [{ type: 'model_output', content: [{ type: 'text', text: JSON.stringify({
        suggestedCategory: 'Alimentação',
        confidence: 72,
        reason: 'Descrição compatível, mas sem evidência determinística suficiente.',
        needsConfirmation: true,
      }) }] }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    const response = await worker.fetch(
      new Request('https://example.com/api/ai/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'PIX M J SILVA 9834', counterparty: 'M J Silva', direction: 'debit' }),
      }),
      makeEnv({ GEMINI_API_KEY: 'test-key' }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      suggestedCategory: 'Alimentação',
      confidence: 72,
      needsConfirmation: true,
    });
  });
});
