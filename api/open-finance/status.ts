import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticatePluggy, getCredentials } from '../../server/pluggy';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const configured = Boolean(getCredentials());
  if (!configured) return res.status(200).json({ configured: false, authenticated: false, code: 'missing', provider: 'Pluggy', environment: 'sandbox' });
  const auth = await authenticatePluggy();
  return res.status(200).json({ configured: true, authenticated: auth.ok, code: auth.ok ? 'ok' : auth.code, provider: 'Pluggy', environment: 'sandbox' });
}
