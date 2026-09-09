import type { PortableTransaction } from './portable-state';

export type PortableLoadState = 'loading' | 'ready' | 'error';
export type InboxFilter = 'attention' | 'resolved' | 'auto';

export function derivePortableLoadState({
  portableReady,
  webLoadError,
}: {
  portableReady: boolean;
  webLoadError: boolean;
}): PortableLoadState {
  if (portableReady) return 'ready';
  return webLoadError ? 'error' : 'loading';
}

export function inboxEmptyCopy(filter: InboxFilter) {
  if (filter === 'resolved') {
    return {
      eyebrow: 'Sem histórico revisado',
      title: 'Nada resolvido por aqui ainda.',
      description: 'Quando você confirmar categorias, elas aparecem nesta lista.',
    };
  }

  if (filter === 'auto') {
    return {
      eyebrow: 'Sem automações',
      title: 'Nenhuma categorização automática ainda.',
      description: 'As sugestões automáticas aparecem conforme padrões confiáveis são reconhecidos.',
    };
  }

  return {
    eyebrow: 'Revisão concluída',
    title: 'Seu dinheiro está organizado.',
    description: 'Veja o que vem pela frente com a projeção do Radar.',
  };
}

export function transactionAccessibilityLabel(tx: PortableTransaction): string {
  const direction = tx.direction === 'debit' ? 'Saída' : 'Entrada';
  const status = tx.status === 'candidate'
    ? 'categorização automática'
    : tx.status === 'categorized'
      ? 'categorizado'
      : tx.status === 'confirmed'
        ? 'confirmado'
        : 'precisa de revisão';
  const category = tx.category || 'sem categoria';

  return `${tx.description}. ${direction}. ${category}. ${status}.`;
}

export function navAccessibilityLabel(label: string, badge?: number): string {
  if (!badge) return label;
  return `${label}, ${badge} ${badge === 1 ? 'pendência' : 'pendências'}`;
}
