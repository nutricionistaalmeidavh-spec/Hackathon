import { describe, expect, it } from 'vitest';
import { parseImportedMoney } from './statementImport';

describe('statement money parser', () => {
  it('parses Brazilian decimal commas without losing cents', () => {
    expect(parseImportedMoney('147,80')).toBe(147.8);
    expect(parseImportedMoney('-147,80')).toBe(-147.8);
    expect(parseImportedMoney('R$ 1.247,80')).toBe(1247.8);
  });

  it('keeps dot-decimal values compatible', () => {
    expect(parseImportedMoney('147.80')).toBe(147.8);
  });
});
