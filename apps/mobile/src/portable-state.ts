export type PortableStatus = 'needs_review' | 'unresolved' | 'candidate' | 'confirmed' | 'categorized';

export type PortableTransaction = {
  id: string;
  date: string;
  amount: number;
  direction: 'debit' | 'credit';
  description: string;
  counterparty: string;
  status: PortableStatus;
  category?: string;
};

export type PortableAccount = {
  id: string;
  name: string;
  type: string;
  balance: number;
  currencyCode?: string;
};

export type PortableState = {
  demoMode: boolean;
  txs: PortableTransaction[];
  accounts: PortableAccount[];
};

export type PortableSummary = {
  attention: number;
  resolved: number;
  automated: number;
  balance: number;
};

export const emptyPortableState: PortableState = {
  demoMode: false,
  txs: [],
  accounts: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseTransaction(value: unknown): PortableTransaction | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'string' || typeof value.date !== 'string') return null;
  if (typeof value.amount !== 'number' || !Number.isFinite(value.amount)) return null;
  if (value.direction !== 'debit' && value.direction !== 'credit') return null;
  if (typeof value.description !== 'string' || typeof value.counterparty !== 'string') return null;
  if (!['needs_review', 'unresolved', 'candidate', 'confirmed', 'categorized'].includes(String(value.status))) return null;

  return {
    id: value.id,
    date: value.date,
    amount: value.amount,
    direction: value.direction,
    description: value.description,
    counterparty: value.counterparty,
    status: value.status as PortableStatus,
    ...(typeof value.category === 'string' && value.category ? { category: value.category } : {}),
  };
}

function parseAccount(value: unknown): PortableAccount | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'string' || typeof value.name !== 'string' || typeof value.type !== 'string') return null;
  if (typeof value.balance !== 'number' || !Number.isFinite(value.balance)) return null;
  return {
    id: value.id,
    name: value.name,
    type: value.type,
    balance: value.balance,
    ...(typeof value.currencyCode === 'string' && value.currencyCode ? { currencyCode: value.currencyCode } : {}),
  };
}

export function parsePortableStatePayload(value: unknown): PortableState | null {
  if (!isRecord(value) || value.type !== 'WTM_PORTABLE_STATE') return null;
  if (typeof value.demoMode !== 'boolean' || !Array.isArray(value.txs) || !Array.isArray(value.accounts)) return null;

  const txs = value.txs.map(parseTransaction);
  const accounts = value.accounts.map(parseAccount);
  if (txs.some(tx => tx === null) || accounts.some(account => account === null)) return null;

  return {
    demoMode: value.demoMode,
    txs: txs as PortableTransaction[],
    accounts: accounts as PortableAccount[],
  };
}

export function summarizePortableState(state: PortableState): PortableSummary {
  return {
    attention: state.txs.filter(tx => tx.status === 'unresolved' || tx.status === 'needs_review').length,
    resolved: state.txs.filter(tx => tx.status === 'confirmed' || tx.status === 'categorized').length,
    automated: state.txs.filter(tx => tx.status === 'candidate').length,
    balance: state.accounts.reduce((sum, account) => sum + account.balance, 0),
  };
}

export function categorizePortableTransaction(state: PortableState, id: string, category: string): PortableState {
  return {
    ...state,
    txs: state.txs.map(tx => tx.id === id ? {
      ...tx,
      status: 'categorized',
      category,
    } : tx),
  };
}
