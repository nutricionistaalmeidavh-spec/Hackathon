import type { BankAccount, Tx } from '../types';

export type MobileTab = 'today' | 'inbox' | 'radar' | 'planner' | 'more';

export type NativeDataCommand =
  | { type: 'WTM_PORTABLE_REQUEST_STATE' }
  | { type: 'WTM_PORTABLE_CATEGORIZE'; id: string; category: string }
  | { type: 'WTM_PORTABLE_NAVIGATE'; tab: MobileTab };

export type PortableStatePayload = {
  type: 'WTM_PORTABLE_STATE';
  demoMode: boolean;
  txs: Tx[];
  accounts: BankAccount[];
};

type NativeWebViewWindow = Window & {
  ReactNativeWebView?: {
    postMessage(message: string): void;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function parseNativeDataCommand(value: unknown): NativeDataCommand | null {
  if (!isRecord(value)) return null;

  if (value.type === 'WTM_PORTABLE_REQUEST_STATE') {
    return { type: 'WTM_PORTABLE_REQUEST_STATE' };
  }

  if (value.type === 'WTM_PORTABLE_CATEGORIZE') {
    if (typeof value.id !== 'string' || !value.id.trim()) return null;
    if (typeof value.category !== 'string' || !value.category.trim()) return null;
    return { type: 'WTM_PORTABLE_CATEGORIZE', id: value.id, category: value.category };
  }

  if (value.type === 'WTM_PORTABLE_NAVIGATE') {
    if (!['today', 'inbox', 'radar', 'planner', 'more'].includes(String(value.tab))) return null;
    return { type: 'WTM_PORTABLE_NAVIGATE', tab: value.tab as MobileTab };
  }

  return null;
}

export function hasNativeDataBridge(): boolean {
  if (typeof window === 'undefined') return false;
  const capabilityEnabled = new URLSearchParams(window.location.search).get('nativeShell') === '1';
  return capabilityEnabled && Boolean((window as NativeWebViewWindow).ReactNativeWebView?.postMessage);
}

export function publishPortableState(payload: Omit<PortableStatePayload, 'type'>): boolean {
  if (!hasNativeDataBridge()) return false;
  (window as NativeWebViewWindow).ReactNativeWebView!.postMessage(JSON.stringify({
    type: 'WTM_PORTABLE_STATE',
    ...payload,
  } satisfies PortableStatePayload));
  return true;
}

export function subscribeToNativeDataCommands(listener: (command: NativeDataCommand) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const handler = (event: Event) => {
    const command = parseNativeDataCommand((event as CustomEvent<unknown>).detail);
    if (command) listener(command);
  };

  window.addEventListener('wtm:native-data', handler);
  return () => window.removeEventListener('wtm:native-data', handler);
}
