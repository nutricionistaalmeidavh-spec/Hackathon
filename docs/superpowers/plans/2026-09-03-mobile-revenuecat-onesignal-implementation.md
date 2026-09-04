# Mobile RevenueCat + OneSignal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Expo Android development client under `apps/mobile` that wraps the current web app and adds native RevenueCat and OneSignal integrations without changing the existing Cloudflare web runtime.

**Architecture:** Keep the current React/Vite + Cloudflare Worker untouched. Add an isolated Expo app that renders the deployed web app through `react-native-webview`; native services initialize RevenueCat and OneSignal and expose a small native plan control. Mobile CI runs independently from the existing web/Worker CI.

**Tech Stack:** Expo SDK 57, React Native 0.87, TypeScript, react-native-webview, RevenueCat React Native SDK/UI, OneSignal React Native SDK + Expo config plugin, EAS Build.

**Spec:** `docs/superpowers/specs/2026-09-03-mobile-revenuecat-onesignal-design.md`

## Global Constraints

- Preserve the current web app and Cloudflare Worker behavior.
- Expo owner: `engenutri`; slug: `wheresthemoney`.
- EAS projectId: `6f7e9d85-5dd4-41e6-a37f-861c54a853d5`.
- Android development build first; iOS prepared but not required for this checkpoint.
- RevenueCat entitlement identifier: `pro`.
- No RevenueCat secret keys, Firebase service accounts, APNs credentials, or EAS credentials in Git.
- Public runtime values only via `EXPO_PUBLIC_REVENUECAT_API_KEY`, `EXPO_PUBLIC_ONESIGNAL_APP_ID`, and `EXPO_PUBLIC_WEB_APP_URL`.
- OneSignal is initialized only when a valid App ID is present.
- RevenueCat is initialized only when a valid public SDK key is present.

---

### Task 1: Scaffold the isolated Expo mobile app

**Files:** `apps/mobile/package.json`, `tsconfig.json`, `index.ts`, `app.config.ts`, `eas.json`, `.env.example`, `src/config.ts`, `src/config.test.ts`.

- [ ] Write failing config tests for default web URL, entitlement `pro`, and public key validation.
- [ ] Run tests and confirm RED because config implementation is absent.
- [ ] Implement Expo/EAS scaffold with SDK 57, New Architecture, owner/slug/projectId, Android package `com.engenutri.wheresthemoney`, and development client profile.
- [ ] Run tests and `npm run typecheck`.
- [ ] Commit `feat: scaffold Expo mobile app`.

### Task 2: RevenueCat service

**Files:** `apps/mobile/src/revenuecat.ts`, `revenuecat-state.ts`, `revenuecat-state.test.ts`.

- [ ] Write failing tests for `isProCustomerInfo`.
- [ ] Run tests and confirm RED.
- [ ] Implement conditional SDK initialization, `pro` entitlement state, paywall, Customer Center, and restore.
- [ ] Run tests/typecheck.
- [ ] Commit `feat: add RevenueCat mobile service`.

### Task 3: OneSignal service

**Files:** `apps/mobile/src/onesignal.ts`, `notification-tags.ts`, `notification-tags.test.ts`.

- [ ] Write failing tests for `{ plan: 'free'|'pro' }` tags.
- [ ] Run tests and confirm RED.
- [ ] Implement conditional initialization, permission, click/foreground listeners, `login`, and plan tag.
- [ ] Run tests/typecheck.
- [ ] Commit `feat: add OneSignal mobile service`.

### Task 4: Native shell

**File:** `apps/mobile/App.tsx`.

- [ ] Render the current deployed web app through a full-screen WebView.
- [ ] Initialize RevenueCat and OneSignal on mount.
- [ ] Subscribe to RevenueCat customer updates and mirror plan state into OneSignal.
- [ ] Add compact native plan/restore controls.
- [ ] Run all mobile tests and typecheck.
- [ ] Commit `feat: add native mobile shell`.

### Task 5: Mobile CI and docs

**Files:** `.github/workflows/mobile-ci.yml`, `.gitignore`, `docs/MOBILE-BUILD.md`, `README.md`.

- [ ] Add mobile CI: `npm install`, tests, typecheck, Expo Doctor, public Expo config.
- [ ] Ignore mobile secrets/generated native files/credential files.
- [ ] Document Windows emulator flow and EAS development APK flow.
- [ ] Validate branch CI.
- [ ] Commit `ci: validate Expo mobile integration`.

### Task 6: Final verification and integration

- [ ] Existing web tests/build/Wrangler dry-runs remain green.
- [ ] Mobile CI is green.
- [ ] Review diff for secrets and unintended web changes.
- [ ] Merge to `main` only after verification.
- [ ] User syncs with `git pull origin main`, then `cd apps\\mobile`.
