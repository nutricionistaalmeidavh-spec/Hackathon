import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import App from '../App';
import { mobileConfig } from './config';
import { isQaAutomationEnabled, revenueCatQaStatusLabel } from './qa-automation';
import {
  getRevenueCatState,
  initializeRevenueCat,
  presentPlanExperience,
  restorePurchases,
  subscribeToCustomerInfo,
} from './revenuecat';

const QA_ENABLED = isQaAutomationEnabled(__DEV__, mobileConfig.qaAutomationRequested);
type QaActionState = 'idle' | 'opening-plan' | 'open-plan-complete' | 'restoring' | 'restore-complete' | 'error';

export default function QaRoot() {
  const [configured, setConfigured] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionState, setActionState] = useState<QaActionState>('idle');

  useEffect(() => {
    if (!QA_ENABLED) return;

    let mounted = true;
    let unsubscribe = () => undefined;

    void initializeRevenueCat(mobileConfig.revenueCatApiKey).then((state) => {
      if (!mounted) return;
      setConfigured(state.configured);
      setIsPro(state.isPro);
      unsubscribe = subscribeToCustomerInfo((nextIsPro) => {
        if (mounted) setIsPro(nextIsPro);
      });
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  if (!QA_ENABLED) return <App />;

  const refresh = async () => {
    const state = await getRevenueCatState();
    setConfigured(state.configured);
    setIsPro(state.isPro);
    return state;
  };

  const openPlan = async () => {
    if (busy) return;
    setBusy(true);
    setActionState('opening-plan');
    try {
      const before = await refresh();
      await presentPlanExperience(before.isPro);
      await refresh();
      setActionState('open-plan-complete');
    } catch {
      setActionState('error');
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    if (busy) return;
    setBusy(true);
    setActionState('restoring');
    try {
      const state = await restorePurchases();
      setConfigured(state.configured);
      setIsPro(state.isPro);
      setActionState('restore-complete');
    } catch {
      setActionState('error');
    } finally {
      setBusy(false);
    }
  };

  const statusLabel = revenueCatQaStatusLabel(configured, isPro);
  const actionLabel = `QA RevenueCat Action ${actionState}`;

  return (
    <View style={styles.root}>
      <App />
      <View style={styles.panel} accessibilityLabel="QA RevenueCat Controls">
        <Text accessible accessibilityLabel={statusLabel} style={styles.status}>
          {statusLabel}
        </Text>
        <Text accessible accessibilityLabel={actionLabel} style={styles.status}>
          {actionLabel}
        </Text>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="QA RevenueCat Open Plan"
            disabled={busy}
            onPress={() => void openPlan()}
            style={styles.button}
          >
            <Text style={styles.buttonText}>QA PLAN</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="QA RevenueCat Restore"
            disabled={busy}
            onPress={() => void restore()}
            style={styles.button}
          >
            <Text style={styles.buttonText}>QA RESTORE</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  panel: {
    position: 'absolute',
    top: 34,
    right: 8,
    zIndex: 10000,
    maxWidth: 280,
    borderRadius: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    padding: 6,
    gap: 5,
  },
  status: { color: '#FFFFFF', fontSize: 9, lineHeight: 12 },
  actions: { flexDirection: 'row', gap: 4 },
  button: {
    minHeight: 34,
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
  },
  buttonText: { color: '#111827', fontSize: 9, fontWeight: '800' },
});
