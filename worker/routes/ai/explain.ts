import { jsonResponse } from '../../../server/pluggy';
import { parseExplainRequest, parseExplainResponse } from '../../ai/contracts';
import { AiInvalidResponseError, AiUpstreamError, callGeminiStructured } from '../../ai/gemini';
import type { RouteHandler } from '../../types';

const responseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string', description: 'Concise explanation in Brazilian Portuguese of the supplied deterministic financial facts.' },
    primaryReason: { type: 'string', description: 'The single strongest reason visible in the supplied drivers.' },
    actions: { type: 'array', minItems: 0, maxItems: 3, items: { type: 'string' } },
  },
  required: ['summary', 'primaryReason', 'actions'],
};

export const handleAiExplain: RouteHandler = async (request, env) => {
  const apiKey = String(env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return jsonResponse({ code: 'AI_NOT_CONFIGURED', error: 'AI explanation is not configured.' }, 503);

  const raw = await request.json().catch(() => null);
  const input = parseExplainRequest(raw);
  if (!input) return jsonResponse({ code: 'INVALID_AI_REQUEST', error: 'Invalid AI explanation request.' }, 400);

  const prompt = [
    'Você é a camada de explicação do app financeiro Where\'s the Money.',
    'Os números abaixo já foram calculados por um motor determinístico e são a fonte de verdade.',
    'Não recalcule, não altere números, não invente saldo, transação, recorrência ou causa ausente.',
    'Explique apenas relações evidentes nos fatos fornecidos, em português do Brasil, com tom claro e curto.',
    'Sugestões devem ser prudentes e não constituem aconselhamento financeiro profissional.',
    `FATOS=${JSON.stringify(input)}`,
  ].join('\n');

  try {
    const modelOutput = await callGeminiStructured(apiKey, prompt, responseSchema);
    const parsed = parseExplainResponse(modelOutput);
    if (!parsed) return jsonResponse({ code: 'AI_INVALID_RESPONSE', error: 'AI returned an invalid explanation.' }, 502);
    return jsonResponse(parsed);
  } catch (error) {
    if (error instanceof AiInvalidResponseError) return jsonResponse({ code: 'AI_INVALID_RESPONSE', error: 'AI returned an invalid explanation.' }, 502);
    if (error instanceof AiUpstreamError) return jsonResponse({ code: 'AI_UPSTREAM_ERROR', error: 'AI service is temporarily unavailable.' }, 502);
    return jsonResponse({ code: 'AI_UPSTREAM_ERROR', error: 'AI service is temporarily unavailable.' }, 502);
  }
};
