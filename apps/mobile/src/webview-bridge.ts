import { parsePortableStatePayload, type PortableState } from './portable-state';

export type WebSubscriptionCommand =
  | { type: 'WTM_SUBSCRIPTION_REQUEST_STATE' }
  | { type: 'WTM_SUBSCRIPTION_OPEN_PLAN' }
  | { type: 'WTM_SUBSCRIPTION_RESTORE' };

export type NativeDataCommand =
  | { type: 'WTM_PORTABLE_REQUEST_STATE' }
  | { type: 'WTM_PORTABLE_CATEGORIZE'; id: string; category: string }
  | { type: 'WTM_PORTABLE_NAVIGATE'; tab: 'today' | 'inbox' | 'radar' | 'planner' | 'more' };

export type NativeSubscriptionStatePayload = {
  type: 'WTM_SUBSCRIPTION_STATE';
  configured: boolean;
  isPro: boolean;
};

export type NativeSubscriptionResultPayload = {
  type: 'WTM_SUBSCRIPTION_RESULT';
  action: 'open-plan' | 'restore';
  ok: boolean;
  configured: boolean;
  isPro: boolean;
};

export type NativeSubscriptionPayload =
  | NativeSubscriptionStatePayload
  | NativeSubscriptionResultPayload;

export type WebViewMessage =
  | { kind: 'subscription-command'; command: WebSubscriptionCommand }
  | { kind: 'portable-state'; state: PortableState };

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function parseSubscriptionValue(value: unknown): WebSubscriptionCommand | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const type = (value as Record<string, unknown>).type;

  if (type === 'WTM_SUBSCRIPTION_REQUEST_STATE') return { type };
  if (type === 'WTM_SUBSCRIPTION_OPEN_PLAN') return { type };
  if (type === 'WTM_SUBSCRIPTION_RESTORE') return { type };
  return null;
}

export function parseWebViewMessage(raw: string): WebViewMessage | null {
  const value = parseJson(raw);
  const subscriptionCommand = parseSubscriptionValue(value);
  if (subscriptionCommand) return { kind: 'subscription-command', command: subscriptionCommand };

  const state = parsePortableStatePayload(value);
  if (state) return { kind: 'portable-state', state };
  return null;
}

export function parseWebSubscriptionCommand(raw: string): WebSubscriptionCommand | null {
  const message = parseWebViewMessage(raw);
  return message?.kind === 'subscription-command' ? message.command : null;
}

export function buildNativeSubscriptionEventScript(payload: NativeSubscriptionPayload): string {
  return `window.dispatchEvent(new CustomEvent('wtm:native', { detail: ${JSON.stringify(payload)} })); true;`;
}

export function buildNativeDataCommandScript(command: NativeDataCommand): string {
  return `window.dispatchEvent(new CustomEvent('wtm:native-data', { detail: ${JSON.stringify(command)} })); true;`;
}
