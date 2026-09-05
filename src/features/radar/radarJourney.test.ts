import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./RadarPage.tsx', import.meta.url), 'utf8');

describe('Radar guided-journey framing', () => {
  it('uses calm deterministic risk and healthy framing', () => {
    expect(source).toContain('Seu saldo pode ficar negativo em');
    expect(source).toContain('Nenhum ponto crítico nos próximos');
    expect(source).toContain('Leitura do Radar');
  });

  it('keeps Fique de olho as the pressure-detail path', () => {
    expect(source).toContain('Fique de olho');
    expect(source).toContain('Entender o que está pressionando');
  });

  it('makes planning the explicit continuation of the Radar story', () => {
    expect(source).toContain('Organizar meu plano');
    expect(source).toContain('onOpenPlan');
  });
});
