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
- Corrigido crash `RangeError: Invalid time value` causado por datas malformadas da sincronização.
- Adicionado teste de regressão para datas inválidas.

## 2026-09-01 — Git + iSH como fluxo definitivo

- GitHub passa a ser a fonte oficial do produto.
- Criada versão portátil sem dependência obrigatória de AppDeploy ou Floot.
- Frontend padronizado em React + TypeScript + Vite.
- Backend Open Finance convertido para funções serverless compatíveis com Vercel.
- Documentado o fluxo de desenvolvimento 100% pelo celular usando iPhone + iSH + GitHub + CI/CD.
- Secrets saem definitivamente do código e ficam no ambiente do deploy.
