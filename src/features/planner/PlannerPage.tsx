import { useMemo, useState } from 'react';
import { BrainCircuit, Check, ChevronRight, CircleDollarSign, LockKeyhole, Plus, Search, Send, Sparkles, Target } from 'lucide-react';
import type { BudgetHealth } from '../../core/budgetHealth';
import { AiFeatureError, plannerTurn, researchMarket, type AiMarketResearch, type AiPlannerCandidateFact } from '../../integrations/ai';
import { allocateAcrossGoals, compoundProjection, INVESTMENT_SIMULATION_DISCLAIMER } from './scenarioEngine';
import { applyConfirmedFact, availableMonthlyCapacity, nextPlanningPrompt, validatePlanTargets, type PlanBucket, type PlanningState } from './planningEngine';

const brl = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

function parseMoneyCandidate(value: string | number | undefined) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value * 100);
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/R\$\s?/gi, '').replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

function candidateToState(state: PlanningState, fact: AiPlannerCandidateFact) {
  const type = fact.type.toLowerCase();
  if (type.includes('goal') || type.includes('objetivo') || type.includes('meta')) {
    return applyConfirmedFact(state, { type: 'goal', goal: { title: fact.label, kind: 'custom', priority: 2, notes: fact.value === undefined ? undefined : String(fact.value) } });
  }
  if (type.includes('adjust') || type.includes('redu') || type.includes('limite')) {
    const targetAmount = parseMoneyCandidate(fact.value);
    if (targetAmount !== null) return applyConfirmedFact(state, { type: 'adjustment', adjustment: { label: fact.label, targetAmount } });
  }
  return state;
}

