# RevenueCat Free/Pro architecture

Where's the Money uses the native RevenueCat SDK as the only source of truth for the real `pro` entitlement. The React/Vite product remains the single visible UI and communicates with the Expo shell through a narrow WebView message bridge.

## Product tiers

| Free | Pro |
| --- | --- |
| Import statement files | Everything in Free |
| Inbox + manual review | Open Finance / Pluggy automatic sync |
| Deterministic categorization | Full 30-day Radar |
| Up to 3 active reusable rules | Unlimited reusable rules |
| 7-day Radar preview | Risk date, drivers and advanced recurrence detail |
| Judge Demo entry | Radar explanation with Gemini when configured |

Judge Demo runs as `demo-pro`: it unlocks the full product UI using only synthetic data. It never creates a RevenueCat entitlement and never changes the OneSignal `plan` tag.

## Bridge

Web -> native commands:

```json
{"type":"WTM_SUBSCRIPTION_REQUEST_STATE"}
{"type":"WTM_SUBSCRIPTION_OPEN_PLAN"}
{"type":"WTM_SUBSCRIPTION_RESTORE"}
```

Native -> web is emitted as `CustomEvent('wtm:native')` with either:

```json
{"type":"WTM_SUBSCRIPTION_STATE","configured":true,"isPro":false}
```

or an action result:

```json
{"type":"WTM_SUBSCRIPTION_RESULT","action":"open-plan","ok":true,"configured":true,"isPro":true}
```

The Expo shell is visually invisible: it hosts the WebView and native integrations, while subscription management appears inside the web product under **Mais**.

## Runtime without a RevenueCat key

`EXPO_PUBLIC_REVENUECAT_API_KEY` is intentionally not committed. When the key is absent:

- the app runs as Free;
- file import, Inbox, manual categorization and the 7-day preview still work;
- Judge Demo remains available;
- purchase/restore actions return a safe `not configured` state instead of crashing.

## Dashboard setup still required

For the hackathon demo, configure RevenueCat Test Store with:

- entitlement: `pro`;
- a test product (for example `pro_monthly_test`);
- a default offering containing that product;
- a RevenueCat Paywall;
- the public Test Store SDK key in `apps/mobile/.env` as `EXPO_PUBLIC_REVENUECAT_API_KEY`.

No private store credentials belong in this repository.
