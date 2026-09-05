# Guided Financial Journey — Phase 2 Design Spec

Date: 2026-09-04
Status: approved direction, pending written-spec review before implementation

## Goal

Turn Where's the Money from a collection of strong product areas into one guided financial journey that continuously answers the user's next question:

1. bring financial data in;
2. review what still needs a decision;
3. understand what the data means for the near future;
4. turn that understanding into an actionable financial plan;
5. continue using the existing navigation without forcing a wizard.

The product must feel like one sequence of decisions, not five disconnected destinations.

Canonical journey:

```text
Dados → Inbox → Radar → Plano → acompanhamento
```

Bottom navigation remains available at all times where it already exists. The guided journey is an orchestration layer, not a replacement navigation architecture.

## Scope

Phase 2 changes user-facing orchestration and information hierarchy only.

In scope:

- Today/Home as the primary next-action surface;
- first-use hierarchy for import, Open Finance and Demo Pro;
- Inbox as a decision queue;
- transaction-detail continuation to the next unresolved item;
- explicit handoff from completed Inbox to Radar;
- contextual Radar messaging and handoff to planning;
- Planner progressive disclosure;
- contextual Free/Pro upgrade messaging;
- judge-oriented Demo Pro progress guidance;
- tests for journey states and transitions;
- supporting CSS/components required by these changes.

Out of scope:

- finance-engine behavior;
- budget calculations;
- Radar calculation logic;
- Gemini prompt/route behavior;
- Pluggy/Open Finance contracts;
- RevenueCat entitlement rules or native checkout bridge;
- Worker routing/runtime;
- persistence model changes;
- changing Free/Pro entitlements themselves.

## Product principle: always expose the next useful decision

The app should not ask users to understand its information architecture before they get value.

At each major state, one primary action should be visually dominant:

- no data → bring data in;
- unresolved transactions → review the next decision;
- Inbox complete → inspect the financial outlook;
- Radar understood → organize a plan;
- active plan → continue monitoring and adjusting.

Secondary areas remain reachable through bottom navigation.

## Journey state model

Phase 2 introduces a deterministic presentation-level journey state derived from existing app state plus one non-persisted session hint that records whether Radar has already been visited in the current session. It does not become a second source of financial truth.

Suggested type:

```ts
type JourneyStage =
  | 'empty'
  | 'review'
  | 'radar-ready'
  | 'plan-ready'
  | 'active-plan';
```

Supporting session state:

```ts
type JourneySession = {
  radarSeenThisSession: boolean;
};
```

`JourneySession` is UI-only, resets on page/app reload and is never written to `wtm-portable`.

Derivation rules are evaluated in this exact precedence order:

1. `empty`
2. `review`
3. `active-plan`
4. `radar-ready`
5. `plan-ready`

### `empty`

Conditions:

- no transactions loaded.

Primary action:

- import statement.

Secondary actions:

- connect bank when Pro access is available;
- learn about Pro when Open Finance is locked;
- explore Demo Pro.

### `review`

Conditions:

- at least one transaction is `unresolved` or `needs_review`.

Primary action:

- review next pending transaction.

Supporting information:

- unresolved count;
- resolved count;
- automatically categorized/candidate count.

### `active-plan`

Conditions:

- transactions exist;
- Inbox does not need immediate review;
- structured planning state contains at least one confirmed meaningful fact, such as a confirmed goal or confirmed adjustment.

Primary Home action:

- continue/review plan or inspect Radar according to current deterministic risk/attention state.

The exact CTA can be derived from existing Radar insight without changing underlying calculation behavior.

### `radar-ready`

Conditions:

- transactions exist;
- no unresolved/review items remain;
- no meaningful active plan exists;
- `radarSeenThisSession === false`.

Primary action:

- open Radar.

Message:

- financial history is organized enough to inspect what comes next.

Opening Radar sets `radarSeenThisSession = true` for the current UI session only.

### `plan-ready`

Conditions:

- transactions exist;
- Inbox does not need immediate review;
- no meaningful active plan exists;
- `radarSeenThisSession === true`.

Primary action:

- open Planner.

This makes the sequence explicit without storing tutorial progress or changing financial persistence.

## Today / Home

### Empty state hierarchy

Current first-use options remain, but their hierarchy changes.

