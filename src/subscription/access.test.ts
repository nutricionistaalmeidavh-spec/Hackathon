import { describe, expect, it } from 'vitest';
import {
  canCreateRule,
  deriveAccess,
  FREE_RADAR_DAYS,
  FREE_RULE_LIMIT,
  visibleRadarPoints,
} from './access';

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

  it('blocks a fourth active Free rule without limiting Pro or Demo Pro', () => {
    const free = deriveAccess(false, { bridgeAvailable: true, configured: true, isPro: false });
    const pro = deriveAccess(false, { bridgeAvailable: true, configured: true, isPro: true });
    const demo = deriveAccess(true, { bridgeAvailable: false, configured: false, isPro: false });

    expect(canCreateRule(free, 2)).toBe(true);
    expect(canCreateRule(free, 3)).toBe(false);
    expect(canCreateRule(pro, 99)).toBe(true);
    expect(canCreateRule(demo, 99)).toBe(true);
  });

  it('shows only 7 Radar points to Free while Pro and Demo keep all 30', () => {
    const points = Array.from({ length: 30 }, (_, index) => index + 1);
    const free = deriveAccess(false, { bridgeAvailable: false, configured: false, isPro: false });
    const pro = deriveAccess(false, { bridgeAvailable: true, configured: true, isPro: true });
    const demo = deriveAccess(true, { bridgeAvailable: false, configured: false, isPro: false });

    expect(visibleRadarPoints(points, free)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(visibleRadarPoints(points, pro)).toHaveLength(30);
    expect(visibleRadarPoints(points, demo)).toHaveLength(30);
  });
});
