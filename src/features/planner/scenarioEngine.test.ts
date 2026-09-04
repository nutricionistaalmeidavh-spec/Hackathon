import { describe, expect, it } from 'vitest';
import { allocateAcrossGoals, compoundProjection, financingScenario } from './scenarioEngine';

describe('scenarioEngine', () => {
  it('projects monthly contributions deterministically', () => {
    const result = compoundProjection({ initialAmount: 1000000, monthlyContribution: 100000, months: 12, annualRate: 0 });
    expect(result.totalContributed).toBe(2200000);
    expect(result.endingAmount).toBe(2200000);
  });

  it('calculates financing payment and total cost from explicit assumptions', () => {
    const result = financingScenario({ price: 10000000, downPayment: 2000000, months: 24, monthlyRate: 0 });
    expect(result.principal).toBe(8000000);
    expect(result.monthlyPayment).toBe(333333);
    expect(result.totalCost).toBe(9999992);
  });

  it('creates competing-goal allocations that never exceed available capacity', () => {
    const scenarios = allocateAcrossGoals({
      monthlyCapacity: 300000,
      goals: [
        { id: 'car', monthlyNeed: 180000, priority: 1 },
        { id: 'retirement', monthlyNeed: 140000, priority: 1 },
        { id: 'trip', monthlyNeed: 80000, priority: 2 },
      ],
    });
    expect(scenarios.map(s => s.id)).toEqual(['priority-first', 'balanced', 'future-first']);
    for (const scenario of scenarios) {
      expect(scenario.allocations.reduce((sum, allocation) => sum + allocation.amount, 0)).toBeLessThanOrEqual(300000);
    }
  });
});
