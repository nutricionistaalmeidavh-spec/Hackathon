import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { event, eventId, itemId, error } = req.body || {};
  console.log('pluggy_webhook', { event: event || 'unknown', eventId: eventId || null, itemId: itemId || null, hasError: Boolean(error) });
  return res.status(200).json({ received: true });
}
