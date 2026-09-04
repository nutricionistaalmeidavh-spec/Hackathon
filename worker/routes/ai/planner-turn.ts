import { jsonResponse } from '../../../server/pluggy';
import { parsePlannerTurnRequest, parsePlannerTurnResponse } from '../../ai/plannerContracts';
import { AiInvalidResponseError, AiUpstreamError, callGeminiStructured } from '../../ai/gemini';
import type { RouteHandler } from '../../types';

const responseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    reply: { type: 'string' },
    nextStage: { type: 'string', enum: ['snapshot','goals','constraints','adjustments','funding','market-context','scenarios','confirm','active-plan'] },
    candidateFacts: {
      type: 'array', minItems: 0, maxItems: 8,
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          type: { type: 'string' },
          label: { type: 'string' },
          value: { type: 'string' },
          needsConfirmation: { type: 'boolean', enum: [true] },
        },
        required: ['type','label','value','needsConfirmation'],
      },
    },
    quickReplies: { type: 'array', minItems: 0, maxItems: 5, items: { type: 'string' } },
  },
  required: ['reply','nextStage','candidateFacts','quickReplies'],
};

export const handleAiPlannerTurn: RouteHandler = async (request, env) => {
  const apiKey = String(env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return jsonResponse({ code: 'AI_NOT_CONFIGURED', error: 'Conversational planner AI is not configured.' }, 503);

  const raw = await request.json().catch(() => null);
  const input = parsePlannerTurnRequest(raw);
  if (!input) return jsonResponse({ code: 'INVALID_AI_REQUEST', error: 'Invalid planner request.' }, 400);

  const prompt = [
    'Você conduz a sessão de planejamento financeiro do app Where\'s the Money em português do Brasil.',
    'Mantenha-se estritamente no objetivo de organizar orçamento, metas, prazos, prioridades e alternativas financeiras.',
    'Os números do snapshot e do plano confirmado são fatos calculados pelo sistema: não recalcule e não os altere.',
    'Faça no máximo uma pergunta realmente necessária por resposta. Use dados já conhecidos e não peça de novo.',
    'Extraia apenas fatos candidatos explícitos da mensagem do usuário. Todo fato candidato deve exigir confirmação.',
    'Não recomende compra ou venda de valores mobiliários e não escolha investimentos pelo usuário.',
    'Se o usuário citar um ativo/produto, reconheça que ele poderá ser pesquisado em etapa própria de contexto de mercado.',
    `SESSAO=${JSON.stringify(input)}`,
  ].join('\n');

  try {
    const rawOutput = await callGeminiStructured(apiKey, prompt, responseSchema, { maxOutputTokens: 900 });
    const parsed = parsePlannerTurnResponse(rawOutput);
    if (!parsed) return jsonResponse({ code: 'AI_INVALID_RESPONSE', error: 'AI returned an invalid planner response.' }, 502);
    return jsonResponse(parsed);
  } catch (error) {
    if (error instanceof AiInvalidResponseError) return jsonResponse({ code: 'AI_INVALID_RESPONSE', error: 'AI returned an invalid planner response.' }, 502);
    if (error instanceof AiUpstreamError) return jsonResponse({ code: 'AI_UPSTREAM_ERROR', error: 'AI service is temporarily unavailable.' }, 502);
    return jsonResponse({ code: 'AI_UPSTREAM_ERROR', error: 'AI service is temporarily unavailable.' }, 502);
  }
};
