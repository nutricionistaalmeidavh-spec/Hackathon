import { authenticatePluggy, getCredentials, jsonResponse } from '../../../server/pluggy';
import type { RouteHandler } from '../../types';

export const handleStatus: RouteHandler = async (_request, env) => {
  const configured = Boolean(getCredentials(env));
  if (!configured) {
    return jsonResponse({
      configured: false,
      authenticated: false,
      code: 'missing',
      provider: 'Pluggy',
      environment: 'sandbox',
    });
  }

  const auth = await authenticatePluggy(env);
  return jsonResponse({
    configured: true,
    authenticated: auth.ok,
    code: auth.ok ? 'ok' : auth.code,
    provider: 'Pluggy',
    environment: 'sandbox',
  });
};
