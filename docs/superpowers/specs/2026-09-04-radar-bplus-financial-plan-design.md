# Radar B+ + Conversational Financial Planner — Design Spec

Date: 2026-09-04
Status: approved direction, implementation authorized

## Goal

Evolve Where's the Money from a transaction/Radar tool into one continuous financial-planning experience:

1. understand where the money goes;
2. project what happens next;
3. explain the current financial structure;
4. conduct a focused planning conversation;
5. capture goals, constraints and user-confirmed adjustments during that conversation;
6. calculate competing scenarios deterministically;
7. use AI to research current market conditions and explain results;
8. keep Radar, plan and goals updated from the same data.

The user must experience one product, not separate "car", "retirement", "travel" or "investment" apps.

## Core product principle: conversation first

After Open Finance/import and the initial deterministic analysis, planning starts as a guided conversation. The user should be able to say naturally:

> Quero organizar minha vida para sobrar dinheiro, me aposentar aos 60, trocar de carro em dois anos e viajar.

The planner then asks only for missing information, one useful question at a time, while using data already known from transactions/accounts.

The conversation is bounded to financial planning. It must not behave as an open-ended general chatbot.

### Planning session stages

Internal stages:

1. `snapshot` — explain current income/spending structure;
2. `goals` — discover goals/dreams;
3. `constraints` — dates, values, assets already owned, priorities;
4. `adjustments` — identify spending the user agrees can change;
5. `funding` — decide how available monthly capacity is allocated;
6. `market-context` — research a product/asset/financing option the user names;
7. `scenarios` — calculate alternatives and trade-offs;
8. `confirm` — present the proposed plan and ask for explicit confirmation;
9. `active-plan` — keep plan linked to Radar and new transactions.

The UI may look conversational, but the state machine and deterministic engines remain explicit/testable.

## Confirmation rule

AI may extract candidate facts from conversation, but ambiguous information must not be committed silently.

Example:

- User: `Acho que consigo gastar menos em restaurante.`
- Planner: `Sua média atual é R$780. Quer definir R$500, R$600 ou outro limite?`
- Only after user confirms a numeric limit is the plan updated.

Confirmed facts become structured plan data; chat text itself is not the source of truth.

## Unified data model

Planning remains generic. "Car", "trip", "retirement" etc. are instances, not separate product areas.

### Goal

```ts
type Goal = {
  id: string;
  title: string;
  kind: 'purchase'|'travel'|'retirement'|'reserve'|'debt'|'education'|'business'|'custom';
  targetAmount?: number; // cents
  targetDate?: string;
  currentAmount?: number;
  monthlyContribution?: number;
  priority: 1|2|3;
  notes?: string;
  status: 'draft'|'confirmed'|'active'|'paused'|'completed';
};
```

### Budget plan

50/30/20 is only a starter/reference. Users may edit percentages and add categories/subcategories.

```ts
type PlanBucket = {
  id: string;
  label: string;
  group: 'essential'|'flexible'|'future'|'custom';
  targetPercent?: number;
  targetAmount?: number;
  parentId?: string;
  userDefined: boolean;
};
```

Rules:

- reference starter: essentials ≤50%, flexible ≤30%, future ≥20%;
- label as reference, not universal truth;
- user can change percentages;
- user can add/rename/remove their own buckets;
- planned percentage totals should be validated and explained, not silently normalized;
- retirement does not use one universal hard-coded percentage.

## Budget-health engine

Add deterministic `budgetTaxonomy.ts` + `budgetHealth.ts`.

Outputs include:

- net income basis;
- essential/flexible/future/uncategorized amounts and percentages;
- top categories;
- recurring commitments;
- reference gaps;
- insufficient-data state.

Unknown/unresolved transactions must remain unknown instead of being forced into a bucket.

## Radar B+

The approved visual direction remains.

### Radar home

