# Decisões técnicas

## ADR-001 — GitHub como fonte oficial

**Decisão:** Git passa a ser a única fonte canônica do código.

**Motivo:** builders facilitaram prototipação, mas introduziram limites e estruturas proprietárias. O produto precisa sobreviver à troca de plataforma.

## ADR-002 — Vite + React + TypeScript

**Decisão:** frontend portátil em Vite/React/TypeScript.

**Motivo:** build simples, ecossistema amplo e execução viável pelo iSH.

## ADR-003 — Motor determinístico antes de IA

**Decisão:** IA não participa da primeira classificação quando há evidência determinística suficiente.

**Motivo:** reduzir custo, latência e alucinação; manter explicabilidade para finanças.

## ADR-004 — Secrets somente no servidor

**Decisão:** Client Secret da Pluggy e outras chaves privadas nunca usam prefixo `VITE_` e nunca chegam ao browser.

**Motivo:** qualquer variável `VITE_*` pode ser lida no bundle entregue ao usuário final.

## ADR-005 — Backend serverless fino

**Decisão:** o backend apenas protege credenciais e intermedeia serviços externos; a lógica financeira principal fica no núcleo TypeScript independente.

**Motivo:** portabilidade e facilidade de teste.

## ADR-006 — Mobile-controlled development

**Decisão:** iPhone + iSH é um fluxo de desenvolvimento suportado oficialmente.

**Motivo:** versionamento, testes e release podem ser controlados do celular, enquanto a nuvem executa infraestrutura pesada.

## ADR-007 — Cloudflare Workers + Static Assets como runtime web

**Decisão:** o runtime web atual é um único Cloudflare Worker ES Module com Static Assets em `dist/` e roteamento Worker-first seletivo para `/api/*`.

**Motivo:** manter frontend e backend same-origin, eliminar a separação Pages/Pages Functions e alinhar o repositório ao projeto Worker `hackathon` já conectado ao GitHub.

## ADR-008 — Pluggy via REST no edge

**Decisão:** o Worker chama a API REST da Pluggy diretamente com `fetch`, sem `pluggy-sdk` no backend.

**Motivo:** reduzir dependência de APIs Node e manter compatibilidade natural com Cloudflare Workers.

## ADR-009 — API antes de SPA

**Decisão:** `/api/*` sempre passa pelo Worker antes dos assets; rota API desconhecida retorna JSON 404 e método incorreto retorna JSON 405.

**Motivo:** impedir que erros de API caiam no fallback `index.html` da SPA e preservar contratos HTTP previsíveis.
