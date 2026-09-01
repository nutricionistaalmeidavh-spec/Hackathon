import { describe, expect, it } from 'vitest';
import { applyPatternIntelligence, buildRadar } from './financeEngine';
import type { Tx } from '../types';

describe('finance engine', () => {
  it('recognizes obvious categories without AI', () => {
    const out = applyPatternIntelligence([{ id: '1', date: '2026-08-01', amount: 80000, direction: 'debit', description: 'CONDOMINIO EDIFICIO', counterparty: 'Condominio Edificio', status: 'unresolved' }], []);
    expect(out[0].category).toBe('Condomínio');
    expect(out[0].status).toBe('candidate');
  });

  it('learns monthly recurrence by merchant, direction and amount band', () => {
    const txs: Tx[] = ['2026-05-05', '2026-06-05', '2026-07-05', '2026-08-05'].map((date, i) => ({ id: String(i), date, amount: 100000 + i * 1000, direction: 'debit', description: 'CONDOMINIO RESIDENCIAL CENTRAL', counterparty: 'Condominio Residencial Central', status: 'unresolved' }));
    const out = applyPatternIntelligence(txs, []);
    expect(out.every(t => t.recurrencePeriod === 'monthly')).toBe(true);
    expect(Math.min(...out.map(t => t.recurrenceConfidence || 0))).toBeGreaterThanOrEqual(76);
  });

  it('keeps credit and debit recurrence separated', () => {
    const txs: Tx[] = [
      { id: 'a', date: '2026-06-01', amount: 500000, direction: 'credit', description: 'ACME', counterparty: 'Acme', status: 'unresolved' },
      { id: 'b', date: '2026-07-01', amount: 500000, direction: 'credit', description: 'ACME', counterparty: 'Acme', status: 'unresolved' },
      { id: 'c', date: '2026-06-15', amount: 500000, direction: 'debit', description: 'ACME', counterparty: 'Acme', status: 'unresolved' },
    ];
    const out = applyPatternIntelligence(txs, []);
    expect(out.find(t => t.id === 'c')?.recurrencePeriod).toBeUndefined();
  });

  it('ignores malformed dates instead of crashing Radar', () => {
    const radar = buildRadar([{ id: 'bad', date: 'Invalid Date', amount: 10000, direction: 'debit', description: 'PAGAMENTO TESTE', counterparty: 'Teste', status: 'unresolved' }], []);
    expect(radar.projection).toHaveLength(30);
  });
});
