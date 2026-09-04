# Radar B+ + Financial Plan — Design Spec

Date: 2026-09-04
Status: approved direction, pending implementation

## Goal

Refactor the current monolithic Radar experience into a feature-oriented B+ architecture that preserves the current dark navy/glass visual language, introduces the approved calmer Radar design, and adds two dedicated flows:

1. `Fique de olho` — short-term/tactical cash-flow attention.
2. `Por que isso acontece / Seu plano financeiro` — structural financial diagnosis and organization plan.

The product must feel proactive and in control rather than alarming.

## Product principles

- Deterministic calculations remain the source of truth.
- Gemini explains and organizes facts; it never invents balances, transactions, percentages or projections.
- Red/coral primarily means a negative amount, not a panic state.
- Amber means “pay attention / monitor”.
- Green/teal means brand, healthy state and forward motion.
- Blue remains informational.
- Purple/indigo remains AI/assistance.
- Existing colors outside the Radar experience should not change unless required for semantic consistency.
- Demo Pro remains synthetic and must never create a real RevenueCat entitlement.

## Budget reference model

Use the 50/30/20 framework as an educational reference, not a hard universal diagnosis:

- Essentials / needs: reference up to 50% of net income.
- Flexible / wants: reference up to 30%.
- Future: target at least 20% for emergency reserve, investments, extra debt reduction and long-term goals.

Important wording rule: show these as `referência`, `faixa sugerida`, or `meta`, never as an absolute medical/legal-style prescription.

The current product taxonomy must map existing transaction categories into three budget groups:

### Essentials
Housing, utilities, groceries, health, transport required for work/life, taxes, minimum debt obligations, payroll/personnel, essential suppliers/services.

### Flexible
Dining out, convenience, subscriptions, gym, leisure-like discretionary purchases, nonessential shopping, other discretionary spending.

### Future
Emergency reserve, investments, retirement contributions, goal savings and extra debt payments. Current transaction data may not yet contain explicit investment transactions; the engine must support the group even when current share is 0%.

The mapping must be centralized and testable, not duplicated inside UI components.

## B+ frontend architecture

Do not add React Router in this phase. Keep the current app shell but move Radar functionality into feature modules and use a small internal screen stack/state.

Proposed structure:

```text
src/
  app/
    navigation.ts

  features/
    radar/
      RadarPage.tsx
      WatchPage.tsx
      FinancialPlanPage.tsx
      radar.css
      components/
        RadarMotion.tsx
        CashPulse.tsx
        WatchCard.tsx
        BudgetDistribution.tsx
        RecurringEvents.tsx
        ForecastEvents.tsx

  core/
    financeEngine.ts
    radarInsight.ts
    budgetHealth.ts
    budgetTaxonomy.ts

  integrations/
    ai.ts
    pluggy.ts
    subscriptionBridge.ts
```

`src/App.tsx` remains the shell and owner of persisted/demo transaction state in this phase, but Radar rendering and related page logic move out of it.

## Internal navigation

Extend the current tab-based state with Radar sub-screens:

```text
radar-home
watch
financial-plan
```

Rules:

- Bottom navigation remains visible on `radar-home`.
- `WatchPage` and `FinancialPlanPage` render a back action to Radar.
- No browser URL routing dependency is required now.
- Demo mode can enter the same screens with synthetic data.

## Page map and required changes

### Today
Small change only.

- Keep current visual direction.
- Any Radar preview language must use calmer `Fique de olho` semantics.
- Do not expose “minimum projected balance” as an independent alarm card.

### Inbox
Small internal change.

- Existing category behavior remains.
- Every category gets a deterministic budget group mapping for budget-health calculations.

### Transaction detail
Small change.

- Keep category editing and Gemini category suggestion.
- Optionally show the derived budget group subtly if useful.

### Radar home — major redesign

Implement the approved visual model.

#### Header motion
The Radar brand icon becomes a true motion component:

- slow sweep around concentric rings;
- faint breathing rings;
- small scan points with low opacity;
- cycle around 6–10 seconds;
- CSS/SVG implementation preferred to reduce dependency risk;
- `prefers-reduced-motion` must fall back to a static icon.

