import { describe, expect, it } from 'vitest';
import { mergeImportedTransactions } from './importMerge';
import type { Tx } from '../types';

function tx(overrides: Partial<Tx> = {}): Tx {
  return {
    id: 'tx-1',
    date: '2026-09-08',
    amount: 14780,
    direction: 'debit',
    description: 'POSTO AVENIDA',
    counterparty: 'Posto Avenida',
    status: 'unresolved',
    ...overrides,
  };
}

describe('mergeImportedTransactions', () => {
  it('preserves an existing manual review when the same movement is imported again', () => {
    const reviewed = tx({
      id: 'old-id',
      status: 'categorized',
      category: 'Combustível',
      categorySource: 'manual',
      categoryConfidence: 100,
    });
    const reimported = tx({ id: 'new-file-id', description: '  Posto   Avenida ' });

    const result = mergeImportedTransactions([reviewed], [reimported]);

    expect(result.merged).toEqual([reviewed]);
    expect(result.addedCount).toBe(0);
    expect(result.duplicateCount).toBe(1);
  });

  it('deduplicates repeated movements inside the same import batch', () => {
    const first = tx({ id: 'file-a' });
    const repeated = tx({ id: 'file-b' });

    const result = mergeImportedTransactions([], [first, repeated]);

    expect(result.merged).toEqual([first]);
    expect(result.addedCount).toBe(1);
    expect(result.duplicateCount).toBe(1);
  });

  it('keeps existing data and appends genuinely new movements', () => {
    const existing = tx({ id: 'existing' });
    const incoming = tx({ id: 'new', amount: 9200, description: 'SUPERMERCADO CENTRAL' });

    const result = mergeImportedTransactions([existing], [incoming]);

    expect(result.merged).toEqual([existing, incoming]);
    expect(result.added).toEqual([incoming]);
    expect(result.addedCount).toBe(1);
  });
});
