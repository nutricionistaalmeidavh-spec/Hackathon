# Phases 2–3 Guided Journey + Demo Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved guided financial journey (Phase 2) and polish the hackathon demo for states, responsiveness and visual consistency (Phase 3) without changing financial engines or deployment architecture.

**Architecture:** Add a pure journey-derivation layer and small presentation components, then wire them into the existing `App.tsx` orchestration. Keep Radar and Planner calculations intact; only change framing, progressive disclosure and contextual handoffs. Add one focused CSS layer loaded before MotionKit so motion remains the final interaction layer.

**Tech Stack:** React 19, TypeScript 5.7, Vite 6, Vitest 2, CSS, Cloudflare Workers + Static Assets.

**Spec:** `docs/superpowers/specs/2026-09-04-guided-financial-journey-design.md`

## Global Constraints

- Canonical journey remains `Dados → Inbox → Radar → Plano → acompanhamento`.
- Bottom navigation remains `Hoje | Inbox | Radar | Planejar | Mais`.
- No finance-engine, budget, Radar calculation, Gemini route/prompt, Pluggy contract, RevenueCat entitlement, Worker routing/runtime or persistence-model changes.
- Browser remains Free unless Demo Pro is active; RevenueCat remains the only truth for real Pro access.
- Demo progress is session-only and must never enter `wtm-portable`.
- Phase 3 adds no new runtime dependency.
- `src/motion-kit.css` must remain the final CSS import.
- Completion requires `npm test`, `npm run build`, both Wrangler dry-runs, Mobile CI, and Cloudflare Workers Build success after merge.

---

### Task 1: Deterministic journey state

**Files:**
- Create: `src/journey/journeyState.ts`
- Create: `src/journey/journeyState.test.ts`

**Interfaces:**
- Consumes: transaction status counts, planning state summary, `radarSeenThisSession`, Radar attention boolean.
- Produces: `deriveJourneyStage(input): JourneyStage`, `nextPendingId(txs, currentId): string | null`, `deriveDemoStep(input): 1|2|3|4`.

- [ ] Write failing tests for `empty`, `review`, `radar-ready`, `plan-ready`, `active-plan`, ordered next-pending selection and four demo steps.
- [ ] Run `npx vitest run src/journey/journeyState.test.ts` and verify RED because module does not exist.
- [ ] Implement pure helpers with no React/localStorage dependency.
- [ ] Run targeted test and verify GREEN.

### Task 2: Journey presentation components

**Files:**
- Create: `src/journey/JourneyCard.tsx`
- Create: `src/journey/ContextualUpgrade.tsx`
- Create: `src/journey/DemoProgress.tsx`
- Create: `src/journey/journeyComponents.test.tsx`

**Interfaces:**
- `JourneyCard({ eyebrow,title,description,actionLabel,onAction,secondaryLabel?,onSecondary? })`.
- `ContextualUpgrade({ open,title,description,benefits,onContinue,onClose })`.
- `DemoProgress({ step,onNext? })`.

- [ ] Write static-render tests with `react-dom/server` checking semantic headings/buttons, dialog role/accessible label, four demo step labels and absence of persistence APIs.
- [ ] Run targeted test and verify RED.
- [ ] Implement minimal accessible components.
- [ ] Run targeted test and verify GREEN.

### Task 3: App orchestration — Home, Inbox and continuity

**Files:**
- Modify: `src/App.tsx`
- Create: `src/journey/appJourneyContract.test.ts`

**Interfaces:**
- Uses Task 1 helpers and Task 2 components.
- Adds session-only `radarSeenThisSession`, `demoTouchedReview`, `demoTouchedWatch`, `demoTouchedPlan` state.
- Adds contextual upgrade descriptor state instead of immediately navigating to `Mais` for locked contextual actions.

