import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

describe('hackathon MotionKit runtime', () => {
  it('loads the motion layer after the existing visual layers', () => {
    const main = readSource('./main.tsx');
    const plannerImport = "import './features/planner/planner.css';";
    const motionImport = "import './motion-kit.css';";

    expect(main).toContain(motionImport);
    expect(main.indexOf(motionImport)).toBeGreaterThan(main.indexOf(plannerImport));
  });

  it('keeps motion functional, restrained and accessible', () => {
    const css = readSource('./motion-kit.css');

    expect(css).toContain('.page-stack>*');
    expect(css).toContain('.motion-scan');
    expect(css).toContain('.toast');
    expect(css).toContain('.primary');
    expect(css).toContain('.bottom-nav button');
    expect(css).toContain('@keyframes mkReveal');
    expect(css).toContain('@keyframes mkScan');
    expect(css).toContain('@keyframes mkSuccess');
    expect(css).toContain('@media(prefers-reduced-motion:reduce)');
  });
});
