export const DEFAULT_WEB_APP_URL =
  'https://hackathon.nutricionistaalmeidavh.workers.dev';

export type MobileConfig = {
  webAppUrl: string;
  revenueCatApiKey?: string;
  oneSignalAppId?: string;
  qaAutomationRequested: boolean;
};

type EnvMap = Record<string, string | undefined>;

const clean = (value?: string) => {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
};

export function withNativeShellParam(url: string): string {
  if (/[?&]nativeShell=1(?:&|$)/.test(url)) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}nativeShell=1`;
}

export function getMobileConfig(env: EnvMap): MobileConfig {
  const webAppUrl = clean(env.EXPO_PUBLIC_WEB_APP_URL) ?? DEFAULT_WEB_APP_URL;
  return {
    webAppUrl: withNativeShellParam(webAppUrl),
    revenueCatApiKey: clean(env.EXPO_PUBLIC_REVENUECAT_API_KEY),
    oneSignalAppId: clean(env.EXPO_PUBLIC_ONESIGNAL_APP_ID),
    qaAutomationRequested: clean(env.EXPO_PUBLIC_QA_AUTOMATION) === '1',
  };
}

export const mobileConfig = getMobileConfig({
  EXPO_PUBLIC_WEB_APP_URL: process.env.EXPO_PUBLIC_WEB_APP_URL,
  EXPO_PUBLIC_REVENUECAT_API_KEY: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY,
  EXPO_PUBLIC_ONESIGNAL_APP_ID: process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID,
  EXPO_PUBLIC_QA_AUTOMATION: process.env.EXPO_PUBLIC_QA_AUTOMATION,
});
