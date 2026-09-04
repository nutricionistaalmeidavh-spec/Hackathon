import { describe, expect, it } from 'vitest';
import { parseNativeSubscriptionPayload } from './subscriptionBridge';

describe('web subscription bridge contract', () => {
  it('accepts native subscription state payloads', () => {
    expect(parseNativeSubscriptionPayload({
      type: 'WTM_SUBSCRIPTION_STATE',
      configured: true,
      isPro: false,
    })).toEqual({
      type: 'WTM_SUBSCRIPTION_STATE',
      configured: true,
      isPro: false,
    });
  });

  it('accepts native action result payloads', () => {
    expect(parseNativeSubscriptionPayload({
      type: 'WTM_SUBSCRIPTION_RESULT',
      action: 'open-plan',
      ok: true,
      configured: true,
      isPro: true,
    })).toEqual({
      type: 'WTM_SUBSCRIPTION_RESULT',
      action: 'open-plan',
      ok: true,
      configured: true,
      isPro: true,
    });
  });

  it('rejects malformed or unknown native payloads', () => {
    expect(parseNativeSubscriptionPayload(null)).toBeNull();
    expect(parseNativeSubscriptionPayload({ type: 'WTM_SUBSCRIPTION_STATE', isPro: true })).toBeNull();
    expect(parseNativeSubscriptionPayload({ type: 'OTHER', configured: true, isPro: true })).toBeNull();
    expect(parseNativeSubscriptionPayload({
      type: 'WTM_SUBSCRIPTION_RESULT',
      action: 'delete-account',
      ok: true,
      configured: true,
      isPro: true,
    })).toBeNull();
  });
});
