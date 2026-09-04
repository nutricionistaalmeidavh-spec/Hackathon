import type { RadarPoint } from '../types';

export type RadarTone = 'risk' | 'healthy' | 'neutral';

export type RadarInsightDriver = {
  label: string;
  category: string;
  delta: number;
  date: string;
};

export type RadarInsight = {
  minimum: RadarPoint | null;
  endingBalance: number | null;
  firstNegative: RadarPoint | null;
  headline: string;
  tone: RadarTone;
  topDrivers: RadarInsightDriver[];
};

export function analyzeRadar(projection: RadarPoint[], _startingBalance: number): RadarInsight {
  if (!projection.length) {
    return {
      minimum: null,
      endingBalance: null,
      firstNegative: null,
      headline: 'O Radar precisa de dados para projetar os próximos 30 dias.',
      tone: 'neutral',
      topDrivers: [],
    };
  }

  const minimum = projection.reduce((lowest, point) => point.balance < lowest.balance ? point : lowest);
  const firstNegativeIndex = projection.findIndex(point => point.balance < 0);
  const firstNegative = firstNegativeIndex >= 0 ? projection[firstNegativeIndex] : null;
  const endingBalance = projection.at(-1)?.balance ?? null;

  const grouped = new Map<string, RadarInsightDriver>();
  for (const point of projection) {
    for (const driver of point.drivers) {
      if (driver.delta >= 0) continue;
      const key = `${driver.label}|${driver.category}`;
      const current = grouped.get(key);
      if (current) {
        current.delta += driver.delta;
      } else {
        grouped.set(key, {
          label: driver.label,
          category: driver.category,
          delta: driver.delta,
          date: point.date,
        });
      }
    }
  }

  const topDrivers = [...grouped.values()]
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3);

  if (firstNegative) {
    const days = firstNegativeIndex + 1;
    return {
      minimum,
      endingBalance,
      firstNegative,
      headline: `Se nada mudar, seu caixa entra no vermelho em ${days} ${days === 1 ? 'dia' : 'dias'}.`,
      tone: 'risk',
      topDrivers,
    };
  }

  return {
    minimum,
    endingBalance,
    firstNegative: null,
    headline: 'Seu caixa permanece positivo nos próximos 30 dias.',
    tone: 'healthy',
    topDrivers,
  };
}
