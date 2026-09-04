export type AiExplainInput = {
  startingBalance: number;
  minimumBalance: number;
  minimumDate: string;
  endingBalance: number;
  drivers: Array<{ label: string; category: string; delta: number; date: string; confidence?: number }>;
};

export type AiRadarExplanation = {
  summary: string;
  primaryReason: string;
  actions: string[];
};

export type AiCategoryInput = {
  description: string;
  counterparty: string;
  direction: 'credit' | 'debit';
  providerCategory?: string;
};

export type AiCategorySuggestion = {
  suggestedCategory: string;
  confidence: number;
  reason: string;
  needsConfirmation: true;
};

export type AiPlannerTurnInput = {
  stage: 'snapshot'|'goals'|'constraints'|'adjustments'|'funding'|'market-context'|'scenarios'|'confirm'|'active-plan';
  snapshot: {
    incomeAmount: number;
    essentialPercent: number | null;
    flexiblePercent: number | null;
    futurePercent: number | null;
    uncategorizedPercent: number | null;
  };
  goals: Array<Record<string, unknown>>;
  adjustments: Array<Record<string, unknown>>;
  recentMessages: Array<{ role: 'user'|'assistant'; text: string }>;
};

export type AiPlannerCandidateFact = {
  type: string;
  label: string;
  value?: string | number;
  needsConfirmation: true;
};

export type AiPlannerTurn = {
  reply: string;
  nextStage: AiPlannerTurnInput['stage'];
  candidateFacts: AiPlannerCandidateFact[];
  quickReplies: string[];
};

export type AiMarketResearchInput = { query: string; purpose?: string };
export type AiMarketResearch = {
  entity: { name: string; symbol?: string; assetClass: string; exchange?: string; currency?: string };
  facts: Array<{ key: string; label: string; value: string; asOf?: string; sourceUrl?: string; sourceTitle?: string }>;
  summary: string;
  fetchedAt: string;
  disclaimer: string;
};

export class AiFeatureError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({})) as { code?: string; error?: string };
  if (!response.ok) {
    throw new AiFeatureError(
      data.code || 'AI_REQUEST_FAILED',
      data.code === 'AI_NOT_CONFIGURED' ? 'Os recursos de IA ainda não estão configurados neste ambiente.' : data.error || 'A IA está temporariamente indisponível.',
    );
  }
  return data as T;
}

export const explainRadar = (input: AiExplainInput) => postJson<AiRadarExplanation>('/api/ai/explain', input);
export const suggestCategory = (input: AiCategoryInput) => postJson<AiCategorySuggestion>('/api/ai/categorize', input);
export const plannerTurn = (input: AiPlannerTurnInput) => postJson<AiPlannerTurn>('/api/ai/planner-turn', input);
export const researchMarket = (input: AiMarketResearchInput) => postJson<AiMarketResearch>('/api/ai/market-research', input);
