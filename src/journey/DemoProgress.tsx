const steps = ['Revisar movimentações', 'Ver o Radar', 'Entender o ponto de atenção', 'Montar o plano'] as const;

export function DemoProgress({ step, onNext }: { step: 1 | 2 | 3 | 4; onNext?: () => void }) {
  return <aside className="demo-progress" aria-label={`Demo Pro, passo ${step} de 4`}>
    <div className="demo-progress-head"><span>Demo guiada</span><b>{step} de 4</b></div>
    <ol>{steps.map((label, index) => {
      const number = index + 1;
      const state = number < step ? 'done' : number === step ? 'active' : 'future';
      return <li key={label} className={state} aria-current={number === step ? 'step' : undefined}><i>{number}</i><span>{label}</span></li>;
    })}</ol>
    {onNext && step < 4 && <button className="text-button demo-progress-next" onClick={onNext}>Ir para o próximo passo</button>}
  </aside>;
}
