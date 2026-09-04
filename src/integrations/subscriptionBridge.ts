import type { SubscriptionState } from '../subscription/access';

export type NativeSubscriptionStateEvent = {
  type: 'WTM_SUBSCRIPTION_STATE';
  configured: boolean;
  isPro: boolean;
};

export type NativeSubscriptionResultEvent = {
  type: 'WTM_SUBSCRIPTION_RESULT';
  action: 'open-plan' | 'restore';
  ok: boolean;
  configured: boolean;
  isPro: boolean;
};

export type NativeSubscriptionEvent = NativeSubscriptionStateEvent | NativeSubscriptionResultEvent;

type NativeCommand =
  | { type: 'WTM_SUBSCRIPTION_REQUEST_STATE' }
  | { type: 'WTM_SUBSCRIPTION_OPEN_PLAN' }
  | { type: 'WTM_SUBSCRIPTION_RESTORE' };

declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage(message: string): void;
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function parseNativeSubscriptionPayload(value: unknown): NativeSubscriptionEvent | null {
  if (!isRecord(value)) return null;

  if (value.type === 'WTM_SUBSCRIPTION_STATE') {
    if (typeof value.configured !== 'boolean' || typeof value.isPro !== 'boolean') return null;
    return {
      type: 'WTM_SUBSCRIPTION_STATE',
      configured: value.configured,
      isPro: value.isPro,
    };
  }

  if (value.type === 'WTM_SUBSCRIPTION_RESULT') {
    if (value.action !== 'open-plan' && value.action !== 'restore') return null;
    if (typeof value.ok !== 'boolean' || typeof value.configured !== 'boolean' || typeof value.isPro !== 'boolean') return null;
    return {
      type: 'WTM_SUBSCRIPTION_RESULT',
      action: value.action,
      ok: value.ok,
      configured: value.configured,
      isPro: value.isPro,
    };
  }

  return null;
}

export function hasNativeSubscriptionBridge(): boolean {
  return typeof window !== 'undefined' && Boolean(window.ReactNativeWebView?.postMessage);
}

function postNativeSubscriptionCommand(command: NativeCommand): boolean {
  if (!hasNativeSubscriptionBridge()) return false;
  window.ReactNativeWebView!.postMessage(JSON.stringify(command));
  return true;
}

export function requestNativeSubscriptionState(): boolean {
  return postNativeSubscriptionCommand({ type: 'WTM_SUBSCRIPTION_REQUEST_STATE' });
}

export function openNativePlan(): boolean {
  return postNativeSubscriptionCommand({ type: 'WTM_SUBSCRIPTION_OPEN_PLAN' });
}

export function restoreNativePurchases(): boolean {
  return postNativeSubscriptionCommand({ type: 'WTM_SUBSCRIPTION_RESTORE' });
}

export function subscribeToNativeSubscription(
  listener: (state: SubscriptionState, event: NativeSubscriptionEvent) => void,
): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const handler = (event: Event) => {
    const payload = parseNativeSubscriptionPayload((event as CustomEvent<unknown>).detail);
    if (!payload) return;
    listener({
      bridgeAvailable: true,
      configured: payload.configured,
      isPro: payload.isPro,
    }, payload);
  };

  window.addEventListener('wtm:native', handler);
  return () => window.removeEventListener('wtm:native', handler);
}
