import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

describe('experience polish layer', () => {
  it('loads after motion and delivery-specific styles', () => {
    const main = readSource('./main.tsx');
    const motion = "import './motion-kit.css';";
    const delivery = "import './delivery-4-6.css';";
    const polish = "import './experience-polish.css';";

    expect(main).toContain(polish);
    expect(main.indexOf(polish)).toBeGreaterThan(main.indexOf(motion));
    expect(main.indexOf(polish)).toBeGreaterThan(main.indexOf(delivery));
  });

  it('marks the Android shell so WebView screens can share its light visual language', () => {
    const main = readSource('./main.tsx');
    const css = readSource('./experience-polish.css');

    expect(main).toContain("document.documentElement.dataset.nativeShell");
    expect(css).toContain("html[data-native-shell='1']");
    expect(css).toContain('--bg:#F6F8FC');
    expect(css).toContain('--accent:#3157D5');
  });

  it('covers focus, keyboard, touch targets and reduced motion', () => {
    const css = readSource('./experience-polish.css');

    expect(css).toContain(':focus-visible');
    expect(css).toContain('min-height:44px');
    expect(css).toContain('font-size:16px!important');
    expect(css).toContain('scroll-margin-bottom:38vh');
    expect(css).toContain('@media(prefers-reduced-motion:reduce)');
    expect(css).toContain('@media(forced-colors:active)');
  });
});
