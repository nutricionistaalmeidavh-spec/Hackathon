import { describe, expect, it } from 'vitest';
import { hasProEntitlement, planTag } from './subscription-state';

describe('subscription state', () => {
  it('detects the pro entitlement', () => {
    expect(hasProEntitlement({ entitlements: { active: { pro: {} } } })).toBe(true);
    expect(hasProEntitlement({ entitlements: { active: {} } })).toBe(false);
    expect(hasProEntitlement(undefined)).toBe(false);
  });

  it('maps entitlement state to the OneSignal plan tag', () => {
    expect(planTag(true)).toBe('pro');
    expect(planTag(false)).toBe('free');
  });
});
