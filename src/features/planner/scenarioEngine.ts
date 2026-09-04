export type ProjectionInput = { initialAmount: number; monthlyContribution: number; months: number; annualRate: number };
export type ProjectionResult = { totalContributed: number; endingAmount: number; earnings: number; monthlyRate: number };

export function compoundProjection(input: ProjectionInput): ProjectionResult {
  const months = Math.max(0, Math.floor(input.months));
  const monthlyRate = input.annualRate <= -1 ? -1 : Math.pow(1 + input.annualRate, 1 / 12) - 1;
  let balance = Math.max(0, Math.round(input.initialAmount));
  const contribution = Math.max(0, Math.round(input.monthlyContribution));
  for (let month = 0; month < months; month += 1) {
    balance = Math.round(balance * (1 + monthlyRate));
    balance += contribution;
  }
  const totalContributed = Math.max(0, Math.round(input.initialAmount)) + contribution * months;
  return { totalContributed, endingAmount: balance, earnings: balance - totalContributed, monthlyRate };
}

export type FinancingInput = { price: number; downPayment: number; months: number; monthlyRate: number };
export type FinancingResult = { principal: number; monthlyPayment: number; totalFinancedPayments: number; totalCost: number; interestCost: number };

export function financingScenario(input: FinancingInput): FinancingResult {
  const price = Math.max(0, Math.round(input.price));
  const downPayment = Math.min(price, Math.max(0, Math.round(input.downPayment)));
  const principal = price - downPayment;
  const months = Math.max(1, Math.floor(input.months));
  const rate = Math.max(0, input.monthlyRate);
  const monthlyPayment = rate === 0
    ? Math.round(principal / months)
    : Math.round(principal * (rate * Math.pow(1 + rate, months)) / (Math.pow(1 + rate, months) - 1));
  const totalFinancedPayments = monthlyPayment * months;
  const totalCost = downPayment + totalFinancedPayments;
  return { principal, monthlyPayment, totalFinancedPayments, totalCost, interestCost: Math.max(0, totalCost - price) };
}

export type GoalNeed = { id: string; monthlyNeed: number; priority: 1|2|3; kind?: 'retirement'|'reserve'|'other' };
export type AllocationScenario = { id: 'priority-first'|'balanced'|'future-first'; label: string; allocations: Array<{ goalId: string; amount: number }> };

function distribute(capacity: number, goals: GoalNeed[], weights: number[]) {
  const safeCapacity = Math.max(0, Math.round(capacity));
  const needs = goals.map(goal => Math.max(0, Math.round(goal.monthlyNeed)));
  const requested = needs.reduce((sum, need) => sum + need, 0);
  if (requested <= safeCapacity) return goals.map((goal, index) => ({ goalId: goal.id, amount: needs[index] }));
  const weighted = goals.map((goal, index) => ({ index, score: Math.max(0.01, weights[index]) * Math.max(1, needs[index]) }));
  const totalScore = weighted.reduce((sum, item) => sum + item.score, 0);
  const result = goals.map((goal, index) => ({ goalId: goal.id, amount: Math.min(needs[index], Math.floor(safeCapacity * weighted[index].score / totalScore)) }));
  let used = result.reduce((sum, item) => sum + item.amount, 0);
  for (const { index } of weighted.sort((a, b) => b.score - a.score)) {
    if (used >= safeCapacity) break;
    const room = needs[index] - result[index].amount;
    const add = Math.min(room, safeCapacity - used);
    result[index].amount += add;
    used += add;
  }
  return result;
}

export function allocateAcrossGoals(input: { monthlyCapacity: number; goals: GoalNeed[] }): AllocationScenario[] {
  const goals = input.goals.slice();
  const priorityWeights = goals.map(goal => 4 - goal.priority);
  const balancedWeights = goals.map(() => 1);
  const futureWeights = goals.map(goal => goal.kind === 'retirement' || goal.kind === 'reserve' || /aposent|reserva/i.test(goal.id) ? 3 : 1);
  return [
    { id: 'priority-first', label: 'Prioridades primeiro', allocations: distribute(input.monthlyCapacity, goals, priorityWeights) },
    { id: 'balanced', label: 'Equilibrado', allocations: distribute(input.monthlyCapacity, goals, balancedWeights) },
    { id: 'future-first', label: 'Futuro primeiro', allocations: distribute(input.monthlyCapacity, goals, futureWeights) },
  ];
}

export const INVESTMENT_SIMULATION_DISCLAIMER = 'Simulação informativa, não previsão. Não constitui recomendação de investimento, oferta ou indicação de compra/venda. Retornos passados não garantem resultados futuros.';
