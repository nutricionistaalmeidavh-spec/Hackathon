# Hackathon Final Steps 1–2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** estabilizar a versão do hackathon e tornar a Demo Pro repetível, previsível e segura para gravação/julgamento.

**Architecture:** manter os motores e integrações existentes intactos. As mudanças ficam em helpers/componentes de apresentação, tratamento de erro na borda de importação e dataset sintético da Demo. O `App.tsx` apenas orquestra esses helpers e um reset de Demo que não toca no snapshot real.

**Tech Stack:** React 19, TypeScript, Vitest, Vite, Expo 57, Cloudflare Workers.

**Spec:** `docs/superpowers/specs/2026-09-04-hackathon-final-steps-1-2-design.md`

## Global Constraints

- Sem alterações em `worker/`, `server/`, motores financeiros, Gemini, Pluggy, RevenueCat ou persistência.
- RevenueCat continua única fonte de verdade do Pro real.
- Demo permanece sintética e isolada de `wtm-portable`.
- Android/simulador é a única plataforma nativa de validação desta etapa; sem iPhone.
- Sem publicação nativa; Cloudflare segue como único deploy web.
- TDD obrigatório para toda mudança de comportamento.

---

### Task 1: Feedback e importação resiliente

**Files:**
- Create: `src/stability/feedback.ts`
- Create: `src/stability/feedback.test.ts`
- Create: `src/stability/FeedbackToast.tsx`
- Create: `src/stability/FeedbackToast.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/journey.css`

**Interfaces:**
- Produces: `classifyFeedback(message: string): 'success' | 'error' | 'info'`
- Produces: `<FeedbackToast message onClose />`

- [ ] Escrever testes que classifiquem mensagens de sucesso, erro/cancelamento e progresso/informação.
- [ ] Rodar `npm test` e confirmar falha porque o módulo/componente ainda não existe.
- [ ] Implementar `feedback.ts` e `FeedbackToast.tsx` com ícone/ARIA coerentes.
- [ ] Substituir o toast hard-coded de `App.tsx` por `FeedbackToast`.
- [ ] Adicionar `catch` em `importFiles` com mensagem amigável sem alterar dados existentes.
- [ ] Rodar `npm test` e confirmar verde.

### Task 2: Modal Pro acessível

**Files:**
- Modify: `src/journey/ContextualUpgrade.tsx`
- Modify: `src/journey/journeyComponents.test.tsx`

**Interfaces:**
- Mantém a API atual de `ContextualUpgrade`.

- [ ] Adicionar teste para foco inicial e fechamento por Escape.
- [ ] Rodar `npm test` e confirmar falha.
- [ ] Implementar `autoFocus` no fechamento e `onKeyDown` para Escape no diálogo.
- [ ] Rodar `npm test` e confirmar verde.

### Task 3: Dataset Demo determinístico

**Files:**
- Modify: `src/demo/demoData.test.ts`
- Modify: `src/demo/demoData.ts`

**Interfaces:**
- Mantém `createDemoState(): DemoState`.

- [ ] Endurecer o teste para exigir exatamente duas pendências após `applyPatternIntelligence`.
- [ ] Confirmar RED no CI/teste.
- [ ] Adicionar uma segunda movimentação sintética ambígua e preservar Radar/recorrências/plano.
- [ ] Confirmar GREEN.

### Task 4: Reset seguro da Demo

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/journey/DemoProgress.tsx`
- Modify: `src/journey/journeyComponents.test.tsx`
- Create: `src/journey/demoResetContract.test.ts`

**Interfaces:**
- `DemoProgress` ganha `onRestart?: () => void`.
- `App` ganha `resetDemo()` que reaplica somente dados sintéticos e estados de sessão, sem escrever em `realStateRef.current`.

- [ ] Escrever testes/contrato exigindo botão `Reiniciar demo` e separação entre `enterDemo` e `resetDemo`.
- [ ] Confirmar RED.
- [ ] Implementar `resetDemo` e conectar ao `DemoProgress`.
- [ ] Confirmar GREEN.

### Task 5: Freeze e smoke checklist

**Files:**
- Create: `docs/hackathon/FINAL_SMOKE_CHECKLIST.md`

- [ ] Documentar fluxo web principal, Demo, falhas de integração, reset e Android/simulador.
- [ ] Registrar explicitamente: sem teste em iPhone e sem publicação nativa NexGen nesta etapa.

### Task 6: Verificação e merge

- [ ] Rodar/verificar `npm test`.
- [ ] Verificar `npm run build` via CI.
- [ ] Verificar `wrangler deploy --dry-run` via CI/build quando disponível.
- [ ] Verificar Mobile CI: testes, typecheck, Expo config e Expo doctor.
- [ ] Comparar branch vs `main` e confirmar que `worker/`, `server/`, engines e integrações externas não mudaram.
- [ ] Abrir PR, revisar diff, fazer squash merge após checks verdes.
- [ ] Verificar CI e Cloudflare no commit final do `main` antes de declarar conclusão.
