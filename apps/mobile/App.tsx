import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
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
  categorizePortableTransaction,
  emptyPortableState,
  summarizePortableState,
  type PortableTransaction,
} from './src/portable-state';
import {
  derivePortableLoadState,
  inboxEmptyCopy,
  navAccessibilityLabel,
  transactionAccessibilityLabel,
  type InboxFilter,
} from './src/experience';
import {
  buildNativeDataCommandScript,
  buildNativeSubscriptionEventScript,
  parseWebViewMessage,
  type NativeDataCommand,
  type NativeSubscriptionPayload,
} from './src/webview-bridge';

const categories = [
  'Salário',
  'Recebimento',
  'Condomínio',
  'Moradia',
  'Energia',
  'Telefonia/Internet',
  'Assinaturas',
  'Academia',
  'Cartão de crédito',
  'Combustível',
  'Supermercado',
  'Alimentação',
  'Conveniência',
  'Transporte',
  'Saúde',
  'Serviços',
  'Impostos',
  'Folha/Pessoal',
  'Fornecedor',
  'Outros',
];

type AppTab = 'today' | 'inbox' | 'radar' | 'planner' | 'more';
type NativeSurface = 'today' | 'inbox' | 'web';

const brl = (cents: number) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
}).format(cents / 100);

function filteredTransactions(txs: PortableTransaction[], filter: InboxFilter) {
  if (filter === 'attention') return txs.filter(tx => tx.status === 'unresolved' || tx.status === 'needs_review');
  if (filter === 'resolved') return txs.filter(tx => tx.status === 'confirmed' || tx.status === 'categorized');
  return txs.filter(tx => tx.status === 'candidate');
}

