# Hackathon Final Steps 1–2 Design

## Goal

Fechar o Where's the Money para o hackathon em duas frentes: (1) estabilização técnica sem ampliar escopo e (2) uma Demo Pro repetível, curta e segura para gravação/julgamento.

## Constraints

- Não adicionar novas funcionalidades de produto fora do que serve diretamente à estabilidade ou à demonstração.
- Não alterar contratos de `worker/`, `server/`, Gemini, Pluggy, RevenueCat, motores financeiros ou persistência.
- RevenueCat continua sendo a única fonte de verdade para entitlement Pro real.
- Demo Pro continua sintética, isolada de `wtm-portable` e sem alterar assinatura real.
- Navegação principal continua `Hoje | Inbox | Radar | Planejar | Mais`.
- Validação nativa será apenas para Android/simulador. Não haverá teste em iPhone nesta etapa.
- Não haverá publicação nativa; no fluxo NexGen, a validação encerra no simulador/checagens locais e CI.
- Deploy web continua exclusivamente via GitHub + Cloudflare Workers.

## Step 1 — Technical Stabilization

### 1. Feedback severity

A UI atual usa a mesma apresentação de sucesso para qualquer `message`, inclusive falhas. A estabilização introduz classificação de feedback em `success`, `error` e `info`, mantendo as mensagens existentes e sem reestruturar o estado financeiro.

A classificação deve ser determinística e testável, com visual e ícone coerentes. Erros de Pluggy, RevenueCat, importação e ações canceladas não podem aparecer com check de sucesso.

### 2. Import error containment

`importFiles` deve capturar falhas de leitura/parser e devolver mensagem amigável sem travar a UI, sem alterar dados já existentes e sempre limpando `busy` e o input de arquivo.

### 3. Contextual upgrade accessibility

O modal de upgrade já é semântico. Nesta etapa ele ganha fechamento por `Escape` e foco inicial previsível no botão de fechar, sem implementar um focus trap novo ou biblioteca adicional.

### 4. Freeze surface

Criar um checklist versionado de smoke tests do hackathon cobrindo jornada principal, estados de erro e fallback. Não modificar `worker/`, `server/`, engine, Pluggy, Gemini ou RevenueCat para cumprir este passo.

## Step 2 — Demo Experience

### 1. Deterministic judge dataset

O dataset deve produzir de forma previsível:

- histórico suficiente para recorrência e Radar;
- exatamente duas decisões manuais claras na Inbox após `applyPatternIntelligence`;
- dados suficientes para Radar significativo;
- plano sintético já contextualizado para demonstrar Planner sem digitação longa;
- nenhum dado pessoal real.

### 2. Repeatable demo reset

A Demo deve poder ser reiniciada em um toque. O reset recarrega o modo `?demo=1`, restaura o dataset sintético original e reinicia o progresso da demonstração sem tocar em dados reais.

### 3. Guided demo sequence

Manter o progresso de 4 passos existente e fazer o dataset sustentar a sequência:

1. revisar duas movimentações;
2. abrir Radar;
3. entender o ponto de atenção;
4. abrir Planner.

O fluxo deve poder ser executado de forma contínua para gravação em aproximadamente 90–110 segundos, sem depender de chamadas externas para chegar ao final.

### 4. Demo resilience

A jornada principal da Demo não deve depender de Pluggy, Gemini ou RevenueCat para avançar. Esses serviços podem ser mostrados separadamente, mas uma indisponibilidade não bloqueia Inbox → Radar → Planner.

## Verification

- TDD: novos contratos primeiro em vermelho, depois implementação mínima até verde.
- Web: `npm test`, `npm run build`, `npx wrangler deploy --dry-run`.
- Mobile: testes, typecheck, Expo config e Expo doctor; Android é a única plataforma de simulador desta etapa.
- CI: workflow web e workflow mobile verdes no commit final da branch e novamente no `main` após merge.
- Revisão de diff antes do merge confirmando ausência de mudanças em `worker/`, `server/`, engines e contratos externos.
