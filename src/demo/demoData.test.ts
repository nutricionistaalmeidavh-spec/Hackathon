import { describe, expect, it } from 'vitest';
import { applyPatternIntelligence, buildRadar } from '../core/financeEngine';
import { createDemoState } from './demoData';

describe('judge demo dataset', () => {
  it('produces a useful deterministic demo without external services', () => {
    const demo = createDemoState();
    const processed = applyPatternIntelligence(demo.txs, demo.rules);
    const radar = buildRadar(processed, demo.accounts, demo.rules);

    expect(demo.txs.length).toBeGreaterThanOrEqual(20);
    expect(demo.accounts.length).toBeGreaterThan(0);
    expect(processed.some(tx => tx.status === 'unresolved' || tx.status === 'needs_review')).toBe(true);
    expect(processed.some(tx => (tx.recurrenceConfidence || 0) >= 76)).toBe(true);
    expect(radar.projection).toHaveLength(30);
    expect(radar.balanceKnown).toBe(true);
    expect(radar.projection.some(point => point.balance < 0)).toBe(true);
    expect(radar.recurring.length).toBeGreaterThanOrEqual(4);
  });

  it('keeps the scenario synthetic and stable for the hackathon video', () => {
    const first = createDemoState();
    const second = createDemoState();

    expect(second).toEqual(first);
    expect(first.txs.some(tx => /PIX M J SILVA/i.test(tx.description))).toBe(true);
  });
});
