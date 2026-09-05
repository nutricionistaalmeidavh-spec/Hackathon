export function ContextualUpgrade({ open, title, description, benefits, onContinue, onClose }: {
  open: boolean;
  title: string;
  description: string;
  benefits: string[];
  onContinue: () => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return <div className="upgrade-backdrop" role="presentation" onClick={onClose}>
    <section className="contextual-upgrade" role="dialog" aria-modal="true" aria-labelledby="upgrade-title" onKeyDown={event => { if (event.key === 'Escape') onClose(); }} onClick={event => event.stopPropagation()}>
      <button className="upgrade-close" aria-label="Fechar" onClick={onClose} autoFocus>×</button>
      <small>Plano Pro</small>
      <h2 id="upgrade-title">{title}</h2>
      <p>{description}</p>
      <ul>{benefits.map(item => <li key={item}>{item}</li>)}</ul>
      <div className="upgrade-actions"><button className="primary" onClick={onContinue}>Conhecer Pro</button><button className="text-button" onClick={onClose}>Continuar no Free</button></div>
    </section>
  </div>;
}
