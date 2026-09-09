import { describe, expect, it } from 'vitest';
import { activeEntitlementIds, hasProEntitlement, planTag, resolveProEntitlementId } from './subscription-state';

describe('subscription state', () => {
  it('detects the default pro entitlement', () => {
    expect(hasProEntitlement({ entitlements: { active: { pro: {} } } })).toBe(true);
    expect(hasProEntitlement({ entitlements: { active: {} } })).toBe(false);
    expect(hasProEntitlement(undefined)).toBe(false);
  });

  it('supports the exact entitlement identifier configured in RevenueCat', () => {
    const info = { entitlements: { active: { premium_access: {} } } };
    expect(hasProEntitlement(info)).toBe(false);
    expect(hasProEntitlement(info, 'premium_access')).toBe(true);
    expect(activeEntitlementIds(info)).toEqual(['premium_access']);
    expect(resolveProEntitlementId(' premium_access ')).toBe('premium_access');
    expect(resolveProEntitlementId('')).toBe('pro');
  });

  it('maps entitlement state to the OneSignal plan tag', () => {
    expect(planTag(true)).toBe('pro');
    expect(planTag(false)).toBe('free');
  });
});
