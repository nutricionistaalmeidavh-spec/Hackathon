import { authenticatePluggy, getCredentials, jsonResponse, type PluggyEnv } from '../../../server/pluggy';

type Context = { request: Request; env: PluggyEnv };

export const onRequestGet = async ({ env }: Context) => {
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
