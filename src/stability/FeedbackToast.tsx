import { Check, CircleAlert, Info, X } from 'lucide-react';
import { classifyFeedback } from './feedback';

export function FeedbackToast({ message, onClose }: { message: string; onClose: () => void }) {
  if (!message) return null;
  const tone = classifyFeedback(message);
  const Icon = tone === 'error' ? CircleAlert : tone === 'success' ? Check : Info;

  return <div className={`toast ${tone}`} role={tone === 'error' ? 'alert' : 'status'} aria-live={tone === 'error' ? 'assertive' : 'polite'}>
    <span className="feedback-icon" aria-hidden="true"><Icon size={14}/></span>
    <p>{message}</p>
    <button aria-label="Fechar" onClick={onClose}><X size={15}/></button>
  </div>;
}
