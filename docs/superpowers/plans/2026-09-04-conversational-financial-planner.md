# Conversational Financial Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Radar B+ plus a conversation-first financial planner that turns confirmed chat facts into a structured plan, calculates scenarios deterministically, and uses Gemini/Google Search only for bounded explanation and market research.

**Architecture:** `App.tsx` remains shell/state composition. Radar and Planner become feature modules. Budget health, planning and scenario math are deterministic TypeScript modules. Gemini routes receive bounded structured inputs; market research uses Google Search grounding when configured and returns source citations. No React Router and no investment-order execution.

**Tech Stack:** React 19, TypeScript 5.7, Vite 6, Vitest 2, Cloudflare Worker, Gemini Interactions API 3.8 Flash, CSS/SVG motion, Expo WebView shell unchanged.

**Spec:** `docs/superpowers/specs/2026-09-04-radar-bplus-financial-plan-design.md`

## Global Constraints

- Deterministic code remains source of truth for money, percentages and scenario math.
- AI may research/explain/extract candidate facts but may not silently commit ambiguous plan values.
- 50/30/20 is an editable educational reference, not a universal prescription.
- Red/coral means negative monetary territory; amber means `Fique de olho`; existing colors elsewhere stay unchanged unless semantically necessary.
- Free keeps 7-day Radar/basic distribution; Pro/Demo Pro get full planner/30-day detail.
- Demo Pro never mutates RevenueCat entitlement or OneSignal real-plan tags.
- Every asset simulation displays a non-recommendation / non-prediction disclaimer.
- `prefers-reduced-motion` disables Radar sweep/chart traveling light/pulse.

---

### Task 1: Budget taxonomy and health engine

**Files:**
- Create: `src/core/budgetTaxonomy.test.ts`
- Create: `src/core/budgetTaxonomy.ts`
- Create: `src/core/budgetHealth.test.ts`
- Create: `src/core/budgetHealth.ts`

**Interfaces:**
- Produces `budgetGroupForCategory(category?: string): BudgetGroup | 'unknown'`.
- Produces `analyzeBudgetHealth(txs: Tx[]): BudgetHealth`.

- [ ] Write tests asserting known categories map to `essential`, `flexible`, `future`, while unknown/unresolved stays `unknown`.
- [ ] Run `npm test -- src/core/budgetTaxonomy.test.ts` and verify RED because module is missing.
- [ ] Implement central mapping.
- [ ] Run taxonomy tests GREEN.
- [ ] Write budget-health tests: recognized monthly credits define income basis; categorized debits produce percentages; zero income returns `status:'insufficient-data'`; unknown debits are reported separately.
- [ ] Run budget-health tests RED.
- [ ] Implement `analyzeBudgetHealth` and reference gaps `{essentialMax:50, flexibleMax:30, futureMin:20}`.
- [ ] Run both test files GREEN.

### Task 2: Structured planning + scenario engines

**Files:**
- Create: `src/features/planner/plannerTypes.ts`
- Create: `src/features/planner/planningEngine.test.ts`
- Create: `src/features/planner/planningEngine.ts`
- Create: `src/features/planner/scenarioEngine.test.ts`
- Create: `src/features/planner/scenarioEngine.ts`

**Interfaces:**
- `createPlanningState(): PlanningState`
- `applyConfirmedFact(state, fact): PlanningState`
- `nextPlanningPrompt(state, budgetHealth): PlanningPrompt`
- `compoundProjection(input): ProjectionResult`
- `financingScenario(input): FinancingResult`
- `allocateAcrossGoals(input): AllocationScenario[]`

- [ ] Write planning tests: user-confirmed goals/limits become structured data; candidate facts alone do not mutate state; custom budget bucket can be added/renamed and target totals are validated.
- [ ] Run planning tests RED.
- [ ] Implement minimal planning state/fact reducers and stage progression.
- [ ] Run planning tests GREEN.
- [ ] Write scenario tests for monthly compounding, financing payment/total cost, and three competing-goal allocation strategies whose monthly allocations never exceed available capacity.
- [ ] Run scenario tests RED.
- [ ] Implement deterministic scenario math.
- [ ] Run scenario tests GREEN.

### Task 3: AI planner/market contracts and grounded research

**Files:**
- Modify: `worker/ai/gemini.ts`
- Modify: `worker/ai/contracts.ts`
- Create: `worker/routes/ai/planner-turn.ts`
- Create: `worker/routes/ai/market-research.ts`
- Modify: `worker/index.ts`
- Modify: `worker/index.test.ts`
- Modify: `src/integrations/ai.ts`

**Interfaces:**
- `callGeminiStructured(..., options?: { googleSearch?: boolean })`.
- Client `plannerTurn(input)` and `researchMarket(input)`.

