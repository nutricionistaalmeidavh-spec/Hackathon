import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
} from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';
import { hasProEntitlement } from './subscription-state';

const PRO_ENTITLEMENT = 'pro';
let configured = false;

export type RevenueCatState = {
  configured: boolean;
  isPro: boolean;
  customerInfo: CustomerInfo | null;
};

export async function initializeRevenueCat(
  apiKey?: string,
): Promise<RevenueCatState> {
  const key = apiKey?.trim();
  if (!key) {
    return { configured: false, isPro: false, customerInfo: null };
  }

  if (!configured) {
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
    Purchases.configure({ apiKey: key });
    configured = true;
  }

  return getRevenueCatState();
}

export async function getRevenueCatState(): Promise<RevenueCatState> {
  if (!configured) {
    return { configured: false, isPro: false, customerInfo: null };
  }

  const customerInfo = await Purchases.getCustomerInfo();
  return {
    configured: true,
    isPro: hasProEntitlement(customerInfo),
    customerInfo,
  };
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
  if (!configured) {
    return { configured: false, isPro: false, customerInfo: null };
  }

  const customerInfo = await Purchases.restorePurchases();
  return {
    configured: true,
    isPro: hasProEntitlement(customerInfo),
    customerInfo,
  };
}

export function subscribeToCustomerInfo(
  listener: (isPro: boolean, customerInfo: CustomerInfo) => void,
): () => void {
  if (!configured) return () => undefined;

  const handler = (customerInfo: CustomerInfo) => {
    listener(hasProEntitlement(customerInfo), customerInfo);
  };

  Purchases.addCustomerInfoUpdateListener(handler);
  return () => Purchases.removeCustomerInfoUpdateListener(handler);
}
