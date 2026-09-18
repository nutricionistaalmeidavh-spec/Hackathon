import { Linking } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
} from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';
import { mobileConfig } from './config';
import { isQaAutomationEnabled, parseRevenueCatQaUrl } from './qa-automation';
import { activeEntitlementIds, hasProEntitlement, resolveProEntitlementId } from './subscription-state';

const PRO_ENTITLEMENT = resolveProEntitlementId(process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID);
const QA_AUTOMATION_ENABLED = isQaAutomationEnabled(__DEV__, mobileConfig.qaAutomationRequested);
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

function qaStateMarker(action: string, run: string, state: RevenueCatState) {
  const active = state.activeEntitlementIds.length ? state.activeEntitlementIds.join(',') : 'none';
  console.warn(
    `[WTM_QA_REVENUECAT] action=${action} run=${run} configured=${state.configured} isPro=${state.isPro} entitlement=${state.entitlementId} active=${active}`,
  );
}

function qaErrorMarker(action: string, run: string, error: unknown) {
  const message = error instanceof Error ? error.message.replace(/\s+/g, ' ').trim() : 'unknown';
  console.warn(`[WTM_QA_REVENUECAT] action=${action}-error run=${run} error=${message}`);
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

async function handleRevenueCatQaUrl(url: string): Promise<void> {
  if (!QA_AUTOMATION_ENABLED) return;
  const command = parseRevenueCatQaUrl(url);
  if (!command) return;

  try {
    if (command.action === 'state') {
      qaStateMarker('state', command.run, await getRevenueCatState());
      return;
    }

    if (command.action === 'restore') {
      qaStateMarker('restore', command.run, await restorePurchases());
      return;
    }

    const before = await getRevenueCatState();
    qaStateMarker('open-plan-before', command.run, before);
    await presentPlanExperience(before.isPro);
    qaStateMarker('open-plan-result', command.run, await getRevenueCatState());
  } catch (error) {
    qaErrorMarker(command.action, command.run, error);
  }
}

if (QA_AUTOMATION_ENABLED) {
  Linking.addEventListener('url', ({ url }) => {
    void handleRevenueCatQaUrl(url);
  });
  console.warn('[WTM_QA_REVENUECAT] hook=ready');
}
