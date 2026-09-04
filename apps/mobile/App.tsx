import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
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

export default function App() {
  const [isPro, setIsPro] = useState(false);
  const [revenueCatConfigured, setRevenueCatConfigured] = useState(false);

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

      unsubscribeRevenueCat = subscribeToCustomerInfo((nextIsPro) => {
        if (!mounted) return;
        setIsPro(nextIsPro);
        setOneSignalPlanTag(planTag(nextIsPro));
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
  };

  const openPlan = async () => {
    if (!revenueCatConfigured) {
      Alert.alert(
        'RevenueCat não configurado',
        'Adicione EXPO_PUBLIC_REVENUECAT_API_KEY ao ambiente do app para testar o plano Pro.',
      );
      return;
    }

    try {
      await presentPlanExperience(isPro);
      await refreshSubscription();
    } catch (error) {
      console.warn('Falha ao abrir gerenciamento do plano.', error);
      Alert.alert('Plano indisponível', 'Não foi possível abrir o plano agora.');
    }
  };

  const restore = async () => {
    if (!revenueCatConfigured) {
      Alert.alert(
        'RevenueCat não configurado',
        'Configure a public SDK key antes de restaurar compras.',
      );
      return;
    }

    try {
      const state = await restorePurchases();
      setIsPro(state.isPro);
      setOneSignalPlanTag(planTag(state.isPro));
      Alert.alert(
        'Compras restauradas',
        state.isPro ? 'Plano Pro restaurado.' : 'Nenhum plano Pro ativo foi encontrado.',
      );
    } catch (error) {
      console.warn('Falha ao restaurar compras.', error);
      Alert.alert('Restauração indisponível', 'Tente novamente em instantes.');
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView
        edges={['top', 'bottom']}
        style={{ flex: 1, backgroundColor: '#f7f7f5' }}
      >
        <StatusBar style="dark" />
        <View
          style={{
            minHeight: 52,
            paddingHorizontal: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            borderBottomWidth: 1,
            borderBottomColor: '#e7e7e2',
            backgroundColor: '#ffffff',
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#171717' }}>
              Where&apos;s the Money
            </Text>
            <Text style={{ fontSize: 11, color: '#77756f' }}>
              {isPro ? 'Plano Pro' : 'Plano Free'}
            </Text>
          </View>
          <Pressable
            onPress={openPlan}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: '#171717',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
              {isPro ? 'Gerenciar' : 'Plano Pro'}
            </Text>
          </Pressable>
          <Pressable
            onPress={restore}
            style={{ paddingHorizontal: 8, paddingVertical: 8 }}
          >
            <Text style={{ color: '#4f4e49', fontSize: 12 }}>Restaurar</Text>
          </Pressable>
        </View>

        <WebView
          source={{ uri: mobileConfig.webAppUrl }}
          style={{ flex: 1, backgroundColor: '#f7f7f5' }}
          startInLoadingState
          renderLoading={() => (
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f7f7f5',
              }}
            >
              <ActivityIndicator />
              <Text style={{ marginTop: 10, color: '#77756f' }}>
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
                backgroundColor: '#f7f7f5',
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#171717' }}>
                Não foi possível carregar o app
              </Text>
              <Text style={{ marginTop: 8, textAlign: 'center', color: '#77756f' }}>
                Verifique a conexão e tente novamente.
              </Text>
            </View>
          )}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
