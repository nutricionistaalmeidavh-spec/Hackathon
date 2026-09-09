import { describe, expect, it } from 'vitest';
import { DEFAULT_WEB_APP_URL, getMobileConfig, withNativeShellParam } from './config';

describe('mobile config', () => {
  it('uses the deployed Worker and advertises the native shell capability', () => {
    expect(DEFAULT_WEB_APP_URL).toBe('https://hackathon.nutricionistaalmeidavh.workers.dev');
    expect(getMobileConfig({}).webAppUrl).toBe(`${DEFAULT_WEB_APP_URL}?nativeShell=1`);
  });

  it('treats blank public integration IDs as not configured', () => {
    const config = getMobileConfig({
      EXPO_PUBLIC_REVENUECAT_API_KEY: '   ',
      EXPO_PUBLIC_ONESIGNAL_APP_ID: '',
      EXPO_PUBLIC_WEB_APP_URL: ' https://example.com/app ',
    });

    expect(config.webAppUrl).toBe('https://example.com/app?nativeShell=1');
    expect(config.revenueCatApiKey).toBeUndefined();
    expect(config.oneSignalAppId).toBeUndefined();
  });

  it('preserves existing query params and never duplicates the native shell flag', () => {
    expect(withNativeShellParam('https://example.com/app?demo=1')).toBe('https://example.com/app?demo=1&nativeShell=1');
    expect(withNativeShellParam('https://example.com/app?nativeShell=1')).toBe('https://example.com/app?nativeShell=1');
  });
});
