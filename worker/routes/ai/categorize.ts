import { jsonResponse } from '../../../server/pluggy';
import { AI_CATEGORIES, parseCategorizeRequest, parseCategorizeResponse } from '../../ai/contracts';
import { AiInvalidResponseError, AiUpstreamError, callGeminiStructured } from '../../ai/gemini';
import type { RouteHandler } from '../../types';

const responseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    suggestedCategory: { type: 'string', enum: [...AI_CATEGORIES] },
    confidence: { type: 'integer', minimum: 0, maximum: 100 },
    reason: { type: 'string' },
    needsConfirmation: { type: 'boolean', enum: [true] },
  },
  required: ['suggestedCategory', 'confidence', 'reason', 'needsConfirmation'],
};

export const handleAiCategorize: RouteHandler = async (request, env) => {
  const apiKey = String(env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return jsonResponse({ code: 'AI_NOT_CONFIGURED', error: 'AI categorization is not configured.' }, 503);

  const raw = await request.json().catch(() => null);
  const input = parseCategorizeRequest(raw);
  if (!input) return jsonResponse({ code: 'INVALID_AI_REQUEST', error: 'Invalid AI categorization request.' }, 400);

  const prompt = [
    'Você sugere uma categoria para UMA movimentação financeira ambígua do app Where\'s the Money.',
    'Use somente descrição, contraparte, direção e categoria do provedor fornecidas.',
    'Não invente estabelecimento, contexto, valor, recorrência ou histórico.',
    'A sugestão é apenas consultiva e sempre exige confirmação do usuário.',
    `CATEGORIAS_PERMITIDAS=${JSON.stringify(AI_CATEGORIES)}`,
    `MOVIMENTACAO=${JSON.stringify(input)}`,
  ].join('\n');

  try {
    const modelOutput = await callGeminiStructured(apiKey, prompt, responseSchema);
    const parsed = parseCategorizeResponse(modelOutput);
    if (!parsed) return jsonResponse({ code: 'AI_INVALID_RESPONSE', error: 'AI returned an invalid category suggestion.' }, 502);
    return jsonResponse(parsed);
  } catch (error) {
    if (error instanceof AiInvalidResponseError) return jsonResponse({ code: 'AI_INVALID_RESPONSE', error: 'AI returned an invalid category suggestion.' }, 502);
    if (error instanceof AiUpstreamError) return jsonResponse({ code: 'AI_UPSTREAM_ERROR', error: 'AI service is temporarily unavailable.' }, 502);
    return jsonResponse({ code: 'AI_UPSTREAM_ERROR', error: 'AI service is temporarily unavailable.' }, 502);
  }
};
