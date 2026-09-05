import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('final stability presentation', () => {
  it('loads severity and demo-control polish before MotionKit', () => {
    const main = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8');
    const css = readFileSync(new URL('./stability.css', import.meta.url), 'utf8');
    expect(main).toContain("import './stability/stability.css';");
    expect(main.indexOf("./stability/stability.css")).toBeLessThan(main.indexOf("./motion-kit.css"));
    expect(css).toContain('.toast.error');
    expect(css).toContain('.toast.info');
    expect(css).toContain('.demo-progress-actions');
  });
});
