import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const main = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8');

describe('Phase 3 journey/demo polish contract', () => {
  it('loads journey polish before MotionKit so motion remains the final layer', () => {
    const journeyImport = "import './journey.css';";
    const motionImport = "import './motion-kit.css';";
    expect(main).toContain(journeyImport);
    expect(main.indexOf(journeyImport)).toBeLessThan(main.indexOf(motionImport));
  });

  it('covers mobile safe areas, touch targets and responsive layouts', () => {
    const css = readFileSync(new URL('../journey.css', import.meta.url), 'utf8');
    expect(css).toContain('env(safe-area-inset-bottom)');
    expect(css).toContain('min-height:44px');
    expect(css).toContain('@media(max-width:680px)');
    expect(css).toContain('@media(max-width:480px)');
  });

  it('polishes the judge guide, upgrade surface, Radar handoff and Planner disclosure', () => {
    const css = readFileSync(new URL('../journey.css', import.meta.url), 'utf8');
    expect(css).toContain('.demo-progress');
    expect(css).toContain('.contextual-upgrade');
    expect(css).toContain('.radar-journey-summary');
    expect(css).toContain('.planner-disclosure');
    expect(css).toContain('@media(prefers-reduced-motion:reduce)');
  });
});
