import { jsonResponse } from '../../../server/pluggy';
import type { RouteHandler } from '../../types';

export const handleWebhook: RouteHandler = async (request) => {
  const body = await request.json().catch(() => ({})) as {
    event?: unknown;
    eventId?: unknown;
    itemId?: unknown;
    error?: unknown;
  };

  console.log('pluggy_webhook', {
    event: typeof body.event === 'string' ? body.event : 'unknown',
    eventId: typeof body.eventId === 'string' ? body.eventId : null,
    itemId: typeof body.itemId === 'string' ? body.itemId : null,
    hasError: Boolean(body.error),
  });

  return jsonResponse({ received: true });
};