- keep current navy/glass/teal palette where possible;
- radar icon becomes a slow SVG/CSS motion with sweep + breathing rings;
- chart geometry never moves, but a low-intensity light travels along its SVG path;
- red/coral denotes negative monetary territory, not panic;
- amber denotes `Fique de olho`;
- remove `Menor saldo previsto` as an independent top-level alarm;
- summary shows `Saldo atual` + calm `Fique de olho` card;
- `Fique de olho` opens a dedicated detail screen;
- `Por que isso acontece` on home is an educational teaser (distribution/reference), not an alert wall.

### WatchPage — `Fique de olho`

Contains the detail intentionally hidden from the Radar home:

- minimum projected balance;
- date/first below-zero point when applicable;
- ending balance;
- top deterministic drivers;
- recurring commitments and income timing;
- structural facts such as high essential share when supported by actual data;
- calm language: monitor → understand → act.

### Financial explanation / plan entry

`Por que isso acontece` opens the planning experience, showing the deterministic distribution first and then continuing into conversation.

## Conversational Planner UI

Add one primary bottom-navigation destination: `Planejar`.

The page contains:

1. current financial snapshot;
2. conversation thread;
3. suggested quick replies/actions when helpful;
4. structured chips/cards for facts awaiting confirmation;
5. live `Seu plano` summary derived from confirmed structured state;
6. goals/progress as optional detail cards, not as mandatory navigation flows.

Users do not need to open "Carro" to plan a car. They describe the objective in conversation; goal cards are generated as summaries afterward.

## Scenario Engine

`scenarioEngine.ts` is deterministic and must own all numeric projections.

Supported generic scenarios in this phase:

- monthly accumulation with initial contribution;
- alternative annual return assumptions;
- financing installment/cost calculation from principal, down payment, term and rate;
- goal feasibility from available monthly capacity;
- allocation of monthly capacity across multiple goals;
- trade-off calculation when one allocation delays another goal.

AI never produces the authoritative numeric result.

### Competing goals

The engine must be able to compare allocations of the same monthly available capacity across multiple goals.

Example output:

- `car-focused`;
- `balanced`;
- `future-focused`.

Each scenario returns machine-readable effects such as target-date shift and monthly allocation.

## AI responsibilities

AI has two permitted roles.

### 1. Planning conversation

AI may:

- interpret user intent;
- identify missing fields;
- propose the next bounded question;
- extract candidate goal/constraint/adjustment facts;
- explain deterministic calculations;
- summarize trade-offs.

AI may not silently commit ambiguous values or overwrite deterministic data.

### 2. Market research

When the user names a market item — e.g. `Itaúsa`, `ITSA4`, `Bitcoin`, `Tesouro IPCA`, a financing type, a consortium or another asset/product — Gemini is responsible for simplifying discovery.

The server-side Gemini call should use Google Search grounding when configured, so it can identify the entity and retrieve current/reference information with citations.

Google's current Gemini Interactions API supports `tools: [{"type":"google_search"}]` and returns URL citations/steps. The app must retain source URL/title/fetched time for material research claims.

Market research may collect, where applicable:

- entity/ticker/class/exchange/currency;
- current/reference price or rate;
- available history length;
- historical returns by period;
- dividend history/yield where relevant;
- volatility and maximum drawdown where data is available;
- market cap/liquidity/fundamental context where relevant;
- financing average/reference rates;
- product fees/rates/terms;
- source citations + timestamps.

The research result is input data/context for the deterministic Scenario Engine.

## Asset-context presentation

Do not label assets simply `safe`/`unsafe` or recommend buying/selling.

Use factual context cards instead, such as:

- historical data available: X years;
- observed volatility: X;
- maximum historical drawdown: X;
- dividend history: X/Y years;
- company/listing age;
- liquidity/market-size context;
- important data limitations.

Never invent a generic "probability the company survives until your retirement" unless a defensible dataset/methodology explicitly exists.

## Investment disclaimer boundary

Every asset/investment simulation must visibly state a concise equivalent of:

> Simulação informativa, não previsão. Não constitui recomendação de investimento, oferta ou indicação de compra/venda. Retornos passados não garantem resultados futuros.

The product may compare user-selected assets/products and conditions. It must not rank or prescribe securities as the best investment for the user.

## AI/Worker endpoints

Keep existing Radar/category endpoints intact.

