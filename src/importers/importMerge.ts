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

function increment(map: Map<string, number>, key: string): number {
  const next = (map.get(key) || 0) + 1;
  map.set(key, next);
  return next;
}

export function mergeImportedTransactions(current: Tx[], incoming: Tx[]): ImportMergeResult {
  const currentMultiplicity = new Map<string, number>();
  const incomingMultiplicity = new Map<string, number>();
  const seenIds = new Set(current.map(tx => tx.id));
  const added: Tx[] = [];
  let duplicateCount = 0;

  current.forEach(tx => increment(currentMultiplicity, transactionFingerprint(tx)));

  for (const tx of incoming) {
    if (seenIds.has(tx.id)) {
      duplicateCount += 1;
      continue;
    }

    const fingerprint = transactionFingerprint(tx);
    const occurrence = increment(incomingMultiplicity, fingerprint);
    const alreadyPresent = currentMultiplicity.get(fingerprint) || 0;

    if (occurrence <= alreadyPresent) {
      duplicateCount += 1;
      continue;
    }

    seenIds.add(tx.id);
    added.push(tx);
  }

  return {
    merged: [...current, ...added],
    added,
    addedCount: added.length,
    duplicateCount,
  };
}
