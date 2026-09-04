# Mobile RevenueCat + OneSignal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Expo development-client mobile shell for Where's the Money that reuses the deployed web app while adding native RevenueCat and OneSignal integrations.

**Architecture:** `apps/mobile` is an isolated Expo SDK 57 project linked to the existing EAS project. A native shell hosts the Cloudflare web app in `react-native-webview`; native services own RevenueCat entitlement/paywall/customer-center state and OneSignal initialization/tags. Mobile CI is separate from the existing web/Worker CI.

**Tech Stack:** Expo SDK 57, React 19.2.3, React Native 0.87, react-native-webview 13.16.1, RevenueCat React Native 10.8.1, OneSignal React Native 5.5.9, onesignal-expo-plugin 2.7.1, TypeScript 6, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-03-mobile-revenuecat-onesignal-design.md`

## Global Constraints

- EAS owner `engenutri`, slug `wheresthemoney`, projectId `6f7e9d85-5dd4-41e6-a37f-861c54a853d5`.
- Web/Worker behavior remains unchanged.
- Default web URL is `https://hackathon.nutricionistaalmeidavh.workers.dev`.
- RevenueCat entitlement is exactly `pro`.
- No secrets or Firebase service-account files are committed.
- Android development build is the first target; iOS is configuration-only in this phase.

---

### Task 1: Scaffold mobile project and RED tests

**Files:**
- Create: `apps/mobile/package.json`
- Create: `apps/mobile/tsconfig.json`
- Create: `apps/mobile/index.ts`
- Create: `apps/mobile/.env.example`
- Create: `apps/mobile/src/config.test.ts`
- Create: `apps/mobile/src/subscription-state.test.ts`
- Create: `.github/workflows/mobile-ci.yml`

**Interfaces:**
- Produces `getMobileConfig(env)` and `hasProEntitlement(customerInfo)` contracts for later tasks.

- [ ] Write tests importing not-yet-existing `./config` and `./subscription-state` and asserting default Worker URL, blank-key handling, entitlement `pro`, and plan tags.
- [ ] Commit the tests and mobile package metadata without production implementations.
- [ ] Trigger branch CI and confirm RED because the imported production modules do not exist.

### Task 2: Implement pure configuration and subscription state

**Files:**
- Create: `apps/mobile/src/config.ts`
- Create: `apps/mobile/src/subscription-state.ts`

**Interfaces:**
- `getMobileConfig(env?: Record<string,string|undefined>): { webAppUrl: string; revenueCatApiKey?: string; oneSignalAppId?: string }`
- `hasProEntitlement(customerInfo: Pick<CustomerInfoLike,'entitlements'> | null | undefined): boolean`
- `planTag(isPro: boolean): 'pro' | 'free'`

- [ ] Implement minimal pure functions to satisfy Task 1 tests.
- [ ] Run mobile tests and verify GREEN.

### Task 3: Add Expo/EAS configuration

**Files:**
- Create: `apps/mobile/app.config.ts`
- Create: `apps/mobile/eas.json`
- Update: `apps/mobile/package.json`

**Interfaces:**
- Expo config exposes projectId, owner, slug, package/bundle identifiers, OneSignal plugin, development-client profile and public env usage.

- [ ] Configure Expo SDK 57, new architecture, Android package `com.engenutri.wheresthemoney`, iOS bundle `com.engenutri.wheresthemoney`, OneSignal plugin first, remote-notification background mode, and EAS projectId.
- [ ] Add `expo-dev-client`, `react-native-webview`, RevenueCat, OneSignal and Vitest dependencies with pinned compatible versions.
- [ ] Validate with `npx expo config --type public`, TypeScript and `expo-doctor` in CI.

### Task 4: Implement RevenueCat and OneSignal services

**Files:**
- Create: `apps/mobile/src/revenuecat.ts`
- Create: `apps/mobile/src/onesignal.ts`

**Interfaces:**
- RevenueCat: `initializeRevenueCat`, `getRevenueCatState`, `presentPlanExperience`, `restorePurchases`, `subscribeToCustomerInfo`.
- OneSignal: `initializeOneSignal`, `identifyOneSignalUser`, `setOneSignalPlanTag`.

- [ ] RevenueCat initializes only with a non-empty public SDK key, reads `CustomerInfo`, checks `pro`, presents paywall if Free, Customer Center if Pro, restores purchases and exposes listener cleanup.
- [ ] OneSignal initializes only with a non-empty App ID, requests permission, registers click/foreground listeners, supports login only with a non-empty stable user ID, and writes tag `plan=free|pro`.
- [ ] Run typecheck and tests.

### Task 5: Build native shell

**Files:**
- Create: `apps/mobile/App.tsx`

**Interfaces:**
- Consumes mobile config and native services; renders the deployed web product in WebView.

- [ ] Bootstrap both native SDKs without failing when public IDs are still absent.
- [ ] Render `WebView` to configured Worker URL with loading/error states.
- [ ] Add compact native plan controls: Free/Pro state, `Plano Pro`/`Gerenciar`, and `Restaurar`.
- [ ] Keep RevenueCat state synchronized to OneSignal `plan` tag.
- [ ] Run full mobile verification.

### Task 6: Documentation and integration verification

**Files:**
- Modify: `README.md`
- Modify: `docs/MOBILE-BUILD.md`
- Modify: `.gitignore` only if mobile-native outputs need explicit ignores.

- [ ] Document mobile setup, required public IDs, Android Emulator + Google Play image, `eas build --platform android --profile development`, and `npx expo start --dev-client`.
- [ ] Verify web CI remains green and mobile CI passes independently.
- [ ] Compare branch against `main` and confirm no functional web/Worker source changes.
- [ ] Only after fresh green verification, integrate the branch into `main`.