#### Summary card
Remove `Menor saldo previsto` as an independent column.

Show only:

- `Saldo atual`
- `Fique de olho`

The `Fique de olho` summary should use calm language, e.g.:

- `Em 11 dias`
- `Há um ponto que merece atenção`
- `Ver detalhes`

Do not show the full negative minimum balance on the Radar home unless needed for accessibility/context; the detailed value belongs to WatchPage.

#### Cash-flow chart motion
Keep deterministic graph geometry unchanged.

Motion:

- a low-intensity light highlight travels along the SVG path;
- no geometry movement;
- zero-crossing marker can breathe gently;
- no flashing red;
- line transitions visually green/teal to coral when negative;
- reduced-motion disables traveling light and pulse.

#### Recurring + forecast events
Keep the current product functionality and information, but restyle to match the approved reference only where needed.

#### `Por que isso acontece` home teaser
This is educational, not an alert wall.

Show three compact cards:

1. `Essenciais` — `Referência: até 50%` — `Hoje: X%`
2. `Flexíveis` — `Referência: até 30%` — `Hoje: X%`
3. `Futuro` — `Meta: ≥20%` — `Hoje: X%`

Use a small cue: `Toque para entender melhor`.

No `Alto impacto / Médio impacto / Baixo impacto` badges on the Radar home.

### WatchPage — new

Purpose: explain short-term cash-flow attention.

Header:

- title `Fique de olho`
- date/time-to-event
- minimum projected balance
- selected risk/attention date

Content:

- enlarged chart focused on the attention date;
- projected minimum balance;
- first below-zero date if any;
- ending balance;
- top deterministic cash drivers;
- recurring events that contribute to the period;
- income timing relevant to the risk window;
- `Despesas fixas altas` can appear here when supported by real calculated share/data;
- suggestions must distinguish deterministic facts from AI explanation.

Tone: monitor, understand, act — never panic.

### FinancialPlanPage — new

Purpose: explain structural distribution and build an organization plan.

#### Section 1 — current distribution

Show actual percentages computed from categorized transactions and income:

- Essentials X%
- Flexible Y%
- Future Z%

Show comparison with the educational 50/30/20 reference.

Example copy:

`Sua maior diferença hoje está nos essenciais: 76%, contra uma referência de até 50%.`

#### Section 2 — explanation

Deterministic facts first:

- largest essential categories;
- largest flexible categories;
- recurring commitments;
- current future/savings share if detectable.

Then optional Gemini explanation.

#### Section 3 — organization plan

Create plan buckets:

- Essentials
- Flexible
- Emergency reserve
- Retirement
- Investments / long-term goals
- Extra debt reduction when applicable

Do not hard-code a universal retirement percentage as truth.

For emergency reserve, allow an explicit target measured in months of essential expenses. Default product guidance may suggest a common 3–6 month target but must be labeled as a reference and user-adjustable.

Retirement guidance must be personalized later from age/current assets/target retirement age. In this phase, the screen can explain that the retirement target depends on profile and should not pretend a universal fixed percentage is correct.

#### Section 4 — AI plan

Gemini receives only bounded deterministic facts such as:

```json
{
  "essentialPercent": 76,
  "flexiblePercent": 14,
  "futurePercent": 10,
  "reference": {"essentialMax": 50, "flexibleMax": 30, "futureMin": 20},
  "topEssentialCategories": [],
  "topFlexibleCategories": [],
  "emergencyMonths": 1.8,
  "emergencyTargetMonths": 6
}
```

Gemini may:

- explain the biggest gap;
- prioritize actions;
- create a concise staged organization plan;
- explain tradeoffs.

Gemini may not:

- calculate balances;
- recalculate transaction grouping;
- claim financial certainty;
- overwrite deterministic facts;
- automatically change user categories/rules.

## Budget-health engine

Add deterministic modules:

### `budgetTaxonomy.ts`

- central category → group mapping;
- unknown categories resolve conservatively and explicitly;
- tested.

### `budgetHealth.ts`

Inputs:

- transactions;
- recognized income;
- category mapping.

Outputs:

