import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, BrainCircuit, Check, ChevronRight, CircleDollarSign, FileUp, Inbox, Landmark, LogOut, Play, Radar, Settings2, ShieldCheck, Sparkles, TriangleAlert, WalletCards, X } from 'lucide-react';
import { applyPatternIntelligence, buildRadar, safeDate } from './core/financeEngine';
import { analyzeRadar } from './core/radarInsight';
import { createDemoState } from './demo/demoData';
import { parseStatementFile } from './importers/statementImport';
import { AiFeatureError, explainRadar, suggestCategory, type AiRadarExplanation } from './integrations/ai';
import { getOpenFinanceData, getPluggyStatus, openPluggyConnect } from './integrations/pluggy';
import type { BankAccount, RadarPoint, Rule, Tx } from './types';

type Tab = 'today' | 'inbox' | 'radar' | 'more';
type Filter = 'attention' | 'resolved' | 'auto';
type Saved = { txs: Tx[]; rules: Rule[]; accounts: BankAccount[] };

const categories = ['Salário','Recebimento','Condomínio','Moradia','Energia','Telefonia/Internet','Assinaturas','Academia','Cartão de crédito','Combustível','Supermercado','Alimentação','Conveniência','Transporte','Saúde','Serviços','Impostos','Folha/Pessoal','Fornecedor','Outros'];
const brl = (c: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c / 100);
const shortDate = (d: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(`${d}T12:00:00Z`));
const longDate = (d: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${d}T12:00:00Z`)).replace('.', '');

function normalizeProviderDate(value: string) { return safeDate(value) || ''; }
function loadSaved(): Saved { try { return JSON.parse(localStorage.getItem('wtm-portable') || '{"txs":[],"rules":[],"accounts":[]}'); } catch { return { txs: [], rules: [], accounts: [] }; } }

export default function App() {
  const initial = useMemo<Saved>(loadSaved, []);
  const startInDemo = useMemo(() => new URLSearchParams(window.location.search).get('demo') === '1', []);
  const initialDemo = useMemo(() => createDemoState(), []);
  const realStateRef = useRef<Saved>(initial);
  const [demoMode, setDemoMode] = useState(startInDemo);
  const [tab, setTab] = useState<Tab>('today'), [filter, setFilter] = useState<Filter>('attention');
  const [txs, setTxs] = useState<Tx[]>(startInDemo ? applyPatternIntelligence(initialDemo.txs, initialDemo.rules) : initial.txs || []);
  const [rules, setRules] = useState<Rule[]>(startInDemo ? initialDemo.rules : initial.rules || []);
  const [accounts, setAccounts] = useState<BankAccount[]>(startInDemo ? initialDemo.accounts : initial.accounts || []);
  const [selected, setSelected] = useState<string | null>(null), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [bankStatus, setBankStatus] = useState<'checking'|'ready'|'missing'|'error'>('checking');
  const [aiExplanation, setAiExplanation] = useState<AiRadarExplanation | null>(null), [aiBusy, setAiBusy] = useState(false), [aiError, setAiError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (demoMode) return;
    const next = { txs, rules, accounts };
    realStateRef.current = next;
    localStorage.setItem('wtm-portable', JSON.stringify(next));
  }, [txs, rules, accounts, demoMode]);
  useEffect(() => { setTxs(current => applyPatternIntelligence(current, rules)); }, [rules]);
  useEffect(() => { getPluggyStatus().then(x => setBankStatus(x.authenticated ? 'ready' : x.configured ? 'error' : 'missing')).catch(() => setBankStatus('error')); }, []);

  const attention = txs.filter(t => t.status === 'unresolved' || t.status === 'needs_review');
  const resolved = txs.filter(t => t.status === 'confirmed' || t.status === 'categorized');
  const automated = txs.filter(t => t.status === 'candidate');
  const radar = useMemo(() => buildRadar(txs, accounts, rules), [txs, accounts, rules]);
  const insight = useMemo(() => analyzeRadar(radar.projection, radar.startingBalance), [radar.projection, radar.startingBalance]);

  function enterDemo() {
    realStateRef.current = { txs, rules, accounts };
    const demo = createDemoState();
    setDemoMode(true); setRules(demo.rules); setAccounts(demo.accounts); setTxs(applyPatternIntelligence(demo.txs, demo.rules)); setSelected(null); setTab('today');
    setAiExplanation(null); setAiError(''); setMessage('Demonstração carregada com dados sintéticos. Seus dados reais não foram alterados.');
  }

  function exitDemo() {
    const real = realStateRef.current;
    setDemoMode(false); setTxs(real.txs || []); setRules(real.rules || []); setAccounts(real.accounts || []); setSelected(null); setTab('today');
    setAiExplanation(null); setAiError(''); setMessage('Demonstração encerrada.');
  }

  async function syncPluggy(itemId: string) {
    setMessage('Sincronizando contas e transações…');
    const data = await getOpenFinanceData(itemId);
    const normalized: Tx[] = data.transactions.map((x): Tx => ({ id: `of_${x.id}`, date: normalizeProviderDate(x.date), amount: Math.round(Math.abs(Number(x.amount) || 0) * 100), direction: String(x.type).toUpperCase() === 'CREDIT' ? 'credit' : 'debit', description: String(x.description || 'Movimentação').toUpperCase(), counterparty: String(x.description || x.accountName || 'Open Finance'), status: 'unresolved', providerCategory: x.category || undefined })).filter(x => Boolean(x.date));
    const classified = applyPatternIntelligence(normalized, rules);
    setTxs(classified); setAccounts(data.accounts); setTab('inbox');
    setMessage(`${classified.length} movimentações · ${classified.filter(x => x.status === 'candidate').length} automáticas.`);
  }

  async function connectBank() {
    setBusy(true); setMessage('Abrindo conexão sandbox…');
    try {
      await openPluggyConnect(async itemId => { try { await syncPluggy(itemId); } catch { setMessage('Conta conectada, mas a sincronização falhou.'); } finally { setBusy(false); } }, () => { setMessage('Conexão cancelada ou com erro.'); setBusy(false); });
      setMessage('');
    } catch { setMessage('Não foi possível abrir a Pluggy. Confira o ambiente do servidor.'); setBusy(false); }
  }

  async function importFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const parsed = await Promise.all(Array.from(files).map(parseStatementFile));
    const incoming = parsed.flatMap(x => x.txs);
    setTxs(applyPatternIntelligence(incoming, rules)); setAccounts([]); setTab('inbox');
    setMessage(`${incoming.length} movimentações importadas.`); setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  function saveCategory(id: string, category: string, makeRule: boolean) {
    const item = txs.find(x => x.id === id); if (!item) return;
    setTxs(current => current.map(x => x.id === id ? { ...x, status: 'categorized', category, categorySource: 'manual', categoryConfidence: 100 } : x));
    if (makeRule) setRules(current => [...current, { id: crypto.randomUUID(), pattern: item.counterparty || item.description, category, active: true }]);
    setSelected(null); setMessage(makeRule ? 'Categoria salva e regra criada.' : 'Categoria salva.');
  }

  async function requestRadarExplanation() {
    if (!insight.minimum || insight.endingBalance === null) return;
    setAiBusy(true); setAiError(''); setAiExplanation(null);
    try {
      const drivers = insight.topDrivers.map(driver => {
        const recurrence = radar.recurring.find(item => item.label === driver.label && item.category === driver.category);
        return { ...driver, ...(recurrence ? { confidence: recurrence.confidence } : {}) };
      });
      setAiExplanation(await explainRadar({
        startingBalance: radar.startingBalance,
        minimumBalance: insight.minimum.balance,
        minimumDate: insight.minimum.date,
        endingBalance: insight.endingBalance,
        drivers,
      }));
    } catch (error) {
      setAiError(error instanceof AiFeatureError ? error.message : 'Não foi possível gerar a explicação por IA agora.');
    } finally { setAiBusy(false); }
  }

  const active = selected ? txs.find(x => x.id === selected) : undefined;
  if (active) return <Detail tx={active} onBack={() => setSelected(null)} onSave={saveCategory} />;

  return <div className={`shell ${demoMode ? 'demo-shell' : ''}`}>
    <header className="app-header"><div className="brand"><span>ARTISYS</span><b>Where's the Money</b></div>{demoMode && <div className="demo-header"><span className="demo-badge"><Play size={11}/>Demonstração</span><button className="header-action" onClick={exitDemo}><LogOut size={14}/>Sair</button></div>}</header>
    {message && <div className="toast"><span className="ok"><Check size={14}/></span><p>{message}</p><button aria-label="Fechar" onClick={() => setMessage('')}><X size={15}/></button></div>}
    <main className="main page-stack">
      {tab === 'today' && <>
        <section className="heading"><span>{demoMode ? 'Demo para jurados' : 'Hoje'}</span><h1>{txs.length ? `${attention.length} decisões pendentes` : 'Descubra para onde seu dinheiro foi.'}</h1><p>{txs.length ? `${resolved.length} resolvidos · ${automated.length} automatizados${demoMode ? ' · dados 100% sintéticos' : ''}` : 'Conecte o banco ou importe um extrato. Evidência primeiro; IA só explica o que os dados sustentam.'}</p></section>
        {!txs.length ? <>
          <section className="surface demo-entry"><div className="demo-entry-icon"><Play size={21}/></div><div><small>Veja antes de conectar</small><h2>Explorar demonstração</h2><p>Um cenário sintético reproduz Inbox, padrões recorrentes e um risco de caixa sem depender de banco ou IA.</p></div><button className="primary" onClick={enterDemo}><Play size={16}/>Abrir demo</button></section>
          <section className={`surface ${busy ? 'motion-scan' : ''}`}><div className="surface-head"><div><small>Open Finance · sandbox</small><h2>Conectar banco</h2><p>Pluggy envia contas e movimentações direto para a Inbox.</p></div><span className={`status ${bankStatus}`}>{bankStatus === 'ready' ? 'Sandbox pronto' : bankStatus === 'missing' ? 'ENV ausente' : bankStatus === 'error' ? 'Verificar' : 'Verificando'}</span></div><button className="primary" onClick={connectBank} disabled={busy || bankStatus === 'missing'}><Landmark size={17}/>{busy ? 'Sincronizando…' : 'Conectar banco'}</button></section>
          <div className="or">ou</div>
          <section className="surface"><input ref={fileRef} type="file" accept=".ofx,.csv,.txt,.xls,.xlsx" multiple onChange={e => importFiles(e.target.files)} hidden/><button className="dropzone" onClick={() => fileRef.current?.click()}><FileUp size={22}/><b>Adicionar extratos</b><span>OFX · CSV · Excel</span></button></section>
        </> : <>
          <section className="metrics"><Metric label="Pendências" value={String(attention.length)}/><Metric label="Automatizados" value={String(automated.length)}/><Metric label={demoMode ? 'Saldo simulado' : 'Saldo conectado'} value={accounts.length ? brl(radar.startingBalance) : '—'}/></section>
          <section className={`surface radar-preview ${insight.tone}`}><div className="surface-head"><div><small>Radar · próximos 30 dias</small><h2>{insight.headline}</h2></div><button className="text-button" onClick={() => setTab('radar')}>Abrir Radar <ChevronRight size={15}/></button></div><CashPulse points={radar.projection} riskDate={insight.firstNegative?.date}/></section>
          <section className="surface"><small>Decisões</small>{attention.slice(0, 5).map(t => <TxRow key={t.id} tx={t} onClick={() => setSelected(t.id)}/>)}{!attention.length && <Empty text="Nada pendente. O motor resolveu o que estava claro."/>}</section>
        </>}
      </>}
      {tab === 'inbox' && <><section className="heading"><span>Inbox</span><h1>Movimentações</h1><p>{demoMode ? 'Demonstração sintética: abra o PIX ambíguo para testar a revisão.' : 'Revise apenas o que o motor não consegue afirmar com segurança.'}</p></section><div className="segments"><button className={filter === 'attention' ? 'active' : ''} onClick={() => setFilter('attention')}>Pendências · {attention.length}</button><button className={filter === 'resolved' ? 'active' : ''} onClick={() => setFilter('resolved')}>Resolvidos · {resolved.length}</button><button className={filter === 'auto' ? 'active' : ''} onClick={() => setFilter('auto')}>Auto · {automated.length}</button></div><section className="surface">{(filter === 'attention' ? attention : filter === 'resolved' ? resolved : automated).map(t => <TxRow key={t.id} tx={t} onClick={() => setSelected(t.id)}/>)}{!(filter === 'attention' ? attention : filter === 'resolved' ? resolved : automated).length && <Empty text="Nenhuma movimentação neste estado."/>}</section></>}
      {tab === 'radar' && <>
        <section className={`radar-hero ${insight.tone}`}><div className="radar-kicker">{insight.tone === 'risk' ? <TriangleAlert size={15}/> : <ShieldCheck size={15}/>}<span>Radar determinístico · 30 dias</span></div><h1>{insight.headline}</h1><p>{insight.tone === 'risk' ? `Menor projeção ${insight.minimum ? brl(insight.minimum.balance) : '—'} em ${insight.minimum ? longDate(insight.minimum.date) : '—'}.` : `Menor projeção ${insight.minimum ? brl(insight.minimum.balance) : '—'}; nenhuma passagem abaixo de zero detectada.`}</p><div className="hero-stats"><div><small>Saldo atual</small><strong>{accounts.length ? brl(radar.startingBalance) : 'Sem saldo'}</strong></div><div><small>Fim de 30 dias</small><strong>{insight.endingBalance === null ? '—' : brl(insight.endingBalance)}</strong></div></div></section>
        <section className="surface radar-chart"><CashPulse points={radar.projection} riskDate={insight.firstNegative?.date}/></section>
        <section className="surface why-card"><div className="surface-head"><div><small>Por que isso acontece</small><h2>Maiores pressões no período</h2></div><span className="status ready">calculado localmente</span></div>{insight.topDrivers.map(driver => <div className="impact" key={`${driver.label}_${driver.category}`}><div><b>{driver.label}</b><span>{driver.category} · a partir de {shortDate(driver.date)}</span></div><strong>{brl(driver.delta)}</strong></div>)}{!insight.topDrivers.length && <Empty text="Sem saídas relevantes para explicar neste período."/>}</section>
        <section className="surface ai-card"><div className="ai-title"><span className="ai-orb"><BrainCircuit size={17}/></span><div><small>Camada opcional</small><h2>Explicar com IA</h2></div></div><p>Gemini recebe somente os números e drivers acima. Ele não calcula o Radar nem altera movimentações.</p>{!aiExplanation && <button className="secondary ai-button" onClick={requestRadarExplanation} disabled={aiBusy || !insight.minimum}>{aiBusy ? <span className="mini-loader"/> : <Sparkles size={16}/>} {aiBusy ? 'Explicando…' : 'Explicar estes dados'}</button>}{aiError && <div className="ai-error"><span>{aiError}</span><button className="text-button" onClick={requestRadarExplanation}>Tentar novamente</button></div>}{aiExplanation && <div className="ai-result"><span className="ai-label"><Sparkles size={13}/>Explicação por IA</span><h3>{aiExplanation.primaryReason}</h3><p>{aiExplanation.summary}</p>{aiExplanation.actions.length > 0 && <ul>{aiExplanation.actions.map(action => <li key={action}>{action}</li>)}</ul>}<button className="text-button" onClick={requestRadarExplanation}>Gerar novamente</button></div>}</section>
        <section className="surface"><div className="surface-head"><div><small>Recorrências detectadas</small><h2>{radar.recurring.length} previstas</h2></div></div>{radar.recurring.map((r, i) => <div className="driver" key={`${r.date}_${i}`}><div><b>{r.label}</b><span>{r.category} · {r.period === 'monthly' ? 'mensal' : r.period === 'biweekly' ? 'quinzenal' : 'semanal'} · {r.confidence}% · {r.samples} amostras · {shortDate(r.date)}</span></div><strong>{r.delta > 0 ? '+' : ''}{brl(r.delta)}</strong></div>)}{!radar.recurring.length && <Empty text="Nenhuma recorrência forte encontrada ainda."/>}</section>
        <section className="surface explainer"><ShieldCheck size={18}/><div><small>Como calculamos</small><h2>Motor determinístico primeiro</h2><p>Recorrência considera estabelecimento normalizado, direção, periodicidade, dia esperado e faixa de valor. Recorrentes saem da média variável para evitar dupla contagem.</p></div></section>
      </>}
      {tab === 'more' && <><section className="heading"><span>Mais</span><h1>Regras e preferências</h1></section>{demoMode && <section className="surface demo-control"><small>Ambiente seguro</small><h2>Demonstração ativa</h2><p>Os dados desta sessão são sintéticos e não estão sendo gravados sobre seu histórico local.</p><button className="secondary" onClick={exitDemo}><LogOut size={16}/>Sair da demonstração</button></section>}<section className="surface"><div className="surface-head"><div><small>Regras automáticas</small><h2>{rules.filter(r => r.active).length} ativas</h2></div></div>{rules.map(r => <div className="rule" key={r.id}><div><b>{r.pattern}</b><span>→ {r.category}</span></div><label className="toggle"><input type="checkbox" checked={r.active} onChange={e => setRules(current => current.map(x => x.id === r.id ? { ...x, active: e.target.checked } : x))}/><i/></label></div>)}{!rules.length && <Empty text="Ao corrigir uma categoria você pode criar uma regra reutilizável."/>}</section>{!demoMode && <button className="secondary" onClick={() => { localStorage.removeItem('wtm-portable'); setTxs([]); setRules([]); setAccounts([]); setTab('today'); }}>Reiniciar dados locais</button>}</>}
    </main>
    <nav className="bottom-nav"><NavButton active={tab === 'today'} onClick={() => setTab('today')} icon={<CircleDollarSign/>} label="Hoje"/><NavButton active={tab === 'inbox'} onClick={() => setTab('inbox')} icon={<Inbox/>} label="Inbox"/><NavButton active={tab === 'radar'} onClick={() => setTab('radar')} icon={<Radar/>} label="Radar"/><NavButton active={tab === 'more'} onClick={() => setTab('more')} icon={<Settings2/>} label="Mais"/></nav>
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="surface metric"><small>{label}</small><strong>{value}</strong></div>; }
function Empty({ text }: { text: string }) { return <div className="empty"><WalletCards size={20}/><p>{text}</p></div>; }
function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) { return <button className={active ? 'active' : ''} onClick={onClick}>{icon}<span>{label}</span></button>; }
function TxRow({ tx, onClick }: { tx: Tx; onClick: () => void }) { const period = tx.recurrencePeriod === 'monthly' ? 'mensal' : tx.recurrencePeriod === 'biweekly' ? 'quinzenal' : tx.recurrencePeriod === 'weekly' ? 'semanal' : ''; return <button className="tx-row" onClick={onClick}><div><b>{tx.description}</b><span>{tx.category || 'Sem categoria'}{period ? ` · ${period}` : ''}{tx.categoryConfidence ? ` · ${tx.categoryConfidence}%` : ''}</span></div><div><strong>{tx.direction === 'debit' ? '−' : '+'}{brl(tx.amount)}</strong><small>{tx.status === 'candidate' ? 'Auto' : tx.status === 'categorized' ? 'Categorizado' : tx.status === 'confirmed' ? 'Confirmado' : tx.status === 'needs_review' ? 'Revisar' : 'Pendente'}</small></div></button>; }

function CashPulse({ points, riskDate }: { points: RadarPoint[]; riskDate?: string }) {
  const [selected, setSelected] = useState(0); useEffect(() => setSelected(0), [points.length]);
  if (!points.length) return <Empty text="Importe ou conecte dados para formar a projeção."/>;
  const values = points.map(x => x.balance), rawMin = Math.min(...values), rawMax = Math.max(...values), min = Math.min(0, rawMin), max = Math.max(0, rawMax), range = Math.max(1, max - min), width = 640, height = 230, pad = 24;
  const yFor = (balance: number) => pad + (max - balance) / range * (height - pad * 2);
  const plotted = points.map((d, i) => ({ x: pad + i * ((width - pad * 2) / Math.max(1, points.length - 1)), y: yFor(d.balance), d }));
  const activeIndex = Math.min(selected, plotted.length - 1), active = plotted[activeIndex], zeroY = yFor(0), riskIndex = riskDate ? plotted.findIndex(point => point.d.date === riskDate) : -1;
  const areaPoints = `${plotted[0].x},${height - pad} ${plotted.map(x => `${x.x},${x.y}`).join(' ')} ${plotted.at(-1)!.x},${height - pad}`;
  return <div className="pulse"><div className="pulse-readout"><span>{longDate(active.d.date)}</span><strong>{brl(active.d.balance)}</strong><small>+{brl(active.d.inflow)} · −{brl(active.d.outflow)}</small></div><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Projeção de caixa em 30 dias"><defs><linearGradient id="pulseArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity=".24"/><stop offset="100%" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs><polygon className="pulse-area" points={areaPoints}/>{min <= 0 && max >= 0 && <line className="zero-line" x1={pad} x2={width - pad} y1={zeroY} y2={zeroY}/>}<polyline className="pulse-line" pathLength="1" points={plotted.map(x => `${x.x},${x.y}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>{riskIndex >= 0 && <><circle className="risk-halo" cx={plotted[riskIndex].x} cy={plotted[riskIndex].y} r="13"/><circle className="risk-dot" cx={plotted[riskIndex].x} cy={plotted[riskIndex].y} r="5"/></>}{plotted.map((x, i) => <circle className={`pulse-point ${i === activeIndex ? 'active' : ''}`} key={i} cx={x.x} cy={x.y} r={i === activeIndex ? 6 : 3.5} tabIndex={0} onClick={() => setSelected(i)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setSelected(i)}/>)}</svg><div className="pulse-dates"><span>{shortDate(points[0].date)}</span><span>toque na linha para explorar</span><span>{shortDate(points.at(-1)!.date)}</span></div></div>;
}

