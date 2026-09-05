import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('App stabilization contracts', () => {
  it('contains statement import failures and keeps the UI recoverable', () => {
    const source = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
    expect(source).toContain('Não conseguimos ler esse arquivo');
    expect(source).toMatch(/async function importFiles[\s\S]*catch\s*\{/);
    expect(source).toMatch(/async function importFiles[\s\S]*finally\s*\{/);
  });
});
