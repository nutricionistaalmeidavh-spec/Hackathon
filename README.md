# Where's the Money

**ARTISYS · RevenueCat Shipaton 2026**

> Jogue seu extrato no Where's the Money e ele descobre para onde seu dinheiro realmente foi — e transforma essa leitura em um plano que você consegue discutir, ajustar e acompanhar.

Where's the Money é um assistente financeiro mobile-first que recebe movimentações por Open Finance ou arquivo, organiza o histórico com um motor determinístico auditável e transforma esse histórico em decisões: pendências para revisão, regras reutilizáveis, padrões recorrentes, Radar de caixa e um planejador conversacional com objetivos e cenários.

## Demo para jurados

O projeto inclui um cenário sintético, determinístico e reproduzível:

```text
https://hackathon.nutricionistaalmeidavh.workers.dev/?demo=1
```

Na tela inicial também existe **Explorar Demo Pro**. A demo não sobrescreve dados reais, não cria entitlement RevenueCat e não altera a tag OneSignal. Ela libera visualmente toda a experiência Pro usando somente movimentações e planejamento sintéticos.

O roteiro demonstra:

1. Inbox com classificações determinísticas e uma movimentação ambígua para revisão;
2. regras reutilizáveis e recorrências com confiança/amostras;
3. Radar B+ com trajetória de caixa e uma área separada **Fique de olho** para os detalhes de pressão;
4. diagnóstico de Essenciais / Flexíveis / Futuro usando 50/30/20 como referência editável, não como prescrição;
5. Planejar com objetivos simultâneos, ajustes confirmados e capacidade mensal;
6. conversa que extrai fatos candidatos, mas só grava os que o usuário confirma;
7. três cenários determinísticos de distribuição entre objetivos;
8. pesquisa contextual de ativos com Google Search grounding quando Gemini estiver configurado;
9. simulações matemáticas locais, sempre rotuladas como informativas e não como previsão/recomendação;
10. plano Pro integrado ao produto e checkout nativo RevenueCat quando configurado.

## Free e Pro

O app mantém um Free útil e coloca o upgrade nos momentos de maior valor.

| Free | Pro |
| --- | --- |
| Importação de extrato | Tudo do Free |
| Inbox e revisão manual | Open Finance automático |
| Classificação determinística | Radar completo de 30 dias |
| Até 3 regras ativas | Regras ilimitadas |
| Prévia do Radar por 7 dias | Fique de olho, drivers e recorrências avançadas |
| Objetivos e estrutura básica do plano | Planejador conversacional completo |
| Demo Pro para conhecer o produto | Pesquisa contextual + cenários + simulações avançadas |

O **RevenueCat nativo é a única fonte de verdade para o entitlement real `pro`**. O site aberto diretamente no navegador assume Free; apenas o modo de demonstração pode usar `demo-pro`, sem representar uma compra.

No app Expo, a WebView é a única superfície visual e conversa com RevenueCat por uma bridge tipada. Assinar, restaurar e gerenciar o plano aparecem dentro de **Mais** no próprio design do Where's the Money.

Detalhes: [docs/REVENUECAT-FREE-PRO.md](docs/REVENUECAT-FREE-PRO.md).

## Arquitetura do produto: evidência e cálculo antes de IA

A classificação e o planejamento financeiro não começam por IA. Primeiro entram evidências verificáveis e cálculos reproduzíveis: regras do usuário, descrição do estabelecimento, categoria do provedor, direção crédito/débito, recorrência, periodicidade, faixa de valor, histórico, distribuição de orçamento e capacidade mensal confirmada.

```text
Open Finance / arquivo
        ↓
motor determinístico
        ↓
Inbox + recorrências + Radar + saúde do orçamento
        ↓
conversa sobre objetivos e restrições
        ↓
fatos candidatos → confirmação humana
        ↓
plano estruturado
        ↓
pesquisa contextual opcional (Gemini + Google Search)
        ↓
Scenario Engine determinístico
        ↓
plano vivo → Radar atualizado
```

A IA **não calcula saldo, não cria movimentação, não inventa recorrência e não grava premissas ambíguas automaticamente**. No planejador ela pode explicar, pesquisar contexto e transformar linguagem natural em fatos candidatos. A confirmação do usuário antecede qualquer alteração estruturada do plano.

## Radar B+

