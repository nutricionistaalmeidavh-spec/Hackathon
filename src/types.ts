export type Status = 'needs_review' | 'unresolved' | 'candidate' | 'confirmed' | 'categorized';
export type CategorySource = 'heuristic' | 'provider' | 'pattern' | 'manual' | 'rule';
export type RecurrencePeriod = 'weekly' | 'biweekly' | 'monthly';

export type Tx = {
  id: string;
  date: string;
  amount: number;
  direction: 'debit' | 'credit';
  description: string;
  counterparty: string;
  status: Status;
  category?: string;
  providerCategory?: string;
  categorySource?: CategorySource;
  categoryConfidence?: number;
  recurrencePeriod?: RecurrencePeriod;
  recurrenceConfidence?: number;
  recurrenceSamples?: number;
  recurrenceMedianAmount?: number;
  recurrenceMinAmount?: number;
  recurrenceMaxAmount?: number;
  recurrenceExpectedDay?: number;
};

export type Rule = { id: string; pattern: string; category: string; active: boolean };
export type BankAccount = { id: string; name: string; type: string; balance: number; currencyCode?: string };
export type RadarPoint = { date: string; balance: number; inflow: number; outflow: number; drivers: { label: string; category: string; delta: number }[] };
export type RadarRecurring = { label: string; category: string; delta: number; date: string; confidence: number; period: RecurrencePeriod; minAmount: number; maxAmount: number; samples: number };
