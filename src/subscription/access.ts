export const FREE_RULE_LIMIT = 3;
export const FREE_RADAR_DAYS = 7;

export type SubscriptionState = {
  bridgeAvailable: boolean;
  configured: boolean;
  isPro: boolean;
};

export type AccessMode = 'free' | 'pro' | 'demo-pro';

export type AccessPolicy = {
  mode: AccessMode;
  hasProAccess: boolean;
  ruleLimit: number | null;
  radarDays: 7 | 30;
};

export function deriveAccess(
  demoMode: boolean,
  subscription: SubscriptionState,
): AccessPolicy {
  if (demoMode) {
    return {
      mode: 'demo-pro',
      hasProAccess: true,
      ruleLimit: null,
      radarDays: 30,
    };
  }

  if (subscription.isPro) {
    return {
      mode: 'pro',
      hasProAccess: true,
      ruleLimit: null,
      radarDays: 30,
    };
  }

  return {
    mode: 'free',
    hasProAccess: false,
    ruleLimit: FREE_RULE_LIMIT,
    radarDays: FREE_RADAR_DAYS,
  };
}
