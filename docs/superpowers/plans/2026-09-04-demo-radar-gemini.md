# Demo Mode, Radar Hero and Gemini Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a judge-safe deterministic demo, turn Radar into the product hero, and add Gemini as a server-side explanation/suggestion layer without allowing AI to change financial truth.

**Architecture:** The existing finance engine remains authoritative. New pure helpers produce the demo dataset and deterministic Radar insight. The React app consumes those helpers and calls optional AI endpoints. The Cloudflare Worker validates small bounded payloads, calls Gemini Interactions API with structured JSON output, validates the response, and returns safe public contracts.

**Tech Stack:** React 19, TypeScript 5.7, Vitest, Cloudflare Workers, Gemini Interactions REST API, CSS/SVG.

**Spec:** `docs/superpowers/specs/2026-09-04-gemini-financial-explainer-design.md`

## Global Constraints

- Gemini never calculates balances, creates transactions, invents recurrence, or automatically confirms categories.
- `GEMINI_API_KEY` stays only in the Worker runtime and never uses `VITE_*` or `EXPO_PUBLIC_*`.
- Money remains integer cents inside app/AI contracts.
- Demo data is synthetic, deterministic, and must not overwrite saved real data.
- App remains fully usable when Gemini is absent or upstream fails.
- Use Gemini Interactions API structured output; current implementation model is centralized as `gemini-3.7-flash`.
- Preserve mobile-first layout, desktop support, reduced-motion support, current Pluggy flows, and existing mobile shell.

---

### Task 1: Deterministic Demo Dataset and Radar Insight

**Files:**
- Create: `src/demo/demoData.ts`
- Create: `src/demo/demoData.test.ts`
- Create: `src/core/radarInsight.ts`
- Create: `src/core/radarInsight.test.ts`

**Interfaces:**
- Produces: `createDemoState(): { txs: Tx[]; accounts: BankAccount[]; rules: Rule[] }`
- Produces: `analyzeRadar(projection: RadarPoint[], startingBalance: number): RadarInsight`
- `RadarInsight` contains `minimum`, `endingBalance`, `firstNegative`, `headline`, `tone`, and `topDrivers`.

- [ ] **Step 1: Write failing tests for the demo contract**

```ts
const demo = createDemoState();
const processed = applyPatternIntelligence(demo.txs, demo.rules);
expect(processed.some(tx => tx.status === 'unresolved' || tx.status === 'needs_review')).toBe(true);
expect(processed.some(tx => (tx.recurrenceConfidence || 0) >= 76)).toBe(true);
expect(buildRadar(processed, demo.accounts, demo.rules).projection).toHaveLength(30);
```

- [ ] **Step 2: Verify the tests fail because `createDemoState` does not exist.**

- [ ] **Step 3: Implement a fixed synthetic four-month dataset** with recurring salary, housing, subscriptions, gym and card/fixed expenses, normal variable purchases, and at least one intentionally ambiguous PIX/merchant. Include a known cash account balance that creates an intelligible 30-day projection.

- [ ] **Step 4: Write failing Radar insight tests** for positive projection and first-negative-day projection.

```ts
expect(analyzeRadar(negativeProjection, 100000).tone).toBe('risk');
expect(analyzeRadar(negativeProjection, 100000).firstNegative?.date).toBe('2026-09-14');
expect(analyzeRadar(positiveProjection, 100000).headline).toContain('permanece positivo');
```

- [ ] **Step 5: Implement `analyzeRadar`** as a pure deterministic transformation. Aggregate negative drivers by label/category, select the strongest three, and never invoke AI.

- [ ] **Step 6: Run `npm test` and ensure all finance/demo tests pass.**

- [ ] **Step 7: Commit the self-contained deterministic layer.**

---

### Task 2: Gemini Worker Contracts and Validation

**Files:**
- Create: `worker/ai/contracts.ts`
- Create: `worker/ai/gemini.ts`
- Create: `worker/routes/ai/explain.ts`
- Create: `worker/routes/ai/categorize.ts`
- Modify: `worker/types.ts`
- Modify: `worker/index.ts`
- Modify: `worker/index.test.ts`

**Interfaces:**
- `Env` gains optional `GEMINI_API_KEY?: string`.
- Public routes: `POST /api/ai/explain`, `POST /api/ai/categorize`.
- `callGeminiStructured(env, input, schema): Promise<unknown>` calls `https://generativelanguage.googleapis.com/v1beta/interactions` using model `gemini-3.7-flash` and `response_format` JSON schema.

- [ ] **Step 1: Add failing Worker tests** asserting missing key returns status 503 and `{ code: 'AI_NOT_CONFIGURED' }`, malformed payload returns 400 `INVALID_AI_REQUEST`, and valid mocked Gemini structured output is normalized.

