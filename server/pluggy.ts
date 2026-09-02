export type PluggyEnv = {
  PLUGGY_CLIENT_ID?: string;
  PLUGGY_CLIENT_SECRET?: string;
};

type PluggyAccount = {
  id: string;
  name?: string;
  marketingName?: string;
  type?: string;
  balance?: number;
  currencyCode?: string;
};

type PluggyTransaction = {
  id: string;
  date?: string;
  description?: string;
  descriptionRaw?: string;
  amount?: number;
  type?: string;
  category?: string | null;
};

type ListResponse<T> = {
  results?: T[];
  next?: string | null;
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export function getCredentials(env: PluggyEnv) {
  const clientId = String(env.PLUGGY_CLIENT_ID || '').trim();
  const clientSecret = String(env.PLUGGY_CLIENT_SECRET || '').trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export async function authenticatePluggy(env: PluggyEnv) {
  const credentials = getCredentials(env);
  if (!credentials) return { ok: false as const, code: 'missing' as const };

  try {
    const response = await fetch('https://api.pluggy.ai/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(credentials),
    });

    const data = await response.json().catch(() => ({})) as {
      apiKey?: string;
      accessToken?: string;
    };

    if (!response.ok) {
      return {
        ok: false as const,
        code: response.status === 401 ? 'rejected' as const : 'unavailable' as const,
      };
    }

    const apiKey = data.apiKey || data.accessToken;
    return apiKey
      ? { ok: true as const, apiKey }
      : { ok: false as const, code: 'unexpected' as const };
  } catch {
    return { ok: false as const, code: 'unavailable' as const };
  }
}

async function authorizedGet<T>(env: PluggyEnv, url: string): Promise<T> {
  const auth = await authenticatePluggy(env);
  if (!auth.ok) throw new Error(`pluggy_auth_${auth.code}`);

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-API-KEY': auth.apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`pluggy_http_${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function listAccounts(env: PluggyEnv, itemId: string) {
  const url = new URL('https://api.pluggy.ai/accounts');
  url.searchParams.set('itemId', itemId);
  const data = await authorizedGet<ListResponse<PluggyAccount>>(env, url.toString());
  return data.results || [];
}

export async function listAllTransactions(env: PluggyEnv, accountId: string) {
  const first = new URL('https://api.pluggy.ai/v2/transactions');
  first.searchParams.set('accountId', accountId);

  let nextUrl: string | null = first.toString();
  const rows: PluggyTransaction[] = [];
  let pages = 0;

  while (nextUrl && pages < 50) {
    const data: ListResponse<PluggyTransaction> = await authorizedGet<ListResponse<PluggyTransaction>>(env, nextUrl);
    rows.push(...(data.results || []));
    pages += 1;

    if (!data.next) {
      nextUrl = null;
    } else {
      nextUrl = new URL(data.next, 'https://api.pluggy.ai/v2/transactions').toString();
    }
  }

  return rows;
}
