import { describe, expect, it } from 'vitest';
import { analyzeBudgetHealth } from './budgetHealth';
import type { Tx } from '../types';

const tx = (id: string, amount: number, direction: Tx['direction'], category?: string): Tx => ({
  id,
  date: '2026-08-10',
  amount,
  direction,
  description: id,
  counterparty: id,
  status: category ? 'categorized' : 'unresolved',
  category,
});

describe('analyzeBudgetHealth', () => {
  it('calculates budget shares from recognized income and categorized debits', () => {
    const health = analyzeBudgetHealth([
      tx('salary', 500000, 'credit', 'Salário'),
      tx('rent', 200000, 'debit', 'Moradia'),
      tx('market', 50000, 'debit', 'Supermercado'),
      tx('gym', 50000, 'debit', 'Academia'),
      tx('invest', 100000, 'debit', 'Investimentos'),
    ]);

    expect(health.status).toBe('ready');
    expect(health.incomeAmount).toBe(500000);
    expect(health.essential.percent).toBe(50);
    expect(health.flexible.percent).toBe(10);
    expect(health.future.percent).toBe(20);
    expect(health.referenceGaps.essential).toBe(0);
    expect(health.referenceGaps.future).toBe(0);
  });

  it('reports uncategorized spending without forcing it into a known bucket', () => {
    const health = analyzeBudgetHealth([
      tx('salary', 400000, 'credit', 'Salário'),
      tx('unknown', 40000, 'debit'),
    ]);
    expect(health.uncategorized.amount).toBe(40000);
    expect(health.uncategorized.percent).toBe(10);
  });

  it('returns insufficient data when income basis is zero', () => {
    const health = analyzeBudgetHealth([tx('rent', 100000, 'debit', 'Moradia')]);
    expect(health.status).toBe('insufficient-data');
    expect(health.essential.percent).toBeNull();
  });
});
