export type WebSubscriptionCommand =
  | { type: 'WTM_SUBSCRIPTION_REQUEST_STATE' }
  | { type: 'WTM_SUBSCRIPTION_OPEN_PLAN' }
  | { type: 'WTM_SUBSCRIPTION_RESTORE' };

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

export function parseWebSubscriptionCommand(raw: string): WebSubscriptionCommand | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const type = (value as Record<string, unknown>).type;

  if (type === 'WTM_SUBSCRIPTION_REQUEST_STATE') return { type };
  if (type === 'WTM_SUBSCRIPTION_OPEN_PLAN') return { type };
  if (type === 'WTM_SUBSCRIPTION_RESTORE') return { type };
  return null;
}

export function buildNativeSubscriptionEventScript(payload: NativeSubscriptionPayload): string {
  return `window.dispatchEvent(new CustomEvent('wtm:native', { detail: ${JSON.stringify(payload)} })); true;`;
}
