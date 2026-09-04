import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from './index';

const makeEnv = (overrides: Record<string, unknown> = {}) => ({
  PLUGGY_CLIENT_ID: undefined,
  PLUGGY_CLIENT_SECRET: undefined,
  GEMINI_API_KEY: undefined,
  ASSETS: { fetch: vi.fn(async () => new Response('asset-response')) },
  ...overrides,
});

const plannerPayload = {
  stage: 'goals',
  snapshot: { incomeAmount: 500000, essentialPercent: 55, flexiblePercent: 20, futurePercent: 10, uncategorizedPercent: 15 },
  goals: [],
  adjustments: [],
  recentMessages: [{ role: 'user', text: 'Quero me aposentar aos 60 e trocar de carro.' }],
};

afterEach(() => vi.unstubAllGlobals());

describe('planner AI routes', () => {
  it('keeps planner usable when Gemini is not configured', async () => {
    const response = await worker.fetch(new Request('https://example.com/api/ai/planner-turn', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(plannerPayload),
    }), makeEnv());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'AI_NOT_CONFIGURED' });
  });

  it('rejects malformed planner payloads before upstream', async () => {
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);
    const response = await worker.fetch(new Request('https://example.com/api/ai/planner-turn', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage: 'anything', recentMessages: [] }),
    }), makeEnv({ GEMINI_API_KEY: 'test-key' }));
    expect(response.status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('uses Google Search grounding for market research and returns normalized sources', async () => {
    const upstream = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || '{}'));
      expect(body.tools).toEqual([{ type: 'google_search' }]);
      return new Response(JSON.stringify({
        status: 'completed',
        steps: [{
          type: 'model_output',
          content: [{
            type: 'text',
            text: JSON.stringify({
              entity: { name: 'Itaúsa S.A.', symbol: 'ITSA4', assetClass: 'equity', exchange: 'B3', currency: 'BRL' },
              facts: [{ key: 'history', label: 'Histórico disponível', value: 'mais de 20 anos', asOf: '2026-09-04' }],
              summary: 'Ação negociada na B3 com histórico longo. Use retornos passados apenas como referência de cenário.',
            }),
          }],
        }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    vi.stubGlobal('fetch', upstream);

    const response = await worker.fetch(new Request('https://example.com/api/ai/market-research', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: 'Itaúsa', purpose: 'aposentadoria' }),
    }), makeEnv({ GEMINI_API_KEY: 'test-key' }));

    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    expect(body).toMatchObject({
      entity: { name: 'Itaúsa S.A.', symbol: 'ITSA4', assetClass: 'equity' },
      disclaimer: expect.stringContaining('não constitui recomendação'),
    });
    expect(Array.isArray(body.facts)).toBe(true);
  });
});
