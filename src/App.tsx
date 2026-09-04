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
  X,
} from 'lucide-react';
import { analyzeBudgetHealth } from './core/budgetHealth';
import { applyPatternIntelligence, buildRadar, safeDate } from './core/financeEngine';
import { analyzeRadar } from './core/radarInsight';
import { createDemoState } from './demo/demoData';
import { PlannerPage } from './features/planner/PlannerPage';
import { createPlanningState, ensurePlanningState, type PlanningState } from './features/planner/planningEngine';
import { RadarPage } from './features/radar/RadarPage';
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
    setMessage('Demo Pro carregada com dados e plano sintéticos. Seus dados reais e sua assinatura não foram alterados.');
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
    setTxs(classified); setAccounts(data.accounts); setTab('inbox');
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
    if (!access.hasProAccess) { openSubscriptionExperience('Open Finance automático faz parte do Plano Pro.'); return; }
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
      setTab('inbox');
      setMessage(`${incoming.length} movimentações importadas.`);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function saveCategory(id: string, category: string, makeRule: boolean) {
    const item = txs.find(x => x.id === id); if (!item) return;
    setTxs(current => current.map(x => x.id === id ? { ...x, status: 'categorized', category, categorySource: 'manual', categoryConfidence: 100 } : x));
    if (makeRule && !canCreateRule(access, activeRuleCount)) {
      setSelected(null); setTab('more'); setMessage('Categoria salva. O Free inclui até 3 regras ativas; Pro libera regras ilimitadas.'); return;
    }
    if (makeRule) setRules(current => [...current, { id: crypto.randomUUID(), pattern: item.counterparty || item.description, category, active: true }]);
    setSelected(null); setMessage(makeRule ? 'Categoria salva e regra criada.' : 'Categoria salva.');
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
  }

  const active = selected ? txs.find(x => x.id === selected) : undefined;
  if (active) return <Detail tx={active} onBack={() => setSelected(null)} onSave={saveCategory} showAdvancedRecurrence={access.hasProAccess} onUpgrade={() => { setSelected(null); openSubscriptionExperience('Detalhes avançados de recorrência fazem parte do Plano Pro.'); }} />;

  return <div className={`shell ${demoMode ? 'demo-shell' : ''}`}>
    <header className="app-header">
      <div className="brand"><span>ARTISYS</span><b>Where's the Money</b></div>
      {demoMode && <div className="demo-header"><span className="demo-badge"><Crown size={11}/>Demo Pro</span><button className="header-action" onClick={exitDemo}><LogOut size={14}/>Sair</button></div>}
    </header>
    {message && <div className="toast"><span className="ok"><Check size={14}/></span><p>{message}</p><button aria-label="Fechar" onClick={() => setMessage('')}><X size={15}/></button></div>}
    <main className="main page-stack">
      {tab === 'today' && <>
        <section className="heading"><span>{demoMode ? 'Demo Pro · dados sintéticos' : 'Hoje'}</span><h1>{txs.length ? `${attention.length} decisões pendentes` : 'Descubra para onde seu dinheiro foi.'}</h1><p>{txs.length ? `${resolved.length} resolvidos · ${automated.length} automatizados${demoMode ? ' · plano sintético pronto para explorar' : ''}` : 'Importe um extrato gratuitamente. Open Finance, Radar completo e planejamento avançado ficam no Pro.'}</p></section>
        {!txs.length ? <>
          <section className="surface demo-entry"><div className="demo-entry-icon"><Play size={21}/></div><div><small>Veja antes de conectar</small><h2>Explorar Demo Pro</h2><p>Um cenário 100% sintético libera Inbox, Radar B+, objetivos e cenários sem alterar sua assinatura.</p></div><button className="primary" onClick={enterDemo}><Play size={16}/>Abrir demo</button></section>
          <section className={`surface ${busy ? 'motion-scan' : ''}`}><div className="surface-head"><div><small>Open Finance · sincronização automática</small><h2>Conectar banco</h2><p>{access.hasProAccess ? 'Pluggy envia contas e movimentações direto para a Inbox.' : 'No Pro, suas contas e movimentações chegam automaticamente à Inbox.'}</p></div><span className={`status ${access.hasProAccess ? bankStatus : 'pro'}`}>{access.hasProAccess ? (bankStatus === 'ready' ? 'Sandbox pronto' : bankStatus === 'missing' ? 'ENV ausente' : bankStatus === 'error' ? 'Verificar' : 'Verificando') : 'Pro'}</span></div><button className="primary" onClick={handleConnectBank} disabled={busy || (access.hasProAccess && bankStatus === 'missing')}><Landmark size={17}/>{busy ? 'Sincronizando…' : access.hasProAccess ? 'Conectar banco' : 'Conectar com Pro'}</button></section>
          <div className="or">ou</div>
          <section className="surface"><input ref={fileRef} type="file" accept=".ofx,.csv,.txt,.xls,.xlsx" multiple onChange={e => void importFiles(e.target.files)} hidden/><button className="dropzone" onClick={() => fileRef.current?.click()}><FileUp size={22}/><b>Adicionar extratos grátis</b><span>OFX · CSV · Excel</span></button></section>
        </> : <>
          <section className="metrics"><Metric label="Pendências" value={String(attention.length)}/><Metric label="Automatizados" value={String(automated.length)}/><Metric label={demoMode ? 'Saldo simulado' : 'Saldo atual'} value={accounts.length ? brl(radar.startingBalance) : '—'}/></section>
          <section className="surface today-radar-card"><div><small>Radar · {access.hasProAccess ? '30 dias' : 'prévia de 7 dias'}</small><h2>{access.hasProAccess ? 'Sua visão de 30 dias está pronta.' : 'Sua prévia da próxima semana está pronta.'}</h2><p>Abra o Radar para ver a trajetória e, quando necessário, o bloco Fique de olho.</p></div><button className="text-button" onClick={() => setTab('radar')}>Abrir Radar <ChevronRight size={15}/></button></section>
          <section className="surface today-plan-card"><div><small>Planejamento</small><h2>{planning.goals.length ? `${planning.goals.length} objetivos no seu plano` : 'Transforme prioridades em um plano.'}</h2><p>{access.hasProAccess ? 'Converse, confirme premissas e compare cenários calculados pelo motor determinístico.' : 'O Free permite começar objetivos; o Pro libera conversa completa, pesquisa e cenários.'}</p></div><button className="text-button" onClick={() => setTab('planner')}>Planejar <ChevronRight size={15}/></button></section>
          <section className="surface"><small>Decisões</small>{attention.slice(0, 5).map(t => <TxRow key={t.id} tx={t} onClick={() => setSelected(t.id)}/>)}{!attention.length && <Empty text="Nada pendente. O motor resolveu o que estava claro."/>}</section>
        </>}
      </>}
      {tab === 'inbox' && <><section className="heading"><span>Inbox</span><h1>Movimentações</h1><p>{demoMode ? 'Demonstração sintética: abra o PIX ambíguo para testar a revisão.' : 'Revise apenas o que o motor não consegue afirmar com segurança.'}</p></section><div className="segments"><button className={filter === 'attention' ? 'active' : ''} onClick={() => setFilter('attention')}>Pendências · {attention.length}</button><button className={filter === 'resolved' ? 'active' : ''} onClick={() => setFilter('resolved')}>Resolvidos · {resolved.length}</button><button className={filter === 'auto' ? 'active' : ''} onClick={() => setFilter('auto')}>Auto · {automated.length}</button></div><section className="surface">{(filter === 'attention' ? attention : filter === 'resolved' ? resolved : automated).map(t => <TxRow key={t.id} tx={t} onClick={() => setSelected(t.id)}/>)}{!(filter === 'attention' ? attention : filter === 'resolved' ? resolved : automated).length && <Empty text="Nenhuma movimentação neste estado."/>}</section></>}
      {tab === 'radar' && <RadarPage startingBalance={radar.startingBalance} projection={visibleProjection} insight={visibleInsight} budgetHealth={budgetHealth} hasProAccess={access.hasProAccess} onOpenPlan={() => setTab('planner')} onUpgrade={() => openSubscriptionExperience('Radar completo de 30 dias e detalhes de risco fazem parte do Plano Pro.')} />}
      {tab === 'planner' && <PlannerPage state={planning} budgetHealth={budgetHealth} hasProAccess={access.hasProAccess} demoMode={demoMode} onChange={setPlanning} onUpgrade={() => openSubscriptionExperience('Conversa completa, pesquisa de mercado e cenários avançados fazem parte do Plano Pro.')} />}
      {tab === 'more' && <>
        <section className="heading"><span>Mais</span><h1>Plano, regras e preferências</h1></section>
        <PlanCard accessMode={access.mode} subscription={subscription} onPlan={() => openSubscriptionExperience()} onRestore={restorePlan} />
        {demoMode && <section className="surface demo-control"><small>Ambiente seguro</small><h2>Demo Pro ativa</h2><p>Movimentações e planejamento são sintéticos. A liberação visual não cria entitlement RevenueCat nem muda a tag OneSignal.</p><button className="secondary" onClick={exitDemo}><LogOut size={16}/>Sair da demonstração</button></section>}
        <section className="surface"><div className="surface-head"><div><small>Regras automáticas</small><h2>{activeRuleCount} ativas{access.ruleLimit === null ? ' · ilimitadas' : ` · limite Free ${access.ruleLimit}`}</h2></div>{access.mode === 'free' && <span className="status pro">Free</span>}</div>{rules.map(rule => <div className="rule" key={rule.id}><div><b>{rule.pattern}</b><span>→ {rule.category}</span></div><label className="toggle"><input type="checkbox" checked={rule.active} onChange={e => toggleRule(rule.id, e.target.checked)}/><i/></label></div>)}{!rules.length && <Empty text="Ao corrigir uma categoria você pode criar uma regra reutilizável."/>}{access.mode === 'free' && <div className="rule-limit"><LockKeyhole size={13}/><span>O Free mantém até 3 regras ativas. O Pro remove esse limite.</span></div>}</section>
        {!demoMode && <button className="secondary" onClick={resetLocalData}>Reiniciar dados locais</button>}
      </>}
    </main>
    <nav className="bottom-nav"><NavButton active={tab === 'today'} onClick={() => setTab('today')} icon={<CircleDollarSign/>} label="Hoje"/><NavButton active={tab === 'inbox'} onClick={() => setTab('inbox')} icon={<Inbox/>} label="Inbox"/><NavButton active={tab === 'radar'} onClick={() => setTab('radar')} icon={<Radar/>} label="Radar"/><NavButton active={tab === 'planner'} onClick={() => setTab('planner')} icon={<Target/>} label="Planejar"/><NavButton active={tab === 'more'} onClick={() => setTab('more')} icon={<Settings2/>} label="Mais"/></nav>
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