function Detail({ tx, onBack, onSave }: { tx: Tx; onBack: () => void; onSave: (id: string, category: string, makeRule: boolean) => void }) {
  const [category, setCategory] = useState(tx.category || 'Outros'), [rule, setRule] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{ suggestedCategory: string; confidence: number; reason: string } | null>(null), [aiBusy, setAiBusy] = useState(false), [aiError, setAiError] = useState('');
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

  return <div className="shell"><header className="detail-header"><button className="icon-button" onClick={onBack}><ArrowLeft size={18}/></button><div><span>Movimentação</span><b>{tx.description}</b></div></header><main className="main page-stack"><section className="money"><span>{longDate(tx.date)} · {tx.counterparty}</span><strong>{tx.direction === 'debit' ? '−' : '+'}{brl(tx.amount)}</strong></section>{tx.recurrenceConfidence && <section className="surface"><div className="surface-head"><div><small>Padrão recorrente · sem IA</small><h2>{tx.recurrencePeriod === 'monthly' ? 'Mensal' : tx.recurrencePeriod === 'biweekly' ? 'Quinzenal' : 'Semanal'}</h2></div><span className="confidence">{tx.recurrenceConfidence}%</span></div><p>{tx.recurrenceSamples} ocorrências compatíveis · dia esperado {tx.recurrenceExpectedDay}</p><p>Faixa típica {brl(tx.recurrenceMinAmount || tx.amount)}–{brl(tx.recurrenceMaxAmount || tx.amount)} · mediana {brl(tx.recurrenceMedianAmount || tx.amount)}</p></section>}{canSuggest && <section className="surface ai-suggestion"><div className="ai-title"><span className="ai-orb"><BrainCircuit size={17}/></span><div><small>Movimentação ambígua</small><h2>Sugestão por IA</h2></div></div><p>A IA recebe somente a descrição desta movimentação e não salva nada automaticamente.</p>{!aiSuggestion && <button className="secondary" onClick={requestSuggestion} disabled={aiBusy}>{aiBusy ? <span className="mini-loader"/> : <Sparkles size={15}/>} {aiBusy ? 'Analisando…' : 'Sugerir com IA'}</button>}{aiError && <div className="ai-error"><span>{aiError}</span><button className="text-button" onClick={requestSuggestion}>Tentar novamente</button></div>}{aiSuggestion && <div className="suggestion-box"><div><b>{aiSuggestion.suggestedCategory}</b><span>{aiSuggestion.confidence}% de confiança</span></div><p>{aiSuggestion.reason}</p><button className="secondary" onClick={() => setCategory(aiSuggestion.suggestedCategory)}><Check size={15}/>Usar como seleção</button></div>}</section>}<section className="surface"><small>Categoria</small><h2>{tx.category || 'Escolha uma categoria'}</h2><label className="field"><span>Categoria</span><select value={category} onChange={e => setCategory(e.target.value)}>{categories.map(c => <option key={c}>{c}</option>)}</select></label><label className="rule-check"><input type="checkbox" checked={rule} onChange={e => setRule(e.target.checked)}/><span><b>Usar nas próximas semelhantes</b><small>Cria uma regra pelo estabelecimento.</small></span></label><button className="primary" onClick={() => onSave(tx.id, category, rule)}><Check size={17}/>Salvar categoria</button></section></main></div>;
}
