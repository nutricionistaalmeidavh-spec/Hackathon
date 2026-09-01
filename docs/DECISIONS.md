# Decisões técnicas

## ADR-001 — GitHub como fonte oficial

**Decisão:** Git passa a ser a única fonte canônica do código.

**Motivo:** builders facilitaram prototipação, mas introduziram limites de conta e estruturas proprietárias. O produto precisa sobreviver à troca de plataforma.

## ADR-002 — Vite + React + TypeScript

**Decisão:** frontend portátil em Vite/React/TypeScript.

**Motivo:** build simples, ecossistema amplo e execução viável pelo iSH.

## ADR-003 — Motor determinístico antes de IA

**Decisão:** IA não participa da primeira classificação quando há evidência determinística suficiente.

**Motivo:** reduzir custo, latência e alucinação; manter explicabilidade para finanças.

## ADR-004 — Secrets somente no servidor

**Decisão:** Client Secret da Pluggy e outras chaves privadas nunca usam prefixo `VITE_` e nunca chegam ao browser.

**Motivo:** qualquer variável `VITE_*` pode ser lida pelo usuário final no bundle.

## ADR-005 — Backend serverless fino

**Decisão:** o backend apenas protege credenciais e intermedeia serviços externos; a lógica financeira principal fica no núcleo TypeScript independente.

**Motivo:** portabilidade e facilidade de teste.

## ADR-006 — Mobile-controlled development

**Decisão:** iPhone + iSH é um fluxo de desenvolvimento suportado oficialmente para o projeto.

**Motivo:** demonstrar que versionamento, revisão, testes e release podem ser controlados do celular, enquanto a nuvem executa infraestrutura pesada.
