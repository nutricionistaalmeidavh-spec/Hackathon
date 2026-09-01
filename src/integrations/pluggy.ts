export type PluggyStatus = { configured: boolean; authenticated: boolean; code: string; provider: string; environment: string };
export type OpenFinanceData = {
  itemId: string;
  accounts: Array<{ id: string; name: string; type: string; balance: number; currencyCode?: string }>;
  transactions: Array<{ id: string; date: string; description: string; amount: number; type?: string; category?: string | null; accountName?: string }>;
};

type PluggyConnectCtor = new (options: { connectToken: string; includeSandbox: boolean; onSuccess: (data: { item: { id: string } }) => void; onError: (error: unknown) => void }) => { init: () => void };

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((body as { error?: string }).error || `HTTP ${response.status}`);
  return body as T;
}

export const getPluggyStatus = () => json<PluggyStatus>('/api/open-finance/status');
export const getOpenFinanceData = (itemId: string) => json<OpenFinanceData>('/api/open-finance/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId }) });

async function loadConnectSdk(): Promise<PluggyConnectCtor> {
  const scope = window as Window & { PluggyConnect?: PluggyConnectCtor };
  if (scope.PluggyConnect) return scope.PluggyConnect;
  await new Promise<void>((resolve, reject) => {
    const existing = document.getElementById('pluggy-connect-sdk') as HTMLScriptElement | null;
    if (existing) { existing.addEventListener('load', () => resolve(), { once: true }); existing.addEventListener('error', () => reject(new Error('pluggy_sdk_load_failed')), { once: true }); return; }
    const script = document.createElement('script');
    script.id = 'pluggy-connect-sdk'; script.src = 'https://cdn.pluggy.ai/pluggy-connect/v2.8.2/pluggy-connect.js'; script.async = true;
    script.onload = () => resolve(); script.onerror = () => reject(new Error('pluggy_sdk_load_failed')); document.head.appendChild(script);
  });
  if (!scope.PluggyConnect) throw new Error('pluggy_sdk_unavailable');
  return scope.PluggyConnect;
}

export async function openPluggyConnect(onSuccess: (itemId: string) => void, onError: (error: unknown) => void) {
  const { accessToken } = await json<{ accessToken: string }>('/api/open-finance/connect-token', { method: 'POST' });
  const Pluggy = await loadConnectSdk();
  new Pluggy({ connectToken: accessToken, includeSandbox: true, onSuccess: data => onSuccess(data.item.id), onError }).init();
}
