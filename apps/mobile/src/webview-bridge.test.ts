import { describe, expect, it } from 'vitest';
import {
  buildNativeDataCommandScript,
  buildNativeSubscriptionEventScript,
  parseWebSubscriptionCommand,
  parseWebViewMessage,
} from './webview-bridge';

describe('native WebView bridge', () => {
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

  it('parses a portable finance snapshot from the web app', () => {
    const message = parseWebViewMessage(JSON.stringify({
      type: 'WTM_PORTABLE_STATE',
      demoMode: false,
      txs: [{
        id: 'tx-1',
        date: '2026-09-08',
        amount: 14780,
        direction: 'debit',
        description: 'POSTO AVENIDA',
        counterparty: 'Posto Avenida',
        status: 'unresolved',
      }],
      accounts: [],
    }));

    expect(message).toEqual({
      kind: 'portable-state',
      state: {
        demoMode: false,
        txs: [{
          id: 'tx-1',
          date: '2026-09-08',
          amount: 14780,
          direction: 'debit',
          description: 'POSTO AVENIDA',
          counterparty: 'Posto Avenida',
          status: 'unresolved',
        }],
        accounts: [],
      },
    });
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

  it('builds native data commands without importing web source code', () => {
    const script = buildNativeDataCommandScript({
      type: 'WTM_PORTABLE_CATEGORIZE',
      id: 'tx-1',
      category: 'Combustível',
    });

    expect(script).toContain("new CustomEvent('wtm:native-data'");
    expect(script).toContain('"id":"tx-1"');
    expect(script).toContain('"category":"Combustível"');
  });
});
