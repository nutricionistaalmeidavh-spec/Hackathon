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

  it('deduplicates the exact same source row inside one batch', () => {
    const first = tx({ id: 'same-source-row' });
    const repeated = tx({ id: 'same-source-row' });

    const result = mergeImportedTransactions([], [first, repeated]);

    expect(result.merged).toEqual([first]);
    expect(result.addedCount).toBe(1);
    expect(result.duplicateCount).toBe(1);
  });

  it('preserves two legitimate identical charges when both exist in a new statement', () => {
    const first = tx({ id: 'row-1' });
    const second = tx({ id: 'row-2' });

    const result = mergeImportedTransactions([], [first, second]);

    expect(result.merged).toEqual([first, second]);
    expect(result.addedCount).toBe(2);
    expect(result.duplicateCount).toBe(0);
  });

  it('uses multiplicity to preserve reviews when the same statement is imported again', () => {
    const firstReviewed = tx({ id: 'old-1', status: 'categorized', category: 'Combustível', categorySource: 'manual' });
    const secondReviewed = tx({ id: 'old-2', status: 'confirmed', category: 'Combustível' });
    const reimportedFirst = tx({ id: 'new-1' });
    const reimportedSecond = tx({ id: 'new-2' });

    const result = mergeImportedTransactions([firstReviewed, secondReviewed], [reimportedFirst, reimportedSecond]);

    expect(result.merged).toEqual([firstReviewed, secondReviewed]);
    expect(result.addedCount).toBe(0);
    expect(result.duplicateCount).toBe(2);
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
