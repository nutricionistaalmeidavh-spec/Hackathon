import { describe, expect, it } from 'vitest';
import { buildNativeSubscriptionEventScript, parseWebSubscriptionCommand } from './webview-bridge';

describe('native WebView subscription bridge', () => {
  it('accepts the supported subscription commands', () => {
    expect(parseWebSubscriptionCommand('{"type":"WTM_SUBSCRIPTION_REQUEST_STATE"}')).toEqual({ type: 'WTM_SUBSCRIPTION_REQUEST_STATE' });
    expect(parseWebSubscriptionCommand('{"type":"WTM_SUBSCRIPTION_OPEN_PLAN"}')).toEqual({ type: 'WTM_SUBSCRIPTION_OPEN_PLAN' });
    expect(parseWebSubscriptionCommand('{"type":"WTM_SUBSCRIPTION_RESTORE"}')).toEqual({ type: 'WTM_SUBSCRIPTION_RESTORE' });
  });

  it('rejects malformed and unknown messages', () => {
    expect(parseWebSubscriptionCommand('not-json')).toBeNull();
    expect(parseWebSubscriptionCommand('{"type":"OTHER"}')).toBeNull();
    expect(parseWebSubscriptionCommand('{"type":"WTM_SUBSCRIPTION_OPEN_PLAN","extra":true}')).toEqual({ type: 'WTM_SUBSCRIPTION_OPEN_PLAN' });
  });

  it('builds a CustomEvent script containing the exact subscription payload', () => {
    const script = buildNativeSubscriptionEventScript({
      type: 'WTM_SUBSCRIPTION_STATE',
      configured: true,
      isPro: true,
    });

    expect(script).toContain("new CustomEvent('wtm:native'");
    expect(script).toContain('"type":"WTM_SUBSCRIPTION_STATE"');
    expect(script).toContain('"configured":true');
    expect(script).toContain('"isPro":true');
    expect(script.trim().endsWith('true;')).toBe(true);
  });
});
