import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  BrainCircuit,
  Check,
  ChevronRight,
  CircleDollarSign,
  Crown,
  FileUp,
  Inbox,
  Landmark,
  LockKeyhole,
  LogOut,
  Play,
  Radar,
  RotateCcw,
  Settings2,
  Sparkles,
  Target,
  WalletCards,
} from 'lucide-react';
import { analyzeBudgetHealth } from './core/budgetHealth';
import { applyPatternIntelligence, buildRadar, safeDate } from './core/financeEngine';
import { analyzeRadar } from './core/radarInsight';
import { createDemoState } from './demo/demoData';
import { PlannerPage } from './features/planner/PlannerPage';
import { createPlanningState, ensurePlanningState, type PlanningState } from './features/planner/planningEngine';
import { RadarPage } from './features/radar/RadarPage';
import { FeedbackToast } from './stability/FeedbackToast';
import { ContextualUpgrade } from './journey/ContextualUpgrade';
import { DemoProgress } from './journey/DemoProgress';
import { JourneyCard } from './journey/JourneyCard';
import { deriveDemoStep, deriveJourneyStage, nextPendingId } from './journey/journeyState';
import { parseStatementFile } from './importers/statementImport';
import { AiFeatureError, suggestCategory } from './integrations/ai';
import { getOpenFinanceData, getPluggyStatus, openPluggyConnect } from './integrations/pluggy';
import {
  hasNativeSubscriptionBridge,
  openNativePlan,
  requestNativeSubscriptionState,
  restoreNativePurchases,
  subscribeToNativeSubscription,
} from './integrations/subscriptionBridge';
import {
  canCreateRule,
  deriveAccess,
  visibleRadarPoints,
  type SubscriptionState,
} from './subscription/access';
import type { BankAccount, Rule, Tx } from './types';

type Tab = 'today' | 'inbox' | 'radar' | 'planner' | 'more';
type Filter = 'attention' | 'resolved' | 'auto';
type Saved = { txs: Tx[]; rules: Rule[]; accounts: BankAccount[]; planning?: PlanningState };
type UpgradeContext = { title: string; description: string; benefits: string[] } | null;