O Radar foi redesenhado para ser memorável sem transformar incerteza em espetáculo. A tela principal mantém a leitura calma: saldo atual, horizonte disponível e trajetória. Valores negativos usam coral/vermelho; atenção usa âmbar; a camada **Fique de olho** separa os detalhes de pressão do resumo principal.

- Free recebe uma janela honesta de 7 dias e nunca faz afirmação sobre os dias 8–30.
- Pro e Demo Pro recebem 30 dias, drivers e detalhes de pressão.
- O gráfico, mínimos e drivers vêm do motor local; não são gerados por IA.
- A animação do Radar e o brilho de trajetória respeitam `prefers-reduced-motion`.

## Planejador conversacional

O planejador trata dinheiro como um conjunto de decisões conectadas, não como módulos isolados. A mesma conversa pode conter aposentadoria, carro, viagem, reserva e outras metas.

O estado estruturado contém objetivos, buckets editáveis, ajustes de gasto confirmados e histórico da conversa. O motor calcula capacidade mensal e compara três estratégias de distribuição: **prioridades primeiro**, **equilibrado** e **futuro primeiro**. Nenhum cenário ultrapassa a capacidade disponível.

A referência 50/30/20 é apenas um ponto de partida educacional. O usuário pode editar percentuais e criar buckets próprios; o sistema sinaliza quando o total ultrapassa 100% em vez de normalizar silenciosamente.

### Pesquisa e simulação de mercado

Quando Gemini estiver configurado, `/api/ai/market-research` usa Google Search grounding para identificar e contextualizar consultas como `ITSA4`, `Bitcoin` ou `Tesouro IPCA`. A resposta normaliza entidade, fatos, data e fontes.

A pesquisa não escolhe investimento para o usuário. Projeções de juros compostos e outros cenários são calculados localmente pelo Scenario Engine e sempre exibem o aviso:

> Simulação informativa, não previsão. Não constitui recomendação de investimento, oferta ou indicação de compra/venda. Retornos passados não garantem resultados futuros.

## Estado atual

- Inbox financeira com estados Pendência / Revisar / Auto / Categorizado.
- Importação OFX, CSV, TXT, XLS e XLSX no navegador.
- Pluggy Sandbox/Open Finance via Cloudflare Worker.
- Classificação determinística de categorias comuns.
- Regras manuais reutilizáveis com política Free/Pro.
- Detecção de recorrência semanal, quinzenal e mensal por estabelecimento + direção + intervalo + valor.
- Radar B+ Free de 7 dias e Pro/Demo Pro de 30 dias.
- Tela Fique de olho separando pressão/risco da visão principal.
- Saúde de orçamento Essenciais / Flexíveis / Futuro com referência editável.
- Planejador conversacional com objetivos simultâneos, ajustes confirmados e persistência local no modo real.
- Scenario Engine para alocação entre metas, juros compostos e financiamento.
- Modo Demo Pro com movimentações e planejamento 100% sintéticos, sem persistência sobre dados reais.
- Gemini Interactions API via Worker para sugestão de categoria, conversa estruturada e pesquisa contextual; todos com fallback seguro quando a chave está ausente.
- RevenueCat nativo com entitlement `pro`, Paywall, restore, Customer Center e WebView bridge.
- OneSignal nativo preparado com tag real `plan=free|pro`.
- Deploy preparado para Cloudflare Workers + Static Assets com GitHub como fonte oficial.

## Rodar só o frontend

```bash
npm install
npm run dev
```

Isso cobre interface, importação, motor, Free, Demo Pro, Radar B+ e os cenários determinísticos. No navegador não existe entitlement nativo; portanto o produto real assume Free, enquanto `?demo=1` abre a demonstração completa.

## Rodar o app completo localmente

Crie `.dev.vars` apenas com os secrets que pretende testar:

```dotenv
PLUGGY_CLIENT_ID=""
PLUGGY_CLIENT_SECRET=""
GEMINI_API_KEY=""
```

Depois:

```bash
npm run dev:worker
```

A chave Gemini nunca entra no bundle React/Expo. O navegador chama apenas `/api/ai/*`.

## Build web/Worker

```bash
npm test
npm run build
npx wrangler deploy --dry-run
npx wrangler deploy --assets=./dist --name=hackathon --dry-run
```

