import type { BankAccount, Rule, Tx } from '../types';
import { createPlanningState, type PlanningState } from '../features/planner/planningEngine';

export type DemoState = {
  txs: Tx[];
  accounts: BankAccount[];
  rules: Rule[];
  planning: PlanningState;
};

const tx = (
  id: string,
  date: string,
  amount: number,
  direction: Tx['direction'],
  description: string,
  counterparty: string,
  providerCategory?: string,
): Tx => ({ id: `demo_${id}`, date, amount, direction, description, counterparty, status: 'unresolved', providerCategory });

function createDemoPlanning(): PlanningState {
  const base = createPlanningState();
  return {
    ...base,
    stage: 'scenarios',
    goals: [
      { id: 'demo_retirement', title: 'Aposentadoria aos 60', kind: 'retirement', currentAmount: 2400000, monthlyContribution: 80000, priority: 1, notes: 'Construir patrimônio de longo prazo', status: 'confirmed' },
      { id: 'demo_car', title: 'Trocar de carro', kind: 'purchase', targetAmount: 9000000, targetDate: '2028-09-01', currentAmount: 1200000, monthlyContribution: 70000, priority: 2, status: 'confirmed' },
      { id: 'demo_travel', title: 'Viagem internacional', kind: 'travel', targetAmount: 1200000, targetDate: '2027-07-01', currentAmount: 180000, monthlyContribution: 30000, priority: 3, status: 'confirmed' },
    ],
    adjustments: [
      { id: 'demo_delivery', label: 'Delivery e restaurantes', currentAmount: 120000, targetAmount: 60000, confirmed: true },
      { id: 'demo_subscriptions', label: 'Assinaturas digitais', currentAmount: 25000, targetAmount: 10000, confirmed: true },
      { id: 'demo_rides', label: 'Transporte por app', currentAmount: 45000, targetAmount: 25000, confirmed: true },
    ],
    messages: [
      ...base.messages,
      { id: 'demo_user_1', role: 'user', text: 'Quero me aposentar com tranquilidade, trocar de carro em dois anos e fazer uma viagem no ano que vem.' },
      { id: 'demo_assistant_1', role: 'assistant', text: 'Confirmei os três objetivos. Com os ajustes que você marcou como possíveis, há R$ 950 por mês para redistribuir. Posso comparar prioridades sem assumir que uma escolha é a correta para você.' },
    ],
  };
}

/** Synthetic fixed data used only for the hackathon/demo experience. Values are cents. */
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
    accounts: [{ id: 'demo_cash', name: 'Conta principal · demonstração', type: 'CHECKING', balance: 2500, currencyCode: 'BRL' }],
    rules: [],
    planning: createDemoPlanning(),
  };
}
