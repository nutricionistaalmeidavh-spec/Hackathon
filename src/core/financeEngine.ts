import type { BankAccount, CategorySource, RadarPoint, RadarRecurring, RecurrencePeriod, Rule, Status, Tx } from '../types';

const merchantPatterns: { pattern: RegExp; label: string; confidence: number }[] = [
  { pattern: /condom[ií]nio|condominio|edif[ií]cio|edificio/i, label: 'Condomínio', confidence: 99 },
  { pattern: /eletrobras|electrobras|\blight\b|energia el[eé]trica|eletricidade/i, label: 'Energia', confidence: 98 },
  { pattern: /\bvivo\b|telef[oô]nica|telefonica|\bclaro\b|\btim\b|telecom/i, label: 'Telefonia/Internet', confidence: 98 },
  { pattern: /netflix|spotify|prime video|amazon prime|disney\+|hbo|max\.com|deezer|youtube premium/i, label: 'Assinaturas', confidence: 99 },
  { pattern: /smart fit|smartfit|bluefit|academia|\bgym\b/i, label: 'Academia', confidence: 99 },
  { pattern: /pagamento.*fatura|fatura.*cart[aã]o|credit card payment/i, label: 'Cartão de crédito', confidence: 99 },
  { pattern: /\bposto\b|combust[ií]vel|gasolina|etanol|diesel/i, label: 'Combustível', confidence: 96 },
  { pattern: /supermercado|hipermercado|atacad[aã]o|\bmercado\b/i, label: 'Supermercado', confidence: 96 },
  { pattern: /padaria|panificadora|restaurante|lanchonete|caf[eé]|pizzaria/i, label: 'Alimentação', confidence: 94 },
  { pattern: /conveni[eê]ncia/i, label: 'Conveniência', confidence: 95 },
  { pattern: /uber|99app|taxi|t[aá]xi|ped[aá]gio|estacionamento/i, label: 'Transporte', confidence: 95 },
  { pattern: /farm[aá]cia|drogaria|hospital|cl[ií]nica|laborat[oó]rio/i, label: 'Saúde', confidence: 96 },
  { pattern: /aluguel/i, label: 'Moradia', confidence: 98 },
  { pattern: /imposto|tributo|arrecada[cç][aã]o|receita federal/i, label: 'Impostos', confidence: 99 },
];

const providerPatterns: { pattern: RegExp; label: string; confidence: number }[] = [
  { pattern: /salary|payroll|wage/i, label: 'Salário', confidence: 98 },
  { pattern: /housing|condominium|rent/i, label: 'Moradia', confidence: 94 },
  { pattern: /electricity|electric utility|utilities/i, label: 'Energia', confidence: 96 },
  { pattern: /telecommunications|internet|phone/i, label: 'Telefonia/Internet', confidence: 96 },
  { pattern: /video streaming|music streaming|subscription/i, label: 'Assinaturas', confidence: 97 },
  { pattern: /gyms|fitness centers|fitness/i, label: 'Academia', confidence: 97 },
  { pattern: /credit card payment/i, label: 'Cartão de crédito', confidence: 99 },
  { pattern: /supermarket|grocer/i, label: 'Supermercado', confidence: 95 },
  { pattern: /restaurant|food/i, label: 'Alimentação', confidence: 93 },
  { pattern: /fuel|gas station/i, label: 'Combustível', confidence: 95 },
  { pattern: /transport|taxi|rideshare/i, label: 'Transporte', confidence: 94 },
  { pattern: /health|pharmacy|medical/i, label: 'Saúde', confidence: 94 },
  { pattern: /tax/i, label: 'Impostos', confidence: 98 },
];

export const safeDate = (value: string) => {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(`${raw}T12:00:00Z`);
    return Number.isNaN(d.getTime()) ? null : raw;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

const median = (values: number[]) => {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};

const dayDiff = (a: string, b: string) => {
  const aa = safeDate(a), bb = safeDate(b);
  if (!aa || !bb) return NaN;
  return Math.round((new Date(`${bb}T12:00:00Z`).getTime() - new Date(`${aa}T12:00:00Z`).getTime()) / 86_400_000);
};

export const merchantKey = (tx: Tx) => (tx.counterparty || tx.description)
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/\b(pix|ted|doc|pagamento|compra|debito|credito|cartao|transferencia|transf|agendamento|recebimento|online)\b/g, ' ')
  .replace(/\b(s\.?a\.?|ltda|eireli|me|servicos?|comercio|comercial)\b/g, ' ')
  .replace(/\d+/g, ' ').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 48) || tx.category || 'movimentacao';

function infer(tx: Tx, rules: Rule[]) {
  const text = `${tx.description} ${tx.counterparty}`.toLowerCase();
  const rule = rules.find(r => r.active && text.includes(r.pattern.toLowerCase()));
  if (rule) return { category: rule.category, source: 'rule' as CategorySource, confidence: 100 };
  if (tx.direction === 'credit' && /sal[aá]rio|salario|salary|payroll|folha de pagamento/i.test(text)) return { category: 'Salário', source: 'heuristic' as CategorySource, confidence: 99 };
  const merchant = merchantPatterns.find(x => x.pattern.test(text));
  if (merchant) return { category: merchant.label, source: 'heuristic' as CategorySource, confidence: merchant.confidence };
  const provider = providerPatterns.find(x => x.pattern.test(tx.providerCategory || ''));
  if (provider) return { category: provider.label, source: 'provider' as CategorySource, confidence: provider.confidence };
  return null;
}