A suíte cobre motor financeiro, orçamento, planejamento, cenários, dataset demo, análise do Radar, política Free/Pro, contratos da WebView bridge e rotas/contratos/fallbacks Gemini.

## Mobile Expo

O aplicativo nativo fica isolado em `apps/mobile`. Ele carrega o produto publicado no Cloudflare em uma WebView e fornece as integrações nativas necessárias ao hackathon:

- RevenueCat: entitlement `pro`, Paywall, restauração e Customer Center;
- WebView bridge: estado/ações RevenueCat sem duplicar a UI;
- OneSignal: push notification, identificação futura por External ID e tag real `plan=free|pro`;
- EAS project: `@engenutri/wheresthemoney`;
- EAS projectId: `6f7e9d85-5dd4-41e6-a37f-861c54a853d5`.

Prepare o ambiente:

```bash
cd apps/mobile
cp .env.example .env
npm install
```

Preencha apenas as chaves públicas:

```text
EXPO_PUBLIC_REVENUECAT_API_KEY=
EXPO_PUBLIC_ONESIGNAL_APP_ID=
```

Sem `EXPO_PUBLIC_REVENUECAT_API_KEY`, o build continua funcional como Free + Demo Pro e os CTAs de compra retornam um estado seguro de configuração ausente.

A URL web padrão já aponta para:

```text
https://hackathon.nutricionistaalmeidavh.workers.dev
```

Validação mobile:

```bash
npm test
npm run typecheck
npm run config
npx expo-doctor
```

Development build Android:

```bash
eas build --platform android --profile development
```

Depois de instalar o APK no aparelho ou emulador:

```bash
npx expo start --dev-client
```

Veja o passo a passo completo em [docs/MOBILE-BUILD.md](docs/MOBILE-BUILD.md).

## Deploy

O projeto de produção web é o Cloudflare Worker `hackathon`, conectado ao branch `main` deste repositório.

Configuração canônica no Git:

- Worker entry point: `worker/index.ts`
- static assets: `dist/`
- API Worker-first: `/api/*`
- SPA fallback: `single-page-application`

Secrets privados de runtime:

```text
PLUGGY_CLIENT_ID
PLUGGY_CLIENT_SECRET
GEMINI_API_KEY
```

`GEMINI_API_KEY` é opcional. Sem ela, todo o produto determinístico, o Radar e o planejador em fallback continuam funcionais; conversa/pesquisa Gemini ao vivo permanecem indisponíveis até a configuração do secret.

Cada push em `main` gera uma nova build no projeto conectado. O repositório também suporta deploy manual com:

```bash
npm run deploy:worker
```

## Desenvolvimento pelo celular

Este projeto adotou Git como fonte oficial e um fluxo de desenvolvimento pelo iPhone usando iSH.

```text
iPhone → iSH → Git → GitHub → Cloudflare Worker → Produção
```

A camada Expo nativa pode ser compilada no EAS sem exigir que o código tenha sido desenvolvido localmente no PC.

## Arquitetura e decisões

- [Arquitetura](docs/ARCHITECTURE.md)
- [Decisões técnicas](docs/DECISIONS.md)
- [ENV e secrets](docs/ENVIRONMENT.md)
- [Roteiro do hackathon](docs/HACKATHON.md)
- [RevenueCat Free/Pro + bridge](docs/REVENUECAT-FREE-PRO.md)
- [Design Radar B+ + Financial Plan](docs/superpowers/specs/2026-09-04-radar-bplus-financial-plan-design.md)
- [Plano Conversational Financial Planner](docs/superpowers/plans/2026-09-04-conversational-financial-planner.md)
- [Design RevenueCat Free/Pro](docs/superpowers/specs/2026-09-04-revenuecat-free-pro-bridge-design.md)
- [Design da camada Gemini](docs/superpowers/specs/2026-09-04-gemini-financial-explainer-design.md)
- [Mobile / emulador](docs/MOBILE-BUILD.md)
- [Build log](BUILDLOG.md)

## Segurança

Nunca faça commit de `.env`, `.env.local`, `.dev.vars`, Client Secret, `GEMINI_API_KEY`, service account Firebase, chave APNs, keystore Android ou outras chaves privadas. A camada Gemini limita e valida payloads antes da chamada externa, e o entitlement Pro real permanece sob controle do SDK RevenueCat nativo.

## Licença

MIT — veja [LICENSE](LICENSE).
