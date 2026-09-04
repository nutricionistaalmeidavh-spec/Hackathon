import { jsonResponse } from '../server/pluggy';
import { handleAiCategorize } from './routes/ai/categorize';
import { handleAiExplain } from './routes/ai/explain';
import { handleConnectToken } from './routes/open-finance/connect-token';
import { handleData } from './routes/open-finance/data';
import { handleStatus } from './routes/open-finance/status';
import { handleWebhook } from './routes/open-finance/webhook';
import type { Env, RouteHandler } from './types';

type RouteDefinition = {
  method: 'GET' | 'POST';
  handler: RouteHandler;
};

const routes: Record<string, RouteDefinition> = {
  '/api/open-finance/status': { method: 'GET', handler: handleStatus },
  '/api/open-finance/connect-token': { method: 'POST', handler: handleConnectToken },
  '/api/open-finance/data': { method: 'POST', handler: handleData },
  '/api/open-finance/webhook': { method: 'POST', handler: handleWebhook },
  '/api/ai/explain': { method: 'POST', handler: handleAiExplain },
  '/api/ai/categorize': { method: 'POST', handler: handleAiCategorize },
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    const route = routes[pathname];

    if (route) {
      if (request.method !== route.method) {
        return jsonResponse({ error: 'Method not allowed.' }, 405);
      }
      return route.handler(request, env);
    }

    if (pathname === '/api' || pathname.startsWith('/api/')) {
      return jsonResponse({ error: 'Not found.' }, 404);
    }

    return env.ASSETS.fetch(request);
  },
};
