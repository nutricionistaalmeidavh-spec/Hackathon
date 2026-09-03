import { authenticatePluggy, jsonResponse } from '../../../server/pluggy';
import type { RouteHandler } from '../../types';

export const handleConnectToken: RouteHandler = async (request, env) => {
  const auth = await authenticatePluggy(env);
  if (!auth.ok) {
    return jsonResponse(
      { error: 'Pluggy authentication unavailable.' },
      auth.code === 'rejected' ? 401 : 503,
    );
  }

  try {
    const origin = new URL(request.url).origin;
    const webhookUrl = `${origin}/api/open-finance/webhook`;

    const response = await fetch('https://api.pluggy.ai/connect_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-API-KEY': auth.apiKey,
      },
      body: JSON.stringify({
        options: {
          clientUserId: 'wheres-the-money',
          avoidDuplicates: false,
          webhookUrl,
        },
      }),
    });

    const data = await response.json().catch(() => ({})) as { accessToken?: string };
    if (!response.ok || !data.accessToken) {
      return jsonResponse({ error: 'Could not create Pluggy connect token.' }, 502);
    }

    return jsonResponse({ accessToken: data.accessToken });
  } catch {
    return jsonResponse({ error: 'Could not create Pluggy connect token.' }, 502);
  }
};
