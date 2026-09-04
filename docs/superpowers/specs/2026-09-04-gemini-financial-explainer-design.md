# Gemini Financial Explainer — Design

## Context

Where's the Money already has a deterministic financial engine that categorizes obvious transactions, learns recurring patterns, and builds a 30-day cash projection. The hackathon direction keeps that engine as the source of truth and adds Gemini only as an explanation and ambiguity-assistance layer.

This work follows the already-approved sequence on branch `feat/demo-radar-gemini`:

1. Demo Mode with synthetic, deterministic data.
2. Radar hero redesign and deterministic risk summary.
3. Gemini explanation and ambiguity assistance.
4. RevenueCat Free/Pro work in a later task.

## Goals

- Make the Radar easier to understand without allowing AI to alter financial facts.
- Use Gemini to explain deterministic outputs in concise language.
- Use Gemini to suggest a category only when the deterministic engine is genuinely ambiguous.
- Keep all Gemini credentials server-side in the Cloudflare Worker.
- Minimize the financial data sent to Gemini.
- Degrade gracefully when Gemini is unavailable or unconfigured.

## Non-goals

Gemini must not:

- calculate balances or the 30-day projection;
- create, delete, or modify transactions;
- invent recurring patterns;
- automatically confirm a category;
- replace `applyPatternIntelligence()` or `buildRadar()`;
- receive Pluggy secrets, account identifiers, tokens, CPF, or other unnecessary banking identifiers;
- become a hard dependency for the app, demo mode, or Radar.

## Architecture

The data flow is:

```text
Pluggy / statement import
        ↓
Deterministic finance engine
        ↓
Structured facts: projection, drivers, recurring patterns, ambiguous transaction
        ↓
Cloudflare Worker
        ↓
Gemini API
        ↓
Validated structured response
        ↓
UI explanation / suggestion
```

The browser and Expo shell never receive `GEMINI_API_KEY`. The Worker reads the secret from its environment.

## Worker API

### `POST /api/ai/explain`

Purpose: explain a deterministic Radar state.

Request shape:

```json
{
  "startingBalance": 320000,
  "minimumBalance": -18500,
  "minimumDate": "2026-09-14",
  "endingBalance": 94000,
  "drivers": [
    {
      "label": "Fatura cartão",
      "category": "Cartão de crédito",
      "delta": -148000,
      "date": "2026-09-12",
      "confidence": 96
    }
  ]
}
```

All money values use integer cents, matching the finance engine.

The client sends only the facts needed to explain the current Radar result. It does not send the complete transaction history.

Response shape:

```json
{
  "summary": "Seu caixa entra no vermelho porque três saídas relevantes se concentram antes do próximo recebimento.",
  "primaryReason": "A fatura do cartão é o maior impacto do período.",
  "actions": [
    "Revise a fatura prevista para 12 set.",
    "Considere reduzir gastos variáveis antes de 14 set."
  ]
}
```

The UI labels this content explicitly as an AI explanation of deterministic data.

### `POST /api/ai/categorize`

Purpose: offer a suggestion for a transaction that remains unresolved or needs review.

Request shape:

```json
{
  "description": "PAGAMENTO XPTO 4281",
  "counterparty": "XPTO",
  "direction": "debit",
  "providerCategory": ""
}
```

Response shape:

```json
{
  "suggestedCategory": "Alimentação",
  "confidence": 72,
  "reason": "A descrição é semelhante a estabelecimentos de alimentação, mas não há evidência suficiente para confirmar automaticamente.",
  "needsConfirmation": true
}
```

The suggestion never writes directly to transaction state. The user must confirm it through the existing category flow.

## Model contract

The Worker will use a current Gemini model that supports structured JSON output. The model name must be centralized in one server-side constant so it can be changed without touching UI code.

Prompts will contain three hard constraints:

1. Treat supplied numeric facts as authoritative and never recalculate or alter them.
2. Do not infer facts that are not in the payload.
3. Return only the declared JSON structure.

The Worker validates the response before returning it to the browser. Invalid JSON, missing required fields, or values outside expected ranges are treated as an AI failure rather than displayed directly.

## Data minimization and privacy

`/api/ai/explain` receives only:

