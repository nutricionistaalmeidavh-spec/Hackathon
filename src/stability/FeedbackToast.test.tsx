import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FeedbackToast } from './FeedbackToast';

describe('FeedbackToast', () => {
  it('renders failures as alerts instead of success confirmations', () => {
    const html = renderToStaticMarkup(<FeedbackToast message="Não foi possível abrir a Pluggy." onClose={() => {}}/>);
    expect(html).toContain('role="alert"');
    expect(html).toContain('toast error');
    expect(html).not.toContain('toast success');
  });

  it('renders successful actions as polite status updates', () => {
    const html = renderToStaticMarkup(<FeedbackToast message="12 movimentações importadas." onClose={() => {}}/>);
    expect(html).toContain('role="status"');
    expect(html).toContain('toast success');
  });
});