Add bounded routes:

- `POST /api/ai/planner-turn`
- `POST /api/ai/market-research`

### planner-turn

Input contains a bounded structured snapshot + current planning stage + recent relevant messages, not raw complete bank history.

Output:

```json
{
  "reply": "...",
  "nextStage": "goals",
  "candidateFacts": [],
  "quickReplies": []
}
```

### market-research

Input:

```json
{"query":"ITSA4","purpose":"retirement simulation"}
```

Output includes normalized entity/context, data points and citations. The Worker uses Gemini + Google Search grounding when GEMINI_API_KEY exists.

Missing key must return controlled `AI_NOT_CONFIGURED`; deterministic planner remains usable.

## Persistence

Extend local saved state in a backward-compatible way:

```ts
type Saved = {
  txs: Tx[];
  rules: Rule[];
  accounts: BankAccount[];
  planning?: PlanningState;
};
```

Demo Pro uses synthetic planning data and never modifies real plan state.

## Free / Pro

### Free

- statement import;
- Inbox/manual categories;
- up to 3 active rules;
- 7-day Radar preview;
- basic budget distribution/reference;
- limited planning preview / goal capture without full AI/market research.

### Pro

- Open Finance;
- 30-day Radar + WatchPage;
- full conversational planner;
- deterministic scenario comparisons;
- Gemini planning explanations when configured;
- grounded market research when configured;
- unlimited rules.

### Demo Pro

Full visual/product experience with synthetic financial data. Never creates a RevenueCat entitlement or changes OneSignal plan tagging.

## Proposed frontend organization

```text
src/
  app/
    navigation.ts
  features/
    radar/
      RadarPage.tsx
      WatchPage.tsx
      RadarMotion.tsx
      radar.css
    planner/
      PlannerPage.tsx
      planningEngine.ts
      scenarioEngine.ts
      plannerTypes.ts
      planner.css
  core/
    financeEngine.ts
    radarInsight.ts
    budgetTaxonomy.ts
    budgetHealth.ts
  integrations/
    ai.ts
    pluggy.ts
    subscriptionBridge.ts
```

`src/App.tsx` remains shell/state composition but loses feature-specific Radar/Planner markup.

## Accessibility and motion

- use SVG/CSS motion first;
- `prefers-reduced-motion` disables radar sweep, chart traveling light and pulsing marker;
- no flashing urgent-red effects;
- cards that open detail pages must be keyboard/touch accessible;
- chart financial geometry remains deterministic/static.

## Hackathon story

A sub-2-minute demo should be possible as one continuous story:

1. Open Demo Pro / connect data.
2. Show the calmer Radar + moving light.
3. Open `Fique de olho` to see what causes a future low point.
4. Open `Planejar`.
5. User says they want retirement + car + trip.
6. Planner uses current spending and asks one or two missing questions.
7. Show confirmed adjustments and available monthly capacity.
8. Show balanced scenarios/trade-offs.
9. User types a market item such as `ITSA4`/`Bitcoin`; AI research returns sourced context; Scenario Engine shows hypothetical values.
10. Close on a living plan that updates as financial reality changes.

## Non-goals for this implementation

- brokerage/exchange order execution;
- automatic transfers/investments;
- personalized buy/sell recommendations;
- bank-grade auth/profile redesign;
- React Router migration;
- pretending a single retirement percentage or return assumption is universal;
- silently changing the user's plan from AI interpretation.

## Success criteria

- one unified planning conversation is the primary way to define goals and adjustments;
- user does not need separate app-like goal flows;
- structured plan state is populated from confirmed conversational facts;
- budget reference is editable/extensible;
- deterministic scenario calculations cover accumulation, financing and competing-goal allocation;
- AI market research can use grounded Google Search and returns citations when configured;
- asset simulations show a non-recommendation disclaimer;
- Radar home uses the approved calmer B+ hierarchy;
- `Fique de olho` owns minimum-balance/drivers detail;
- `Por que isso acontece` is educational and leads into planning;
- Demo Pro demonstrates the integrated journey;
- existing Web/Mobile CI remains green.