- starting balance;
- minimum projected balance and date;
- ending projected balance;
- a limited list of the strongest deterministic drivers;
- recurrence confidence when relevant.

`/api/ai/categorize` receives only:

- normalized description;
- normalized counterparty;
- credit/debit direction;
- provider category when available.

The Worker must reject unexpectedly large payloads. No Pluggy token, API credential, bank account ID, account number, CPF, or complete statement is intentionally sent to Gemini.

## Radar integration

The Radar hero remains useful without AI. Its primary message is computed locally from deterministic projection data, for example:

- `Se nada mudar, seu caixa entra no vermelho em 9 dias.`
- `Seu caixa permanece positivo nos próximos 30 dias.`

Below the deterministic `Por que isso acontece` block, the UI exposes `Explicar com IA`.

When tapped:

- loading state stays inside the explanation card;
- deterministic chart and drivers remain visible and interactive;
- a successful response appears beneath an `Explicação por IA` label;
- a failed response shows a short retryable state without removing deterministic information.

Demo Mode can call the same endpoint when Gemini is configured. If Gemini is not configured, the demo remains fully functional and the button reports that AI explanation is unavailable in the current environment.

## Ambiguous category integration

The category detail screen should offer `Sugerir com IA` only when the transaction is `unresolved` or `needs_review`.

A Gemini suggestion is visually separate from deterministic category evidence and always requires user confirmation. Confirming it uses the existing manual-save path, keeping `categorySource` as `manual`; Gemini is advisory, not a new automatic source of truth.

## Error handling

Worker responses use stable error classes:

- `503 AI_NOT_CONFIGURED` when `GEMINI_API_KEY` is absent;
- `400 INVALID_AI_REQUEST` for malformed or oversized client input;
- `502 AI_UPSTREAM_ERROR` when Gemini is unavailable;
- `502 AI_INVALID_RESPONSE` when the model response fails schema validation.

No upstream Gemini error body or secret-bearing diagnostic is returned to the client.

The UI treats all AI errors as optional-feature failures and leaves the rest of the app untouched.

## Security

- `GEMINI_API_KEY` is a Cloudflare Worker secret and is never committed.
- No `VITE_*`, `EXPO_PUBLIC_*`, or client-visible Gemini secret is introduced.
- API inputs are validated and bounded before calling Gemini.
- Gemini output is treated as untrusted data and schema-validated before rendering.
- AI text is rendered as plain text, not injected HTML.

## Testing strategy

### Finance/UI contract tests

- deterministic Radar risk summary produces a negative-cash warning when projection crosses zero;
- positive projection produces a positive 30-day message;
- demo dataset generates stable recurring patterns and at least one reviewable transaction;
- Gemini category suggestion cannot automatically mutate transaction category state.

### Worker tests

- missing `GEMINI_API_KEY` returns `AI_NOT_CONFIGURED`;
- invalid request payloads are rejected before any upstream call;
- explain payload omits complete transaction history and sensitive identifiers;
- valid upstream structured response is normalized to the public API contract;
- malformed Gemini response returns `AI_INVALID_RESPONSE`;
- upstream failure returns `AI_UPSTREAM_ERROR` without leaking upstream content.

### Regression validation

Existing web tests, TypeScript build, Worker dry-run, and mobile CI must remain green before the branch is merged.

## Deployment and configuration

The only new private runtime configuration is:

```text
GEMINI_API_KEY
```

Without that secret, web, Pluggy, statement import, Inbox, Demo Mode, deterministic categorization, recurring detection, and Radar continue to work.

The secret will be added to the Cloudflare Worker only after code review and CI pass. No Gemini configuration is required for the existing EAS development build because requests originate from the loaded web app and are proxied by the Worker.

## Success criteria

The implementation is complete when:

1. Demo Mode and Radar work with Gemini disabled.
2. Radar produces a deterministic risk headline and driver explanation before AI is invoked.
3. `Explicar com IA` returns a concise explanation based only on supplied Radar facts.
4. An unresolved transaction can request a Gemini category suggestion, but nothing is saved until the user confirms.
5. `GEMINI_API_KEY` never appears in client bundles or committed files.
6. Invalid or unavailable Gemini responses cannot break the financial flows.
7. Full web/Worker/mobile CI remains green.
