import { getCredentials, jsonResponse } from '../../../server/pluggy';
import type { RouteHandler } from '../../types';

export const handleIntegrationsStatus: RouteHandler = async (_request, env) => {
  return jsonResponse({
    openFinance: {
      configured: Boolean(getCredentials(env)),
      provider: 'pluggy',
    },
    ai: {
      configured: Boolean(String(env.GEMINI_API_KEY || '').trim()),
      provider: 'gemini',
    },
  });
};
