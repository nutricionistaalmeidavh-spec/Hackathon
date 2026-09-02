# Where's the Money

**ARTISYS · RevenueCat Shipaton 2026**

> Jogue seu extrato no Where's the Money e ele descobre para onde seu dinheiro realmente foi.

Where's the Money é um assistente financeiro mobile-first que recebe movimentações por Open Finance ou arquivo, organiza o histórico com um motor determinístico auditável e transforma esse histórico em decisões: pendências para revisão, regras reutilizáveis e um Radar de caixa para os próximos 30 dias.

## Princípio do produto

A classificação financeira não começa por IA. Primeiro entram evidências verificáveis: regras do usuário, descrição do estabelecimento, categoria do provedor, direção crédito/débito, recorrência, periodicidade, faixa de valor e consistência histórica. IA é uma etapa posterior para ambiguidade e explicação — nunca para inventar saldo ou movimentação.

## Estado atual

- Inbox financeira com estados Pendência / Revisar / Auto / Categorizado.
- Importação OFX, CSV, TXT, XLS e XLSX no navegador.
- Pluggy Sandbox/Open Finance via Cloudflare Pages Functions.
- Classificação determinística de categorias comuns.
- Regras manuais reutilizáveis.
- Detecção de recorrência semanal, quinzenal e mensal por estabelecimento + direção + intervalo + valor.
- Radar de caixa de 30 dias sem IA.
- Proteção contra datas malformadas.
- Persistência local para o protótipo.
- Deploy preparado para Cloudflare Pages com GitHub como fonte oficial.

## Rodar só o frontend

```bash
npm install
npm run dev
```

Isso cobre interface, importação de arquivos, motor e Radar.

## Rodar o app completo localmente

Crie `.dev.vars` com as credenciais da Pluggy e execute:

```bash
npm run dev:pages
```

O Wrangler sobe o frontend e as Pages Functions no runtime local do Cloudflare.

## Build

```bash
npm test
npm run build
```

O build também verifica TypeScript das Pages Functions.

## Deploy

Conecte este repositório a um projeto do Cloudflare Pages:

- build command: `npm run build`
- output directory: `dist`
- production branch: `main`

Depois cadastre os secrets no Cloudflare:

```text
PLUGGY_CLIENT_ID
PLUGGY_CLIENT_SECRET
```

Cada push em `main` pode gerar um novo deploy automaticamente.

## Desenvolvimento pelo celular

Este projeto adotou Git como fonte oficial e um fluxo de desenvolvimento pelo iPhone usando iSH.

```text
iPhone → iSH → Git → GitHub → Cloudflare Pages → Produção
```

Veja [docs/MOBILE-BUILD.md](docs/MOBILE-BUILD.md).

## Arquitetura e decisões

- [Arquitetura](docs/ARCHITECTURE.md)
- [Decisões técnicas](docs/DECISIONS.md)
- [ENV e secrets](docs/ENVIRONMENT.md)
- [Hackathon](docs/HACKATHON.md)
- [Build log](BUILDLOG.md)

## Segurança

Nunca faça commit de `.env`, `.env.local`, `.dev.vars`, Client Secret ou outras chaves privadas. O repositório contém apenas nomes de variáveis de exemplo.

## Licença

MIT — veja [LICENSE](LICENSE).
