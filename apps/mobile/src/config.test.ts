import { describe, expect, it } from 'vitest';
import { DEFAULT_WEB_APP_URL, getMobileConfig } from './config';

describe('mobile config', () => {
  it('uses the deployed Worker as the default web app URL', () => {
    expect(DEFAULT_WEB_APP_URL).toBe('https://hackathon.nutricionistaalmeidavh.workers.dev');
    expect(getMobileConfig({}).webAppUrl).toBe(DEFAULT_WEB_APP_URL);
  });

  it('treats blank public integration IDs as not configured', () => {
    const config = getMobileConfig({
      EXPO_PUBLIC_REVENUECAT_API_KEY: '   ',
      EXPO_PUBLIC_ONESIGNAL_APP_ID: '',
      EXPO_PUBLIC_WEB_APP_URL: ' https://example.com/app ',
    });

    expect(config.webAppUrl).toBe('https://example.com/app');
    expect(config.revenueCatApiKey).toBeUndefined();
    expect(config.oneSignalAppId).toBeUndefined();
  });
});
