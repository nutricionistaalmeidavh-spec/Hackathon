import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
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
type InboxFilter = 'attention' | 'resolved' | 'auto';

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
  const webViewRef = useRef<WebView>(null);
  const webHandoffRef = useRef<'import' | null>(null);

  const summary = useMemo(() => summarizePortableState(portable), [portable]);
  const attention = useMemo(
    () => portable.txs.filter(tx => tx.status === 'unresolved' || tx.status === 'needs_review'),
    [portable.txs],
  );
  const selected = selectedId ? portable.txs.find(tx => tx.id === selectedId) : undefined;

  useEffect(() => {
    setSelectedCategory(selected?.category || 'Outros');
  }, [selected?.id, selected?.category]);

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
      if (webHandoffRef.current === 'import' && message.state.txs.length > 0) {
        webHandoffRef.current = null;
        setInboxFilter('attention');
        setActiveTab('inbox');
        setSurface('inbox');
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

    if (nextAttention) {
      setSelectedId(nextAttention.id);
    } else {
      setSelectedId(null);
    }
  };

  const renderNativeSurface = () => {
    if (!portableReady) {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator />
          <Text style={styles.muted}>Sincronizando seu financeiro…</Text>
        </View>
      );
    }

    if (surface === 'inbox') {
      const visible = filteredTransactions(portable.txs, inboxFilter);
      return (
        <ScrollView contentContainerStyle={styles.page}>
          <PageHeader
            eyebrow={portable.demoMode ? 'Demo Pro · Inbox' : 'Inbox · fila de decisões'}
            title={summary.attention ? `${summary.attention} para revisar` : 'Tudo revisado'}
            description={summary.attention
              ? `${summary.automated} organizadas automaticamente · ${summary.resolved} já confirmadas.`
              : 'As pendências acabaram. O Radar já pode usar seu histórico organizado.'}
          />
          <View style={styles.segmentRow}>
            <Segment label={`Revisar · ${summary.attention}`} active={inboxFilter === 'attention'} onPress={() => setInboxFilter('attention')} />
            <Segment label={`Resolvidas · ${summary.resolved}`} active={inboxFilter === 'resolved'} onPress={() => setInboxFilter('resolved')} />
            <Segment label={`Auto · ${summary.automated}`} active={inboxFilter === 'auto'} onPress={() => setInboxFilter('auto')} />
          </View>
          {inboxFilter === 'attention' && !visible.length ? (
            <View style={styles.heroCard}>
              <Text style={styles.cardEyebrow}>Revisão concluída</Text>
              <Text style={styles.cardTitle}>Seu dinheiro está organizado.</Text>
              <Text style={styles.cardText}>Veja o que vem pela frente com a projeção do Radar.</Text>
              <PrimaryButton label="Abrir Radar" onPress={() => navigate('radar')} />
            </View>
          ) : (
            <View style={styles.listCard}>
              {visible.length ? visible.map(tx => (
                <TransactionRow key={tx.id} tx={tx} onPress={() => setSelectedId(tx.id)} />
              )) : <Text style={styles.emptyText}>Nenhuma movimentação neste estado.</Text>}
            </View>
          )}
        </ScrollView>
      );
    }

    return (
      <ScrollView contentContainerStyle={styles.page}>
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
              <PrimaryButton label="Adicionar extrato" onPress={openImport} />
            </View>
            <Pressable style={styles.secondaryCard} onPress={() => {
              sendDataCommand({ type: 'WTM_PORTABLE_NAVIGATE', tab: 'today' });
              setSurface('web');
            }}>
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
            style={[styles.webContainer, surface !== 'web' && styles.webHidden]}
          >
            <WebView
              ref={webViewRef}
              source={{ uri: mobileConfig.webAppUrl }}
              style={styles.webView}
              onMessage={(event) => handleWebMessage(event.nativeEvent.data)}
              onLoadEnd={() => {
                emitCurrentState();
                sendDataCommand({ type: 'WTM_PORTABLE_REQUEST_STATE' });
              }}
              startInLoadingState
              renderLoading={() => (
                <View style={styles.centerState}>
                  <ActivityIndicator />
                  <Text style={styles.muted}>Carregando experiência completa…</Text>
                </View>
              )}
              renderError={() => (
                <View style={styles.centerState}>
                  <Text style={styles.errorTitle}>Não foi possível carregar o app</Text>
                  <Text style={styles.muted}>Verifique a conexão e tente novamente.</Text>
                </View>
              )}
            />
          </View>
          {surface !== 'web' ? renderNativeSurface() : null}
        </View>

        <View style={styles.bottomNav}>
          <NavItem label="Hoje" active={activeTab === 'today'} onPress={() => navigate('today')} />
          <NavItem label="Inbox" active={activeTab === 'inbox'} badge={summary.attention || undefined} onPress={() => navigate('inbox')} />
          <NavItem label="Radar" active={activeTab === 'radar'} onPress={() => navigate('radar')} />
          <NavItem label="Planejar" active={activeTab === 'planner'} onPress={() => navigate('planner')} />
          <NavItem label="Mais" active={activeTab === 'more'} onPress={() => navigate('more')} />
        </View>

        <Modal visible={Boolean(selected)} transparent animationType="slide" onRequestClose={() => setSelectedId(null)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <Text style={styles.cardEyebrow}>Movimentação</Text>
              <Text numberOfLines={2} style={styles.modalTitle}>{selected?.description}</Text>
              <Text style={styles.modalAmount}>{selected ? `${selected.direction === 'debit' ? '−' : '+'}${brl(selected.amount)}` : ''}</Text>
              <Text style={styles.fieldLabel}>Categoria</Text>
              <ScrollView style={styles.categoryList} contentContainerStyle={styles.categoryGrid}>
                {categories.map(category => (
                  <Pressable
                    key={category}
                    onPress={() => setSelectedCategory(category)}
                    style={[styles.categoryChip, selectedCategory === category && styles.categoryChipActive]}
                  >
                    <Text style={[styles.categoryText, selectedCategory === category && styles.categoryTextActive]}>{category}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <PrimaryButton label={attention.some(tx => tx.id !== selected?.id) ? 'Salvar e ver próxima' : 'Salvar e concluir revisão'} onPress={saveCategory} />
              <Pressable style={styles.cancelButton} onPress={() => setSelectedId(null)}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function PageHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <View style={styles.heading}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.headingTitle}>{title}</Text>
      <Text style={styles.headingText}>{description}</Text>
    </View>
  );
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} onPress={onPress}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function Segment({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.segment, active && styles.segmentActive]}>
      <Text numberOfLines={1} style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text numberOfLines={1} style={styles.metricLabel}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function TransactionRow({ tx, onPress }: { tx: PortableTransaction; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.txRow, pressed && styles.pressed]}>
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
    <Pressable onPress={onPress} style={styles.navItem} accessibilityRole="button" accessibilityState={{ selected: active }}>
      <View style={[styles.navDot, active && styles.navDotActive]}>{badge ? <Text style={styles.navBadge}>{badge > 9 ? '9+' : badge}</Text> : null}</View>
      <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F8FC' },
  content: { flex: 1, position: 'relative' },
  webContainer: { ...StyleSheet.absoluteFillObject, backgroundColor: '#F6F8FC', zIndex: 2 },
  webHidden: { opacity: 0, width: 1, height: 1, right: undefined, bottom: undefined },
  webView: { flex: 1, backgroundColor: '#F6F8FC' },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#F6F8FC', padding: 24 },
  errorTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  muted: { color: '#667085', textAlign: 'center' },
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
  secondaryCard: { backgroundColor: '#EEF4FF', borderRadius: 20, borderWidth: 1, borderColor: '#D6E4FF', padding: 18, gap: 6 },
  cardEyebrow: { color: '#64748B', fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  cardTitle: { color: '#101828', fontSize: 20, lineHeight: 25, fontWeight: '800' },
  secondaryTitle: { color: '#102A56', fontSize: 18, fontWeight: '800' },
  cardText: { color: '#667085', fontSize: 14, lineHeight: 20 },
  primaryButton: { marginTop: 8, minHeight: 48, borderRadius: 14, backgroundColor: '#3157D5', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  pressed: { opacity: 0.72 },
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
  emptyText: { paddingVertical: 22, textAlign: 'center', color: '#667085' },
  segmentRow: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1, minHeight: 38, borderRadius: 12, backgroundColor: '#EDEFF4', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  segmentActive: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D7DDEA' },
  segmentText: { color: '#7A8496', fontSize: 10, fontWeight: '700' },
  segmentTextActive: { color: '#1F3A8A' },
  bottomNav: { height: 68, flexDirection: 'row', alignItems: 'stretch', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#DCE1EA', backgroundColor: '#FFFFFF', paddingHorizontal: 4 },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5 },
  navDot: { width: 22, height: 4, borderRadius: 999, backgroundColor: '#E4E8F0', alignItems: 'center', justifyContent: 'center' },
  navDotActive: { backgroundColor: '#3157D5' },
  navBadge: { position: 'absolute', top: -17, right: -6, minWidth: 18, textAlign: 'center', overflow: 'hidden', borderRadius: 9, backgroundColor: '#E5484D', color: '#FFFFFF', fontSize: 9, fontWeight: '900', paddingHorizontal: 3, paddingVertical: 2 },
  navLabel: { color: '#7A8496', fontSize: 10, fontWeight: '700' },
  navLabelActive: { color: '#1F3A8A', fontWeight: '900' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.38)' },
  modalSheet: { maxHeight: '86%', backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 10 },
  modalHandle: { width: 40, height: 4, borderRadius: 999, alignSelf: 'center', backgroundColor: '#D8DEE9', marginBottom: 4 },
  modalTitle: { color: '#101828', fontSize: 20, lineHeight: 25, fontWeight: '800' },
  modalAmount: { color: '#101828', fontSize: 28, fontWeight: '900', marginBottom: 4 },
  fieldLabel: { color: '#667085', fontSize: 12, fontWeight: '800', marginTop: 4 },
  categoryList: { maxHeight: 240 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingVertical: 4 },
  categoryChip: { borderRadius: 999, borderWidth: 1, borderColor: '#DCE2EC', backgroundColor: '#F8FAFC', paddingHorizontal: 11, paddingVertical: 8 },
  categoryChipActive: { borderColor: '#3157D5', backgroundColor: '#EEF2FF' },
  categoryText: { color: '#526070', fontSize: 12, fontWeight: '700' },
  categoryTextActive: { color: '#2442A5', fontWeight: '900' },
  cancelButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: '#667085', fontSize: 13, fontWeight: '700' },
});