function addPeriod(iso: string, period: RecurrencePeriod, expectedDay?: number) {
  const valid = safeDate(iso);
  if (!valid) return null;
  const d = new Date(`${valid}T12:00:00Z`);
  if (period === 'weekly') d.setUTCDate(d.getUTCDate() + 7);
  else if (period === 'biweekly') d.setUTCDate(d.getUTCDate() + 14);
  else {
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const targetDay = expectedDay || d.getUTCDate();
    const lastDay = new Date(Date.UTC(year, month + 1, 0, 12)).getUTCDate();
    return new Date(Date.UTC(year, month, Math.min(targetDay, lastDay), 12));
  }
  return d;
}

export function applyPatternIntelligence(txs: Tx[], rules: Rule[]) {
  const first = txs.map(tx => {
    const normalizedDate = safeDate(tx.date);
    const base = normalizedDate ? { ...tx, date: normalizedDate } : tx;
    if (base.categorySource === 'manual' || base.status === 'confirmed' || base.status === 'categorized') return base;
    const inferred = infer(base, rules);
    if (!inferred) return { ...base, status: 'unresolved' as Status, category: undefined, categorySource: undefined, categoryConfidence: undefined };
    return { ...base, status: (inferred.confidence >= 94 ? 'candidate' : 'needs_review') as Status, category: inferred.category, categorySource: inferred.source, categoryConfidence: inferred.confidence };
  });

  const groups = new Map<string, Tx[]>();
  first.forEach(tx => {
    const key = `${merchantKey(tx)}|${tx.direction}`;
    groups.set(key, [...(groups.get(key) || []), tx]);
  });

  const meta = new Map<string, {
    period: RecurrencePeriod; confidence: number; samples: number; medianAmount: number; minAmount: number; maxAmount: number; expectedDay: number; category?: string; categoryConfidence?: number;
  }>();

  groups.forEach(list => {
    const sorted = list.filter(t => safeDate(t.date)).slice().sort((a, b) => a.date.localeCompare(b.date));
    if (sorted.length < 2) return;
    const intervals = sorted.slice(1).map((t, i) => dayDiff(sorted[i].date, t.date)).filter(n => Number.isFinite(n) && n > 0);
    if (!intervals.length) return;
    const im = median(intervals);
    const period: RecurrencePeriod | null = im >= 25 && im <= 35 ? 'monthly' : im >= 13 && im <= 16 ? 'biweekly' : im >= 6 && im <= 8 ? 'weekly' : null;
    if (!period) return;
    const target = period === 'monthly' ? 30 : period === 'biweekly' ? 14 : 7;
    const tolerance = period === 'monthly' ? 6 : period === 'biweekly' ? 2 : 1;
    const intervalConsistency = intervals.filter(n => Math.abs(n - target) <= tolerance).length / intervals.length;
    if (intervalConsistency < .6) return;

    const amounts = sorted.map(x => x.amount);
    const med = median(amounts), minAmount = Math.min(...amounts), maxAmount = Math.max(...amounts);
    const spread = med ? (maxAmount - minAmount) / med : 1;
    const dom = sorted.map(t => new Date(`${t.date}T12:00:00Z`).getUTCDate()).filter(Number.isFinite);
    const expectedDay = median(dom);
    const daySpread = Math.max(...dom) - Math.min(...dom);
    let confidence = 38 + Math.min(24, (sorted.length - 1) * 8) + Math.round(intervalConsistency * 18) + (spread <= .08 ? 18 : spread <= .2 ? 14 : spread <= .4 ? 8 : 3) + (period === 'monthly' ? (daySpread <= 3 ? 10 : daySpread <= 6 ? 6 : 0) : 0);
    confidence = Math.min(99, confidence);
    if (confidence < 72) return;

    const donors = sorted.filter(t => t.category && (t.categoryConfidence || 0) >= 90);
    const categories = [...new Set(donors.map(t => t.category!))];
    const category = categories.length === 1 ? categories[0] : undefined;
    const categoryConfidence = category ? Math.max(...donors.filter(t => t.category === category).map(t => t.categoryConfidence || 90)) : undefined;
    sorted.forEach(t => meta.set(t.id, { period, confidence, samples: sorted.length, medianAmount: med, minAmount, maxAmount, expectedDay, category, categoryConfidence }));
  });

  return first.map(tx => {
    const m = meta.get(tx.id);
    if (!m) return tx;
    let next: Tx = { ...tx, recurrencePeriod: m.period, recurrenceConfidence: m.confidence, recurrenceSamples: m.samples, recurrenceMedianAmount: m.medianAmount, recurrenceMinAmount: m.minAmount, recurrenceMaxAmount: m.maxAmount, recurrenceExpectedDay: m.expectedDay };
    if (tx.categorySource === 'manual' || tx.status === 'confirmed' || tx.status === 'categorized') return next;
    if (m.category && m.confidence >= 78) {
      const confidence = Math.min(98, Math.round(((m.categoryConfidence || 92) + m.confidence) / 2));
      next = { ...next, category: m.category, categorySource: 'pattern', categoryConfidence: confidence, status: confidence >= 94 ? 'candidate' : 'needs_review' };
    } else if (!next.category && next.direction === 'credit' && m.period === 'monthly' && m.confidence >= 82) {
      next = { ...next, category: 'Recebimento', categorySource: 'pattern', categoryConfidence: 88, status: 'needs_review' };
    }
    return next;
  });
}

