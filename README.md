# Where's the Money

**ARTISYS · RevenueCat Shipaton 2026**

> Jogue seu extrato no Where's the Money e ele descobre para onde seu dinheiro realmente foi — e o que pode acontecer com o seu caixa depois.

Where's the Money é um assistente financeiro mobile-first que recebe movimentações por Open Finance ou arquivo, organiza o histórico com um motor determinístico auditável e transforma esse histórico em decisões: pendências para revisão, regras reutilizáveis, padrões recorrentes e um Radar de caixa.

## Demo para jurados

O projeto inclui um cenário sintético, determinístico e reproduzível:

```text
https://hackathon.nutricionistaalmeidavh.workers.dev/?demo=1
```

Na tela inicial também existe **Explorar Demo Pro**. A demo não sobrescreve dados reais, não cria entitlement RevenueCat e não altera a tag OneSignal. Ela libera visualmente toda a experiência Pro usando somente dados sintéticos.

O roteiro demonstra:

1. Inbox com classificações determinísticas;
2. uma movimentação ambígua para revisão;
3. regras reutilizáveis;
4. recorrências com confiança e amostras;
5. Radar de 30 dias com primeiro dia de risco e maiores drivers;
6. Gemini opcional explicando apenas fatos que o motor já calculou;
7. plano Pro integrado ao produto e checkout nativo RevenueCat quando configurado.

## Free e Pro

O app mantém um Free útil e coloca o upgrade nos momentos de maior valor.

| Free | Pro |
| --- | --- |
| Importação de extrato | Tudo do Free |
| Inbox e revisão manual | Open Finance automático |
| Classificação determinística | Radar completo de 30 dias |
| Até 3 regras ativas | Regras ilimitadas |
| Prévia do Radar por 7 dias | Risco, drivers e recorrências avançadas |
| Demo Pro para conhecer o produto | Explicação do Radar com Gemini quando configurado |

O **RevenueCat nativo é a única fonte de verdade para o entitlement real `pro`**. O site aberto diretamente no navegador assume Free; apenas o modo de demonstração pode usar `demo-pro`, sem representar uma compra.

No app Expo, o antigo cabeçalho nativo de assinatura foi removido. A WebView é a única superfície visual e conversa com RevenueCat por uma bridge tipada. Assinar, restaurar e gerenciar o plano aparecem dentro de **Mais** no próprio design do Where's the Money.

Detalhes: [docs/REVENUECAT-FREE-PRO.md](docs/REVENUECAT-FREE-PRO.md).

## Princípio do produto: evidência antes de IA

A classificação financeira não começa por IA. Primeiro entram evidências verificáveis: regras do usuário, descrição do estabelecimento, categoria do provedor, direção crédito/débito, recorrência, periodicidade, faixa de valor e consistência histórica.

Gemini é uma camada posterior e opcional:

```text
Open Finance / arquivo
        ↓
motor determinístico
        ↓
Inbox + recorrências + Radar
        ↓
fatos estruturados e mínimos
        ↓
Gemini (explicação / sugestão)
        ↓
usuário confirma quando houver decisão
```

A IA **não calcula saldo, não cria movimentação, não inventa recorrência e não confirma categoria automaticamente**.

## Estado atual

- Inbox financeira com estados Pendência / Revisar / Auto / Categorizado.
- Importação OFX, CSV, TXT, XLS e XLSX no navegador.
- Pluggy Sandbox/Open Finance via Cloudflare Worker.
- Classificação determinística de categorias comuns.
- Regras manuais reutilizáveis com política Free/Pro.
- Detecção de recorrência semanal, quinzenal e mensal por estabelecimento + direção + intervalo + valor.
- Radar Free de 7 dias e Radar Pro/Demo Pro de 30 dias.
- Radar hero com primeiro dia negativo, menor saldo, saldo final e principais drivers no Pro.
- Modo Demo Pro com dados 100% sintéticos e sem persistência sobre dados reais.
- Gemini Interactions API via Worker para explicação do Radar e sugestão de categoria ambígua.
- Fallback completo quando Gemini ou RevenueCat não estão configurados.
- RevenueCat nativo com entitlement `pro`, Paywall, restore, Customer Center e WebView bridge.
- OneSignal nativo preparado com tag real `plan=free|pro`.
- Deploy preparado para Cloudflare Workers + Static Assets com GitHub como fonte oficial.

## Rodar só o frontend

```bash
npm install
npm run dev
```

Isso cobre interface, importação, motor, Free, Demo Pro e Radar. No navegador não existe entitlement nativo; portanto o produto real assume Free, enquanto `?demo=1` abre a demonstração completa.

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

A suíte cobre motor financeiro, dataset demo, análise do Radar, política Free/Pro, contratos da WebView bridge, roteamento Worker e contratos/fallbacks Gemini.

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

`GEMINI_API_KEY` é opcional. Sem ela, todo o produto determinístico continua funcional.

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
- [Design RevenueCat Free/Pro](docs/superpowers/specs/2026-09-04-revenuecat-free-pro-bridge-design.md)
- [Design da camada Gemini](docs/superpowers/specs/2026-09-04-gemini-financial-explainer-design.md)
- [Mobile / emulador](docs/MOBILE-BUILD.md)
- [Build log](BUILDLOG.md)

## Segurança

Nunca faça commit de `.env`, `.env.local`, `.dev.vars`, Client Secret, `GEMINI_API_KEY`, service account Firebase, chave APNs, keystore Android ou outras chaves privadas. A camada Gemini limita e valida payloads antes da chamada externa, e o entitlement Pro real permanece sob controle do SDK RevenueCat nativo.

## Licença

MIT — veja [LICENSE](LICENSE).
