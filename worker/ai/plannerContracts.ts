export const PLANNING_STAGES = ['snapshot','goals','constraints','adjustments','funding','market-context','scenarios','confirm','active-plan'] as const;
export type PlanningStage = typeof PLANNING_STAGES[number];

export type PlannerTurnRequest = {
  stage: PlanningStage;
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

export type PlannerTurnResponse = {
  reply: string;
  nextStage: PlanningStage;
  candidateFacts: Array<{ type: string; label: string; value?: string|number; needsConfirmation: true }>;
  quickReplies: string[];
};

export type MarketResearchRequest = { query: string; purpose?: string };
export type MarketResearchResponse = {
  entity: { name: string; symbol?: string; assetClass: string; exchange?: string; currency?: string };
  facts: Array<{ key: string; label: string; value: string; asOf?: string; sourceUrl?: string; sourceTitle?: string }>;
  summary: string;
  fetchedAt: string;
  disclaimer: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const bounded = (value: unknown, max: number, allowEmpty = false) => typeof value === 'string' && value.length <= max && (allowEmpty || value.trim().length > 0);
const finiteNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
const nullablePercent = (value: unknown) => value === null || (finiteNumber(value) && Number(value) >= 0 && Number(value) <= 1000);
const safeHttpUrl = (value: unknown) => {
  if (!bounded(value, 500, true)) return false;
  const raw = String(value).trim();
  if (!raw) return true;
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

export function parsePlannerTurnRequest(value: unknown): PlannerTurnRequest | null {
  if (!isRecord(value) || !PLANNING_STAGES.includes(value.stage as PlanningStage) || !isRecord(value.snapshot)) return null;
  const snapshot = value.snapshot;
  if (!finiteNumber(snapshot.incomeAmount) || !nullablePercent(snapshot.essentialPercent) || !nullablePercent(snapshot.flexiblePercent) || !nullablePercent(snapshot.futurePercent) || !nullablePercent(snapshot.uncategorizedPercent)) return null;
  if (!Array.isArray(value.goals) || value.goals.length > 20 || !value.goals.every(isRecord)) return null;
  if (!Array.isArray(value.adjustments) || value.adjustments.length > 30 || !value.adjustments.every(isRecord)) return null;
  if (!Array.isArray(value.recentMessages) || value.recentMessages.length > 12) return null;
  const recentMessages: PlannerTurnRequest['recentMessages'] = [];
  for (const raw of value.recentMessages) {
    if (!isRecord(raw) || (raw.role !== 'user' && raw.role !== 'assistant') || !bounded(raw.text, 1200)) return null;
    recentMessages.push({ role: raw.role, text: String(raw.text).trim() });
  }
  return {
    stage: value.stage as PlanningStage,
    snapshot: {
      incomeAmount: Number(snapshot.incomeAmount),
      essentialPercent: snapshot.essentialPercent === null ? null : Number(snapshot.essentialPercent),
      flexiblePercent: snapshot.flexiblePercent === null ? null : Number(snapshot.flexiblePercent),
      futurePercent: snapshot.futurePercent === null ? null : Number(snapshot.futurePercent),
      uncategorizedPercent: snapshot.uncategorizedPercent === null ? null : Number(snapshot.uncategorizedPercent),
    },
    goals: value.goals as Array<Record<string, unknown>>,
    adjustments: value.adjustments as Array<Record<string, unknown>>,
    recentMessages,
  };
}

export function parseMarketResearchRequest(value: unknown): MarketResearchRequest | null {
  if (!isRecord(value) || !bounded(value.query, 160) || (value.purpose !== undefined && !bounded(value.purpose, 300, true))) return null;
  return { query: String(value.query).trim(), ...(value.purpose === undefined ? {} : { purpose: String(value.purpose).trim() }) };
}

export function parsePlannerTurnResponse(value: unknown): PlannerTurnResponse | null {
  if (!isRecord(value) || !bounded(value.reply, 1600) || !PLANNING_STAGES.includes(value.nextStage as PlanningStage)) return null;
  if (!Array.isArray(value.candidateFacts) || value.candidateFacts.length > 8 || !Array.isArray(value.quickReplies) || value.quickReplies.length > 5) return null;
  const candidateFacts: PlannerTurnResponse['candidateFacts'] = [];
  for (const fact of value.candidateFacts) {
    if (!isRecord(fact) || !bounded(fact.type, 60) || !bounded(fact.label, 200) || fact.needsConfirmation !== true) return null;
    if (fact.value !== undefined && typeof fact.value !== 'string' && typeof fact.value !== 'number') return null;
    candidateFacts.push({ type: String(fact.type), label: String(fact.label), ...(fact.value === undefined ? {} : { value: fact.value as string|number }), needsConfirmation: true });
  }
  if (!value.quickReplies.every(item => bounded(item, 160))) return null;
  return { reply: String(value.reply).trim(), nextStage: value.nextStage as PlanningStage, candidateFacts, quickReplies: value.quickReplies.map(String) };
}

export function parseMarketResearchResponse(value: unknown): Omit<MarketResearchResponse, 'fetchedAt'|'disclaimer'> | null {
  if (!isRecord(value) || !isRecord(value.entity) || !bounded(value.entity.name, 180) || !bounded(value.entity.assetClass, 80) || !bounded(value.summary, 1500)) return null;
  if (value.entity.symbol !== undefined && !bounded(value.entity.symbol, 40, true)) return null;
  if (value.entity.exchange !== undefined && !bounded(value.entity.exchange, 80, true)) return null;
  if (value.entity.currency !== undefined && !bounded(value.entity.currency, 20, true)) return null;
  if (!Array.isArray(value.facts) || value.facts.length > 12) return null;
  const facts: MarketResearchResponse['facts'] = [];
  for (const fact of value.facts) {
    if (!isRecord(fact) || !bounded(fact.key, 80) || !bounded(fact.label, 160) || !bounded(fact.value, 500)) return null;
    if (fact.asOf !== undefined && !bounded(fact.asOf, 40, true)) return null;
    if (fact.sourceUrl !== undefined && !safeHttpUrl(fact.sourceUrl)) return null;
    if (fact.sourceTitle !== undefined && !bounded(fact.sourceTitle, 300, true)) return null;
    facts.push({ key: String(fact.key), label: String(fact.label), value: String(fact.value), ...(fact.asOf === undefined ? {} : { asOf: String(fact.asOf) }), ...(fact.sourceUrl === undefined ? {} : { sourceUrl: String(fact.sourceUrl) }), ...(fact.sourceTitle === undefined ? {} : { sourceTitle: String(fact.sourceTitle) }) });
  }
  return {
    entity: {
      name: String(value.entity.name),
      assetClass: String(value.entity.assetClass),
      ...(value.entity.symbol === undefined ? {} : { symbol: String(value.entity.symbol) }),
      ...(value.entity.exchange === undefined ? {} : { exchange: String(value.entity.exchange) }),
      ...(value.entity.currency === undefined ? {} : { currency: String(value.entity.currency) }),
    },
    facts,
    summary: String(value.summary).trim(),
  };
}
