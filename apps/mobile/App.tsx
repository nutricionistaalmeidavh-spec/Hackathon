import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { mobileConfig } from './src/config';
import {
  getRevenueCatState,
  initializeRevenueCat,
  presentPlanExperience,
  restorePurchases,
  subscribeToCustomerInfo,
} from './src/revenuecat';
import {
  disposeOneSignal,
  initializeOneSignal,
  setOneSignalPlanTag,
} from './src/onesignal';
import { planTag } from './src/subscription-state';
import {
  buildNativeSubscriptionEventScript,
  parseWebSubscriptionCommand,
  type NativeSubscriptionPayload,
} from './src/webview-bridge';

const productBackground = '#0b1020';
const productText = '#f7f8fb';
const productMuted = '#9ba5b9';

export default function App() {
  const [isPro, setIsPro] = useState(false);
  const [revenueCatConfigured, setRevenueCatConfigured] = useState(false);
  const webViewRef = useRef<WebView>(null);

  const sendToWeb = (payload: NativeSubscriptionPayload) => {
    webViewRef.current?.injectJavaScript(
      buildNativeSubscriptionEventScript(payload),
    );
  };

  useEffect(() => {
    let mounted = true;
    let unsubscribeRevenueCat: () => void = () => {};

    void (async () => {
      const oneSignalReady = await initializeOneSignal(mobileConfig.oneSignalAppId);
      const revenueCatState = await initializeRevenueCat(
        mobileConfig.revenueCatApiKey,
      );

      if (!mounted) return;
      setRevenueCatConfigured(revenueCatState.configured);
      setIsPro(revenueCatState.isPro);

      if (oneSignalReady) {
        setOneSignalPlanTag(planTag(revenueCatState.isPro));
      }

      sendToWeb({
        type: 'WTM_SUBSCRIPTION_STATE',
        configured: revenueCatState.configured,
        isPro: revenueCatState.isPro,
      });

      unsubscribeRevenueCat = subscribeToCustomerInfo((nextIsPro) => {
        if (!mounted) return;
        setIsPro(nextIsPro);
        setOneSignalPlanTag(planTag(nextIsPro));
        sendToWeb({
          type: 'WTM_SUBSCRIPTION_STATE',
          configured: true,
          isPro: nextIsPro,
        });
      });
    })().catch((error: unknown) => {
      console.warn('Falha ao inicializar integrações nativas.', error);
    });

    return () => {
      mounted = false;
      unsubscribeRevenueCat();
      disposeOneSignal();
    };
  }, []);

  const refreshSubscription = async () => {
    const state = await getRevenueCatState();
    setRevenueCatConfigured(state.configured);
    setIsPro(state.isPro);
    setOneSignalPlanTag(planTag(state.isPro));
    return state;
  };

  const emitCurrentState = () => {
    sendToWeb({
      type: 'WTM_SUBSCRIPTION_STATE',
      configured: revenueCatConfigured,
      isPro,
    });
  };

  const openPlan = async () => {
    if (!revenueCatConfigured) {
      sendToWeb({
        type: 'WTM_SUBSCRIPTION_RESULT',
        action: 'open-plan',
        ok: false,
        configured: false,
        isPro: false,
      });
      return;
    }

    try {
      await presentPlanExperience(isPro);
      const state = await refreshSubscription();
      sendToWeb({
        type: 'WTM_SUBSCRIPTION_RESULT',
        action: 'open-plan',
        ok: true,
        configured: state.configured,
        isPro: state.isPro,
      });
    } catch (error) {
      console.warn('Falha ao abrir gerenciamento do plano.', error);
      sendToWeb({
        type: 'WTM_SUBSCRIPTION_RESULT',
        action: 'open-plan',
        ok: false,
        configured: revenueCatConfigured,
        isPro,
      });
    }
  };

  const restore = async () => {
    if (!revenueCatConfigured) {
      sendToWeb({
        type: 'WTM_SUBSCRIPTION_RESULT',
        action: 'restore',
        ok: false,
        configured: false,
        isPro: false,
      });
      return;
    }

    try {
      const state = await restorePurchases();
      setIsPro(state.isPro);
      setOneSignalPlanTag(planTag(state.isPro));
      sendToWeb({
        type: 'WTM_SUBSCRIPTION_RESULT',
        action: 'restore',
        ok: true,
        configured: state.configured,
        isPro: state.isPro,
      });
    } catch (error) {
      console.warn('Falha ao restaurar compras.', error);
      sendToWeb({
        type: 'WTM_SUBSCRIPTION_RESULT',
        action: 'restore',
        ok: false,
        configured: revenueCatConfigured,
        isPro,
      });
    }
  };

  const handleWebMessage = (raw: string) => {
    const command = parseWebSubscriptionCommand(raw);
    if (!command) return;

    if (command.type === 'WTM_SUBSCRIPTION_REQUEST_STATE') {
      emitCurrentState();
      return;
    }

    if (command.type === 'WTM_SUBSCRIPTION_OPEN_PLAN') {
      void openPlan();
      return;
    }

    void restore();
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView
        edges={['top', 'bottom']}
        style={{ flex: 1, backgroundColor: productBackground }}
      >
        <StatusBar style="light" />
        <WebView
          ref={webViewRef}
          source={{ uri: mobileConfig.webAppUrl }}
          style={{ flex: 1, backgroundColor: productBackground }}
          onMessage={(event) => handleWebMessage(event.nativeEvent.data)}
          onLoadEnd={emitCurrentState}
          startInLoadingState
          renderLoading={() => (
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: productBackground,
              }}
            >
              <ActivityIndicator />
              <Text style={{ marginTop: 10, color: productMuted }}>
                Carregando seu financeiro…
              </Text>
            </View>
          )}
          renderError={() => (
            <View
              style={{
                flex: 1,
                padding: 24,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: productBackground,
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: '700', color: productText }}>
                Não foi possível carregar o app
              </Text>
              <Text style={{ marginTop: 8, textAlign: 'center', color: productMuted }}>
                Verifique a conexão e tente novamente.
              </Text>
            </View>
          )}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