- net income basis used;
- essential amount/percent;
- flexible amount/percent;
- future amount/percent;
- uncategorized amount/percent;
- top categories per group;
- comparison gaps to reference.

Rules:

- Do not silently treat unknown/unresolved transactions as a known budget group.
- If income basis is missing/zero, show `dados insuficientes` rather than fake percentages.
- Demo data must produce a stable meaningful distribution for juror presentation.

## AI integration

Keep existing Radar explanation endpoint behavior intact.

Add one dedicated bounded endpoint/contract for financial-plan explanation rather than overloading the current Radar explanation payload.

Suggested route:

`POST /api/ai/financial-plan`

Input is the bounded deterministic summary only, not raw statement history.

Output should be structured JSON, for example:

```json
{
  "summary": "...",
  "mainGap": "...",
  "actions": [
    {"priority": 1, "title": "...", "reason": "..."}
  ]
}
```

All fields and lengths must be validated server-side.

Missing Gemini key continues to produce controlled fallback; the deterministic plan screen must still work without AI.

## Free / Pro behavior

Keep current product policy unless explicitly changed later:

### Free

- import statements;
- Inbox/manual review;
- up to 3 active rules;
- Radar preview up to 7 days;
- basic budget distribution teaser / 50-30-20 educational comparison.

### Pro

- Open Finance;
- full 30-day Radar;
- WatchPage full detail;
- unlimited rules;
- advanced recurrence/risk drivers;
- FinancialPlanPage personalized deterministic analysis;
- Gemini explanation and staged plan when configured.

### Demo Pro

- same visual/data access as Pro using synthetic data;
- no RevenueCat entitlement mutation;
- no OneSignal plan mutation.

## Color direction

Do not recolor unaffected app surfaces.

Semantic additions on top of current palette:

- brand/radar: current green/teal;
- healthy/current positive: green;
- informational: existing blue;
- AI: current purple/indigo;
- `Fique de olho`: muted amber/gold;
- negative monetary values: coral/red;
- cards/backgrounds: existing navy/glass system.

Avoid full-card urgent red surfaces on Radar home.

## Motion and accessibility

- SVG/CSS first; avoid a heavy motion dependency unless implementation proves necessary.
- Radar icon sweep and chart traveling light should use GPU-friendly transforms/stroke effects where possible.
- Motion must not change financial data geometry.
- Implement `prefers-reduced-motion` fallback.
- Maintain readable contrast and keyboard/touch access for actionable cards.

## Demo / hackathon story

The Demo Pro should support a sub-2-minute narrative:

1. Open Demo Pro.
2. Radar shows calm 30-day projection.
3. `Fique de olho` reveals the exact future low point and what causes it.
4. Return and open `Por que isso acontece`.
5. See current distribution vs 50/30/20 reference.
6. Gemini explains the biggest gap and builds a staged organization plan.
7. Close on proactive control rather than fear.

## Testing

Add/extend tests for:

- category → budget group mapping;
- percentages and insufficient-income behavior;
- reference-gap calculation;
- Demo Pro stable budget distribution;
- internal Radar sub-navigation helpers if extracted;
- Free/Pro screen access decisions;
- AI financial-plan request/output validation;
- reduced-motion class/behavior at component logic level where practical;
- existing web and mobile CI must remain green.

## Non-goals for this phase

- React Router migration.
- Full app-wide visual redesign.
- User-auth/profile storage redesign.
- A universal retirement percentage presented as fact.
- Investment portfolio recommendation or security selection.
- Automatic financial actions.

## Success criteria

The phase is successful when:

- `src/App.tsx` is materially smaller and Radar-specific UI is feature modularized;
- the Radar home matches the approved calmer visual direction;
- minimum balance is no longer a standalone top-level alarm card;
- `Fique de olho` opens a dedicated detail screen;
- `Por que isso acontece` is educational on home and opens a detailed financial-plan screen;
- 50/30/20 percentages are calculated deterministically from mapped transaction data;
- Gemini enhances explanation/planning without becoming source of truth;
- Demo Pro demonstrates the full flow;
- CI and Mobile CI pass on the final branch head.