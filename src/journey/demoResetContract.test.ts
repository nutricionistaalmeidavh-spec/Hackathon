import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('demo restart contract', () => {
  it('restarts synthetic demo state without replacing the real-state snapshot', () => {
    const source = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
    const resetStart = source.indexOf('function resetDemo()');
    const resetEnd = source.indexOf('\n  function ', resetStart + 1);
    expect(resetStart).toBeGreaterThan(-1);
    const resetSource = source.slice(resetStart, resetEnd > resetStart ? resetEnd : undefined);
    expect(resetSource).toContain('createDemoState()');
    expect(resetSource).toContain("setTab('today')");
    expect(resetSource).toContain('setDemoTouchedReview(false)');
    expect(resetSource).not.toContain('realStateRef.current =');
    expect(source).toContain('onRestart={resetDemo}');
  });
});
