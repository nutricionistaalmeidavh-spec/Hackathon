export const DEFAULT_WEB_APP_URL =
  'https://hackathon.nutricionistaalmeidavh.workers.dev';

export type MobileConfig = {
  webAppUrl: string;
  revenueCatApiKey?: string;
  oneSignalAppId?: string;
};

type EnvMap = Record<string, string | undefined>;

const clean = (value?: string) => {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
};

export function getMobileConfig(env: EnvMap): MobileConfig {
  return {
    webAppUrl: clean(env.EXPO_PUBLIC_WEB_APP_URL) ?? DEFAULT_WEB_APP_URL,
    revenueCatApiKey: clean(env.EXPO_PUBLIC_REVENUECAT_API_KEY),
    oneSignalAppId: clean(env.EXPO_PUBLIC_ONESIGNAL_APP_ID),
  };
}

export const mobileConfig = getMobileConfig({
  EXPO_PUBLIC_WEB_APP_URL: process.env.EXPO_PUBLIC_WEB_APP_URL,
  EXPO_PUBLIC_REVENUECAT_API_KEY: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY,
  EXPO_PUBLIC_ONESIGNAL_APP_ID: process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID,
});