export default function App() {
  const [isPro, setIsPro] = useState(false);
  const [revenueCatConfigured, setRevenueCatConfigured] = useState(false);
  const [portable, setPortable] = useState(emptyPortableState);
  const [portableReady, setPortableReady] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>('today');
  const [surface, setSurface] = useState<NativeSurface>('today');
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>('attention');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('Outros');
  const [webLoading, setWebLoading] = useState(true);
  const [webLoadError, setWebLoadError] = useState(false);
  const [bridgeTimedOut, setBridgeTimedOut] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [feedback, setFeedback] = useState('');
  const webViewRef = useRef<WebView>(null);
  const webHandoffRef = useRef<'import' | null>(null);
  const surfaceOpacity = useRef(new Animated.Value(1)).current;
  const surfaceTranslate = useRef(new Animated.Value(0)).current;

  const summary = useMemo(() => summarizePortableState(portable), [portable]);
  const attention = useMemo(
    () => portable.txs.filter(tx => tx.status === 'unresolved' || tx.status === 'needs_review'),
    [portable.txs],
  );
  const selected = selectedId ? portable.txs.find(tx => tx.id === selectedId) : undefined;
  const portableLoadState = derivePortableLoadState({
    portableReady,
    webLoadError: webLoadError || bridgeTimedOut,
  });

  useEffect(() => {
    setSelectedCategory(selected?.category || 'Outros');
  }, [selected?.id, selected?.category]);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (surface === 'web') return;
    if (reduceMotion) {
      surfaceOpacity.setValue(1);
      surfaceTranslate.setValue(0);
      return;
    }

    surfaceOpacity.setValue(0);
    surfaceTranslate.setValue(8);
    Animated.parallel([
      Animated.timing(surfaceOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(surfaceTranslate, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [activeTab, surface, reduceMotion, surfaceOpacity, surfaceTranslate]);

  useEffect(() => {
    if (portableReady || webLoadError || webLoading) {
      setBridgeTimedOut(false);
      return;
    }

    const timer = setTimeout(() => setBridgeTimedOut(true), 6000);
    return () => clearTimeout(timer);
  }, [portableReady, webLoadError, webLoading]);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(''), 2600);
    return () => clearTimeout(timer);
  }, [feedback]);

  const showFeedback = (message: string) => {
    setFeedback(message);
    AccessibilityInfo.announceForAccessibility(message);
  };

  const sendToWeb = (payload: NativeSubscriptionPayload) => {
    webViewRef.current?.injectJavaScript(buildNativeSubscriptionEventScript(payload));
  };

  const sendDataCommand = (command: NativeDataCommand) => {
    webViewRef.current?.injectJavaScript(buildNativeDataCommandScript(command));
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
    const message = parseWebViewMessage(raw);
    if (!message) return;

    if (message.kind === 'portable-state') {
      setPortable(message.state);
      setPortableReady(true);
      setWebLoadError(false);
      setBridgeTimedOut(false);
      if (webHandoffRef.current === 'import' && message.state.txs.length > 0) {
        webHandoffRef.current = null;
        setInboxFilter('attention');
        setActiveTab('inbox');
        setSurface('inbox');
        showFeedback('Extrato importado. Revise apenas o que ainda precisa de decisão.');
      }
      return;
    }

    const command = message.command;
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

  const navigate = (tab: AppTab) => {
    setActiveTab(tab);
    setSelectedId(null);
    sendDataCommand({ type: 'WTM_PORTABLE_NAVIGATE', tab });

    if (tab === 'today' || tab === 'inbox') {
      setSurface(tab);
      return;
    }

    setSurface('web');
  };

  const retryWebBootstrap = () => {
    setWebLoadError(false);
    setBridgeTimedOut(false);
    setWebLoading(true);
    webViewRef.current?.reload();
  };

  const openImport = () => {
    webHandoffRef.current = 'import';
    setActiveTab('today');
    sendDataCommand({ type: 'WTM_PORTABLE_NAVIGATE', tab: 'today' });
    setSurface('web');
  };

  const saveCategory = () => {
    if (!selected || !selectedCategory.trim()) return;
    const nextAttention = attention.find(tx => tx.id !== selected.id);

    setPortable(current => categorizePortableTransaction(current, selected.id, selectedCategory));
    sendDataCommand({
      type: 'WTM_PORTABLE_CATEGORIZE',
      id: selected.id,
      category: selectedCategory,
    });
    showFeedback(`${selected.description} salvo em ${selectedCategory}.`);

    if (nextAttention) {
      setSelectedId(nextAttention.id);
    } else {
      setSelectedId(null);
    }
  };

  const renderNativeSurface = () => {
    if (portableLoadState === 'loading') {
      return (
        <ExperienceState
          loading
          title={webLoading ? 'Abrindo seu financeiro…' : 'Sincronizando seus dados…'}
          description="Estamos conectando o shell Android ao seu estado financeiro."
        />
      );
    }

    if (portableLoadState === 'error') {
      return (
        <ExperienceState
          title="Não foi possível sincronizar agora"
          description="O conteúdo web não respondeu. Seus dados não foram apagados; tente carregar novamente."
          actionLabel="Tentar novamente"
          onAction={retryWebBootstrap}
        />
      );
    }

    if (surface === 'inbox') {
      const visible = filteredTransactions(portable.txs, inboxFilter);
      const emptyCopy = inboxEmptyCopy(inboxFilter);
      return (
        <ScrollView
          contentContainerStyle={styles.page}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <PageHeader
            eyebrow={portable.demoMode ? 'Demo Pro · Inbox' : 'Inbox · fila de decisões'}
            title={summary.attention ? `${summary.attention} para revisar` : 'Tudo revisado'}
            description={summary.attention
              ? `${summary.automated} organizadas automaticamente · ${summary.resolved} já confirmadas.`
              : 'As pendências acabaram. O Radar já pode usar seu histórico organizado.'}
          />
          <View style={styles.segmentRow} accessibilityRole="tablist">
            <Segment label={`Revisar · ${summary.attention}`} active={inboxFilter === 'attention'} onPress={() => setInboxFilter('attention')} />
            <Segment label={`Resolvidas · ${summary.resolved}`} active={inboxFilter === 'resolved'} onPress={() => setInboxFilter('resolved')} />
            <Segment label={`Auto · ${summary.automated}`} active={inboxFilter === 'auto'} onPress={() => setInboxFilter('auto')} />
          </View>
          {!visible.length ? (
            <View style={styles.heroCard}>
              <Text style={styles.cardEyebrow}>{emptyCopy.eyebrow}</Text>
              <Text style={styles.cardTitle}>{emptyCopy.title}</Text>
              <Text style={styles.cardText}>{emptyCopy.description}</Text>
              {inboxFilter === 'attention' ? <PrimaryButton label="Abrir Radar" onPress={() => navigate('radar')} /> : null}
            </View>
          ) : (
            <View style={styles.listCard}>
              {visible.map(tx => (
                <TransactionRow key={tx.id} tx={tx} onPress={() => setSelectedId(tx.id)} />
              ))}
            </View>
          )}
        </ScrollView>
      );
    }

    return (
      <ScrollView
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandRow}>
          <View>
            <Text style={styles.brandOverline}>ARTISYS</Text>
            <Text style={styles.brandName}>Where's the Money</Text>
          </View>
          {portable.demoMode ? <Text style={styles.demoPill}>Demo Pro</Text> : null}
        </View>
        <PageHeader
          eyebrow={portable.demoMode ? 'Demo Pro · dados sintéticos' : 'Hoje'}
          title={portable.txs.length ? 'O que precisa da sua atenção agora.' : 'Descubra para onde seu dinheiro foi.'}
          description={portable.txs.length
            ? `${summary.attention} para revisar · ${summary.automated} automáticas · ${summary.resolved} confirmadas`
            : 'Comece pelo extrato gratuito e organize sua vida financeira sem perder o controle.'}
        />

        {!portable.txs.length ? (
          <>
            <View style={styles.heroCard}>
              <Text style={styles.cardEyebrow}>Começar agora · Free</Text>
              <Text style={styles.cardTitle}>Adicionar extrato grátis</Text>
              <Text style={styles.cardText}>OFX, CSV, TXT ou Excel. A importação continua no web app enquanto Hoje e Inbox migram para nativo.</Text>
              <PrimaryButton label="Adicionar extrato" onPress={openImport} accessibilityHint="Abre a importação de extrato na experiência web" />
            </View>
            <Pressable
              style={({ pressed }) => [styles.secondaryCard, pressed && styles.pressed]}
              onPress={() => {
                sendDataCommand({ type: 'WTM_PORTABLE_NAVIGATE', tab: 'today' });
                setSurface('web');
              }}
              accessibilityRole="button"
              accessibilityLabel="Abrir experiência completa"
              accessibilityHint="Abre Open Finance, integrações e Demo Pro"
            >
              <Text style={styles.cardEyebrow}>Experiência completa</Text>
              <Text style={styles.secondaryTitle}>Open Finance e Demo Pro</Text>
              <Text style={styles.cardText}>Acesse as integrações e a demonstração completa sem duplicar lógica no app nativo.</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.metricRow}>
              <Metric label="Para revisar" value={String(summary.attention)} />
              <Metric label="Automáticas" value={String(summary.automated)} />
              <Metric label={portable.demoMode ? 'Saldo simulado' : 'Saldo atual'} value={portable.accounts.length ? brl(summary.balance) : '—'} />
            </View>

            <View style={styles.heroCard}>
              <Text style={styles.cardEyebrow}>Próximo passo</Text>
              <Text style={styles.cardTitle}>{summary.attention ? `${summary.attention} movimentações precisam de você` : 'Seu dinheiro está organizado.'}</Text>
              <Text style={styles.cardText}>{summary.attention
                ? `${summary.resolved + summary.automated} já foram organizadas. Revise apenas o que ainda precisa de decisão.`
                : 'Abra o Radar para entender o que vem pela frente.'}</Text>
              <PrimaryButton label={summary.attention ? 'Revisar agora' : 'Abrir Radar'} onPress={() => navigate(summary.attention ? 'inbox' : 'radar')} />
            </View>

            {attention.length ? (
              <View style={styles.listCard}>
                <Text style={styles.cardEyebrow}>Próximas decisões</Text>
                {attention.slice(0, 3).map(tx => (
                  <TransactionRow key={tx.id} tx={tx} onPress={() => {
                    setActiveTab('inbox');
                    setSurface('inbox');
                    setSelectedId(tx.id);
                  }} />
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    );
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.content}>
          <View
            pointerEvents={surface === 'web' ? 'auto' : 'none'}
            importantForAccessibility={surface === 'web' ? 'auto' : 'no-hide-descendants'}
            style={[styles.webContainer, surface !== 'web' && styles.webHidden]}
          >
            <WebView
              ref={webViewRef}
              source={{ uri: mobileConfig.webAppUrl }}
              style={styles.webView}
              onMessage={(event) => handleWebMessage(event.nativeEvent.data)}
              onLoadStart={() => {
                setWebLoading(true);
                setWebLoadError(false);
                setBridgeTimedOut(false);
              }}
              onLoadEnd={() => {
                setWebLoading(false);
                emitCurrentState();
                sendDataCommand({ type: 'WTM_PORTABLE_REQUEST_STATE' });
              }}
              onError={() => {
                setWebLoading(false);
                setWebLoadError(true);
              }}
              onHttpError={() => {
                setWebLoading(false);
                setWebLoadError(true);
              }}
              startInLoadingState
              renderLoading={() => (
                <ExperienceState
                  loading
                  title="Carregando experiência completa…"
                  description="Preparando Radar, Planejamento e integrações."
                />
              )}
              renderError={() => (
                <ExperienceState
                  title="Não foi possível carregar o app"
                  description="Verifique a conexão. Nenhum dado local foi apagado."
                  actionLabel="Tentar novamente"
                  onAction={retryWebBootstrap}
                />
              )}
            />
          </View>
          {surface !== 'web' ? (
            <Animated.View
              style={[
                styles.nativeSurface,
                { opacity: surfaceOpacity, transform: [{ translateY: surfaceTranslate }] },
              ]}
            >
              {renderNativeSurface()}
            </Animated.View>
          ) : null}
        </View>

        {feedback ? (
          <View pointerEvents="none" style={styles.feedbackBanner} accessible>
            <Text accessibilityLiveRegion="polite" style={styles.feedbackText}>{feedback}</Text>
          </View>
        ) : null}

        <View style={styles.bottomNav} accessibilityRole="tablist">
          <NavItem label="Hoje" active={activeTab === 'today'} onPress={() => navigate('today')} />
          <NavItem label="Inbox" active={activeTab === 'inbox'} badge={summary.attention || undefined} onPress={() => navigate('inbox')} />
          <NavItem label="Radar" active={activeTab === 'radar'} onPress={() => navigate('radar')} />
          <NavItem label="Planejar" active={activeTab === 'planner'} onPress={() => navigate('planner')} />
          <NavItem label="Mais" active={activeTab === 'more'} onPress={() => navigate('more')} />
        </View>

        <Modal
          visible={Boolean(selected)}
          transparent
          animationType={reduceMotion ? 'none' : 'slide'}
          onRequestClose={() => setSelectedId(null)}
          accessibilityViewIsModal
        >
          <KeyboardAvoidingView
            style={styles.modalBackdrop}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View
              style={styles.modalSheet}
              onAccessibilityEscape={() => setSelectedId(null)}
              accessibilityLabel="Revisar categoria da movimentação"
            >
              <View style={styles.modalHandle} accessibilityElementsHidden />
              <Text style={styles.cardEyebrow}>Movimentação</Text>
              <Text numberOfLines={2} style={styles.modalTitle}>{selected?.description}</Text>
              <Text style={styles.modalAmount}>{selected ? `${selected.direction === 'debit' ? '−' : '+'}${brl(selected.amount)}` : ''}</Text>
              <Text style={styles.fieldLabel}>Categoria</Text>
              <ScrollView
                style={styles.categoryList}
                contentContainerStyle={styles.categoryGrid}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {categories.map(category => (
                  <Pressable
                    key={category}
                    onPress={() => setSelectedCategory(category)}
                    style={({ pressed }) => [
                      styles.categoryChip,
                      selectedCategory === category && styles.categoryChipActive,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: selectedCategory === category }}
                    accessibilityLabel={category}
                    hitSlop={2}
                  >
                    <Text style={[styles.categoryText, selectedCategory === category && styles.categoryTextActive]}>{category}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <PrimaryButton label={attention.some(tx => tx.id !== selected?.id) ? 'Salvar e ver próxima' : 'Salvar e concluir revisão'} onPress={saveCategory} />
              <Pressable
                style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
                onPress={() => setSelectedId(null)}
                accessibilityRole="button"
                accessibilityLabel="Cancelar revisão"
                hitSlop={4}
              >
                <Text style={styles.cancelText}>Cancelar</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function ExperienceState({
  loading = false,
  title,
  description,
  actionLabel,
  onAction,
}: {
  loading?: boolean;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.centerState}>
      {loading ? <ActivityIndicator accessibilityLabel="Carregando" /> : <View style={styles.errorMark}><Text style={styles.errorMarkText}>!</Text></View>}
      <Text accessibilityLiveRegion={loading ? 'polite' : 'assertive'} style={styles.errorTitle}>{title}</Text>
      <Text style={styles.muted}>{description}</Text>
      {actionLabel && onAction ? <PrimaryButton label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

function PageHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <View style={styles.heading} accessible accessibilityRole="header">
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.headingTitle}>{title}</Text>
      <Text style={styles.headingText}>{description}</Text>
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  accessibilityHint?: string;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      hitSlop={3}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function Segment({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.segment, active && styles.segmentActive, pressed && styles.pressed]}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      hitSlop={2}
    >
      <Text numberOfLines={1} style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text numberOfLines={1} style={styles.metricLabel}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function TransactionRow({ tx, onPress }: { tx: PortableTransaction; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.txRow, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={transactionAccessibilityLabel(tx)}
      accessibilityHint="Abre a revisão de categoria"
    >
      <View style={styles.txMain}>
        <Text numberOfLines={1} style={styles.txTitle}>{tx.description}</Text>
        <Text numberOfLines={1} style={styles.txMeta}>{tx.category || 'Sem categoria'} · {tx.date}</Text>
      </View>
      <View style={styles.txSide}>
        <Text style={[styles.txAmount, tx.direction === 'credit' && styles.credit]}>{tx.direction === 'debit' ? '−' : '+'}{brl(tx.amount)}</Text>
        <Text style={styles.txStatus}>{tx.status === 'candidate' ? 'Auto' : tx.status === 'categorized' ? 'Categorizado' : tx.status === 'confirmed' ? 'Confirmado' : 'Revisar'}</Text>
      </View>
    </Pressable>
  );
}

function NavItem({ label, active, badge, onPress }: { label: string; active: boolean; badge?: number; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.navItem, pressed && styles.navPressed]}
      accessibilityRole="tab"
      accessibilityLabel={navAccessibilityLabel(label, badge)}
      accessibilityState={{ selected: active }}
      hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}
    >
      <View style={[styles.navDot, active && styles.navDotActive]}>{badge ? <Text style={styles.navBadge}>{badge > 9 ? '9+' : badge}</Text> : null}</View>
      <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F8FC' },
  content: { flex: 1, position: 'relative' },
  nativeSurface: { flex: 1 },
  webContainer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#F6F8FC', zIndex: 2 },
  webHidden: { opacity: 0, width: 1, height: 1, right: undefined, bottom: undefined },
  webView: { flex: 1, backgroundColor: '#F6F8FC' },
  centerState: { flex: 1, minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#F6F8FC', padding: 24 },
  errorMark: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF3F2' },
  errorMarkText: { color: '#B42318', fontSize: 20, fontWeight: '900' },
  errorTitle: { fontSize: 18, lineHeight: 24, fontWeight: '800', color: '#111827', textAlign: 'center' },
  muted: { color: '#667085', textAlign: 'center', fontSize: 14, lineHeight: 20, maxWidth: 340 },
  page: { padding: 18, paddingBottom: 28, gap: 14 },
  brandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 2, paddingBottom: 2 },
  brandOverline: { color: '#3157D5', fontSize: 10, fontWeight: '800', letterSpacing: 1.6 },
  brandName: { marginTop: 2, color: '#111827', fontSize: 15, fontWeight: '700' },
  demoPill: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#EEF2FF', color: '#4338CA', fontSize: 11, fontWeight: '800' },
  heading: { gap: 6, marginTop: 5, marginBottom: 2 },
  eyebrow: { color: '#3157D5', fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  headingTitle: { color: '#101828', fontSize: 29, lineHeight: 35, fontWeight: '800', letterSpacing: -0.7 },
  headingText: { color: '#667085', fontSize: 14, lineHeight: 21 },
  heroCard: { backgroundColor: '#FFFFFF', borderRadius: 22, borderWidth: 1, borderColor: '#E6EAF2', padding: 18, gap: 8, shadowColor: '#101828', shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  secondaryCard: { minHeight: 44, backgroundColor: '#EEF4FF', borderRadius: 20, borderWidth: 1, borderColor: '#D6E4FF', padding: 18, gap: 6 },
  cardEyebrow: { color: '#64748B', fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  cardTitle: { color: '#101828', fontSize: 20, lineHeight: 25, fontWeight: '800' },
  secondaryTitle: { color: '#102A56', fontSize: 18, fontWeight: '800' },
  cardText: { color: '#667085', fontSize: 14, lineHeight: 20 },
  primaryButton: { marginTop: 8, minHeight: 48, minWidth: 124, borderRadius: 14, backgroundColor: '#3157D5', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  metricRow: { flexDirection: 'row', gap: 8 },
  metricCard: { flex: 1, minWidth: 0, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E8ECF3', paddingHorizontal: 11, paddingVertical: 13, gap: 5 },
  metricLabel: { color: '#7A8496', fontSize: 10, fontWeight: '700' },
  metricValue: { color: '#101828', fontSize: 17, fontWeight: '800' },
  listCard: { backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#E8ECF3', paddingHorizontal: 14, paddingTop: 14, paddingBottom: 4 },
  txRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E8ECF3', paddingVertical: 12 },
  txMain: { flex: 1, minWidth: 0, gap: 4 },
  txTitle: { color: '#172033', fontSize: 14, fontWeight: '800' },
  txMeta: { color: '#7A8496', fontSize: 11 },
  txSide: { alignItems: 'flex-end', gap: 4 },
  txAmount: { color: '#B42318', fontSize: 13, fontWeight: '800' },
  credit: { color: '#027A48' },
  txStatus: { color: '#667085', fontSize: 10, fontWeight: '700' },
  segmentRow: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1, minHeight: 44, borderRadius: 12, backgroundColor: '#EDEFF4', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  segmentActive: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#B8C4D8' },
  segmentText: { color: '#667085', fontSize: 10, fontWeight: '700' },
  segmentTextActive: { color: '#1F3A8A', fontWeight: '900' },
  bottomNav: { height: 68, flexDirection: 'row', alignItems: 'stretch', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#DCE1EA', backgroundColor: '#FFFFFF', paddingHorizontal: 4 },
  navItem: { flex: 1, minWidth: 44, alignItems: 'center', justifyContent: 'center', gap: 5 },
  navPressed: { backgroundColor: '#F7F9FC' },
  navDot: { width: 22, height: 4, borderRadius: 999, backgroundColor: '#E4E8F0', alignItems: 'center', justifyContent: 'center' },
  navDotActive: { backgroundColor: '#3157D5' },
  navBadge: { position: 'absolute', top: -17, right: -6, minWidth: 18, textAlign: 'center', overflow: 'hidden', borderRadius: 9, backgroundColor: '#D92D20', color: '#FFFFFF', fontSize: 9, fontWeight: '900', paddingHorizontal: 3, paddingVertical: 2 },
  navLabel: { color: '#667085', fontSize: 10, fontWeight: '700' },
  navLabelActive: { color: '#1F3A8A', fontWeight: '900' },
  feedbackBanner: { position: 'absolute', left: 16, right: 16, bottom: 78, zIndex: 30, borderRadius: 14, borderWidth: 1, borderColor: '#ABEFC6', backgroundColor: '#ECFDF3', paddingHorizontal: 14, paddingVertical: 11, shadowColor: '#101828', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  feedbackText: { color: '#05603A', fontSize: 13, lineHeight: 18, fontWeight: '700', textAlign: 'center' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.38)' },
  modalSheet: { maxHeight: '86%', backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 10 },
  modalHandle: { width: 40, height: 4, borderRadius: 999, alignSelf: 'center', backgroundColor: '#D8DEE9', marginBottom: 4 },
  modalTitle: { color: '#101828', fontSize: 20, lineHeight: 25, fontWeight: '800' },
  modalAmount: { color: '#101828', fontSize: 28, fontWeight: '900', marginBottom: 4 },
  fieldLabel: { color: '#667085', fontSize: 12, fontWeight: '800', marginTop: 4 },
  categoryList: { maxHeight: 240 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingVertical: 4 },
  categoryChip: { minHeight: 44, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: '#D0D5DD', backgroundColor: '#F8FAFC', paddingHorizontal: 12, paddingVertical: 8 },
  categoryChipActive: { borderColor: '#3157D5', backgroundColor: '#EEF2FF' },
  categoryText: { color: '#475467', fontSize: 12, fontWeight: '700' },
  categoryTextActive: { color: '#2442A5', fontWeight: '900' },
  cancelButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: '#667085', fontSize: 13, fontWeight: '700' },
});
