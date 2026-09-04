import { LogLevel, OneSignal } from 'react-native-onesignal';

let configured = false;
let cleanupListeners: (() => void) | undefined;

export async function initializeOneSignal(appId?: string): Promise<boolean> {
  const id = appId?.trim();
  if (!id) return false;
  if (configured) return true;

  if (__DEV__) {
    OneSignal.Debug.setLogLevel(LogLevel.Verbose);
  }

  OneSignal.initialize(id);

  const onClick = () => undefined;
  const onForeground = () => undefined;
  OneSignal.Notifications.addEventListener('click', onClick);
  OneSignal.Notifications.addEventListener('foregroundWillDisplay', onForeground);

  cleanupListeners = () => {
    OneSignal.Notifications.removeEventListener('click', onClick);
    OneSignal.Notifications.removeEventListener(
      'foregroundWillDisplay',
      onForeground,
    );
  };

  await OneSignal.Notifications.requestPermission(false);
  configured = true;
  return true;
}

export function identifyOneSignalUser(userId?: string): void {
  const id = userId?.trim();
  if (configured && id) {
    OneSignal.login(id);
  }
}

export function setOneSignalPlanTag(plan: 'free' | 'pro'): void {
  if (configured) {
    OneSignal.User.addTag('plan', plan);
  }
}

export function disposeOneSignal(): void {
  cleanupListeners?.();
  cleanupListeners = undefined;
}