const categories = ['Salário','Recebimento','Condomínio','Moradia','Energia','Telefonia/Internet','Assinaturas','Academia','Cartão de crédito','Combustível','Supermercado','Alimentação','Conveniência','Transporte','Saúde','Serviços','Impostos','Folha/Pessoal','Fornecedor','Outros'];
const brl = (c: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c / 100);
const longDate = (d: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${d}T12:00:00Z`)).replace('.', '');

function normalizeProviderDate(value: string) { return safeDate(value) || ''; }
function loadSaved(): Saved {
  try {
    const parsed = JSON.parse(localStorage.getItem('wtm-portable') || '{}') as Partial<Saved>;
    return {
      txs: Array.isArray(parsed.txs) ? parsed.txs : [],
      rules: Array.isArray(parsed.rules) ? parsed.rules : [],
      accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
      planning: ensurePlanningState(parsed.planning),
    };
  } catch {
    return { txs: [], rules: [], accounts: [], planning: createPlanningState() };
  }
}

export default function App() {
  const initial = useMemo(loadSaved, []);
  const startInDemo = useMemo(() => new URLSearchParams(window.location.search).get('demo') === '1', []);
  const initialDemo = useMemo(() => createDemoState(), []);
  const realStateRef = useRef<Saved>({ ...initial, planning: ensurePlanningState(initial.planning) });
  const [demoMode, setDemoMode] = useState(startInDemo);
  const [tab, setTab] = useState<Tab>('today');
  const [filter, setFilter] = useState<Filter>('attention');
  const [txs, setTxs] = useState<Tx[]>(startInDemo ? applyPatternIntelligence(initialDemo.txs, initialDemo.rules) : initial.txs);
  const [rules, setRules] = useState<Rule[]>(startInDemo ? initialDemo.rules : initial.rules);
  const [accounts, setAccounts] = useState<BankAccount[]>(startInDemo ? initialDemo.accounts : initial.accounts);
  const [planning, setPlanning] = useState<PlanningState>(startInDemo ? initialDemo.planning : ensurePlanningState(initial.planning));
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [bankStatus, setBankStatus] = useState<'checking'|'ready'|'missing'|'error'>('checking');
  const [subscription, setSubscription] = useState<SubscriptionState>(() => ({
    bridgeAvailable: hasNativeSubscriptionBridge(), configured: false, isPro: false,
  }));
  const [radarSeenThisSession, setRadarSeenThisSession] = useState(false);
  const [demoTouchedReview, setDemoTouchedReview] = useState(false);
  const [demoTouchedWatch, setDemoTouchedWatch] = useState(false);
  const [demoTouchedPlan, setDemoTouchedPlan] = useState(false);
  const [upgradeContext, setUpgradeContext] = useState<UpgradeContext>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (demoMode) return;
    const next: Saved = { txs, rules, accounts, planning };
    realStateRef.current = next;
    localStorage.setItem('wtm-portable', JSON.stringify(next));
  }, [txs, rules, accounts, planning, demoMode]);
  useEffect(() => { setTxs(current => applyPatternIntelligence(current, rules)); }, [rules]);
  useEffect(() => { getPluggyStatus().then(x => setBankStatus(x.authenticated ? 'ready' : x.configured ? 'error' : 'missing')).catch(() => setBankStatus('error')); }, []);
  useEffect(() => {
    const unsubscribe = subscribeToNativeSubscription((next, event) => {
      setSubscription(next);
      if (event.type !== 'WTM_SUBSCRIPTION_RESULT') return;
      if (!event.ok) {
        setMessage(event.configured ? 'Não foi possível concluir a ação da assinatura agora.' : 'O checkout RevenueCat ainda não está configurado neste build.');
      } else if (event.action === 'restore') {
        setMessage(event.isPro ? 'Plano Pro restaurado.' : 'Restauração concluída. Nenhum Plano Pro ativo foi encontrado.');
      } else {
        setMessage(event.isPro ? 'Plano Pro ativo. Recursos premium liberados.' : 'Plano atualizado. Você continua no Free.');
      }
    });
    requestNativeSubscriptionState();
    return unsubscribe;
  }, []);

  const attention = txs.filter(t => t.status === 'unresolved' || t.status === 'needs_review');
  const resolved = txs.filter(t => t.status === 'confirmed' || t.status === 'categorized');
  const automated = txs.filter(t => t.status === 'candidate');
  const activeRuleCount = rules.filter(rule => rule.active).length;
  const access = useMemo(() => deriveAccess(demoMode, subscription), [demoMode, subscription]);
  const radar = useMemo(() => buildRadar(txs, accounts, rules), [txs, accounts, rules]);
  const fullInsight = useMemo(() => analyzeRadar(radar.projection, radar.startingBalance), [radar.projection, radar.startingBalance]);
  const visibleProjection = useMemo(() => visibleRadarPoints(radar.projection, access), [radar.projection, access]);
  const visibleInsight = useMemo(() => access.hasProAccess ? fullInsight : analyzeRadar(visibleProjection, radar.startingBalance), [access.hasProAccess, fullInsight, visibleProjection, radar.startingBalance]);
  const budgetHealth = useMemo(() => analyzeBudgetHealth(txs), [txs]);
  const hasMeaningfulPlan = planning.goals.length > 0 || planning.adjustments.length > 0;
  const journeyStage = deriveJourneyStage({
    txCount: txs.length,
    attentionCount: attention.length,
    hasMeaningfulPlan,
    radarSeenThisSession,
    hasRadarAttention: Boolean(fullInsight.firstNegative),
  });
  const homeJourneyStage = demoMode && !demoTouchedReview ? 'review' : journeyStage;
  const demoStep = deriveDemoStep({ touchedReview: demoTouchedReview && attention.length === 0, touchedWatch: demoTouchedWatch, touchedPlan: demoTouchedPlan });

  function openTab(next: Tab) {
    setTab(next);
    if (next === 'radar') {
      setRadarSeenThisSession(true);
      if (demoMode) setDemoTouchedWatch(true);
    }
    if (next === 'planner' && demoMode) setDemoTouchedPlan(true);
  }

  function openTransaction(id: string) {
    setSelected(id);
    if (demoMode) setDemoTouchedReview(true);
  }

  function showUpgrade(title: string, description: string, benefits: string[]) {
    setUpgradeContext({ title, description, benefits });
  }

  function enterDemo() {
    realStateRef.current = { txs, rules, accounts, planning };
    const demo = createDemoState();
    setDemoMode(true);
    setRules(demo.rules);
    setAccounts(demo.accounts);
    setTxs(applyPatternIntelligence(demo.txs, demo.rules));
    setPlanning(demo.planning);
    setSelected(null);
    setTab('today');
    setRadarSeenThisSession(false);
    setDemoTouchedReview(false);
    setDemoTouchedWatch(false);
    setDemoTouchedPlan(false);
    setUpgradeContext(null);
    setMessage('Demo Pro carregada com dados e plano sintéticos. Seus dados reais e sua assinatura não foram alterados.');
  }

  function resetDemo() {
    const demo = createDemoState();
    setRules(demo.rules);
    setAccounts(demo.accounts);
    setTxs(applyPatternIntelligence(demo.txs, demo.rules));
    setPlanning(demo.planning);
    setSelected(null);
    setFilter('attention');
    setTab('today');
    setRadarSeenThisSession(false);
    setDemoTouchedReview(false);
    setDemoTouchedWatch(false);
    setDemoTouchedPlan(false);
    setUpgradeContext(null);
    setMessage('Demo reiniciada com o cenário sintético original. Seus dados reais continuam preservados.');
  }

  function exitDemo() {
    const real = realStateRef.current;
    setDemoMode(false);
    setTxs(real.txs || []);
    setRules(real.rules || []);
    setAccounts(real.accounts || []);
    setPlanning(ensurePlanningState(real.planning));
    setSelected(null);
    setTab('today');
    setRadarSeenThisSession(false);
    setDemoTouchedReview(false);
    setDemoTouchedWatch(false);
    setDemoTouchedPlan(false);
    setUpgradeContext(null);
    setMessage('Demonstração encerrada.');
  }

  function openSubscriptionExperience(context?: string) {
    if (!subscription.bridgeAvailable) {
      setTab('more');
      setMessage(context || 'Assinaturas são gerenciadas pelo app Android/iOS. Abra o app nativo para assinar o Pro.');
      return;
    }
    if (!subscription.configured) {
      setTab('more');
      setMessage('O checkout RevenueCat ainda não está configurado neste build. O restante do app continua disponível.');
      return;
    }
    if (openNativePlan()) setMessage('Abrindo assinatura Pro…');
  }

  function continueUpgrade() {
    const context = upgradeContext;
    setUpgradeContext(null);
    openSubscriptionExperience(context?.description);
  }

  function restorePlan() {
    if (!subscription.bridgeAvailable) { setMessage('Restauração de compra está disponível no app Android/iOS.'); return; }
    if (!subscription.configured) { setMessage('O checkout RevenueCat ainda não está configurado neste build.'); return; }
    if (restoreNativePurchases()) setMessage('Verificando compras anteriores…');
  }

  async function syncPluggy(itemId: string) {
    setMessage('Sincronizando contas e transações…');
    const data = await getOpenFinanceData(itemId);
    const normalized: Tx[] = data.transactions.map((x): Tx => ({
      id: `of_${x.id}`,
      date: normalizeProviderDate(x.date),
      amount: Math.round(Math.abs(Number(x.amount) || 0) * 100),
      direction: String(x.type).toUpperCase() === 'CREDIT' ? 'credit' : 'debit',
      description: String(x.description || 'Movimentação').toUpperCase(),
      counterparty: String(x.description || x.accountName || 'Open Finance'),
      status: 'unresolved',
      providerCategory: x.category || undefined,
    })).filter(x => Boolean(x.date));
    const classified = applyPatternIntelligence(normalized, rules);
    setTxs(classified); setAccounts(data.accounts); setFilter('attention'); openTab('inbox');
    setMessage(`${classified.length} movimentações · ${classified.filter(x => x.status === 'candidate').length} automáticas.`);
  }

  async function connectBank() {
    setBusy(true); setMessage('Abrindo conexão sandbox…');
    try {
      await openPluggyConnect(async itemId => {
        try { await syncPluggy(itemId); }
        catch { setMessage('Conta conectada, mas a sincronização falhou.'); }
        finally { setBusy(false); }
      }, () => { setMessage('Conexão cancelada ou com erro.'); setBusy(false); });
      setMessage('');
    } catch { setMessage('Não foi possível abrir a Pluggy. Confira o ambiente do servidor.'); setBusy(false); }
  }

  function handleConnectBank() {
    if (!access.hasProAccess) {
      showUpgrade('Open Finance automático é Pro', 'No Free você pode continuar importando extratos sem custo.', ['Sincronização automática das contas', 'Movimentações direto na Inbox', 'Menos importações manuais']);
      return;
    }
    void connectBank();
  }

  async function importFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const parsed = await Promise.all(Array.from(files).map(parseStatementFile));
      const incoming = parsed.flatMap(x => x.txs);
      setTxs(applyPatternIntelligence(incoming, rules));
      setAccounts([]);
      setFilter('attention');
      openTab('inbox');
      setMessage(`${incoming.length} movimentações importadas.`);
    } catch {
      setMessage('Não conseguimos ler esse arquivo. Confira o formato e tente novamente.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function saveCategory(id: string, category: string, makeRule: boolean) {
    const item = txs.find(x => x.id === id); if (!item) return;
    const nextId = nextPendingId(txs, id);
    setTxs(current => current.map(x => x.id === id ? { ...x, status: 'categorized', category, categorySource: 'manual', categoryConfidence: 100 } : x));
    if (makeRule && !canCreateRule(access, activeRuleCount)) {
      setSelected(nextId);
      setFilter('attention');
      if (!nextId) setTab('inbox');
      setMessage('Categoria salva. O Free inclui até 3 regras ativas; a regra extra não foi criada.');
      return;
    }
    if (makeRule) setRules(current => [...current, { id: crypto.randomUUID(), pattern: item.counterparty || item.description, category, active: true }]);
    if (demoMode) setDemoTouchedReview(true);
    setFilter('attention');
    setSelected(nextId);
    if (nextId) {
      setMessage(makeRule ? 'Categoria salva e regra criada. Próxima pendência aberta.' : 'Categoria salva. Próxima pendência aberta.');
    } else {
      setTab('inbox');
      setMessage(makeRule ? 'Revisão concluída. Categoria salva e regra criada.' : 'Revisão concluída. Tudo que precisava de você foi tratado.');
    }
  }

  function toggleRule(id: string, nextActive: boolean) {
    if (nextActive && !canCreateRule(access, activeRuleCount)) {
      setMessage('O Free inclui até 3 regras ativas. Desative uma regra ou use o Pro para regras ilimitadas.'); return;
    }
    setRules(current => current.map(rule => rule.id === id ? { ...rule, active: nextActive } : rule));
  }

  function resetLocalData() {
    localStorage.removeItem('wtm-portable');
    setTxs([]); setRules([]); setAccounts([]); setPlanning(createPlanningState()); setTab('today');
    setRadarSeenThisSession(false); setUpgradeContext(null);
  }

  const active = selected ? txs.find(x => x.id === selected) : undefined;
  const activeHasNext = active ? nextPendingId(txs, active.id) !== null : false;
  if (active) return <Detail tx={active} onBack={() => setSelected(null)} onSave={saveCategory} hasNextPending={activeHasNext} showAdvancedRecurrence={access.hasProAccess} onUpgrade={() => { setSelected(null); showUpgrade('Detalhes avançados de recorrência são Pro', 'O Free mantém a categorização e os sinais básicos. O Pro abre periodicidade, confiança e impacto no Radar.', ['Periodicidade detectada', 'Confiança e faixa típica', 'Impacto no Radar completo']); }} />;

  const renderHomeJourney = () => {
    if (homeJourneyStage === 'review') return <JourneyCard eyebrow="Próximo passo" title={`${attention.length} movimentações precisam de você`} description={`${resolved.length + automated.length} já foram organizadas. Revise só o que ainda precisa de uma decisão.`} actionLabel="Revisar agora" onAction={() => { setFilter('attention'); openTab('inbox'); }} />;
    if (homeJourneyStage === 'radar-ready') return <JourneyCard eyebrow="Próximo passo" title="Seu dinheiro está organizado." description="Veja o que vem pela frente com a projeção construída a partir das movimentações revisadas." actionLabel="Abrir Radar" onAction={() => openTab('radar')} />;
    if (homeJourneyStage === 'plan-ready') return <JourneyCard eyebrow="Próximo passo" title="Agora transforme essa leitura em um plano." description="Converse sobre objetivos e prioridades; o sistema confirma premissas antes de alterar o plano." actionLabel="Planejar" onAction={() => openTab('planner')} secondaryLabel="Voltar ao Radar" onSecondary={() => openTab('radar')} />;
    return <JourneyCard eyebrow="Acompanhamento" title={fullInsight.firstNegative ? 'Seu plano está ativo. Há um ponto para acompanhar.' : 'Seu plano está ativo.'} description={fullInsight.firstNegative ? 'Abra o Radar para entender a pressão prevista sem alterar seu plano automaticamente.' : 'Continue acompanhando a projeção ou ajuste seus objetivos quando a vida mudar.'} actionLabel={fullInsight.firstNegative ? 'Abrir Radar' : 'Continuar plano'} onAction={() => openTab(fullInsight.firstNegative ? 'radar' : 'planner')} secondaryLabel={fullInsight.firstNegative ? 'Ver plano' : 'Ver Radar'} onSecondary={() => openTab(fullInsight.firstNegative ? 'planner' : 'radar')} />;
  };

  return <div className={`shell ${demoMode ? 'demo-shell' : ''}`}>
    <header className="app-header">
      <div className="brand"><span>ARTISYS</span><b>Where's the Money</b></div>
      {demoMode && <div className="demo-header"><span className="demo-badge"><Crown size={11}/>Demo Pro</span><button className="header-action" onClick={exitDemo}><LogOut size={14}/>Sair</button></div>}
    </header>
    <FeedbackToast message={message} onClose={() => setMessage('')}/>
    <main className="main page-stack">
      {demoMode && <DemoProgress step={demoStep} onRestart={resetDemo} onNext={demoStep === 1 ? () => { setFilter('attention'); openTab('inbox'); } : demoStep === 2 ? () => openTab('radar') : demoStep === 3 ? () => openTab('planner') : undefined} />}
      {tab === 'today' && <>
        <section className="heading"><span>{demoMode ? 'Demo Pro · dados sintéticos' : 'Hoje'}</span><h1>{txs.length ? 'O que precisa da sua atenção agora.' : 'Descubra para onde seu dinheiro foi.'}</h1><p>{txs.length ? `${attention.length} para revisar · ${automated.length} organizadas automaticamente · ${resolved.length} confirmadas` : 'Comece pelo extrato gratuito. Open Finance automático, Radar completo e planejamento avançado ficam no Pro.'}</p></section>
        {!txs.length ? <>
          <section className="surface journey-onboarding-primary"><div><small>Começar agora · Free</small><h2>Adicionar extrato grátis</h2><p>Envie OFX, CSV, TXT ou Excel. O motor organiza as movimentações localmente e leva você direto para a Inbox.</p></div><input ref={fileRef} type="file" accept=".ofx,.csv,.txt,.xls,.xlsx" multiple onChange={e => void importFiles(e.target.files)} hidden/><button className="dropzone" onClick={() => fileRef.current?.click()}><FileUp size={22}/><b>Adicionar extrato grátis</b><span>OFX · CSV · TXT · Excel</span></button></section>
          <section className={`surface onboarding-secondary ${busy ? 'motion-scan' : ''}`}><div className="surface-head"><div><small>Open Finance · Pro</small><h2>Conectar banco</h2><p>{access.hasProAccess ? 'Pluggy envia contas e movimentações direto para a Inbox.' : 'Automatize a entrada de contas e movimentações sem perder a opção gratuita de importar extratos.'}</p></div><span className={`status ${access.hasProAccess ? bankStatus : 'pro'}`}>{access.hasProAccess ? (bankStatus === 'ready' ? 'Sandbox pronto' : bankStatus === 'missing' ? 'ENV ausente' : bankStatus === 'error' ? 'Verificar' : 'Verificando') : 'Pro'}</span></div><button className="secondary" onClick={handleConnectBank} disabled={busy || (access.hasProAccess && bankStatus === 'missing')}><Landmark size={17}/>{busy ? 'Sincronizando…' : access.hasProAccess ? 'Conectar banco' : 'Conhecer Open Finance Pro'}</button></section>
          <section className="surface demo-entry demo-entry-tertiary"><div className="demo-entry-icon"><Play size={21}/></div><div><small>Veja antes de conectar</small><h2>Explorar Demo Pro</h2><p>Um cenário 100% sintético mostra a jornada completa sem alterar seus dados ou sua assinatura.</p></div><button className="text-button" onClick={enterDemo}><Play size={15}/>Abrir demo</button></section>
        </> : <>
          {renderHomeJourney()}
          <section className="metrics"><Metric label="Para revisar" value={String(attention.length)}/><Metric label="Automáticas" value={String(automated.length)}/><Metric label={demoMode ? 'Saldo simulado' : 'Saldo atual'} value={accounts.length ? brl(radar.startingBalance) : '—'}/></section>
          {attention.length > 0 && <section className="surface compact-decisions"><small>Próximas decisões</small>{attention.slice(0, 3).map(t => <TxRow key={t.id} tx={t} onClick={() => openTransaction(t.id)}/>)}</section>}
        </>}
      </>}
      {tab === 'inbox' && <>
        <section className="heading"><span>Inbox · fila de decisões</span><h1>{attention.length ? `${attention.length} para revisar` : 'Tudo revisado'}</h1><p>{attention.length ? `${automated.length} organizadas automaticamente · ${resolved.length} já confirmadas. Foque apenas no que ainda precisa de você.` : 'As pendências acabaram. O Radar já pode usar essas informações para mostrar o que vem pela frente.'}</p></section>
        <div className="segments"><button className={filter === 'attention' ? 'active' : ''} onClick={() => setFilter('attention')}>Revisar · {attention.length}</button><button className={filter === 'resolved' ? 'active' : ''} onClick={() => setFilter('resolved')}>Resolvidas · {resolved.length}</button><button className={filter === 'auto' ? 'active' : ''} onClick={() => setFilter('auto')}>Automáticas · {automated.length}</button></div>
        {filter === 'attention' && !attention.length ? <JourneyCard eyebrow="Revisão concluída" title="Tudo revisado" description="O Radar já consegue usar o histórico organizado para construir sua visão à frente." actionLabel="Ver meu Radar" onAction={() => openTab('radar')} /> : <section className="surface">{(filter === 'attention' ? attention : filter === 'resolved' ? resolved : automated).map(t => <TxRow key={t.id} tx={t} onClick={() => openTransaction(t.id)}/>)}{!(filter === 'attention' ? attention : filter === 'resolved' ? resolved : automated).length && <Empty text="Nenhuma movimentação neste estado."/>}</section>}
      </>}
      {tab === 'radar' && <RadarPage startingBalance={radar.startingBalance} projection={visibleProjection} insight={visibleInsight} budgetHealth={budgetHealth} hasProAccess={access.hasProAccess} onOpenPlan={() => openTab('planner')} onUpgrade={() => showUpgrade('Radar completo é Pro', 'Você já pode ver os próximos 7 dias. O Pro libera a visão completa sem mudar os cálculos do motor.', ['30 dias de projeção', 'Drivers e detalhes de pressão', 'Recorrências avançadas no contexto do Radar'])} />}
      {tab === 'planner' && <PlannerPage state={planning} budgetHealth={budgetHealth} hasProAccess={access.hasProAccess} demoMode={demoMode} onChange={setPlanning} onUpgrade={() => showUpgrade('Planejamento avançado é Pro', 'O Free mantém a leitura básica e o início dos objetivos. O Pro libera a conversa completa e as ferramentas avançadas.', ['Conversa completa de planejamento', 'Pesquisa contextual com fontes', 'Cenários e simulações avançadas'])} />}
      {tab === 'more' && <>
        <section className="heading"><span>Mais</span><h1>Plano, regras e preferências</h1></section>
        <PlanCard accessMode={access.mode} subscription={subscription} onPlan={() => openSubscriptionExperience()} onRestore={restorePlan} />
        {demoMode && <section className="surface demo-control"><small>Ambiente seguro</small><h2>Demo Pro ativa</h2><p>Movimentações e planejamento são sintéticos. A liberação visual não cria entitlement RevenueCat nem muda a tag OneSignal.</p><button className="secondary" onClick={exitDemo}><LogOut size={16}/>Sair da demonstração</button></section>}
        <section className="surface"><div className="surface-head"><div><small>Regras automáticas</small><h2>{activeRuleCount} ativas{access.ruleLimit === null ? ' · ilimitadas' : ` · limite Free ${access.ruleLimit}`}</h2></div>{access.mode === 'free' && <span className="status pro">Free</span>}</div>{rules.map(rule => <div className="rule" key={rule.id}><div><b>{rule.pattern}</b><span>→ {rule.category}</span></div><label className="toggle"><input type="checkbox" checked={rule.active} onChange={e => toggleRule(rule.id, e.target.checked)}/><i/></label></div>)}{!rules.length && <Empty text="Ao corrigir uma categoria você pode criar uma regra reutilizável."/>}{access.mode === 'free' && <div className="rule-limit"><LockKeyhole size={13}/><span>O Free mantém até 3 regras ativas. O Pro remove esse limite.</span></div>}</section>
        {!demoMode && <button className="secondary" onClick={resetLocalData}>Reiniciar dados locais</button>}
      </>}
    </main>
    <ContextualUpgrade open={Boolean(upgradeContext)} title={upgradeContext?.title || ''} description={upgradeContext?.description || ''} benefits={upgradeContext?.benefits || []} onContinue={continueUpgrade} onClose={() => setUpgradeContext(null)} />
    <nav className="bottom-nav"><NavButton active={tab === 'today'} onClick={() => openTab('today')} icon={<CircleDollarSign/>} label="Hoje"/><NavButton active={tab === 'inbox'} onClick={() => openTab('inbox')} icon={<Inbox/>} label="Inbox"/><NavButton active={tab === 'radar'} onClick={() => openTab('radar')} icon={<Radar/>} label="Radar"/><NavButton active={tab === 'planner'} onClick={() => openTab('planner')} icon={<Target/>} label="Planejar"/><NavButton active={tab === 'more'} onClick={() => openTab('more')} icon={<Settings2/>} label="Mais"/></nav>
  </div>;
}

function PlanCard({ accessMode, subscription, onPlan, onRestore }: { accessMode: 'free'|'pro'|'demo-pro'; subscription: SubscriptionState; onPlan: () => void; onRestore: () => void }) {
  const realPro = subscription.isPro;
  if (accessMode === 'demo-pro') return <section className="surface plan-card demo-plan"><div className="plan-top"><span className="plan-icon"><Crown size={19}/></span><div><small>Apresentação</small><h2>Demo Pro · dados sintéticos</h2></div><span className="plan-pill">Demo</span></div><p>Radar B+, conversa, objetivos e cenários estão liberados para demonstração, sem representar uma compra ou alterar o entitlement real.</p>{subscription.bridgeAvailable && <div className="plan-actions"><button className="primary" onClick={onPlan}><Crown size={15}/>{realPro ? 'Gerenciar assinatura real' : 'Ver assinatura Pro'}</button>{subscription.configured && <button className="secondary" onClick={onRestore}><RotateCcw size={14}/>Restaurar</button>}</div>}</section>;
  if (accessMode === 'pro') return <section className="surface plan-card pro-plan"><div className="plan-top"><span className="plan-icon"><Crown size={19}/></span><div><small>Assinatura</small><h2>Plano Pro ativo</h2></div><span className="plan-pill pro">Pro</span></div><p>Open Finance, Radar de 30 dias, regras ilimitadas, conversa completa, pesquisa contextual e cenários determinísticos estão liberados.</p><div className="plan-actions"><button className="primary" onClick={onPlan}><Settings2 size={15}/>Gerenciar assinatura</button>{subscription.bridgeAvailable && <button className="secondary" onClick={onRestore}><RotateCcw size={14}/>Restaurar</button>}</div></section>;
  return <section className="surface plan-card free-plan"><div className="plan-top"><span className="plan-icon"><Crown size={19}/></span><div><small>Seu plano</small><h2>Plano Free</h2></div><span className="plan-pill free">Free</span></div><p>O essencial continua gratuito: importação, Inbox, objetivos básicos e Radar de 7 dias. Pro adiciona automação e profundidade.</p><div className="plan-benefits"><span><Check size={13}/>Open Finance automático</span><span><Check size={13}/>Radar completo de 30 dias</span><span><Check size={13}/>Planejador conversacional completo</span><span><Check size={13}/>Pesquisa contextual + cenários</span></div><button className="primary plan-primary" onClick={onPlan}><Crown size={16}/>Assinar Pro</button>{subscription.bridgeAvailable && <button className="secondary" onClick={onRestore}><RotateCcw size={14}/>Restaurar compra</button>}{!subscription.bridgeAvailable && <p className="plan-note">A compra é concluída pelo app Android/iOS com RevenueCat.</p>}{subscription.bridgeAvailable && !subscription.configured && <p className="plan-note">Checkout nativo ainda não configurado neste build.</p>}</section>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="surface metric"><small>{label}</small><strong>{value}</strong></div>; }
function Empty({ text }: { text: string }) { return <div className="empty"><WalletCards size={20}/><p>{text}</p></div>; }
function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) { return <button className={active ? 'active' : ''} onClick={onClick}>{icon}<span>{label}</span></button>; }
function TxRow({ tx, onClick }: { tx: Tx; onClick: () => void }) { const period = tx.recurrencePeriod === 'monthly' ? 'mensal' : tx.recurrencePeriod === 'biweekly' ? 'quinzenal' : tx.recurrencePeriod === 'weekly' ? 'semanal' : ''; return <button className="tx-row" onClick={onClick}><div><b>{tx.description}</b><span>{tx.category || 'Sem categoria'}{period ? ` · ${period}` : ''}{tx.categoryConfidence ? ` · ${tx.categoryConfidence}%` : ''}</span></div><div><strong>{tx.direction === 'debit' ? '−' : '+'}{brl(tx.amount)}</strong><small>{tx.status === 'candidate' ? 'Auto' : tx.status === 'categorized' ? 'Categorizado' : tx.status === 'confirmed' ? 'Confirmado' : tx.status === 'needs_review' ? 'Revisar' : 'Pendente'}</small></div></button>; }

function Detail({ tx, onBack, onSave, hasNextPending, showAdvancedRecurrence, onUpgrade }: { tx: Tx; onBack: () => void; onSave: (id: string, category: string, makeRule: boolean) => void; hasNextPending: boolean; showAdvancedRecurrence: boolean; onUpgrade: () => void }) {
  const [category, setCategory] = useState(tx.category || 'Outros');
  const [rule, setRule] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{ suggestedCategory: string; confidence: number; reason: string } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const canSuggest = tx.status === 'unresolved' || tx.status === 'needs_review';

  async function requestSuggestion() {
    setAiBusy(true); setAiError(''); setAiSuggestion(null);
    try {
      const suggestion = await suggestCategory({ description: tx.description, counterparty: tx.counterparty, direction: tx.direction, ...(tx.providerCategory ? { providerCategory: tx.providerCategory } : {}) });
      setAiSuggestion(suggestion);
    } catch (error) {
      setAiError(error instanceof AiFeatureError ? error.message : 'Não foi possível gerar uma sugestão agora.');
    } finally { setAiBusy(false); }
  }

  return <div className="shell"><header className="detail-header"><button className="icon-button" onClick={onBack}><ArrowLeft size={18}/></button><div><span>Movimentação</span><b>{tx.description}</b></div></header><main className="main page-stack"><section className="money"><span>{longDate(tx.date)} · {tx.counterparty}</span><strong>{tx.direction === 'debit' ? '−' : '+'}{brl(tx.amount)}</strong></section>{tx.recurrenceConfidence && showAdvancedRecurrence && <section className="surface"><div className="surface-head"><div><small>Padrão recorrente · sem IA</small><h2>{tx.recurrencePeriod === 'monthly' ? 'Mensal' : tx.recurrencePeriod === 'biweekly' ? 'Quinzenal' : 'Semanal'}</h2></div><span className="confidence">{tx.recurrenceConfidence}%</span></div><p>{tx.recurrenceSamples} ocorrências compatíveis · dia esperado {tx.recurrenceExpectedDay}</p><p>Faixa típica {brl(tx.recurrenceMinAmount || tx.amount)}–{brl(tx.recurrenceMaxAmount || tx.amount)} · mediana {brl(tx.recurrenceMedianAmount || tx.amount)}</p></section>}{tx.recurrenceConfidence && !showAdvancedRecurrence && <section className="surface recurrence-lock"><div className="locked-inline"><LockKeyhole size={16}/><div><small>Padrão detectado</small><h2>Detalhes avançados no Pro</h2></div></div><p>O motor encontrou sinais de recorrência. Periodicidade, confiança, faixa típica e impacto no Radar completo ficam no Pro.</p><button className="secondary" onClick={onUpgrade}><Crown size={15}/>Ver Plano Pro</button></section>}{canSuggest && <section className="surface ai-suggestion"><div className="ai-title"><span className="ai-orb"><BrainCircuit size={17}/></span><div><small>Movimentação ambígua</small><h2>Sugestão por IA</h2></div></div><p>A IA recebe somente a descrição desta movimentação e não salva nada automaticamente.</p>{!aiSuggestion && <button className="secondary" onClick={() => void requestSuggestion()} disabled={aiBusy}>{aiBusy ? <span className="mini-loader"/> : <Sparkles size={15}/>} {aiBusy ? 'Analisando…' : 'Sugerir com IA'}</button>}{aiError && <div className="ai-error"><span>{aiError}</span><button className="text-button" onClick={() => void requestSuggestion()}>Tentar novamente</button></div>}{aiSuggestion && <div className="suggestion-box"><div><b>{aiSuggestion.suggestedCategory}</b><span>{aiSuggestion.confidence}% de confiança</span></div><p>{aiSuggestion.reason}</p><button className="secondary" onClick={() => setCategory(aiSuggestion.suggestedCategory)}><Check size={15}/>Usar como seleção</button></div>}</section>}<section className="surface"><small>Categoria</small><h2>{tx.category || 'Escolha uma categoria'}</h2><label className="field"><span>Categoria</span><select value={category} onChange={e => setCategory(e.target.value)}>{categories.map(c => <option key={c}>{c}</option>)}</select></label><label className="rule-check"><input type="checkbox" checked={rule} onChange={e => setRule(e.target.checked)}/><span><b>Usar nas próximas semelhantes</b><small>Cria uma regra pelo estabelecimento.</small></span></label><button className="primary" onClick={() => onSave(tx.id, category, rule)}><Check size={17}/>{hasNextPending ? 'Salvar e ver próxima' : 'Salvar e concluir revisão'}</button></section></main></div>;
}
