# Where's the Money

**ARTISYS · RevenueCat Shipaton 2026**

> Jogue seu extrato no Where's the Money e ele descobre para onde seu dinheiro realmente foi.

Where's the Money é um assistente financeiro mobile-first que recebe movimentações por Open Finance ou arquivo, organiza o histórico com um motor determinístico auditável e transforma esse histórico em decisões: pendências para revisão, regras reutilizáveis e um Radar de caixa para os próximos 30 dias.

## Princípio do produto

A classificação financeira não começa por IA. Primeiro entram evidências verificáveis: regras do usuário, descrição do estabelecimento, categoria do provedor, direção crédito/débito, recorrência, periodicidade, faixa de valor e consistência histórica. IA é uma etapa posterior para ambiguidade e explicação — nunca para inventar saldo ou movimentação.

## Estado atual

- Inbox financeira com estados Pendência / Revisar / Auto / Categorizado.
- Importação OFX, CSV, TXT, XLS e XLSX no próprio navegador.
- Pluggy Sandbox/Open Finance via backend serverless.
- Classificação determinística de categorias comuns.
- Regras manuais reutilizáveis.
- Detecção de recorrência semanal, quinzenal e mensal por estabelecimento + direção + intervalo + valor.
- Radar de caixa de 30 dias sem IA.
- Proteção contra datas malformadas de provedores/importações.
- Persistência local para o protótipo.

## Rodar localmente

```bash
npm install
npm run dev
```

Para testar apenas importação de arquivos, nenhuma credencial é necessária. Para testar Open Finance localmente com as funções serverless, use Vercel Dev e configure as variáveis descritas em [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md).

```bash
npm install -g vercel
vercel dev
```

## Verificar antes do push

```bash
npm test
npm run build
```

## Desenvolvimento pelo celular

Este projeto adotou Git como fonte oficial e um fluxo de desenvolvimento pelo iPhone usando iSH. Veja [docs/MOBILE-BUILD.md](docs/MOBILE-BUILD.md).

## Arquitetura e decisões

- [Arquitetura](docs/ARCHITECTURE.md)
- [Decisões técnicas](docs/DECISIONS.md)
- [ENV e secrets](docs/ENVIRONMENT.md)
- [Hackathon](docs/HACKATHON.md)
- [Build log](BUILDLOG.md)

## Segurança

Nunca faça commit de `.env`, `.env.local`, Client Secret ou chaves privadas. Arquivos reais de ambiente são ignorados por `.gitignore`. O repositório contém apenas `.env.example` com nomes de variáveis vazias.

## Licença

MIT — veja [LICENSE](LICENSE).
