import type { BankAccount, Rule, Tx } from '../types';

export type DemoState = {
  txs: Tx[];
  accounts: BankAccount[];
  rules: Rule[];
};

const tx = (
  id: string,
  date: string,
  amount: number,
  direction: Tx['direction'],
  description: string,
  counterparty: string,
  providerCategory?: string,
): Tx => ({
  id: `demo_${id}`,
  date,
  amount,
  direction,
  description,
  counterparty,
  status: 'unresolved',
  providerCategory,
});

/**
 * Synthetic fixed data used only for the hackathon/demo experience.
 * Values are cents and intentionally stable so the same judge flow can
 * be replayed without Pluggy, a bank account, or an AI provider.
 */
export function createDemoState(): DemoState {
  const txs: Tx[] = [
    tx('salary_may', '2026-05-30', 520000, 'credit', 'SALARIO ARTISYS', 'Artisys Tecnologia', 'salary'),
    tx('salary_jun', '2026-06-30', 520000, 'credit', 'SALARIO ARTISYS', 'Artisys Tecnologia', 'salary'),
    tx('salary_jul', '2026-07-30', 520000, 'credit', 'SALARIO ARTISYS', 'Artisys Tecnologia', 'salary'),
    tx('salary_aug', '2026-08-30', 520000, 'credit', 'SALARIO ARTISYS', 'Artisys Tecnologia', 'salary'),

    tx('rent_may', '2026-05-05', 178000, 'debit', 'ALUGUEL RESIDENCIAL', 'Imobiliaria Central', 'housing'),
    tx('rent_jun', '2026-06-05', 178000, 'debit', 'ALUGUEL RESIDENCIAL', 'Imobiliaria Central', 'housing'),
    tx('rent_jul', '2026-07-05', 180000, 'debit', 'ALUGUEL RESIDENCIAL', 'Imobiliaria Central', 'housing'),
    tx('rent_aug', '2026-08-05', 180000, 'debit', 'ALUGUEL RESIDENCIAL', 'Imobiliaria Central', 'housing'),

    tx('card_may', '2026-05-08', 212000, 'debit', 'PAGAMENTO FATURA CARTAO', 'Banco Cartao', 'credit card payment'),
    tx('card_jun', '2026-06-08', 224000, 'debit', 'PAGAMENTO FATURA CARTAO', 'Banco Cartao', 'credit card payment'),
    tx('card_jul', '2026-07-08', 218000, 'debit', 'PAGAMENTO FATURA CARTAO', 'Banco Cartao', 'credit card payment'),
    tx('card_aug', '2026-08-08', 231000, 'debit', 'PAGAMENTO FATURA CARTAO', 'Banco Cartao', 'credit card payment'),

    tx('gym_may', '2026-05-15', 11990, 'debit', 'SMART FIT MENSALIDADE', 'Smart Fit', 'fitness'),
    tx('gym_jun', '2026-06-15', 11990, 'debit', 'SMART FIT MENSALIDADE', 'Smart Fit', 'fitness'),
    tx('gym_jul', '2026-07-15', 11990, 'debit', 'SMART FIT MENSALIDADE', 'Smart Fit', 'fitness'),
    tx('gym_aug', '2026-08-15', 11990, 'debit', 'SMART FIT MENSALIDADE', 'Smart Fit', 'fitness'),

    tx('netflix_may', '2026-05-18', 5590, 'debit', 'NETFLIX.COM', 'Netflix', 'video streaming'),
    tx('netflix_jun', '2026-06-18', 5590, 'debit', 'NETFLIX.COM', 'Netflix', 'video streaming'),
    tx('netflix_jul', '2026-07-18', 5590, 'debit', 'NETFLIX.COM', 'Netflix', 'video streaming'),
    tx('netflix_aug', '2026-08-18', 5590, 'debit', 'NETFLIX.COM', 'Netflix', 'video streaming'),

    tx('internet_may', '2026-05-20', 10990, 'debit', 'VIVO FIBRA', 'Vivo', 'internet'),
    tx('internet_jun', '2026-06-20', 10990, 'debit', 'VIVO FIBRA', 'Vivo', 'internet'),
    tx('internet_jul', '2026-07-20', 10990, 'debit', 'VIVO FIBRA', 'Vivo', 'internet'),
    tx('internet_aug', '2026-08-20', 10990, 'debit', 'VIVO FIBRA', 'Vivo', 'internet'),

    tx('market_1', '2026-08-03', 24670, 'debit', 'SUPERMERCADO PONTO CERTO', 'Supermercado Ponto Certo', 'supermarket'),
    tx('fuel_1', '2026-08-10', 18000, 'debit', 'POSTO AVENIDA', 'Posto Avenida', 'fuel'),
    tx('food_1', '2026-08-13', 6890, 'debit', 'RESTAURANTE DO CENTRO', 'Restaurante do Centro', 'restaurant'),
    tx('market_2', '2026-08-22', 19230, 'debit', 'SUPERMERCADO PONTO CERTO', 'Supermercado Ponto Certo', 'supermarket'),
    tx('transport_1', '2026-08-25', 3740, 'debit', 'UBER TRIP', 'Uber', 'rideshare'),
    tx('ambiguous', '2026-08-27', 14780, 'debit', 'PIX M J SILVA 9834', 'M J Silva'),
    tx('pharmacy', '2026-08-29', 8460, 'debit', 'DROGARIA SAO PAULO', 'Drogaria Sao Paulo', 'pharmacy'),
  ];

  return {
    txs,
    accounts: [
      { id: 'demo_cash', name: 'Conta principal · demonstração', type: 'CHECKING', balance: 2500, currencyCode: 'BRL' },
    ],
    rules: [],
  };
}
