import { describe, expect, it } from 'vitest';
import { analyzeRadar } from './radarInsight';
import type { RadarPoint } from '../types';

const point = (date: string, balance: number, drivers: RadarPoint['drivers'] = []): RadarPoint => ({
  date,
  balance,
  inflow: 0,
  outflow: Math.max(0, -drivers.reduce((sum, driver) => sum + Math.min(0, driver.delta), 0)),
  drivers,
});

describe('radar insight', () => {
  it('identifies the first negative day and strongest causes', () => {
    const projection = [
      point('2026-09-12', 65000, [{ label: 'Gastos variáveis', category: 'Histórico', delta: -15000 }]),
      point('2026-09-13', 12000, [{ label: 'Condomínio', category: 'Moradia', delta: -53000 }]),
      point('2026-09-14', -18500, [{ label: 'Fatura cartão', category: 'Cartão de crédito', delta: -30500 }]),
      point('2026-09-15', -24000, [{ label: 'Gastos variáveis', category: 'Histórico', delta: -5500 }]),
    ];

    const insight = analyzeRadar(projection, 100000);

    expect(insight.tone).toBe('risk');
    expect(insight.firstNegative?.date).toBe('2026-09-14');
    expect(insight.minimum?.balance).toBe(-24000);
    expect(insight.headline).toContain('3 dias');
    expect(insight.topDrivers[0].delta).toBeLessThan(0);
    expect(insight.topDrivers.length).toBeLessThanOrEqual(3);
  });

  it('describes a healthy 30-day projection without inventing risk', () => {
    const projection = [
      point('2026-09-12', 95000),
      point('2026-09-13', 90000),
      point('2026-09-14', 87000),
    ];

    const insight = analyzeRadar(projection, 100000);

    expect(insight.tone).toBe('healthy');
    expect(insight.firstNegative).toBeNull();
    expect(insight.headline).toContain('permanece positivo');
    expect(insight.endingBalance).toBe(87000);
  });

  it('handles an empty projection safely', () => {
    const insight = analyzeRadar([], 0);

    expect(insight.tone).toBe('neutral');
    expect(insight.minimum).toBeNull();
    expect(insight.endingBalance).toBeNull();
  });
});
