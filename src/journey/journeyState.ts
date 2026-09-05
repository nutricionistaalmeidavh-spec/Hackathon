import type { Tx } from '../types';

export type JourneyStage = 'empty' | 'review' | 'radar-ready' | 'plan-ready' | 'active-plan';

export type JourneyInput = {
  txCount: number;
  attentionCount: number;
  hasMeaningfulPlan: boolean;
  radarSeenThisSession: boolean;
  hasRadarAttention: boolean;
};

export function deriveJourneyStage(input: JourneyInput): JourneyStage {
  if (input.txCount === 0) return 'empty';
  if (input.attentionCount > 0) return 'review';
  if (input.hasMeaningfulPlan) return 'active-plan';
  if (input.radarSeenThisSession) return 'plan-ready';
  return 'radar-ready';
}

const isPending = (tx: Tx) => tx.status === 'unresolved' || tx.status === 'needs_review';

export function nextPendingId(txs: Tx[], currentId: string): string | null {
  const currentIndex = txs.findIndex(tx => tx.id === currentId);
  if (currentIndex < 0) return txs.find(isPending)?.id ?? null;

  for (let index = currentIndex + 1; index < txs.length; index += 1) {
    if (txs[index].id !== currentId && isPending(txs[index])) return txs[index].id;
  }
  for (let index = 0; index < currentIndex; index += 1) {
    if (txs[index].id !== currentId && isPending(txs[index])) return txs[index].id;
  }
  return null;
}

export type DemoProgressInput = {
  touchedReview: boolean;
  touchedWatch: boolean;
  touchedPlan: boolean;
};

export function deriveDemoStep(input: DemoProgressInput): 1 | 2 | 3 | 4 {
  if (input.touchedPlan) return 4;
  if (input.touchedWatch) return 3;
  if (input.touchedReview) return 2;
  return 1;
}
