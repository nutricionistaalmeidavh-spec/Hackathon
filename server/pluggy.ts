import { PluggyClient } from 'pluggy-sdk';

export function getCredentials() {
  const clientId = process.env.PLUGGY_CLIENT_ID;
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export async function authenticatePluggy() {
  const credentials = getCredentials();
  if (!credentials) return { ok: false as const, code: 'missing' };
  try {
    const response = await fetch('https://api.pluggy.ai/auth', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(credentials) });
    const data = await response.json().catch(() => ({})) as { apiKey?: string; accessToken?: string };
    if (!response.ok) return { ok: false as const, code: response.status === 401 ? 'rejected' : 'unavailable' };
    const apiKey = data.apiKey || data.accessToken;
    return apiKey ? { ok: true as const, apiKey } : { ok: false as const, code: 'unexpected' };
  } catch { return { ok: false as const, code: 'unavailable' }; }
}

export function pluggyClient() {
  const credentials = getCredentials();
  return credentials ? new PluggyClient(credentials) : null;
}