- [ ] Write contract tests that assert imports/use of journey helpers/components and copy for `Começar agora`, `Revisar agora`, `Tudo revisado`, `Ver meu Radar`, `Salvar e ver próxima`.
- [ ] Verify RED.
- [ ] Reorder empty Home hierarchy: Free import first, Open Finance second, Demo Pro third.
- [ ] Replace feature-first data Home with a `JourneyCard` driven by `JourneyStage`, while retaining compact metrics and existing secondary destinations.
- [ ] Make Inbox header decision-oriented and add completion handoff to Radar.
- [ ] Change category save behavior: after save, select next unresolved/review item; on last item return to Inbox completion state. Preserve rule-limit behavior.
- [ ] Mark Radar as seen only in React session state when user enters Radar.
- [ ] Add contextual upgrade sheet/card that calls existing `openSubscriptionExperience` only after user chooses `Conhecer Pro`.
- [ ] Add DemoProgress only in Demo Pro and infer progress from actions/navigation; keep real-user storage untouched.
- [ ] Run contract tests + full test suite.

### Task 4: Radar contextual handoff

**Files:**
- Modify: `src/features/radar/RadarPage.tsx`
- Create: `src/features/radar/radarJourney.test.ts`

**Interfaces:**
- Existing inputs/calculations unchanged.
- Adds calm context copy from existing `insight`; `onOpenPlan` remains the planning handoff.

- [ ] Write source-contract tests for risk copy, healthy copy, and planning CTA `Organizar meu plano`.
- [ ] Verify RED.
- [ ] Add contextual summary without changing chart/insight calculation.
- [ ] Keep `Fique de olho` behavior and Pro gating intact.
- [ ] Run targeted tests.

### Task 5: Planner progressive disclosure

**Files:**
- Modify: `src/features/planner/PlannerPage.tsx`
- Create: `src/features/planner/plannerDisclosure.test.ts`

**Interfaces:**
- Existing planning state, AI calls, scenario engine and market research unchanged.
- Advanced groups use native `<details>`/`<summary>` disclosure to avoid a new dependency.

- [ ] Write source-contract tests for dominant prompt `O que você quer que seu dinheiro permita?` and labels `Organizar orçamento`, `Comparar cenários`, `Pesquisar ativo/caminho`, `Simular`.
- [ ] Verify RED.
- [ ] Keep conversation + compact health snapshot first.
- [ ] Keep `Seu plano` visible as the second level.
- [ ] Move buckets, allocation scenarios, market research and simulation into clearly labeled progressive-disclosure sections while preserving all existing controls and disclaimers.
- [ ] Run targeted tests and full suite.

### Task 6: Phase 3 responsive/demo polish

**Files:**
- Create: `src/journey.css`
- Modify: `src/main.tsx`
- Create: `src/journey/polishContract.test.ts`

**Interfaces:**
- CSS only; no product logic.
- Import order: existing feature CSS → `journey.css` → `motion-kit.css`.

- [ ] Write failing source tests requiring `journey.css` import before MotionKit, mobile breakpoints, `env(safe-area-inset-bottom)`, responsive dialog, demo progress and disclosure styles, and `prefers-reduced-motion` compatibility.
- [ ] Verify RED.
- [ ] Implement polished journey/demo layer: stronger action hierarchy, compact judge progress, touch-safe minimum targets, responsive Home/Inbox/Radar/Planner spacing, sticky-safe bottom navigation padding, contextual upgrade surface, native details styling.
- [ ] Preserve existing visual tokens and MotionKit interaction behavior.
- [ ] Run targeted tests.

### Task 7: Verification, review and Cloudflare integration

**Files:**
- No product-file changes unless verification exposes a defect.

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `npx wrangler deploy --dry-run`.
- [ ] Run `npx wrangler deploy --assets=./dist --name=hackathon --dry-run`.
- [ ] Inspect PR diff for accidental changes to `worker/`, `server/`, finance engines, subscription access, or persistence schema.
- [ ] Create PR to `main`; require branch CI and Mobile CI green.
- [ ] Merge only after verification is green.
- [ ] Verify push-to-main CI, Mobile CI and Cloudflare `Workers Builds: hackathon` all conclude `success`.

## Self-review

- Spec coverage: Home hierarchy, Inbox queue/continuation, Radar handoff, Planner disclosure, contextual Pro, Demo progress, unchanged bottom nav and unchanged engines are each mapped to a task.
- Phase 3 scope is limited to states/responsiveness/consistency and does not add features or dependencies.
- Journey state remains derived/session-only; no duplicate persisted source of truth is introduced.
- Contextual upgrade does not duplicate entitlement state and delegates to the existing RevenueCat path.