Primary card/action:

**Começar agora**

- statement import;
- explicitly labeled Free;
- accepts the formats already supported by the importer.

Secondary Pro action:

**Conectar banco**

- keeps current Pluggy behavior;
- if the user lacks Pro access, explain value contextually before invoking the existing subscription experience.

Tertiary exploration action:

**Explorar Demo Pro**

- remains prominent enough for hackathon judging;
- must not visually compete with the primary real-user onboarding action;
- keeps current isolation guarantees for real user data and entitlement.

### Home with data

Replace feature-centric summary with next-action framing.

If pending review exists:

```text
3 movimentações precisam de você
18 já foram organizadas

[Revisar agora]
```

If review is complete and Radar has not yet been visited this session:

```text
Seu dinheiro está organizado.
Veja o que vem pela frente.

[Abrir Radar]
```

If Radar has already been visited and there is no active plan:

```text
Agora transforme essa leitura em um plano.

[Planejar]
```

If a plan already exists, Home may summarize the next meaningful action, but should avoid duplicating the full Radar or Planner screen.

## Inbox as a decision queue

Inbox should emphasize completion and uncertainty resolution rather than a generic transaction list.

Header structure:

```text
3 para revisar · 18 organizadas automaticamente
```

Filters can remain, but the `attention` filter is the default work queue.

### Transaction detail continuation

After manually categorizing a pending transaction, the user should not be forced back to the list when another pending transaction exists.

Primary completion behavior:

- save category;
- if another unresolved/review transaction exists, open the next one;
- otherwise return to Inbox completion state.

Suggested action label:

```text
Salvar e ver próxima
```

When the current item is the last pending one:

```text
Salvar e concluir revisão
```

Rule creation remains optional and keeps existing Free/Pro limits.

### Inbox completion state

When `attention.length === 0` and transactions exist, show a dedicated completion surface:

```text
Tudo revisado.
O Radar já consegue usar essas informações.

[Ver meu Radar]
```

This is a contextual handoff, not a modal or forced redirect.

## Radar handoff

Radar calculation and existing B+ visual structure remain intact.

Phase 2 changes framing and CTA language only.

### Risk/pressure state

If the deterministic insight contains a first-negative point or meaningful pressure:

```text
Seu saldo pode ficar negativo em X dias.

[Entender o que está pressionando]
```

The CTA may open `Fique de olho` when available or the existing detailed Radar path.

### Healthy state

When no relevant negative point exists:

```text
Nenhum ponto crítico nos próximos X dias.
```

Do not invent urgency.

### Planning handoff

The existing `Por que isso acontece` / distribution section remains the bridge into planning, but CTA copy should clearly signal continuation:

```text
Organizar meu plano
```

or equivalent context-specific language.

The existing numeric insight and budget-health source remain deterministic.

## Planner progressive disclosure

The Planner keeps all current capabilities but stops presenting them with equal visual priority on first entry.

### Level 1 — Conversation

Initial dominant surface:

```text
O que você quer que seu dinheiro permita?
```

Contains:

- current financial snapshot in compact form;
- conversation thread;
- composer;
- AI candidate confirmations;
- quick replies where already supported.

This remains the primary way to establish goals and constraints.

### Level 2 — Your plan

Visible once structured planning data exists, or as a compact empty summary before that.

Contains:

- confirmed goals;
- monthly contribution where known;
- monthly capacity released by confirmed adjustments;
- relevant allocation summary.

The plan summary should be understandable without reading chat history.

### Level 3 — Advanced tools

The existing advanced tools remain available but are grouped into clearly labeled expandable/secondary sections:

1. **Organizar orçamento**
   - editable bucket references;
   - custom buckets;
   - total validation.

2. **Comparar cenários**
   - existing deterministic allocation scenarios.

3. **Pesquisar ativo/caminho**
   - existing Gemini-grounded market research when configured.

4. **Simular**
   - existing deterministic compound/financial simulations;
   - existing disclaimer boundary remains visible.

No capability is removed. Progressive disclosure changes first-glance density only.

## Free / Pro upgrade UX

The current entitlement and checkout architecture remain unchanged.

Problem to solve:

- a locked action can currently move the user to `Mais`, losing context.

Phase 2 introduces a contextual explanation layer before the existing subscription action.

