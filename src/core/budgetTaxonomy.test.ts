import { describe, expect, it } from 'vitest';
import { budgetGroupForCategory } from './budgetTaxonomy';

describe('budgetGroupForCategory', () => {
  it('maps essential categories', () => {
    expect(budgetGroupForCategory('Moradia')).toBe('essential');
    expect(budgetGroupForCategory('Supermercado')).toBe('essential');
    expect(budgetGroupForCategory('Saúde')).toBe('essential');
  });

  it('maps flexible categories', () => {
    expect(budgetGroupForCategory('Assinaturas')).toBe('flexible');
    expect(budgetGroupForCategory('Academia')).toBe('flexible');
    expect(budgetGroupForCategory('Conveniência')).toBe('flexible');
  });

  it('maps future categories', () => {
    expect(budgetGroupForCategory('Investimentos')).toBe('future');
    expect(budgetGroupForCategory('Aposentadoria')).toBe('future');
    expect(budgetGroupForCategory('Reserva de emergência')).toBe('future');
  });

  it('keeps unknown categories explicit', () => {
    expect(budgetGroupForCategory(undefined)).toBe('unknown');
    expect(budgetGroupForCategory('Categoria inventada')).toBe('unknown');
  });
});
