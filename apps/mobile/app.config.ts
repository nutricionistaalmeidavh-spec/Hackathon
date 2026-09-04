import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Where's the Money",
  slug: 'wheresthemoney',
  owner: 'engenutri',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  scheme: 'wheresthemoney',
  plugins: [
    [
      'onesignal-expo-plugin',
      {
        mode: 'development',
        disableLocation: true,
      },
    ],
  ],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.engenutri.wheresthemoney',
    infoPlist: {
      UIBackgroundModes: ['remote-notification'],
    },
  },
  android: {
    package: 'com.engenutri.wheresthemoney',
    predictiveBackGestureEnabled: false,
  },
  extra: {
    ...(config.extra ?? {}),
    eas: {
      projectId: '6f7e9d85-5dd4-41e6-a37f-861c54a853d5',
    },
  },
});
