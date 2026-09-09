import { describe, expect, it } from 'vitest';
import {
  categorizePortableTransaction,
  parsePortableStatePayload,
  summarizePortableState,
  type PortableState,
} from './portable-state';

const state: PortableState = {
  demoMode: true,
  txs: [
    { id: 'a', date: '2026-09-08', amount: 14780, direction: 'debit', description: 'POSTO', counterparty: 'Posto', status: 'unresolved' },
    { id: 'b', date: '2026-09-08', amount: 10000, direction: 'credit', description: 'PIX', counterparty: 'Cliente', status: 'candidate' },
    { id: 'c', date: '2026-09-08', amount: 5000, direction: 'debit', description: 'MERCADO', counterparty: 'Mercado', status: 'categorized', category: 'Supermercado' },
  ],
  accounts: [
    { id: 'account-1', name: 'Conta', type: 'BANK', balance: 5240 },
    { id: 'card-1', name: 'Cartão', type: 'CREDIT', balance: -1800 },
  ],
};

describe('portable finance state', () => {
  it('parses a web state payload without importing web dependencies', () => {
    expect(parsePortableStatePayload({ type: 'WTM_PORTABLE_STATE', ...state })).toEqual(state);
  });

  it('summarizes Today/Inbox counts and uses the same cash-balance unit as Radar', () => {
    expect(summarizePortableState(state)).toEqual({
      attention: 1,
      resolved: 1,
      automated: 1,
      balance: 524000,
    });
  });

  it('categorizes a transaction without changing demo isolation', () => {
    const next = categorizePortableTransaction(state, 'a', 'Combustível');
    expect(next.demoMode).toBe(true);
    expect(next.txs[0]).toMatchObject({ status: 'categorized', category: 'Combustível' });
    expect(state.txs[0].status).toBe('unresolved');
  });

  it('rejects malformed payloads instead of trusting bridge data', () => {
    expect(parsePortableStatePayload({ type: 'WTM_PORTABLE_STATE', demoMode: false, txs: [{ id: 'bad' }], accounts: [] })).toBeNull();
  });
});
