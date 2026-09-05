export function JourneyCard({ eyebrow, title, description, actionLabel, onAction, secondaryLabel, onSecondary }: {
  eyebrow: string;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return <section className="surface journey-card">
    <div className="journey-card-copy"><small>{eyebrow}</small><h2>{title}</h2><p>{description}</p></div>
    <div className="journey-card-actions"><button className="primary" onClick={onAction}>{actionLabel}</button>{secondaryLabel && onSecondary && <button className="text-button" onClick={onSecondary}>{secondaryLabel}</button>}</div>
  </section>;
}
