import { describe, expect, it } from 'vitest';
import { deriveAccess, FREE_RADAR_DAYS, FREE_RULE_LIMIT } from './access';

describe('subscription access policy', () => {
  it('limits Free to 3 rules and a 7-day Radar preview', () => {
    const access = deriveAccess(false, {
      bridgeAvailable: true,
      configured: true,
      isPro: false,
    });

    expect(FREE_RULE_LIMIT).toBe(3);
    expect(FREE_RADAR_DAYS).toBe(7);
    expect(access).toEqual({
      mode: 'free',
      hasProAccess: false,
      ruleLimit: 3,
      radarDays: 7,
    });
  });

  it('unlocks the full product only from a real Pro entitlement', () => {
    const access = deriveAccess(false, {
      bridgeAvailable: true,
      configured: true,
      isPro: true,
    });

    expect(access).toEqual({
      mode: 'pro',
      hasProAccess: true,
      ruleLimit: null,
      radarDays: 30,
    });
  });

  it('unlocks Demo Pro without turning browser subscription state into a real entitlement', () => {
    const access = deriveAccess(true, {
      bridgeAvailable: false,
      configured: false,
      isPro: false,
    });

    expect(access).toEqual({
      mode: 'demo-pro',
      hasProAccess: true,
      ruleLimit: null,
      radarDays: 30,
    });
  });
});