- [ ] **Step 2: Verify CI/test failure before implementation.**

- [ ] **Step 3: Add strict input guards.** Explain accepts integer balances/dates and at most five driver objects with bounded text; categorize accepts bounded description/counterparty, `credit|debit`, and optional provider category. Reject extra/oversized history-like payloads.

- [ ] **Step 4: Implement Gemini REST caller** with `x-goog-api-key`, JSON content type, the centralized model constant, response schema, and prompt constraints that supplied numbers are authoritative and unknown facts must not be invented.

- [ ] **Step 5: Validate output manually in TypeScript** before returning. Explain requires non-empty `summary`, `primaryReason`, and up to three plain-text actions. Categorize requires category from the app category allow-list, confidence 0–100, reason, and `needsConfirmation: true`.

- [ ] **Step 6: Add routes to Worker router and environment type.** Return only stable client-safe error classes; never expose upstream body.

- [ ] **Step 7: Run `npm test` and `npm run build`.**

- [ ] **Step 8: Commit the AI Worker layer.**

---

### Task 3: Client AI Adapter and Judge-Safe Demo Flow

**Files:**
- Create: `src/integrations/ai.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- `explainRadar(input): Promise<AiRadarExplanation>`
- `suggestCategory(input): Promise<AiCategorySuggestion>`
- Demo activation uses `createDemoState()` and an in-memory `demoMode` boolean.

- [ ] **Step 1: Add client adapter types/functions** that POST JSON and map Worker error `AI_NOT_CONFIGURED` to a friendly optional-feature error.

- [ ] **Step 2: Add Demo activation** on the empty Today state: `Explorar demonstração`. Also auto-activate when URL query has `demo=1` and there is no active demo state. Keep synthetic state separate from `localStorage`; while `demoMode` is true, persistence effect must not write demo data to `wtm-portable`.

- [ ] **Step 3: Add a visible but compact `Demonstração` badge and `Sair da demo` action.** Exiting restores the original saved state captured on app initialization rather than clearing real data.

- [ ] **Step 4: Add `Sugerir com IA` to unresolved/needs-review detail only.** Display suggestion in a separate advisory card. The suggestion changes the select value only after an explicit user action and is saved through the existing manual category path; no automatic mutation.

- [ ] **Step 5: Run `npm test` and `npm run build`.**

- [ ] **Step 6: Commit demo/client integration.**

---

### Task 4: Radar Hero UI and AI Explanation

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Radar screen consumes `analyzeRadar` output and current `buildRadar` result.
- `CashPulse` accepts optional risk date and selected-day callback while keeping its current interactive SVG behavior.

- [ ] **Step 1: Replace generic Radar heading with deterministic hero copy** using `RadarInsight.headline`, minimum balance, ending balance, and risk/healthy tone.

- [ ] **Step 2: Upgrade `CashPulse`** to render SVG area fill, animated line, zero baseline when in range, stronger active point, and a pulsing risk marker on first negative day. Preserve keyboard interaction and reduced motion.

- [ ] **Step 3: Add `Por que isso acontece`** under the graph, listing the strongest two or three deterministic drivers with amount and date. Keep recurrence confidence on recurring rows.

- [ ] **Step 4: Add `Explicar com IA`** after deterministic drivers. Send only starting/minimum/ending balances and limited strongest drivers. Show loading, successful explanation with explicit `Explicação por IA`, retryable unavailable/error state, and never hide deterministic content.

- [ ] **Step 5: Refine mobile-first CSS** for hero, risk marker, explanation card, demo affordance and category suggestion; retain desktop width and `prefers-reduced-motion` behavior.

- [ ] **Step 6: Run full validation:** `npm test`, `npm run build`, `npx wrangler deploy --dry-run`, `npx wrangler deploy --assets=./dist --name=hackathon --dry-run`.

- [ ] **Step 7: Commit Radar hero UI.**

---

### Task 5: Documentation, PR and CI Gate

**Files:**
- Modify: `README.md`
- Modify: `docs/ENVIRONMENT.md`
- Modify: `docs/HACKATHON.md`

**Interfaces:** Documentation must describe Demo Mode, deterministic-vs-AI boundary, `GEMINI_API_KEY`, and demo URL `?demo=1` without exposing secrets.

- [ ] **Step 1: Document new feature state and local/Cloudflare secret configuration.**

- [ ] **Step 2: Document judge demo path and AI fallback behavior.**

- [ ] **Step 3: Run the full web/Worker verification once more.**

- [ ] **Step 4: Open a PR from `feat/demo-radar-gemini` to `main`.**

- [ ] **Step 5: Verify GitHub CI and Mobile CI are green before merging. Do not merge on a red/pending required validation.**
