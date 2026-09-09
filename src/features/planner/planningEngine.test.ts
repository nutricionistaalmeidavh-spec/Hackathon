import { describe, expect, it } from 'vitest';
import { applyConfirmedFact, createPlanningState, ensurePlanningState, nextPlanningPrompt, validatePlanTargets } from './planningEngine';

describe('planningEngine', () => {
  it('commits only explicitly confirmed facts into structured planning state', () => {
    const initial = createPlanningState();
    const withGoal = applyConfirmedFact(initial, {
      type: 'goal',
      goal: { title: 'Trocar de carro', kind: 'purchase', priority: 1, targetAmount: 10000000, targetDate: '2028-09-01' },
    });
    expect(withGoal.goals).toHaveLength(1);
    expect(withGoal.goals[0].title).toBe('Trocar de carro');
    expect(initial.goals).toHaveLength(0);
  });

  it('connects diagnosis, suggested next step and confirmed actions into the plan journey', () => {
    const health = {
      status: 'ready' as const,
      essential: { percent: 62 },
      flexible: { percent: 25 },
      future: { percent: 13 },
    };
    const initial = createPlanningState();
    expect(nextPlanningPrompt(initial, health)).toMatchObject({ stage: 'goals' });

    const withGoal = applyConfirmedFact(initial, {
      type: 'goal',
      goal: { title: 'Reserva de emergência', kind: 'reserve', priority: 1, monthlyContribution: 50000 },
    });
    expect(nextPlanningPrompt(withGoal, health)).toMatchObject({ stage: 'adjustments' });

    const actionable = applyConfirmedFact(withGoal, {
      type: 'adjustment',
      adjustment: { label: 'Reduzir gastos flexíveis', currentAmount: 120000, targetAmount: 80000 },
    });
    expect(nextPlanningPrompt(actionable, health)).toMatchObject({ stage: 'scenarios' });
    expect(actionable.goals[0].status).toBe('confirmed');
    expect(actionable.adjustments[0]).toMatchObject({ confirmed: true, targetAmount: 80000 });
  });

  it('supports user-defined buckets without turning 50/30/20 into a fixed plan', () => {
    const initial = createPlanningState();
    const next = applyConfirmedFact(initial, {
      type: 'bucket',
      bucket: { id: 'travel', label: 'Viagem', group: 'custom', targetPercent: 8, userDefined: true },
    });
    expect(next.buckets.some(bucket => bucket.id === 'travel' && bucket.targetPercent === 8)).toBe(true);
  });

  it('flags target percentages above 100 instead of silently normalizing them', () => {
    expect(validatePlanTargets([
      { id: 'a', label: 'A', group: 'custom', targetPercent: 60, userDefined: true },
      { id: 'b', label: 'B', group: 'custom', targetPercent: 50, userDefined: true },
    ])).toEqual({ totalPercent: 110, valid: false });
  });

  it('loads old saved state without a planning payload safely', () => {
    expect(ensurePlanningState(undefined)).toEqual(createPlanningState());
    expect(ensurePlanningState({ goals: [] }).buckets.map(bucket => bucket.targetPercent)).toEqual([50, 30, 20]);
  });
});
