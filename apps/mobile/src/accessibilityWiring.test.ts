import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

describe('Android accessibility wiring', () => {
  it('keeps retry and empty-state actions exposed as separate accessible controls', () => {
    const app = readSource('../App.tsx');

    expect(app).not.toContain('<View style={styles.centerState} accessible');
    expect(app).not.toContain('<View style={styles.heroCard} accessible');
    expect(app).toContain('accessibilityRole="tab"');
    expect(app).toContain('accessibilityRole="radio"');
    expect(app).toContain('accessibilityLiveRegion="polite"');
  });

  it('resizes Android content instead of letting the software keyboard cover it', () => {
    const config = readSource('../app.config.ts');
    expect(config).toContain("softwareKeyboardLayoutMode: 'resize'");
  });
});
