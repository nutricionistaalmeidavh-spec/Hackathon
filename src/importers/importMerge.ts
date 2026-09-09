import type { Tx } from '../types';

export type ImportMergeResult = {
  merged: Tx[];
  added: Tx[];
  addedCount: number;
  duplicateCount: number;
};

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export function transactionFingerprint(tx: Tx): string {
  return [
    tx.date,
    tx.direction,
    String(tx.amount),
    normalizeText(tx.description || tx.counterparty || ''),
  ].join('|');
}

export function mergeImportedTransactions(current: Tx[], incoming: Tx[]): ImportMergeResult {
  const fingerprints = new Set(current.map(transactionFingerprint));
  const added: Tx[] = [];
  let duplicateCount = 0;

  for (const tx of incoming) {
    const fingerprint = transactionFingerprint(tx);
    if (fingerprints.has(fingerprint)) {
      duplicateCount += 1;
      continue;
    }

    fingerprints.add(fingerprint);
    added.push(tx);
  }

  return {
    merged: [...current, ...added],
    added,
    addedCount: added.length,
    duplicateCount,
  };
}
