import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./PlannerPage.tsx', import.meta.url), 'utf8');

describe('Planner progressive disclosure', () => {
  it('makes the planning conversation the dominant first question', () => {
    expect(source).toContain('O que você quer que seu dinheiro permita?');
    expect(source.indexOf('O que você quer que seu dinheiro permita?')).toBeLessThan(source.indexOf('Seu plano'));
  });

  it('groups advanced capabilities instead of showing everything at the same priority', () => {
    expect(source).toContain('<details');
    expect(source).toContain('Organizar orçamento');
    expect(source).toContain('Comparar cenários');
    expect(source).toContain('Pesquisar ativo/caminho');
    expect(source).toContain('Simular');
  });

  it('keeps deterministic simulation disclosure and disclaimer', () => {
    expect(source).toContain('INVESTMENT_SIMULATION_DISCLAIMER');
    expect(source).toContain('projection.totalContributed');
    expect(source).toContain('projection.endingAmount');
  });
});