export function buildRadar(txs: Tx[], accounts: BankAccount[], rules: Rule[] = []) {
  const processed = applyPatternIntelligence(txs, rules);
  const validDates = processed.map(t => safeDate(t.date)).filter((d): d is string => Boolean(d)).sort();
  const anchor = validDates.at(-1) || new Date().toISOString().slice(0, 10);
  const anchorDate = new Date(`${anchor}T12:00:00Z`);
  const end = new Date(anchorDate); end.setUTCDate(end.getUTCDate() + 30);

  const cash = accounts.filter(a => !/credit|cart/i.test(String(a.type)));
  const basis = cash.length ? cash : accounts;
  const balanceKnown = basis.length > 0 && basis.some(a => Number.isFinite(Number(a.balance)));
  const startingBalance = balanceKnown ? basis.reduce((s, a) => s + Math.round((Number(a.balance) || 0) * 100), 0) : 0;

  const recurring: RadarRecurring[] = [];
  const seen = new Set<string>();
  processed.forEach(tx => {
    if (!tx.recurrencePeriod || !tx.recurrenceConfidence || tx.recurrenceConfidence < 76) return;
    const key = `${merchantKey(tx)}|${tx.direction}`;
    if (seen.has(key)) return;
    const siblings = processed.filter(x => `${merchantKey(x)}|${x.direction}` === key && safeDate(x.date)).sort((a, b) => a.date.localeCompare(b.date));
    const latest = siblings.at(-1);
    if (!latest) return;
    let d = addPeriod(latest.date, tx.recurrencePeriod, tx.recurrenceExpectedDay);
    if (!d) return;
    seen.add(key);
    let guard = 0;
    while (d <= anchorDate && guard < 60) { d = addPeriod(d.toISOString().slice(0, 10), tx.recurrencePeriod, tx.recurrenceExpectedDay); if (!d) return; guard++; }
    if (d <= end) recurring.push({
      label: latest.counterparty || latest.description,
      category: latest.category || 'Recorrente',
      delta: latest.direction === 'credit' ? (tx.recurrenceMedianAmount || latest.amount) : -(tx.recurrenceMedianAmount || latest.amount),
      date: d.toISOString().slice(0, 10), confidence: tx.recurrenceConfidence, period: tx.recurrencePeriod,
      minAmount: tx.recurrenceMinAmount || latest.amount, maxAmount: tx.recurrenceMaxAmount || latest.amount, samples: tx.recurrenceSamples || siblings.length,
    });
  });

  const recurringIds = new Set(processed.filter(t => t.recurrenceConfidence && t.recurrenceConfidence >= 76).map(t => t.id));
  const windowStart = new Date(anchorDate); windowStart.setUTCDate(windowStart.getUTCDate() - 30);
  const variable = processed.filter(t => {
    const d = safeDate(t.date);
    return t.direction === 'debit' && !recurringIds.has(t.id) && Boolean(d) && new Date(`${d}T12:00:00Z`) >= windowStart && new Date(`${d}T12:00:00Z`) <= anchorDate;
  });
  const variableDaily = Math.round(variable.reduce((s, t) => s + t.amount, 0) / 30);
  const byDate = new Map<string, RadarRecurring[]>();
  recurring.forEach(r => byDate.set(r.date, [...(byDate.get(r.date) || []), r]));

  let balance = startingBalance;
  const projection: RadarPoint[] = [];
  for (let i = 1; i <= 30; i++) {
    const d = new Date(anchorDate); d.setUTCDate(d.getUTCDate() + i);
    const date = d.toISOString().slice(0, 10), scheduled = byDate.get(date) || [];
    const inflow = scheduled.filter(x => x.delta > 0).reduce((s, x) => s + x.delta, 0);
    const outflow = Math.abs(scheduled.filter(x => x.delta < 0).reduce((s, x) => s + x.delta, 0)) + variableDaily;
    balance += inflow - outflow;
    projection.push({ date, balance, inflow, outflow, drivers: [...scheduled.map(x => ({ label: x.label, category: x.category, delta: x.delta })), ...(variableDaily ? [{ label: 'Média de gastos variáveis', category: 'Histórico', delta: -variableDaily }] : [])] });
  }
  return { projection, recurring, startingBalance, balanceKnown, variableDaily, anchor };
}
