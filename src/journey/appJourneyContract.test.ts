import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');

describe('App guided-journey contract', () => {
  it('wires the derived journey and its presentation components', () => {
    expect(app).toContain("from './journey/journeyState'");
    expect(app).toContain("from './journey/JourneyCard'");
    expect(app).toContain("from './journey/ContextualUpgrade'");
    expect(app).toContain("from './journey/DemoProgress'");
    expect(app).toContain('deriveJourneyStage');
    expect(app).toContain('nextPendingId');
  });

  it('makes first-use, review and handoff actions explicit', () => {
    expect(app).toContain('Começar agora');
    expect(app).toContain('Adicionar extrato grátis');
    expect(app).toContain('Revisar agora');
    expect(app).toContain('Tudo revisado');
    expect(app).toContain('Ver meu Radar');
    expect(app).toContain('Salvar e ver próxima');
  });

  it('keeps demo progress and Radar viewing session-only', () => {
    expect(app).toContain('radarSeenThisSession');
    expect(app).toContain('demoTouchedReview');
    expect(app).toContain('demoTouchedWatch');
    expect(app).toContain('demoTouchedPlan');
    expect(app).toContain('<DemoProgress');
  });

  it('explains locked value contextually before using the existing subscription path', () => {
    expect(app).toContain('<ContextualUpgrade');
    expect(app).toContain('Radar completo é Pro');
    expect(app).toContain('Open Finance automático é Pro');
    expect(app).toContain('openSubscriptionExperience');
  });
});
