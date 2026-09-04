# RevenueCat Free/Pro + WebView Bridge — Design

## Context

The current mobile shell already initializes RevenueCat natively and knows whether the `pro` entitlement is active. However, it exposes that state through a separate white native header above the WebView. The web product itself does not know the subscription state, so monetization currently feels attached to the app instead of being part of the product.

This change integrates RevenueCat into the existing Where's the Money experience without rewriting the web app in React Native.

## Goals

- Make the web UI the single visible product surface.
- Keep RevenueCat native as the source of truth for the real `pro` entitlement.
- Remove the standalone native subscription header.
- Let the web app request the native RevenueCat Paywall, Customer Center, and restore flow through an explicit WebView bridge.
- Reflect Free/Pro state inside the web UI.
- Add a coherent Free/Pro product split that supports the Shipaton monetization story.
- Let Judge Demo expose the full Pro experience with synthetic data without creating or faking a RevenueCat entitlement.
- Continue working safely when the RevenueCat public SDK key is not configured.

## Non-goals

This phase does not:

- configure the actual RevenueCat dashboard, products, offering, or public SDK key;
- change the `pro` entitlement identifier;
- add backend account authentication;
- make local browser feature gates a security boundary;
- add OneSignal campaigns;
- change Gemini API configuration;
- implement a second native navigation stack.

## Product tiers

### Free

The Free experience keeps the core product useful:

- statement/file import;
- Inbox review and manual categorization;
- deterministic categorization;
- up to 3 active reusable rules;
- basic cash preview limited to the first 7 projected days;
- access to the Judge Demo entry point.

### Pro

The real `pro` entitlement unlocks:

- Open Finance / Pluggy connection;
- full 30-day Radar;
- full risk headline, zero-crossing visualization, top drivers, and recurring-pattern detail;
- unlimited reusable rules;
- advanced recurrence visibility;
- existing Radar AI explanation surface because it lives inside the full Radar experience;
- future smart push alerts when OneSignal is configured.

### Judge Demo

Judge Demo is a presentation mode, not a fake purchase.

- It always renders the full Pro product surface using only synthetic data.
- It is labeled `Demo Pro · dados sintéticos`.
- It does not mutate RevenueCat state.
- It does not report the user as `pro` to OneSignal.
- The real `Assinar Pro` action remains available separately so the purchase flow can be demonstrated when RevenueCat is configured.

## Subscription source of truth

There are three UI access modes:

```text
free     -> real mobile shell, no active pro entitlement
pro      -> real mobile shell, active RevenueCat `pro` entitlement
demo-pro -> Judge Demo override for synthetic presentation only
```

The web app must never create `pro` by itself. Real `pro` comes only from native RevenueCat state.

Browser-only access to the Cloudflare site has no native entitlement source and defaults to `free`, except Judge Demo which may use `demo-pro` for synthetic presentation.

## Native bridge architecture

### Web -> native

The web app sends JSON through `window.ReactNativeWebView.postMessage()`.

Supported commands:

```json
{ "type": "WTM_SUBSCRIPTION_REQUEST_STATE" }
{ "type": "WTM_SUBSCRIPTION_OPEN_PLAN" }
{ "type": "WTM_SUBSCRIPTION_RESTORE" }
```

Unknown or malformed messages are ignored.

### Native -> web

The Expo shell emits subscription messages into the WebView using `injectJavaScript` and a browser `CustomEvent` named `wtm:native`.

State payload:

```json
{
  "type": "WTM_SUBSCRIPTION_STATE",
  "configured": true,
  "isPro": false
}
```

Action result payload:

```json
{
  "type": "WTM_SUBSCRIPTION_RESULT",
  "action": "open-plan",
  "ok": true,
  "configured": true,
  "isPro": true
}
```

For restore, `action` is `restore`.

The native shell sends state:

- after RevenueCat initialization;
- when the WebView finishes loading;
- when the web app explicitly requests state;
- after Paywall/Customer Center returns;
- after restore;
- whenever RevenueCat customer info changes.

## Native shell UI

The current white native header containing:

- Where's the Money;
- Plano Free / Plano Pro;
- Plano Pro / Gerenciar;
- Restaurar;

is removed.

The native shell becomes visually transparent infrastructure:

```text
SafeArea
  -> WebView
```

Native loading/error states remain, but their background should match the dark product shell so startup does not flash a separate visual system.

## Web subscription state

A small web integration module owns bridge parsing and feature decisions.

Suggested state:

```ts
type SubscriptionState = {
  bridgeAvailable: boolean;
  configured: boolean;
  isPro: boolean;
};
```

Derived access:

```ts
isDemoPro = demoMode
hasProAccess = isDemoPro || subscription.isPro
```

Demo mode is always visually distinguished from a real entitlement.

## UI placement