- [ ] Extend Worker tests first for `/api/ai/planner-turn` and `/api/ai/market-research`; verify malformed input is 400 and missing key is controlled 503.
- [ ] Add unit/route assertion that grounded market request sends `tools:[{type:'google_search'}]` through the Gemini helper.
- [ ] Run Worker tests RED.
- [ ] Implement bounded contracts/routes; market research returns normalized `entity`, `facts`, `citations`, `fetchedAt`, `disclaimer`.
- [ ] Update Gemini helper to optionally enable Google Search while preserving existing structured calls.
- [ ] Update frontend integration types/functions.
- [ ] Run Worker + integration tests GREEN.

### Task 4: Radar B+ feature module

**Files:**
- Create: `src/features/radar/RadarMotion.tsx`
- Create: `src/features/radar/RadarPage.tsx`
- Create: `src/features/radar/WatchPage.tsx`
- Create: `src/features/radar/radar.css`
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`

**Interfaces:**
- `RadarPage` receives deterministic Radar/insight/budget-health data and callbacks `onOpenWatch`, `onOpenPlan`.
- `WatchPage` owns minimum-balance/top-driver detail.

- [ ] Add component-logic tests where extractable: calm summary copy does not expose minimum balance on home; Watch detail does.
- [ ] Run tests RED.
- [ ] Implement radar motion SVG/CSS with reduced-motion fallback.
- [ ] Move Pro Radar home markup out of `App.tsx`; top summary becomes `Saldo atual` + `Fique de olho`.
- [ ] Replace alert-wall `Por que isso acontece` with educational budget-health teaser and `onOpenPlan`.
- [ ] Implement `WatchPage` with minimum balance/drivers/recurrences.
- [ ] Run tests/build GREEN.

### Task 5: Conversational Planner UI

**Files:**
- Create: `src/features/planner/PlannerPage.tsx`
- Create: `src/features/planner/planner.css`
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`

**Interfaces:**
- Planner receives `PlanningState`, `BudgetHealth`, Pro access and persistence callbacks.
- User message -> bounded planner turn; extracted facts render as confirmation cards before committing.

- [ ] Write helper tests for confirmation-card behavior and deterministic fallback prompts.
- [ ] Run RED.
- [ ] Add `Planejar` bottom-nav destination.
- [ ] Show snapshot + conversation + quick replies + pending fact confirmations + derived `Seu plano` summary.
- [ ] Demo Pro starts with a convincing synthetic conversation/goal setup but remains editable.
- [ ] Free shows basic snapshot/goal capture and contextual Pro lock for full AI research/scenarios.
- [ ] Run helper tests/build GREEN.

### Task 6: Market research inside the conversation

**Files:**
- Modify: `src/features/planner/PlannerPage.tsx`
- Modify: `src/features/planner/plannerTypes.ts`
- Modify: `src/features/planner/scenarioEngine.ts`
- Test: `src/features/planner/scenarioEngine.test.ts`

**Interfaces:**
- A user-selected market query becomes `MarketResearchResult`; facts/citations are displayed; user chooses assumptions used by deterministic scenarios.

- [ ] Add tests ensuring historical/reference return is represented as an assumption, never automatically treated as future return.
- [ ] Run RED.
- [ ] Implement market-context card with source links/timestamp and concise asset-history indicators.
- [ ] Add disclaimer: `Simulação informativa, não previsão...`.
- [ ] Add scenario controls for initial amount, monthly contribution, horizon and selected annual-return assumption.
- [ ] Run tests/build GREEN.

### Task 7: Persistence, Demo Pro and integrated flow

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/demo/demoData.ts`
- Modify: `src/types.ts` if shared types are needed
- Test: `src/demo/demoData.test.ts` or planner tests

**Interfaces:**
- `Saved` becomes backward-compatible with optional `planning` state.

- [ ] Write test proving old local state without `planning` loads safely and Demo planning state is synthetic/stable.
- [ ] Run RED.
- [ ] Persist confirmed real planning state only outside Demo mode.
- [ ] Ensure entering/exiting Demo preserves real planning state just like real tx/rules/accounts.
- [ ] Seed Demo with retirement + car + travel objectives and a user-confirmed spending adjustment so jurors can see trade-offs immediately.
- [ ] Run tests/build GREEN.

### Task 8: Final verification and documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/HACKATHON.md`
- Modify: `docs/REVENUECAT-FREE-PRO.md` if plan entitlements need clarification

- [ ] Document the conversation-first architecture and the distinction: AI researches/explains; engines calculate.
- [ ] Document grounded market research and visible non-recommendation disclaimer.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run both Wrangler dry-runs from CI equivalent.
- [ ] Verify Mobile CI remains unaffected/green.
- [ ] Compare branch to `main` for accidental files.
- [ ] Open PR only after final branch-head CI is green.