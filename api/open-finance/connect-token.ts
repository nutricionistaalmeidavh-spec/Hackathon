import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticatePluggy } from '../../server/pluggy';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const auth = await authenticatePluggy();
  if (!auth.ok) return res.status(auth.code === 'rejected' ? 401 : 503).json({ error: 'Pluggy authentication unavailable.' });
  const proto = String(req.headers['x-forwarded-proto'] || 'https');
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '');
  const webhookUrl = host ? `${proto}://${host}/api/open-finance/webhook` : undefined;
  try {
    const response = await fetch('https://api.pluggy.ai/connect_token', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-API-KEY': auth.apiKey }, body: JSON.stringify({ options: { clientUserId: 'wheres-the-money', avoidDuplicates: false, ...(webhookUrl ? { webhookUrl } : {}) } }) });
    const data = await response.json().catch(() => ({})) as { accessToken?: string };
    if (!response.ok || !data.accessToken) return res.status(502).json({ error: 'Could not create Pluggy connect token.' });
    return res.status(200).json({ accessToken: data.accessToken });
  } catch { return res.status(502).json({ error: 'Could not create Pluggy connect token.' }); }
}
