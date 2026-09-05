import { describe, expect, it } from 'vitest';
import { classifyFeedback } from './feedback';

describe('feedback severity', () => {
  it('classifies clear failures and cancellations as errors', () => {
    expect(classifyFeedback('Não foi possível abrir a Pluggy. Confira o ambiente do servidor.')).toBe('error');
    expect(classifyFeedback('Conexão cancelada ou com erro.')).toBe('error');
    expect(classifyFeedback('O checkout RevenueCat ainda não está configurado neste build.')).toBe('error');
  });

  it('classifies completed actions as success', () => {
    expect(classifyFeedback('Plano Pro ativo. Recursos premium liberados.')).toBe('success');
    expect(classifyFeedback('12 movimentações importadas.')).toBe('success');
    expect(classifyFeedback('Revisão concluída. Tudo que precisava de você foi tratado.')).toBe('success');
  });

  it('keeps progress and neutral guidance informational', () => {
    expect(classifyFeedback('Sincronizando contas e transações…')).toBe('info');
    expect(classifyFeedback('Abrindo assinatura Pro…')).toBe('info');
    expect(classifyFeedback('Demo Pro carregada com dados e plano sintéticos. Seus dados reais e sua assinatura não foram alterados.')).toBe('info');
  });
});
