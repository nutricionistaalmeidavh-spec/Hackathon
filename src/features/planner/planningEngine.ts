export type PlanningStage = 'snapshot'|'goals'|'constraints'|'adjustments'|'funding'|'market-context'|'scenarios'|'confirm'|'active-plan';
export type GoalKind = 'purchase'|'travel'|'retirement'|'reserve'|'debt'|'education'|'business'|'custom';
export type Goal = {
  id: string;
  title: string;
  kind: GoalKind;
  targetAmount?: number;
  targetDate?: string;
  currentAmount?: number;
  monthlyContribution?: number;
  priority: 1|2|3;
  notes?: string;
  status: 'draft'|'confirmed'|'active'|'paused'|'completed';
};
export type PlanBucket = {
  id: string;
  label: string;
  group: 'essential'|'flexible'|'future'|'custom';
  targetPercent?: number;
  targetAmount?: number;
  parentId?: string;
  userDefined: boolean;
};
export type SpendingAdjustment = { id: string; label: string; currentAmount?: number; targetAmount: number; confirmed: true };
export type PlanningMessage = { id: string; role: 'assistant'|'user'; text: string };
export type PlanningState = {
  stage: PlanningStage;
  goals: Goal[];
  buckets: PlanBucket[];
  adjustments: SpendingAdjustment[];
  messages: PlanningMessage[];
};

export type ConfirmedFact =
  | { type: 'goal'; goal: Omit<Goal, 'id'|'status'> & { id?: string } }
  | { type: 'bucket'; bucket: PlanBucket }
  | { type: 'adjustment'; adjustment: Omit<SpendingAdjustment, 'id'|'confirmed'> & { id?: string } }
  | { type: 'stage'; stage: PlanningStage };

const stages: PlanningStage[] = ['snapshot','goals','constraints','adjustments','funding','market-context','scenarios','confirm','active-plan'];
const starterBuckets: PlanBucket[] = [
  { id: 'essential', label: 'Essenciais', group: 'essential', targetPercent: 50, userDefined: false },
  { id: 'flexible', label: 'Flexíveis', group: 'flexible', targetPercent: 30, userDefined: false },
  { id: 'future', label: 'Futuro', group: 'future', targetPercent: 20, userDefined: false },
];

const makeId = (prefix: string, label: string, size: number) => `${prefix}_${label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30) || size}_${size + 1}`;

export function createPlanningState(): PlanningState {
  return {
    stage: 'snapshot',
    goals: [],
    buckets: starterBuckets.map(bucket => ({ ...bucket })),
    adjustments: [],
    messages: [{ id: 'welcome', role: 'assistant', text: 'Vou usar seus dados para organizar prioridades e fazer uma pergunta de cada vez. Nada ambíguo entra no plano sem sua confirmação.' }],
  };
}

export function ensurePlanningState(value: unknown): PlanningState {
  const fallback = createPlanningState();
  if (!value || typeof value !== 'object') return fallback;
  const candidate = value as Partial<PlanningState>;
  return {
    stage: candidate.stage && stages.includes(candidate.stage) ? candidate.stage : fallback.stage,
    goals: Array.isArray(candidate.goals) ? candidate.goals : fallback.goals,
    buckets: Array.isArray(candidate.buckets) && candidate.buckets.length ? candidate.buckets : fallback.buckets,
    adjustments: Array.isArray(candidate.adjustments) ? candidate.adjustments : fallback.adjustments,
    messages: Array.isArray(candidate.messages) && candidate.messages.length ? candidate.messages : fallback.messages,
  };
}

export function applyConfirmedFact(state: PlanningState, fact: ConfirmedFact): PlanningState {
  if (fact.type === 'stage') return { ...state, stage: fact.stage };
  if (fact.type === 'goal') {
    const id = fact.goal.id || makeId('goal', fact.goal.title, state.goals.length);
    return { ...state, goals: [...state.goals.filter(goal => goal.id !== id), { ...fact.goal, id, status: 'confirmed' }] };
  }
  if (fact.type === 'bucket') {
    return { ...state, buckets: [...state.buckets.filter(bucket => bucket.id !== fact.bucket.id), { ...fact.bucket }] };
  }
  const id = fact.adjustment.id || makeId('adjustment', fact.adjustment.label, state.adjustments.length);
  return { ...state, adjustments: [...state.adjustments.filter(item => item.id !== id), { ...fact.adjustment, id, confirmed: true }] };
}

export function validatePlanTargets(buckets: PlanBucket[]) {
  const totalPercent = Math.round(buckets.reduce((sum, bucket) => sum + (bucket.targetPercent || 0), 0) * 10) / 10;
  return { totalPercent, valid: totalPercent <= 100 };
}

export function availableMonthlyCapacity(state: PlanningState) {
  return state.adjustments.reduce((sum, adjustment) => sum + Math.max(0, (adjustment.currentAmount || 0) - adjustment.targetAmount), 0);
}

export function nextPlanningPrompt(state: PlanningState, health: { status: 'ready'|'insufficient-data'; essential: { percent: number|null }; flexible: { percent: number|null }; future: { percent: number|null } }) {
  if (health.status === 'insufficient-data') return { stage: 'snapshot' as const, text: 'Ainda preciso reconhecer uma base de renda para montar percentuais confiáveis. Quer revisar as entradas primeiro?' };
  if (!state.goals.length) return { stage: 'goals' as const, text: 'O que você quer que seu dinheiro permita nos próximos anos? Pode falar de aposentadoria, carro, viagem, casa ou qualquer outro objetivo.' };
  if (!state.adjustments.length) return { stage: 'adjustments' as const, text: `Hoje seus essenciais estão em ${health.essential.percent ?? 0}% e os flexíveis em ${health.flexible.percent ?? 0}%. Quais gastos você considera realmente ajustáveis?` };
  return { stage: 'scenarios' as const, text: 'Já tenho objetivos e ajustes confirmados. Posso comparar como diferentes divisões do valor mensal disponível mudam as datas de cada meta.' };
}