Example for Radar:

```text
Radar completo é Pro
Você já pode ver os próximos 7 dias.
Pro libera 30 dias, drivers e alertas detalhados.

[Conhecer Pro]
```

Example for Open Finance:

```text
Open Finance automático é Pro
No Free você pode continuar importando extratos.

[Conhecer Pro]
```

Requirements:

- explain value in the context of the attempted action;
- never imply the user has Pro before RevenueCat confirms it;
- browser remains Free unless Demo Pro is active;
- final purchase/restore/manage action remains native RevenueCat when available;
- no entitlement duplication in React state beyond the existing access layer.

Implementation may use a lightweight contextual upgrade sheet/card/modal, but it must reuse the existing `openSubscriptionExperience` path for the actual purchase flow.

## Demo Pro judge journey

Demo Pro already uses isolated synthetic data and must retain those guarantees.

Add a discreet progress guide only in Demo Pro:

```text
1 de 4 · Revisar movimentações
2 de 4 · Ver o Radar
3 de 4 · Entender o ponto de atenção
4 de 4 · Montar o plano
```

Principles:

- progress guidance is optional, not blocking;
- judges can still use bottom navigation freely;
- progress should be inferred from navigation/actions where practical;
- do not persist demo progress into real-user storage;
- exiting Demo Pro restores real state exactly as today.

Recommended demo progression:

1. Today → Inbox attention;
2. resolve/open representative transaction;
3. Radar → `Fique de olho`/pressure explanation;
4. Planner → conversation/confirmed plan.

The guide exists to make the product story legible in a short judging session, not to create a tutorial framework for production users.

## Navigation

Bottom navigation destinations remain:

```text
Hoje | Inbox | Radar | Planejar | Mais
```

No route is removed or renamed in Phase 2.

Guided CTAs call the same tab/state transitions already owned by `App.tsx`.

The bottom navigation remains the escape hatch and power-user path; contextual next actions are the default novice path.

## Component boundaries

Phase 2 should reduce further growth of `App.tsx` without broad refactoring.

Recommended focused units:

### `journeyState.ts`

Pure deterministic helpers:

- derive current `JourneyStage` from existing transaction/planning/session/access/insight state;
- choose next primary action metadata;
- no React dependency;
- directly unit-testable.

### `JourneyCard.tsx`

Reusable Home next-action presentation:

- title;
- supporting summary;
- primary CTA;
- optional secondary link/status.

No finance calculations.

### `ContextualUpgrade.tsx`

Presentation only:

- attempted feature context;
- value explanation;
- continue to existing subscription action;
- dismiss/back.

No entitlement logic.

### `DemoProgress.tsx`

Demo-only presentation:

- current step;
- four-step progress;
- optional next CTA.

No real-user persistence.

Existing `RadarPage` and `PlannerPage` should be changed only where required for handoff copy/progressive disclosure.

## Data flow

```text
Existing transactions/rules/accounts/planning/access/Radar insight
                          +
              non-persisted JourneySession
                          ↓
                  journeyState.ts
                          ↓
              presentation-only stage
                          ↓
     Home / Inbox / Radar / Planner contextual CTA
                          ↓
               existing App tab/actions
```

No journey state is allowed to overwrite source financial data.

Contextual upgrade flow:

```text
Locked action
    ↓
ContextualUpgrade explanation
    ↓
existing openSubscriptionExperience()
    ↓
native RevenueCat bridge when available
```

## Error handling

Phase 2 does not introduce new network failure modes.

Existing errors from Pluggy, Gemini and RevenueCat remain handled by current integrations.

New UI behavior must follow these rules:

- if import fails, do not advance journey stage;
- if category save fails for any future reason, do not skip to next item;
- if Pro checkout is unavailable, preserve current explanatory fallback and keep user context visible;
- if Radar lacks enough data, do not claim risk/health; use current insufficient-data language;
- if planning has no confirmed structured facts, do not claim an active plan;
- Demo progress failures must never affect core navigation.

## Accessibility and motion

Phase 2 builds on MotionKit Delivery 1.

Requirements:

