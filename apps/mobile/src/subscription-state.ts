export const DEFAULT_PRO_ENTITLEMENT = 'pro';

export type CustomerInfoLike = {
  entitlements: {
    active: Record<string, unknown>;
  };
};

export function resolveProEntitlementId(value?: string): string {
  return value?.trim() || DEFAULT_PRO_ENTITLEMENT;
}

export function hasProEntitlement(
  customerInfo?: CustomerInfoLike | null,
  entitlementId = DEFAULT_PRO_ENTITLEMENT,
): boolean {
  return Boolean(customerInfo?.entitlements.active[entitlementId]);
}

export function activeEntitlementIds(customerInfo?: CustomerInfoLike | null): string[] {
  return Object.keys(customerInfo?.entitlements.active || {});
}

export function planTag(isPro: boolean): 'pro' | 'free' {
  return isPro ? 'pro' : 'free';
}
