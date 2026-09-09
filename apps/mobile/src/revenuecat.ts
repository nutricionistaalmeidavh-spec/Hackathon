import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
} from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';
import { activeEntitlementIds, hasProEntitlement, resolveProEntitlementId } from './subscription-state';

const PRO_ENTITLEMENT = resolveProEntitlementId(process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID);
let configured = false;

export type RevenueCatState = {
  configured: boolean;
  isPro: boolean;
  customerInfo: CustomerInfo | null;
  entitlementId: string;
  activeEntitlementIds: string[];
};

function emptyState(): RevenueCatState {
  return {
    configured: false,
    isPro: false,
    customerInfo: null,
    entitlementId: PRO_ENTITLEMENT,
    activeEntitlementIds: [],
  };
}

function stateFromCustomerInfo(customerInfo: CustomerInfo): RevenueCatState {
  return {
    configured: true,
    isPro: hasProEntitlement(customerInfo, PRO_ENTITLEMENT),
    customerInfo,
    entitlementId: PRO_ENTITLEMENT,
    activeEntitlementIds: activeEntitlementIds(customerInfo),
  };
}

export async function initializeRevenueCat(
  apiKey?: string,
): Promise<RevenueCatState> {
  const key = apiKey?.trim();
  if (!key) return emptyState();

  if (!configured) {
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
    Purchases.configure({ apiKey: key });
    configured = true;
  }

  return getRevenueCatState();
}

export async function getRevenueCatState(): Promise<RevenueCatState> {
  if (!configured) return emptyState();
  return stateFromCustomerInfo(await Purchases.getCustomerInfo());
}

export async function presentPlanExperience(isPro: boolean): Promise<void> {
  if (!configured) return;

  if (isPro) {
    await RevenueCatUI.presentCustomerCenter();
    return;
  }

  await RevenueCatUI.presentPaywallIfNeeded({
    requiredEntitlementIdentifier: PRO_ENTITLEMENT,
  });
}

export async function restorePurchases(): Promise<RevenueCatState> {
  if (!configured) return emptyState();
  return stateFromCustomerInfo(await Purchases.restorePurchases());
}

export function subscribeToCustomerInfo(
  listener: (isPro: boolean, customerInfo: CustomerInfo) => void,
): () => void {
  if (!configured) return () => undefined;

  const handler = (customerInfo: CustomerInfo) => {
    const state = stateFromCustomerInfo(customerInfo);
    if (__DEV__ && !state.isPro && state.activeEntitlementIds.length) {
      console.warn(`RevenueCat: entitlement esperado "${PRO_ENTITLEMENT}"; ativos: ${state.activeEntitlementIds.join(', ')}`);
    }
    listener(state.isPro, customerInfo);
  };

  Purchases.addCustomerInfoUpdateListener(handler);
  return () => Purchases.removeCustomerInfoUpdateListener(handler);
}
