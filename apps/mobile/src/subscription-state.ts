export type CustomerInfoLike = {
  entitlements: {
    active: Record<string, unknown>;
  };
};

export function hasProEntitlement(
  customerInfo?: CustomerInfoLike | null,
): boolean {
  return Boolean(customerInfo?.entitlements.active.pro);
}

export function planTag(isPro: boolean): 'pro' | 'free' {
  return isPro ? 'pro' : 'free';
}
