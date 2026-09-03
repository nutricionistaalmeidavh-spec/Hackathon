# Build Log — Where's the Money

Registro cronológico das decisões e mudanças relevantes do projeto.

## 2026-08-31 — AppDeploy e Open Finance

- Estruturado o produto como assistente financeiro, não como ERP.
- Criada a navegação Hoje / Inbox / Radar / Mais.
- Pluggy Sandbox conectado com fluxo real do Connect Widget.
- Teste ponta a ponta trouxe 35 movimentações do sandbox.
- Identificado que transações óbvias ainda chegavam como pendentes.
- Motor determinístico ampliado para categorias como condomínio, salário, energia, telefonia, assinaturas, academia e pagamento de cartão.
- AppDeploy atingiu o limite vitalício do plano Free: 125/125 deploy requests.

## 2026-09-01 — Migração para Floot

- Criado projeto equivalente no Floot.
- Pluggy reconectado por secrets server-side.
- Motor de recorrência evoluído para usar estabelecimento normalizado, direção, periodicidade e faixa de valor.
- Radar passou a projetar recorrências reais e retirar recorrentes da média variável.
- Corrigido crash `RangeError: Invalid time value` causado por datas malformadas.
- Adicionado teste de regressão.

## 2026-09-01 — Git + iSH

- GitHub passa a ser a fonte oficial.
- Criada versão portátil React + TypeScript + Vite.
- Documentado desenvolvimento pelo iPhone/iSH.
- Secrets removidos do código e mantidos fora do Git.

## 2026-09-01 — Cloudflare Pages

- Backend Vercel removido.
- Criadas Cloudflare Pages Functions em `functions/api/open-finance/*`.
- Integração Pluggy migrada para REST nativo com `fetch`, sem SDK Node no runtime edge.
- Paginação de transações `/v2/transactions` implementada.
- `wrangler.toml` adicionado com output `./dist`.
- Build passa a type-checkar também Functions e helper server-side.
- `.dev.vars` documentado para teste local no iSH.
- Production/Preview secrets passam a ser configurados no Cloudflare Pages.

## 2026-09-03 — Migração definitiva para Cloudflare Workers

- Cloudflare Pages deixa de ser o runtime atual; o histórico acima é preservado apenas como registro.
- Criado `worker/index.ts` como entry point único do Worker `hackathon`.
- As quatro rotas Open Finance foram portadas de Pages Functions para módulos do Worker sem alterar URLs públicas.
- `dist/` passa a ser servido por Workers Static Assets via binding `ASSETS`.
- `/api/*` usa Worker-first e não cai no fallback da SPA.
- `wrangler.toml` deixa de usar `pages_build_output_dir` e passa a declarar `main`, assets e SPA fallback.
- Scripts e TypeScript foram migrados de Pages para Workers.
- CI passa a validar testes, build e os dois dry-runs de deploy usados localmente e pelo Cloudflare.
