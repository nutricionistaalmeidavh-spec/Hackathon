import { describe, expect, it } from 'vitest';
import {
  derivePortableLoadState,
  inboxEmptyCopy,
  navAccessibilityLabel,
  transactionAccessibilityLabel,
} from './experience';

const tx = {
  id: 'tx_1',
  date: '2026-09-08',
  amount: 14780,
  direction: 'debit' as const,
  description: 'SUPERMERCADO CENTRAL',
  counterparty: 'SUPERMERCADO CENTRAL',
  status: 'needs_review' as const,
};

describe('mobile experience helpers', () => {
  it('never leaves a failed web bootstrap looking like an endless loading state', () => {
    expect(derivePortableLoadState({ portableReady: false, webLoadError: false })).toBe('loading');
    expect(derivePortableLoadState({ portableReady: false, webLoadError: true })).toBe('error');
    expect(derivePortableLoadState({ portableReady: true, webLoadError: true })).toBe('ready');
  });

  it('provides specific empty states for each inbox filter', () => {
    expect(inboxEmptyCopy('attention').title).toContain('organizado');
    expect(inboxEmptyCopy('resolved').title).toContain('resolvido');
    expect(inboxEmptyCopy('auto').title).toContain('automática');
  });

  it('builds screen-reader friendly transaction and navigation labels', () => {
    expect(transactionAccessibilityLabel(tx)).toContain('Saída');
    expect(transactionAccessibilityLabel(tx)).toContain('precisa de revisão');
    expect(navAccessibilityLabel('Inbox', 2)).toBe('Inbox, 2 pendências');
    expect(navAccessibilityLabel('Radar')).toBe('Radar');
  });
});
