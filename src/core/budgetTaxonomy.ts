export type BudgetGroup = 'essential' | 'flexible' | 'future';

const mapping: Record<string, BudgetGroup> = {
  'Condomínio': 'essential',
  'Moradia': 'essential',
  'Energia': 'essential',
  'Telefonia/Internet': 'essential',
  'Combustível': 'essential',
  'Supermercado': 'essential',
  'Transporte': 'essential',
  'Saúde': 'essential',
  'Serviços': 'essential',
  'Impostos': 'essential',
  'Folha/Pessoal': 'essential',
  'Fornecedor': 'essential',
  'Cartão de crédito': 'essential',
  'Alimentação': 'flexible',
  'Conveniência': 'flexible',
  'Assinaturas': 'flexible',
  'Academia': 'flexible',
  'Investimentos': 'future',
  'Aposentadoria': 'future',
  'Reserva de emergência': 'future',
  'Metas': 'future',
  'Pagamento extra de dívida': 'future',
};

export function budgetGroupForCategory(category?: string): BudgetGroup | 'unknown' {
  if (!category) return 'unknown';
  return mapping[category] || 'unknown';
}
