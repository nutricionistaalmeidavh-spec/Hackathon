import type { Tx } from '../types';
import { budgetGroupForCategory, type BudgetGroup } from './budgetTaxonomy';

export const BUDGET_REFERENCE = { essentialMax: 50, flexibleMax: 30, futureMin: 20 } as const;

type GroupHealth = { amount: number; percent: number | null; topCategories: Array<{ category: string; amount: number }> };

export type BudgetHealth = {
  status: 'ready' | 'insufficient-data';
  incomeAmount: number;
  essential: GroupHealth;
  flexible: GroupHealth;
  future: GroupHealth;
  uncategorized: { amount: number; percent: number | null };
  referenceGaps: { essential: number | null; flexible: number | null; future: number | null };
};

function groupSummary(group: BudgetGroup, txs: Tx[], income: number): GroupHealth {
  const matching = txs.filter(tx => tx.direction === 'debit' && budgetGroupForCategory(tx.category) === group);
  const amount = matching.reduce((sum, tx) => sum + tx.amount, 0);
  const categories = new Map<string, number>();
  for (const tx of matching) {
    const category = tx.category || 'Sem categoria';
    categories.set(category, (categories.get(category) || 0) + tx.amount);
  }
  return {
    amount,
    percent: income > 0 ? Math.round((amount / income) * 1000) / 10 : null,
    topCategories: [...categories.entries()]
      .map(([category, categoryAmount]) => ({ category, amount: categoryAmount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5),
  };
}

export function analyzeBudgetHealth(txs: Tx[]): BudgetHealth {
  const incomeAmount = txs
    .filter(tx => tx.direction === 'credit' && ['Salário', 'Recebimento'].includes(tx.category || ''))
    .reduce((sum, tx) => sum + tx.amount, 0);

  const essential = groupSummary('essential', txs, incomeAmount);
  const flexible = groupSummary('flexible', txs, incomeAmount);
  const future = groupSummary('future', txs, incomeAmount);
  const uncategorizedAmount = txs
    .filter(tx => tx.direction === 'debit' && budgetGroupForCategory(tx.category) === 'unknown')
    .reduce((sum, tx) => sum + tx.amount, 0);
  const uncategorizedPercent = incomeAmount > 0 ? Math.round((uncategorizedAmount / incomeAmount) * 1000) / 10 : null;

  if (incomeAmount <= 0) {
    return {
      status: 'insufficient-data',
      incomeAmount: 0,
      essential,
      flexible,
      future,
      uncategorized: { amount: uncategorizedAmount, percent: null },
      referenceGaps: { essential: null, flexible: null, future: null },
    };
  }

  return {
    status: 'ready',
    incomeAmount,
    essential,
    flexible,
    future,
    uncategorized: { amount: uncategorizedAmount, percent: uncategorizedPercent },
    referenceGaps: {
      essential: Math.max(0, (essential.percent || 0) - BUDGET_REFERENCE.essentialMax),
      flexible: Math.max(0, (flexible.percent || 0) - BUDGET_REFERENCE.flexibleMax),
      future: Math.max(0, BUDGET_REFERENCE.futureMin - (future.percent || 0)),
    },
  };
}
