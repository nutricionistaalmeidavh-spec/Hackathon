import { describe, expect, it } from 'vitest';
import { applyPatternIntelligence, buildRadar } from '../core/financeEngine';
import { createDemoState } from './demoData';

describe('judge demo dataset', () => {
  it('produces exactly two manual decisions and a useful deterministic Radar', () => {
    const demo = createDemoState();
    const processed = applyPatternIntelligence(demo.txs, demo.rules);
    const pending = processed.filter(tx => tx.status === 'unresolved' || tx.status === 'needs_review');
    const radar = buildRadar(processed, demo.accounts, demo.rules);

    expect(demo.txs.length).toBeGreaterThanOrEqual(20);
    expect(demo.accounts.length).toBeGreaterThan(0);
    expect(pending).toHaveLength(2);
    expect(pending.map(tx => tx.id)).toEqual(['demo_ambiguous', 'demo_ambiguous_2']);
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
    expect(first.txs.some(tx => /PIX L N COSTA/i.test(tx.description))).toBe(true);
    expect(first.planning.goals.map(goal => goal.kind)).toEqual(expect.arrayContaining(['retirement', 'purchase', 'travel']));
    expect(first.planning.adjustments.length).toBeGreaterThan(0);
    expect(first.planning.messages.some(message => /R\$ 950 por mês/i.test(message.text))).toBe(true);
  });
});
