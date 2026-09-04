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
      data.code === 'AI_NOT_CONFIGURED' ? 'A explicação por IA ainda não está configurada neste ambiente.' : data.error || 'A IA está temporariamente indisponível.',
    );
  }
  return data as T;
}

export const explainRadar = (input: AiExplainInput) => postJson<AiRadarExplanation>('/api/ai/explain', input);
export const suggestCategory = (input: AiCategoryInput) => postJson<AiCategorySuggestion>('/api/ai/categorize', input);
