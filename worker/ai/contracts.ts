export const AI_CATEGORIES = ['Salário','Recebimento','Condomínio','Moradia','Energia','Telefonia/Internet','Assinaturas','Academia','Cartão de crédito','Combustível','Supermercado','Alimentação','Conveniência','Transporte','Saúde','Serviços','Impostos','Folha/Pessoal','Fornecedor','Outros'] as const;

export type AiExplainDriver = {
  label: string;
  category: string;
  delta: number;
  date: string;
  confidence?: number;
};

export type AiExplainRequest = {
  startingBalance: number;
  minimumBalance: number;
  minimumDate: string;
  endingBalance: number;
  drivers: AiExplainDriver[];
};

export type AiExplainResponse = {
  summary: string;
  primaryReason: string;
  actions: string[];
};

export type AiCategorizeRequest = {
  description: string;
  counterparty: string;
  direction: 'credit' | 'debit';
  providerCategory?: string;
};

export type AiCategorizeResponse = {
  suggestedCategory: typeof AI_CATEGORIES[number];
  confidence: number;
  reason: string;
  needsConfirmation: true;
};

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isInteger = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value);
const bounded = (value: unknown, max: number, allowEmpty = false) => typeof value === 'string' && value.length <= max && (allowEmpty || value.trim().length > 0);
const dateOnly = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
const hasOnlyKeys = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every(key => allowed.includes(key));

export function parseExplainRequest(value: unknown): AiExplainRequest | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ['startingBalance', 'minimumBalance', 'minimumDate', 'endingBalance', 'drivers'])) return null;
  if (!isInteger(value.startingBalance) || !isInteger(value.minimumBalance) || !isInteger(value.endingBalance) || !dateOnly(value.minimumDate)) return null;
  if (!Array.isArray(value.drivers) || value.drivers.length > 5) return null;

  const drivers: AiExplainDriver[] = [];
  for (const raw of value.drivers) {
    if (!isRecord(raw) || !hasOnlyKeys(raw, ['label', 'category', 'delta', 'date', 'confidence'])) return null;
    if (!bounded(raw.label, 100) || !bounded(raw.category, 80) || !isInteger(raw.delta) || !dateOnly(raw.date)) return null;
    if (raw.confidence !== undefined && (!isInteger(raw.confidence) || Number(raw.confidence) < 0 || Number(raw.confidence) > 100)) return null;
    drivers.push({
      label: String(raw.label).trim(),
      category: String(raw.category).trim(),
      delta: Number(raw.delta),
      date: String(raw.date),
      ...(raw.confidence === undefined ? {} : { confidence: Number(raw.confidence) }),
    });
  }

  return {
    startingBalance: Number(value.startingBalance),
    minimumBalance: Number(value.minimumBalance),
    minimumDate: String(value.minimumDate),
    endingBalance: Number(value.endingBalance),
    drivers,
  };
}

export function parseCategorizeRequest(value: unknown): AiCategorizeRequest | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ['description', 'counterparty', 'direction', 'providerCategory'])) return null;
  if (!bounded(value.description, 160) || !bounded(value.counterparty, 120, true)) return null;
  if (value.direction !== 'credit' && value.direction !== 'debit') return null;
  if (value.providerCategory !== undefined && !bounded(value.providerCategory, 120, true)) return null;
  return {
    description: String(value.description).trim(),
    counterparty: String(value.counterparty).trim(),
    direction: value.direction,
    ...(value.providerCategory === undefined ? {} : { providerCategory: String(value.providerCategory).trim() }),
  };
}

export function parseExplainResponse(value: unknown): AiExplainResponse | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ['summary', 'primaryReason', 'actions'])) return null;
  if (!bounded(value.summary, 800) || !bounded(value.primaryReason, 500)) return null;
  if (!Array.isArray(value.actions) || value.actions.length > 3 || !value.actions.every(action => bounded(action, 240))) return null;
  return {
    summary: String(value.summary).trim(),
    primaryReason: String(value.primaryReason).trim(),
    actions: value.actions.map(action => String(action).trim()),
  };
}

export function parseCategorizeResponse(value: unknown): AiCategorizeResponse | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ['suggestedCategory', 'confidence', 'reason', 'needsConfirmation'])) return null;
  if (!AI_CATEGORIES.includes(value.suggestedCategory as typeof AI_CATEGORIES[number])) return null;
  if (!isInteger(value.confidence) || Number(value.confidence) < 0 || Number(value.confidence) > 100) return null;
  if (!bounded(value.reason, 500) || value.needsConfirmation !== true) return null;
  return {
    suggestedCategory: value.suggestedCategory as typeof AI_CATEGORIES[number],
    confidence: Number(value.confidence),
    reason: String(value.reason).trim(),
    needsConfirmation: true,
  };
}
