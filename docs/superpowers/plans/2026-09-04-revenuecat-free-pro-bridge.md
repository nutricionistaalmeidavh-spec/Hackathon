# RevenueCat Free/Pro Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the native RevenueCat `pro` entitlement into the existing web product through a typed WebView bridge, remove the separate native plan header, and enforce the approved Free/Pro product experience while keeping Judge Demo fully unlocked with synthetic data.

**Architecture:** Expo remains the source of truth for the real RevenueCat entitlement. The web app owns the visible subscription UI and derives `free`, `pro`, or `demo-pro` access from native state plus Demo Mode. Web-to-native commands open RevenueCat Paywall/Customer Center or restore purchases; native-to-web events return current state/results.

**Tech Stack:** React 19, TypeScript, Vite/Vitest, Expo SDK 57, React Native 0.86, react-native-webview, react-native-purchases, react-native-purchases-ui, OneSignal.

**Spec:** `docs/superpowers/specs/2026-09-04-revenuecat-free-pro-bridge-design.md`

## Global Constraints

- Real `pro` comes only from RevenueCat entitlement `pro` in the native shell.
- Judge Demo may render full Pro UI only with synthetic data and must never mutate RevenueCat state or OneSignal plan tagging.
- Free allows at most 3 active reusable rules.
- Free Radar exposes only a 7-day preview and must not claim a 30-day safe/risk conclusion.
- Pro/Demo Pro retain the full 30-day Radar, Open Finance entry, recurrence detail, and Radar AI explanation.
- Browser-only web defaults to Free unless Judge Demo is active.
- Missing RevenueCat configuration must degrade safely; it must not crash either runtime.
- No private RevenueCat, Pluggy, Gemini, Firebase, APNs, or keystore secrets are committed.

---

### Task 1: Web access policy and bridge contract

**Files:**
- Create: `src/subscription/access.ts`
- Create: `src/subscription/access.test.ts`
- Create: `src/integrations/subscriptionBridge.ts`
- Create: `src/integrations/subscriptionBridge.test.ts`

**Interfaces:**
- Produces: `deriveAccess(demoMode, subscription)`, `FREE_RULE_LIMIT`, `FREE_RADAR_DAYS`.
- Produces: `NativeSubscriptionState`, `subscribeToNativeSubscription`, `requestNativeSubscriptionState`, `openNativePlan`, `restoreNativePurchases`.

- [ ] **Step 1: Write failing access-policy tests** proving Free=3 rules/7 days, Pro unlimited/full, and Demo Pro full without real entitlement.
- [ ] **Step 2: Write failing bridge-contract tests** proving native state/result payload validation and malformed payload rejection.
- [ ] **Step 3: Run `npm test`** and confirm the new tests fail because implementations are missing.
- [ ] **Step 4: Implement the minimal pure access policy and guarded browser bridge**. Browser bridge calls `window.ReactNativeWebView.postMessage(JSON.stringify(command))` only when available and listens for `wtm:native` CustomEvents.
- [ ] **Step 5: Run `npm test`** and confirm the new tests pass.
- [ ] **Step 6: Commit** with `feat: add subscription access and web bridge`.

### Task 2: Native WebView bridge and invisible shell

**Files:**
- Create: `apps/mobile/src/webview-bridge.ts`
- Create: `apps/mobile/src/webview-bridge.test.ts`
- Modify: `apps/mobile/App.tsx`

**Interfaces:**
- Consumes: existing `getRevenueCatState`, `presentPlanExperience`, `restorePurchases`, `subscribeToCustomerInfo`.
- Produces: parser for `WTM_SUBSCRIPTION_REQUEST_STATE`, `WTM_SUBSCRIPTION_OPEN_PLAN`, `WTM_SUBSCRIPTION_RESTORE` and script builder for `WTM_SUBSCRIPTION_STATE` / `WTM_SUBSCRIPTION_RESULT` events.

- [ ] **Step 1: Write failing native bridge tests** for valid commands, malformed/unknown messages, and injected event script payloads.
- [ ] **Step 2: Run `cd apps/mobile && npm test`** and confirm failure before implementation.
- [ ] **Step 3: Implement `webview-bridge.ts`** with strict command parsing and event-script generation.
- [ ] **Step 4: Replace the white native subscription header in `apps/mobile/App.tsx`** with a dark SafeArea + WebView only. Add a WebView ref, `onMessage`, `onLoadEnd`, native action handlers, and native-to-web state/result emission.
- [ ] **Step 5: Keep OneSignal tagging tied only to real RevenueCat `isPro` state**; Demo Mode never changes the tag because it exists only in web state.
- [ ] **Step 6: Run mobile tests and typecheck**: `cd apps/mobile && npm test && npm run typecheck`.
- [ ] **Step 7: Commit** with `feat: bridge RevenueCat state into WebView`.

### Task 3: Free/Pro experience in the web product

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: Task 1 access policy and bridge functions.
- Preserves: deterministic finance engine and existing Demo/Radar/Gemini behavior.

- [ ] **Step 1: Subscribe to native entitlement state in `App`** and derive `hasProAccess`, `demo-pro`, rule limit, and Radar horizon.
- [ ] **Step 2: Add plan management to `Mais`**: Free card + `Assinar Pro`; Pro active card + `Gerenciar assinatura`; restore action when native bridge exists; Demo Pro label with synthetic-data explanation.
- [ ] **Step 3: Gate Open Finance contextually**: Free `Conectar banco` opens the RevenueCat plan flow; Pro runs the existing Pluggy flow; Demo continues using synthetic data.
- [ ] **Step 4: Enforce the 3-rule Free limit without losing categorization**. A blocked 4th rule still saves the category, creates no rule, routes to `Mais`, and explains the upgrade path.
- [ ] **Step 5: Implement the Free 7-day Radar preview**. Analyze only the visible 7 days, label it as a preview, hide full 30-day risk/recurrence/AI conclusions, and render a locked continuation CTA.
- [ ] **Step 6: Preserve full 30-day Radar + AI for Pro and Demo Pro**.
- [ ] **Step 7: Add cohesive dark-theme plan/locked-state styling and `prefers-reduced-motion` compatibility**.
- [ ] **Step 8: Run `npm test && npm run build`**.
- [ ] **Step 9: Commit** with `feat: add Free and Pro product tiers`.

### Task 4: Documentation and full verification

**Files:**
- Modify: `README.md`
- Modify: `docs/HACKATHON.md`
- Modify: `docs/MOBILE-BUILD.md`

**Interfaces:**
- Documents the exact bridge commands, tier split, Demo Pro semantics, and remaining RevenueCat dashboard/key work.

- [ ] **Step 1: Update docs** to state that the native shell is visually invisible, RevenueCat owns real `pro`, Free=3 rules/7-day Radar, and Demo Pro is synthetic-only.
- [ ] **Step 2: Document runtime behavior when `EXPO_PUBLIC_REVENUECAT_API_KEY` is absent** and the later dashboard setup steps without committing a key.
- [ ] **Step 3: Run full web verification**: `npm test`, `npm run build`, `npx wrangler deploy --dry-run`, `npx wrangler deploy --assets=./dist --name=hackathon --dry-run`.
- [ ] **Step 4: Run full mobile verification**: `cd apps/mobile && npm test && npm run typecheck && npm run config && npm run doctor`.
- [ ] **Step 5: Open/update PR from `feat/revenuecat-free-pro` to `main` and require both GitHub Actions workflows to finish successfully before merge recommendation**.