export function PlannerPage({ state, budgetHealth, hasProAccess, demoMode, onChange, onUpgrade }: {
  state: PlanningState;
  budgetHealth: BudgetHealth;
  hasProAccess: boolean;
  demoMode: boolean;
  onChange: (state: PlanningState) => void;
  onUpgrade: () => void;
}) {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<AiPlannerCandidateFact[]>([]);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [marketQuery, setMarketQuery] = useState('');
  const [marketBusy, setMarketBusy] = useState(false);
  const [market, setMarket] = useState<AiMarketResearch | null>(null);
  const [marketError, setMarketError] = useState('');
  const [initialAmount, setInitialAmount] = useState('10000');
  const [monthlyContribution, setMonthlyContribution] = useState('500');
  const [months, setMonths] = useState('120');
  const [annualRate, setAnnualRate] = useState('8');
  const [customLabel, setCustomLabel] = useState('');
  const [customPercent, setCustomPercent] = useState('');

  const deterministicPrompt = useMemo(() => nextPlanningPrompt(state, budgetHealth), [state, budgetHealth]);
  const capacity = availableMonthlyCapacity(state);
  const allocationScenarios = useMemo(() => allocateAcrossGoals({
    monthlyCapacity: capacity,
    goals: state.goals.filter(goal => (goal.monthlyContribution || 0) > 0).map(goal => ({ id: goal.id, monthlyNeed: goal.monthlyContribution || 0, priority: goal.priority, kind: goal.kind === 'retirement' || goal.kind === 'reserve' ? goal.kind : 'other' })),
  }), [capacity, state.goals]);
  const planTargets = validatePlanTargets(state.buckets);
  const projection = useMemo(() => compoundProjection({
    initialAmount: Math.max(0, Number(initialAmount) || 0) * 100,
    monthlyContribution: Math.max(0, Number(monthlyContribution) || 0) * 100,
    months: Math.max(1, Number(months) || 1),
    annualRate: (Number(annualRate) || 0) / 100,
  }), [initialAmount, monthlyContribution, months, annualRate]);

  function appendMessage(role: 'user'|'assistant', text: string, current = state) {
    return { ...current, messages: [...current.messages, { id: `${role}_${Date.now()}_${current.messages.length}`, role, text }] };
  }

  async function send(text = input) {
    const value = text.trim();
    if (!value || busy) return;
    setInput(''); setError(''); setPending([]); setQuickReplies([]);
    const withUser = appendMessage('user', value);
    onChange(withUser);
    if (!hasProAccess) {
      const fallback = nextPlanningPrompt(withUser, budgetHealth);
      onChange(appendMessage('assistant', fallback.text, { ...withUser, stage: fallback.stage }));
      return;
    }
    setBusy(true);
    try {
      const result = await plannerTurn({
        stage: withUser.stage,
        snapshot: {
          incomeAmount: budgetHealth.incomeAmount,
          essentialPercent: budgetHealth.essential.percent,
          flexiblePercent: budgetHealth.flexible.percent,
          futurePercent: budgetHealth.future.percent,
          uncategorizedPercent: budgetHealth.uncategorized.percent,
        },
        goals: withUser.goals,
        adjustments: withUser.adjustments,
        recentMessages: withUser.messages.slice(-10).map(message => ({ role: message.role, text: message.text })),
      });
      setPending(result.candidateFacts);
      setQuickReplies(result.quickReplies);
      onChange(appendMessage('assistant', result.reply, { ...withUser, stage: result.nextStage }));
    } catch (caught) {
      const fallback = nextPlanningPrompt(withUser, budgetHealth);
      setError(caught instanceof AiFeatureError ? `${caught.message} Continuei com o planejador determinístico.` : 'A IA não respondeu; continuei com o planejador determinístico.');
      onChange(appendMessage('assistant', fallback.text, { ...withUser, stage: fallback.stage }));
    } finally { setBusy(false); }
  }

  function confirmCandidate(fact: AiPlannerCandidateFact) {
    const next = candidateToState(state, fact);
    if (next === state) {
      setError('Esse dado precisa de mais contexto antes de entrar no plano. Continue a conversa para definir valor, prazo ou prioridade.');
      return;
    }
    onChange(next);
    setPending(current => current.filter(item => item !== fact));
  }

  function updateBucket(bucket: PlanBucket, targetPercent: number) {
    onChange(applyConfirmedFact(state, { type: 'bucket', bucket: { ...bucket, targetPercent } }));
  }

  function addBucket() {
    const label = customLabel.trim(), percent = Number(customPercent);
    if (!label || !Number.isFinite(percent) || percent < 0) return;
    onChange(applyConfirmedFact(state, { type: 'bucket', bucket: { id: `custom_${Date.now()}`, label, group: 'custom', targetPercent: percent, userDefined: true } }));
    setCustomLabel(''); setCustomPercent('');
  }

  async function doMarketResearch() {
    const query = marketQuery.trim(); if (!query) return;
    if (!hasProAccess) { onUpgrade(); return; }
    setMarketBusy(true); setMarketError(''); setMarket(null);
    try { setMarket(await researchMarket({ query, purpose: state.goals.map(goal => goal.title).join(', ') || 'simulação financeira' })); }
    catch (caught) { setMarketError(caught instanceof AiFeatureError ? caught.message : 'Não foi possível pesquisar o mercado agora.'); }
    finally { setMarketBusy(false); }
  }

  const healthCards = [
    ['Essenciais', budgetHealth.essential.percent, 'referência ≤ 50%'],
    ['Flexíveis', budgetHealth.flexible.percent, 'referência ≤ 30%'],
    ['Futuro', budgetHealth.future.percent, 'referência ≥ 20%'],
  ] as const;

  return <section className="planner-page">
    <header className="planner-heading"><span>{demoMode ? 'Planejador · Demo Pro' : 'Planejar'}</span><h1>Converse sobre a vida que seu dinheiro precisa sustentar.</h1><p>O sistema usa sua realidade financeira, confirma o que entendeu e calcula cenários sem transformar a conversa em formulários.</p></header>

    <div className="planner-health-grid">{healthCards.map(([label, value, ref]) => <article key={label}><span>{label}</span><strong>{value === null ? '—' : `${value}%`}</strong><small>{ref}</small></article>)}</div>

    <article className="planner-conversation"><div className="planner-section-title"><BrainCircuit size={19}/><div><span>Sessão de planejamento</span><strong>{deterministicPrompt.stage}</strong></div></div>
      <div className="planner-thread">{state.messages.map(message => <div key={message.id} className={`planner-message ${message.role}`}><span>{message.role === 'assistant' ? 'Where’s the Money' : 'Você'}</span><p>{message.text}</p></div>)}</div>
      {pending.length > 0 && <div className="planner-confirmations"><span>Confirmar antes de salvar no plano</span>{pending.map((fact, index) => <button key={`${fact.label}-${index}`} onClick={() => confirmCandidate(fact)}><div><strong>{fact.label}</strong>{fact.value !== undefined && <small>{String(fact.value)}</small>}</div><span><Check size={15}/>Confirmar</span></button>)}</div>}
      {quickReplies.length > 0 && <div className="planner-quick">{quickReplies.map(reply => <button key={reply} onClick={() => void send(reply)}>{reply}</button>)}</div>}
      {error && <p className="planner-inline-error">{error}</p>}
      <div className="planner-composer"><textarea value={input} onChange={event => setInput(event.target.value)} placeholder="Ex.: quero me aposentar aos 60, viajar e trocar de carro em dois anos…" rows={3}/><button className="primary" disabled={busy || !input.trim()} onClick={() => void send()}><Send size={16}/>{busy ? 'Analisando…' : 'Enviar'}</button></div>
      {!hasProAccess && <button className="planner-pro-lock" onClick={onUpgrade}><LockKeyhole size={17}/><span><strong>Conversa completa + cenários + pesquisa de mercado</strong><small>O Free mantém a leitura básica e captura inicial de objetivos.</small></span><ChevronRight size={17}/></button>}
    </article>

    <article className="planner-plan-card"><div className="planner-section-title"><Target size={19}/><div><span>Seu plano</span><strong>{state.goals.length} objetivos confirmados</strong></div></div>
      <div className="planner-goals">{state.goals.length ? state.goals.map(goal => <div key={goal.id}><div><strong>{goal.title}</strong><small>{goal.targetDate || goal.notes || 'Objetivo confirmado na conversa'}</small></div>{goal.monthlyContribution ? <b>{brl(goal.monthlyContribution)}/mês</b> : <span>definindo aporte</span>}</div>) : <p>Seus objetivos aparecem aqui conforme você os confirma na conversa.</p>}</div>
      {capacity > 0 && <div className="planner-capacity"><span>Capacidade liberada pelos ajustes confirmados</span><strong>{brl(capacity)}/mês</strong></div>}
      {allocationScenarios[0]?.allocations.length > 0 && <div className="planner-scenarios"><span>Cenários de divisão</span>{allocationScenarios.map(scenario => <div key={scenario.id}><strong>{scenario.label}</strong>{scenario.allocations.map(item => <small key={item.goalId}>{state.goals.find(goal => goal.id === item.goalId)?.title || item.goalId}: {brl(item.amount)}/mês</small>)}</div>)}</div>}
    </article>

    <article className="planner-buckets"><div className="planner-section-title"><CircleDollarSign size={19}/><div><span>Organização mensal</span><strong>50/30/20 é só o ponto de partida</strong></div></div><p>Altere as referências ou crie categorias próprias. Nada é normalizado sem você perceber.</p>
      <div className="planner-bucket-list">{state.buckets.map(bucket => <label key={bucket.id}><span>{bucket.label}<small>{bucket.userDefined ? 'personalizada' : 'referência inicial'}</small></span><input type="number" min="0" step="1" value={bucket.targetPercent ?? ''} onChange={event => updateBucket(bucket, Math.max(0, Number(event.target.value) || 0))}/><b>%</b></label>)}</div>
      <div className={`planner-total ${planTargets.valid ? '' : 'invalid'}`}><span>Total planejado</span><strong>{planTargets.totalPercent}%</strong>{!planTargets.valid && <small>Reduza os percentuais: o plano ultrapassa 100%.</small>}</div>
      <div className="planner-add-bucket"><input value={customLabel} onChange={event => setCustomLabel(event.target.value)} placeholder="Nova categoria"/><input type="number" value={customPercent} onChange={event => setCustomPercent(event.target.value)} placeholder="%"/><button onClick={addBucket}><Plus size={15}/>Adicionar</button></div>
    </article>

    <article className="planner-market"><div className="planner-section-title"><Search size={19}/><div><span>Pesquisar um caminho</span><strong>Digite do jeito que você conhece</strong></div></div><p>Itaúsa, ITSA4, Bitcoin, Tesouro IPCA, financiamento, consórcio… A IA identifica e pesquisa; o motor faz as contas.</p>
      <div className="planner-market-search"><input value={marketQuery} onChange={event => setMarketQuery(event.target.value)} placeholder="Ex.: Itaúsa"/><button className="primary" onClick={() => void doMarketResearch()} disabled={marketBusy}><Search size={16}/>{marketBusy ? 'Pesquisando…' : 'Pesquisar'}</button></div>
      {marketError && <p className="planner-inline-error">{marketError}</p>}
      {market && <div className="market-result"><div className="market-identity"><div><small>{market.entity.assetClass}{market.entity.exchange ? ` · ${market.entity.exchange}` : ''}</small><h2>{market.entity.name}</h2>{market.entity.symbol && <b>{market.entity.symbol}</b>}</div><span>{new Date(market.fetchedAt).toLocaleString('pt-BR')}</span></div><p>{market.summary}</p><div className="market-facts">{market.facts.slice(0, 6).map(fact => <div key={`${fact.key}-${fact.value}`}><span>{fact.label}</span><strong>{fact.value}</strong>{fact.sourceUrl && <a href={fact.sourceUrl} target="_blank" rel="noreferrer">{fact.sourceTitle || 'Fonte'} ↗</a>}</div>)}</div>
        <div className="market-simulation"><div className="market-sim-heading"><Sparkles size={17}/><strong>Simular uma premissa</strong></div><div className="market-sim-inputs"><label>Inicial (R$)<input value={initialAmount} onChange={event => setInitialAmount(event.target.value)} inputMode="decimal"/></label><label>Aporte/mês<input value={monthlyContribution} onChange={event => setMonthlyContribution(event.target.value)} inputMode="decimal"/></label><label>Meses<input value={months} onChange={event => setMonths(event.target.value)} inputMode="numeric"/></label><label>Retorno hipotético a.a. (%)<input value={annualRate} onChange={event => setAnnualRate(event.target.value)} inputMode="decimal"/></label></div><div className="market-sim-result"><span>Total aportado <b>{brl(projection.totalContributed)}</b></span><span>Patrimônio matemático <b>{brl(projection.endingAmount)}</b></span><span>Diferença pela premissa <b>{brl(projection.earnings)}</b></span></div><p className="market-disclaimer">{market.disclaimer || INVESTMENT_SIMULATION_DISCLAIMER}</p></div>
      </div>}
      {!market && <p className="market-disclaimer">{INVESTMENT_SIMULATION_DISCLAIMER}</p>}
    </article>
  </section>;
}
