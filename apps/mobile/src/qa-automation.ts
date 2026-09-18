export type RevenueCatQaAction = 'open-plan' | 'restore' | 'state';

export type RevenueCatQaCommand = {
  action: RevenueCatQaAction;
  run: string;
};

export function isQaAutomationEnabled(isDev: boolean, requested: boolean): boolean {
  return isDev && requested;
}

export function parseRevenueCatQaUrl(url: string): RevenueCatQaCommand | null {
  const match = /^wheresthemoney:\/\/qa\/revenuecat\/(open-plan|restore|state)(?:\?run=([^&]+))?$/.exec(url.trim());
  if (!match) return null;

  try {
    return {
      action: match[1] as RevenueCatQaAction,
      run: match[2] ? decodeURIComponent(match[2]) : 'none',
    };
  } catch {
    return null;
  }
}
