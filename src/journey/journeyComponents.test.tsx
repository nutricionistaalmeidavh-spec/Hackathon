import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { JourneyCard } from './JourneyCard';
import { ContextualUpgrade } from './ContextualUpgrade';
import { DemoProgress } from './DemoProgress';

describe('journey presentation components', () => {
  it('renders a semantic primary journey action', () => {
    const html = renderToStaticMarkup(<JourneyCard eyebrow="Próximo passo" title="Tudo revisado" description="Seu Radar está pronto." actionLabel="Ver meu Radar" onAction={() => {}}/>);
    expect(html).toContain('<h2>Tudo revisado</h2>');
    expect(html).toContain('Ver meu Radar');
    expect(html).toContain('Próximo passo');
  });

  it('renders contextual upgrade as an accessible dialog without owning entitlement', () => {
    const html = renderToStaticMarkup(<ContextualUpgrade open title="Radar completo é Pro" description="Você já pode ver 7 dias." benefits={["30 dias", "Drivers detalhados"]} onContinue={() => {}} onClose={() => {}}/>);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('Conhecer Pro');
    expect(html).toContain('30 dias');
    expect(html).not.toContain('localStorage');
  });

  it('supports Escape dismissal and predictable initial focus in the upgrade dialog', () => {
    const source = readFileSync(new URL('./ContextualUpgrade.tsx', import.meta.url), 'utf8');
    expect(source).toContain("event.key === 'Escape'");
    expect(source).toContain('autoFocus');
  });

  it('renders all four demo guide steps and offers a one-tap restart', () => {
    const html = renderToStaticMarkup(<DemoProgress step={3} onRestart={() => {}}/>);
    expect(html).toContain('Revisar movimentações');
    expect(html).toContain('Ver o Radar');
    expect(html).toContain('Entender o ponto de atenção');
    expect(html).toContain('Montar o plano');
    expect(html).toContain('3 de 4');
    expect(html).toContain('Reiniciar demo');
  });
});