function Detail({ tx, onBack, onSave, showAdvancedRecurrence, onUpgrade }: { tx: Tx; onBack: () => void; onSave: (id: string, category: string, makeRule: boolean) => void; showAdvancedRecurrence: boolean; onUpgrade: () => void }) {
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

  return <div className="shell"><header className="detail-header"><button className="icon-button" onClick={onBack}><ArrowLeft size={18}/></button><div><span>Movimentação</span><b>{tx.description}</b></div></header><main className="main page-stack"><section className="money"><span>{longDate(tx.date)} · {tx.counterparty}</span><strong>{tx.direction === 'debit' ? '−' : '+'}{brl(tx.amount)}</strong></section>{tx.recurrenceConfidence && showAdvancedRecurrence && <section className="surface"><div className="surface-head"><div><small>Padrão recorrente · sem IA</small><h2>{tx.recurrencePeriod === 'monthly' ? 'Mensal' : tx.recurrencePeriod === 'biweekly' ? 'Quinzenal' : 'Semanal'}</h2></div><span className="confidence">{tx.recurrenceConfidence}%</span></div><p>{tx.recurrenceSamples} ocorrências compatíveis · dia esperado {tx.recurrenceExpectedDay}</p><p>Faixa típica {brl(tx.recurrenceMinAmount || tx.amount)}–{brl(tx.recurrenceMaxAmount || tx.amount)} · mediana {brl(tx.recurrenceMedianAmount || tx.amount)}</p></section>}{tx.recurrenceConfidence && !showAdvancedRecurrence && <section className="surface recurrence-lock"><div className="locked-inline"><LockKeyhole size={16}/><div><small>Padrão detectado</small><h2>Detalhes avançados no Pro</h2></div></div><p>O motor encontrou sinais de recorrência. Periodicidade, confiança, faixa típica e impacto no Radar completo ficam no Pro.</p><button className="secondary" onClick={onUpgrade}><Crown size={15}/>Ver Plano Pro</button></section>}{canSuggest && <section className="surface ai-suggestion"><div className="ai-title"><span className="ai-orb"><BrainCircuit size={17}/></span><div><small>Movimentação ambígua</small><h2>Sugestão por IA</h2></div></div><p>A IA recebe somente a descrição desta movimentação e não salva nada automaticamente.</p>{!aiSuggestion && <button className="secondary" onClick={() => void requestSuggestion()} disabled={aiBusy}>{aiBusy ? <span className="mini-loader"/> : <Sparkles size={15}/>} {aiBusy ? 'Analisando…' : 'Sugerir com IA'}</button>}{aiError && <div className="ai-error"><span>{aiError}</span><button className="text-button" onClick={() => void requestSuggestion()}>Tentar novamente</button></div>}{aiSuggestion && <div className="suggestion-box"><div><b>{aiSuggestion.suggestedCategory}</b><span>{aiSuggestion.confidence}% de confiança</span></div><p>{aiSuggestion.reason}</p><button className="secondary" onClick={() => setCategory(aiSuggestion.suggestedCategory)}><Check size={15}/>Usar como seleção</button></div>}</section>}<section className="surface"><small>Categoria</small><h2>{tx.category || 'Escolha uma categoria'}</h2><label className="field"><span>Categoria</span><select value={category} onChange={e => setCategory(e.target.value)}>{categories.map(c => <option key={c}>{c}</option>)}</select></label><label className="rule-check"><input type="checkbox" checked={rule} onChange={e => setRule(e.target.checked)}/><span><b>Usar nas próximas semelhantes</b><small>Cria uma regra pelo estabelecimento.</small></span></label><button className="primary" onClick={() => onSave(tx.id, category, rule)}><Check size={17}/>Salvar categoria</button></section></main></div>;
}