### More tab

`Mais` becomes the home for subscription management.

Free state:

- compact plan card: `Plano Free`;
- benefit summary;
- primary action `Assinar Pro`;
- secondary `Restaurar compra` when native bridge exists;
- if RevenueCat is not configured, tapping the purchase action shows a clear setup-safe message instead of failing.

Pro state:

- card: `Plano Pro ativo`;
- action `Gerenciar assinatura` opening RevenueCat Customer Center;
- restore remains available as a secondary action if useful.

Demo state:

- card: `Demo Pro · dados sintéticos`;
- explanatory text that the demo unlock is not an entitlement;
- real purchase CTA may still be shown as `Ver assinatura Pro` when running inside the native shell.

## Contextual monetization

The paywall should not appear randomly.

Free users encounter upgrade moments at high-value actions:

1. `Conectar banco` -> explains that automatic Open Finance sync is Pro and offers `Assinar Pro`.
2. Full Radar -> Free sees a 7-day preview and a locked continuation card for days 8-30.
3. Creating a 4th active rule -> keeps existing rules intact and offers Pro instead of silently rejecting or deleting anything.
4. Advanced recurrence detail -> visible as a premium continuation from the basic preview.

These surfaces call the same bridge command; RevenueCat remains responsible for the native Paywall.

## Radar behavior by tier

### Free

- 7-day projection preview;
- current balance and basic minimum within the preview window;
- no complete 30-day risk conclusion;
- a premium continuation block explains what the full Radar adds.

The app must not claim that the user's 30-day cash position is safe or risky when only displaying the Free preview.

### Pro / Demo Pro

The existing full Radar hero remains available:

- 30 days;
- first negative date;
- minimum balance;
- zero line;
- top drivers;
- recurrence detail;
- AI explanation when Gemini is configured.

## Rule limit behavior

Free permits at most 3 active rules.

When a Free user attempts to create a 4th rule:

- the transaction category is still saved;
- no new rule is created;
- the user gets a clear upgrade message and CTA;
- existing rules are never disabled or deleted automatically.

Pro and Demo Pro have no app-level rule count limit.

## Open Finance behavior

Open Finance remains technically available in the Worker, but the user-facing connection flow is Pro-gated in the app.

- Free user: tapping `Conectar banco` opens the upgrade flow.
- Pro user: existing Pluggy connect behavior runs.
- Demo Pro: uses synthetic data and does not need Pluggy.

This is a product gate, not a backend authorization boundary. A production service would later need authenticated server-side entitlement enforcement.

## Failure and fallback behavior

### RevenueCat key missing

The web app receives:

```json
{
  "configured": false,
  "isPro": false
}
```

The rest of the product remains functional. Purchase/restore actions explain that subscriptions are not configured in this build.

### Direct browser

If `window.ReactNativeWebView` is absent:

- app behaves as Free;
- Judge Demo remains available;
- plan card explains that subscription purchase is available in the mobile build rather than throwing an error.

### Malformed bridge messages

Ignored. They must never change access state.

## OneSignal interaction

The existing native `plan=free|pro` tag continues to use only real RevenueCat entitlement state.

Judge Demo must not set `plan=pro` because it is not a purchase.

## Testing strategy

### Web unit tests

- bridge message parser accepts only known subscription payloads;
- derived access returns Pro for real entitlement;
- derived access returns Demo Pro only when demo mode is active;
- browser fallback is Free;
- Free rule limit is 3 and preserves categorization when the 4th rule is rejected;
- Radar preview includes only 7 days for Free;
- Pro/Demo Pro receives full 30-day Radar.

### Mobile unit tests

- web command parser accepts only known commands;
- state serialization reports configured/isPro accurately;
- Demo does not alter RevenueCat or OneSignal subscription state;
- existing RevenueCat entitlement tests remain green.

### CI

Before merge:

```bash
npm test
npm run build
npx wrangler deploy --dry-run
```

and in `apps/mobile`:

```bash
npm test
npm run typecheck
npm run config
npm run doctor
```

Both GitHub Actions workflows must pass.

## Acceptance criteria

- No standalone white native subscription header remains.
- Web UI visibly distinguishes Free, Pro, and Demo Pro.
- Native RevenueCat entitlement is the only source of real Pro state.
- `Assinar Pro`, `Gerenciar assinatura`, and `Restaurar compra` are initiated from the web UI and handled natively.
- Free users can import, review, categorize, and use up to 3 active rules.
- Free users receive a 7-day Radar preview without false 30-day conclusions.
- Pro users receive the full existing 30-day Radar and Open Finance flow.
- Judge Demo shows the full Pro product using synthetic data without mutating purchase state.
- Missing RevenueCat configuration never breaks the app.
- Web/Worker CI and Mobile CI pass before integration to `main`.
