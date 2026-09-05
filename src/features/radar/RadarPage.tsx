import { useMemo, useState } from 'react';
import { ChevronRight, Eye, LockKeyhole, Sparkles } from 'lucide-react';
import type { RadarInsight } from '../../core/radarInsight';
import type { BudgetHealth } from '../../core/budgetHealth';
import type { RadarPoint } from '../../types';
import { RadarMotion } from './RadarMotion';
import { WatchPage } from './WatchPage';

const brl = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

function RadarChart({ points }: { points: RadarPoint[] }) {
  const data = useMemo(() => {
    if (!points.length) return { path: '', area: '', min: 0, max: 1 };
    const balances = points.map(point => point.balance);
    const min = Math.min(...balances, 0), max = Math.max(...balances, 0);
    const span = Math.max(1, max - min);
    const coords = points.map((point, index) => ({
      x: points.length === 1 ? 50 : 4 + (index / (points.length - 1)) * 92,
      y: 88 - ((point.balance - min) / span) * 76,
    }));
    const path = coords.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
    const area = `${path} L ${coords.at(-1)?.x ?? 96} 92 L ${coords[0]?.x ?? 4} 92 Z`;
    return { path, area, min, max };
  }, [points]);

  if (!points.length) return <div className="radar-chart-empty">Importe movimentações para construir a projeção.</div>;
  const zeroY = 88 - ((0 - data.min) / Math.max(1, data.max - data.min)) * 76;
  return <div className="radar-bplus-chart" aria-label={`Projeção de saldo com ${points.length} pontos`}>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img">
      <defs><linearGradient id="radarArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity=".24"/><stop offset="100%" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs>
      <line className="radar-zero" x1="4" x2="96" y1={zeroY} y2={zeroY}/>
      <path className="radar-area" d={data.area} />
      <path className="radar-line-base" d={data.path}/>
      <path className="radar-line-travel" d={data.path}/>
    </svg>
    <div className="radar-chart-labels"><span>Hoje</span><span>{points.length} dias</span></div>
  </div>;
}

export function RadarPage({ startingBalance, projection, insight, budgetHealth, hasProAccess, onOpenPlan, onUpgrade }: {
  startingBalance: number;
  projection: RadarPoint[];
  insight: RadarInsight;
  budgetHealth: BudgetHealth;
  hasProAccess: boolean;
  onOpenPlan: () => void;
  onUpgrade: () => void;
}) {
  const [watchOpen, setWatchOpen] = useState(false);
  if (watchOpen && hasProAccess) return <WatchPage insight={insight} essentialPercent={budgetHealth.essential.percent} onBack={() => setWatchOpen(false)} onOpenPlan={onOpenPlan}/>;

  const firstNegativeIndex = insight.firstNegative ? projection.findIndex(point => point.date === insight.firstNegative?.date) : -1;
  const daysUntilNegative = firstNegativeIndex >= 0 ? firstNegativeIndex + 1 : null;
  const watchTitle = daysUntilNegative ? `Em ${daysUntilNegative} ${daysUntilNegative === 1 ? 'dia' : 'dias'}` : 'Tudo sob controle';
  const journeyMessage = daysUntilNegative
    ? `Seu saldo pode ficar negativo em ${daysUntilNegative} ${daysUntilNegative === 1 ? 'dia' : 'dias'}.`
    : `Nenhum ponto crítico nos próximos ${projection.length} dias.`;
  const healthItems = [
    { label: 'Essenciais', value: budgetHealth.essential.percent, reference: 'referência ≤ 50%' },
    { label: 'Flexíveis', value: budgetHealth.flexible.percent, reference: 'referência ≤ 30%' },
    { label: 'Futuro', value: budgetHealth.future.percent, reference: 'referência ≥ 20%' },
  ];

  return <section className="radar-feature">
    <header className="radar-feature-heading"><div className="radar-feature-brand"><RadarMotion/><div><span>Radar</span><h1>Visão à frente. Decisões melhores.</h1></div></div><span className="radar-window">{projection.length} dias</span></header>
    <article className={`radar-journey-summary ${daysUntilNegative ? 'risk' : 'healthy'}`}><small>Leitura do Radar</small><strong>{journeyMessage}</strong><span>{daysUntilNegative ? 'Entender o que está pressionando ajuda a decidir o que ajustar antes.' : 'A projeção continua sendo uma leitura do histórico e das recorrências conhecidas.'}</span></article>
    <div className="radar-summary-grid">
      <article className="radar-balance-card"><span>Saldo atual</span><strong>{brl(startingBalance)}</strong><small>base da projeção</small></article>
      <button className="radar-watch-card" onClick={hasProAccess ? () => setWatchOpen(true) : onUpgrade}><div><span><Eye size={15}/>Fique de olho</span><strong>{hasProAccess ? watchTitle : 'Prévia disponível'}</strong><small>{hasProAccess ? (daysUntilNegative ? 'Entender o que está pressionando' : 'Toque para entender os detalhes') : 'O Pro mostra o ponto de atenção completo'}</small></div>{hasProAccess ? <ChevronRight size={19}/> : <LockKeyhole size={18}/>}</button>
    </div>
    <article className="radar-chart-card"><div className="radar-card-title"><div><span>Projeção de saldo</span><h2>Próximos {projection.length} dias</h2></div><small>A luz percorre a projeção; os números não se movem.</small></div><RadarChart points={projection}/></article>
    <button className="radar-why" onClick={onOpenPlan}><div className="radar-why-title"><Sparkles size={18}/><div><span>Por que isso acontece</span><strong>Sua distribuição hoje</strong></div></div><div className="radar-budget-preview">{healthItems.map(item => <div key={item.label}><span>{item.label}</span><b>{item.value === null ? '—' : `${item.value}%`}</b><small>{item.reference}</small></div>)}</div><p>{budgetHealth.status === 'ready' ? 'Uma referência ajuda a começar; seu plano pode ser personalizado na conversa.' : 'Revise suas entradas e categorias para construir uma leitura confiável.'}</p><span className="radar-why-cta">Organizar meu plano <ChevronRight size={16}/></span></button>
  </section>;
}
