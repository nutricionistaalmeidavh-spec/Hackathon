# Arquitetura

## Objetivo

Manter o domínio financeiro independente do provedor de interface/build. GitHub é a fonte oficial e Cloudflare Workers + Static Assets é o runtime web atual.

## Camadas

```text
src/App.tsx
   ↓
src/importers/statementImport.ts ──→ OFX/CSV/XLS/XLSX
   ↓
src/core/financeEngine.ts
   ├─ classificação determinística
   ├─ regras manuais
   ├─ recorrência
   └─ Radar 30 dias

src/integrations/pluggy.ts
   ↓ same-origin HTTP
worker/index.ts
   ↓ rotas Open Finance
server/pluggy.ts
   ↓ HTTPS
Pluggy Sandbox / Open Finance

requisições não-API
   ↓
env.ASSETS.fetch(request)
   ↓
dist/
```

## Cloudflare Worker

O deploy usa um único Worker ES Module. As rotas do backend são:

```text
GET  /api/open-finance/status
POST /api/open-finance/connect-token
POST /api/open-finance/data
POST /api/open-finance/webhook
```

`worker/index.ts` roteia `/api/*` antes dos assets. Métodos incompatíveis em rotas conhecidas retornam JSON 405 e rotas `/api/*` desconhecidas retornam JSON 404, sem fallback para a SPA.

O frontend compilado pelo Vite fica em `dist/` e é servido pelo binding `ASSETS`. O Wrangler configura fallback `single-page-application` para navegação direta em rotas do frontend.

As credenciais são bindings de ambiente no Worker e chegam ao runtime por `env`. O frontend nunca recebe Client Secret.

O backend usa a API REST da Pluggy diretamente. Isso evita dependência de runtime Node no edge e mantém o código compatível com Workers.

## Núcleo determinístico

O motor usa:

1. regra explicitamente criada pelo usuário;
2. evidência semântica forte na descrição/estabelecimento;
3. categoria do provedor;
4. padrão recorrente do mesmo estabelecimento e mesma direção;
5. se ainda houver ambiguidade, revisão manual.

Não existe fallback que invente categoria, saldo ou entrada futura.

## Recorrência

A chave inclui estabelecimento normalizado + direção. Créditos e débitos nunca são misturados.

Periodicidades iniciais:

- semanal: ~7 dias;
- quinzenal: ~14 dias;
- mensal: ~30 dias.

A confiança combina número de amostras, consistência do intervalo, estabilidade de valor e, no mensal, consistência do dia.

## Radar

O Radar:

- parte do saldo de contas não-cartão quando disponível;
- projeta recorrências fortes pela mediana;
- calcula média diária de débitos variáveis dos 30 dias anteriores;
- remove recorrentes da média variável para evitar dupla contagem;
- projeta 30 dias.

## Persistência

O protótipo usa `localStorage`. Antes de uso comercial/multiusuário, a persistência deve migrar para banco com autenticação e isolamento por usuário.
