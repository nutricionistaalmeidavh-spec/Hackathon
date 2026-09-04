import { jsonResponse } from '../../../server/pluggy';
import { parseMarketResearchRequest, parseMarketResearchResponse } from '../../ai/plannerContracts';
import { AiInvalidResponseError, AiUpstreamError, callGeminiStructured } from '../../ai/gemini';
import type { RouteHandler } from '../../types';

const DISCLAIMER = 'Simulação informativa, não previsão. Não constitui recomendação de investimento, oferta ou indicação de compra/venda. Retornos passados não garantem resultados futuros.';

const responseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    entity: {
      type: 'object', additionalProperties: false,
      properties: {
        name: { type: 'string' },
        symbol: { type: 'string' },
        assetClass: { type: 'string' },
        exchange: { type: 'string' },
        currency: { type: 'string' },
      },
      required: ['name','symbol','assetClass','exchange','currency'],
    },
    facts: {
      type: 'array', minItems: 0, maxItems: 12,
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          key: { type: 'string' }, label: { type: 'string' }, value: { type: 'string' },
          asOf: { type: 'string' }, sourceUrl: { type: 'string' }, sourceTitle: { type: 'string' },
        },
        required: ['key','label','value','asOf','sourceUrl','sourceTitle'],
      },
    },
    summary: { type: 'string' },
  },
  required: ['entity','facts','summary'],
};

export const handleAiMarketResearch: RouteHandler = async (request, env) => {
  const apiKey = String(env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return jsonResponse({ code: 'AI_NOT_CONFIGURED', error: 'Market research AI is not configured.' }, 503);

  const raw = await request.json().catch(() => null);
  const input = parseMarketResearchRequest(raw);
  if (!input) return jsonResponse({ code: 'INVALID_AI_REQUEST', error: 'Invalid market research request.' }, 400);

  const prompt = [
    'Você é a camada de pesquisa factual de mercado do app Where\'s the Money.',
    'Identifique exatamente o ativo, produto ou tipo de crédito citado pelo usuário e use pesquisa Google para buscar referências atuais e históricas úteis.',
    'Responda em português do Brasil. Não recomende compra, venda ou alocação e não escolha o melhor investimento para a pessoa.',
    'Priorize fontes oficiais/primárias e fontes financeiras reconhecidas. Para cada fato, inclua URL, título da fonte e data de referência quando disponível.',
    'Quando houver histórico, diferencie retorno passado de premissa futura. Cite limitações e evite criar probabilidades de sobrevivência/segurança sem metodologia defensável.',
    'Os cálculos de aportes, juros, parcelas e patrimônio serão feitos depois por um motor determinístico; não faça deles a fonte de verdade.',
    `PESQUISA=${JSON.stringify(input)}`,
  ].join('\n');

  try {
    const rawOutput = await callGeminiStructured(apiKey, prompt, responseSchema, { googleSearch: true, maxOutputTokens: 1400 });
    const parsed = parseMarketResearchResponse(rawOutput);
    if (!parsed) return jsonResponse({ code: 'AI_INVALID_RESPONSE', error: 'AI returned invalid market research.' }, 502);
    return jsonResponse({ ...parsed, fetchedAt: new Date().toISOString(), disclaimer: DISCLAIMER });
  } catch (error) {
    if (error instanceof AiInvalidResponseError) return jsonResponse({ code: 'AI_INVALID_RESPONSE', error: 'AI returned invalid market research.' }, 502);
    if (error instanceof AiUpstreamError) return jsonResponse({ code: 'AI_UPSTREAM_ERROR', error: 'Market research is temporarily unavailable.' }, 502);
    return jsonResponse({ code: 'AI_UPSTREAM_ERROR', error: 'Market research is temporarily unavailable.' }, 502);
  }
};
