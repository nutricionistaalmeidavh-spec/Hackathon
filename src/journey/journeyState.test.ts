import { describe, expect, it } from 'vitest';
import type { Tx } from '../types';
import { deriveDemoStep, deriveJourneyStage, nextPendingId } from './journeyState';

const tx = (id: string, status: Tx['status']): Tx => ({
  id,
  date: '2026-09-04',
  amount: 1000,
  direction: 'debit',
  description: id,
  counterparty: id,
  status,
});

describe('guided journey state', () => {
  it('derives mutually exclusive journey stages from existing state', () => {
    expect(deriveJourneyStage({ txCount: 0, attentionCount: 0, hasMeaningfulPlan: false, radarSeenThisSession: false, hasRadarAttention: false })).toBe('empty');
    expect(deriveJourneyStage({ txCount: 4, attentionCount: 2, hasMeaningfulPlan: false, radarSeenThisSession: false, hasRadarAttention: false })).toBe('review');
    expect(deriveJourneyStage({ txCount: 4, attentionCount: 0, hasMeaningfulPlan: false, radarSeenThisSession: false, hasRadarAttention: false })).toBe('radar-ready');
    expect(deriveJourneyStage({ txCount: 4, attentionCount: 0, hasMeaningfulPlan: false, radarSeenThisSession: true, hasRadarAttention: false })).toBe('plan-ready');
    expect(deriveJourneyStage({ txCount: 4, attentionCount: 0, hasMeaningfulPlan: true, radarSeenThisSession: true, hasRadarAttention: true })).toBe('active-plan');
  });

  it('selects the next pending transaction in list order and wraps once', () => {
    const txs = [tx('a', 'categorized'), tx('b', 'needs_review'), tx('c', 'unresolved'), tx('d', 'confirmed')];
    expect(nextPendingId(txs, 'b')).toBe('c');
    expect(nextPendingId(txs, 'c')).toBe('b');
    expect(nextPendingId([tx('a', 'categorized'), tx('b', 'needs_review')], 'b')).toBeNull();
  });

  it('derives four non-persisted demo progress steps from interaction evidence', () => {
    expect(deriveDemoStep({ touchedReview: false, touchedWatch: false, touchedPlan: false })).toBe(1);
    expect(deriveDemoStep({ touchedReview: true, touchedWatch: false, touchedPlan: false })).toBe(2);
    expect(deriveDemoStep({ touchedReview: true, touchedWatch: true, touchedPlan: false })).toBe(3);
    expect(deriveDemoStep({ touchedReview: true, touchedWatch: true, touchedPlan: true })).toBe(4);
  });
});
