import { ArrowLeft, CalendarClock, ChevronRight, CircleDollarSign, Gauge } from 'lucide-react';
import type { RadarInsight } from '../../core/radarInsight';

const brl = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
const date = (value: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${value}T12:00:00Z`)).replace('.', '');

export function WatchPage({ insight, essentialPercent, onBack, onOpenPlan }: {
  insight: RadarInsight;
  essentialPercent: number | null;
  onBack: () => void;
  onOpenPlan: () => void;
}) {
  const minimum = insight.minimum;
  return <section className="radar-feature radar-watch-page">
    <button className="radar-back" onClick={onBack}><ArrowLeft size={17}/>Radar</button>
    <div className="radar-watch-heading"><span>Fique de olho</span><h1>Entenda o ponto que merece atenção.</h1><p>Sem alarmes: aqui você vê o que está puxando a projeção e o que pode organizar.</p></div>
    <div className="watch-kpis">
      <article><span>Menor saldo previsto</span><strong className={minimum && minimum.balance < 0 ? 'negative-value' : ''}>{minimum ? brl(minimum.balance) : '—'}</strong><small>{minimum ? date(minimum.date) : 'Sem projeção suficiente'}</small></article>
      <article><span>Saldo no fim do período</span><strong className={insight.endingBalance !== null && insight.endingBalance < 0 ? 'negative-value' : ''}>{insight.endingBalance === null ? '—' : brl(insight.endingBalance)}</strong><small>cenário atual</small></article>
    </div>
    <div className="watch-section"><div className="watch-section-title"><CalendarClock size={18}/><div><small>O que leva até esse ponto</small><h2>Principais movimentos previstos</h2></div></div>
      <div className="watch-driver-list">{insight.topDrivers.length ? insight.topDrivers.map(driver => <div className="watch-driver" key={`${driver.label}-${driver.category}`}><div><strong>{driver.label}</strong><span>{driver.category} · {date(driver.date)}</span></div><b>{brl(driver.delta)}</b></div>) : <p className="muted-copy">Ainda não há saídas recorrentes suficientes para explicar um driver específico.</p>}</div>
    </div>
    {essentialPercent !== null && <button className="watch-structure-card" onClick={onOpenPlan}><Gauge size={19}/><div><span>Estrutura do orçamento</span><strong>Essenciais hoje: {essentialPercent}%</strong><small>Compare sua distribuição com referências e ajuste seu próprio plano.</small></div><ChevronRight size={18}/></button>}
    <div className="watch-note"><CircleDollarSign size={17}/><p>O Radar projeta o cenário com dados reconhecidos e recorrências. Ele não presume que todo gasto futuro acontecerá exatamente como no passado.</p></div>
  </section>;
}