- all primary journey actions are real buttons/links with accessible names;
- changing stage must not rely only on animation or color;
- focus is moved only when a user action results in a new detail/context surface where focus movement is expected;
- contextual upgrade surface must be keyboard dismissible if implemented as a modal/sheet;
- `prefers-reduced-motion` remains honored by MotionKit;
- no auto-advancing wizard behavior.

## Mobile-first behavior

This phase is optimized for the WebView/mobile shell first.

Requirements:

- one dominant CTA per state;
- no horizontal-scroll dependency for journey navigation;
- advanced Planner sections collapsed/secondary enough to reduce first-screen density;
- sticky/bottom navigation remains reachable;
- transaction-detail continuation must work comfortably one-handed;
- desktop may expand layouts but must retain the same information hierarchy.

## Testing strategy

Implementation must follow TDD for deterministic journey behavior.

### `journeyState.test.ts`

Cover at minimum:

1. no transactions → `empty`;
2. unresolved transaction exists → `review`;
3. all transactions resolved + no meaningful plan + Radar unseen → `radar-ready`;
4. all transactions resolved + no meaningful plan + Radar seen this session → `plan-ready`;
5. meaningful structured plan → `active-plan` regardless of Radar session hint;
6. demo state does not change entitlement derivation;
7. risk vs healthy insight changes CTA copy/action only, not engine data.

### Inbox continuation tests

Cover:

- saving a non-final pending item selects the next pending item;
- saving final pending item yields Inbox completion state;
- rule-limit behavior still invokes existing Free/Pro path;
- categorized/resolved items are not treated as pending.

### Contextual upgrade tests

Cover:

- locked feature preserves attempted-feature context;
- dismiss does not change entitlement;
- continue action delegates to existing subscription handler;
- browser fallback remains safe.

### Demo progress tests

Cover:

- only rendered in Demo Pro;
- steps can advance from user actions/navigation;
- exiting demo discards progress;
- real persisted data remains untouched.

### Regression suite

Before merge:

```bash
npm test
npm run build
npx wrangler deploy --dry-run
npx wrangler deploy --assets=./dist --name=hackathon --dry-run
```

Mobile validation:

```bash
cd apps/mobile
npm test
npm run typecheck
npm run config
npm run doctor
```

## Acceptance criteria

Phase 2 is complete only when all of the following are true:

1. A new Free user can understand how to start without choosing between three equally weighted onboarding cards.
2. Import remains the primary Free first-use path.
3. Open Finance remains a contextual Pro option and keeps the existing Pluggy integration.
4. Demo Pro remains available and isolated from real data/entitlement.
5. Home presents one clear next action based on current state.
6. Inbox clearly communicates pending vs already-organized work.
7. Categorizing an item can continue directly to the next pending item.
8. Completing review presents an explicit handoff to Radar.
9. Radar maintains current deterministic calculations and visual architecture.
10. Radar can hand off naturally to planning.
11. Planner retains all existing capabilities while reducing first-view density through progressive disclosure.
12. Free/Pro attempts explain value in context before delegating to existing subscription behavior.
13. Demo Pro exposes a non-blocking four-step judging path.
14. Bottom navigation remains fully usable.
15. Finance engine, Gemini, Pluggy, RevenueCat, Worker and persisted financial contracts remain unchanged unless a separately reviewed defect requires otherwise.
16. `JourneySession` remains non-persisted and cannot alter financial data or entitlement.
17. Web/Worker CI and mobile validation pass.
18. Cloudflare Worker remains the only production web deployment target.

## Expected implementation surface

Likely additions:

- `src/core/journeyState.ts`
- `src/core/journeyState.test.ts`
- `src/components/JourneyCard.tsx`
- `src/components/ContextualUpgrade.tsx`
- `src/components/DemoProgress.tsx`
- focused component tests where practical.

Likely modifications:

- `src/App.tsx`
- `src/features/radar/RadarPage.tsx`
- `src/features/planner/PlannerPage.tsx`
- `src/styles.css` / `src/premium.css` / `src/motion-kit.css` only as needed for the new hierarchy and states.

No new backend endpoint is expected for this phase.

## Non-goals

Phase 2 does not:

- redesign the brand;
- replace bottom navigation;
- introduce account authentication;
- add new subscription tiers;
- add new finance calculations;
- add new AI features;
- add a production tutorial/wizard framework;
- introduce another deployment provider;
- migrate away from Cloudflare Workers.
