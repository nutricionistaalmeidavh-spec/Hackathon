# Where's the Money — Mobile Expo + RevenueCat + OneSignal

Data: 2026-09-03
Status: design aprovado em conversa e em implementação.
Branch: feat/mobile-revenuecat-onesignal

## Objetivo

Adicionar ao repositório `Hackathon` uma camada mobile Expo vinculada ao projeto EAS existente `@engenutri/wheresthemoney` (projectId `6f7e9d85-5dd4-41e6-a37f-861c54a853d5`) sem reescrever nem desestabilizar o web app atual e o Cloudflare Worker já publicado.

A camada mobile deve permitir demonstrar no hackathon:

1. o produto web atual rodando no app mobile;
2. RevenueCat com entitlement `pro`, paywall, compra Test Store, restauração e Customer Center;
3. OneSignal com inicialização nativa, permissão, identificação do usuário e tags de plano;
4. build Android de desenvolvimento via EAS; iOS fica preparado, sem exigir conta Apple Developer nesta etapa.

## Evidência recuperada

Não há ZIP do código mobile P13 no Drive/File Library. O checkpoint P13 confirma que havia um projeto Expo vinculado a `@engenutri/wheresthemoney`, que TypeScript mobile passava e que o SDK nativo RevenueCat ainda não estava integrado. Portanto esta entrega não tenta reconstruir uma base inexistente arquivo a arquivo; ela cria uma camada mobile mínima, rastreável e versionada no repositório atual.

## Abordagens consideradas

### A. Wrapper Expo com WebView + integrações nativas — recomendada

- Reaproveita imediatamente a interface e lógica web já funcionando.
- RevenueCat e OneSignal ficam realmente nativos.
- Menor risco e menor duplicação para o prazo do hackathon.
- Permite evoluir gradualmente para telas nativas depois.

### B. Reimplementar todo o produto em React Native

- Maior controle nativo, porém duplica UI, estado e lógica financeira.
- Alto risco de divergência entre web e mobile.
- Fora do escopo para o prazo atual.

### C. Expo DOM para portar componentes web

- Pode reaproveitar componentes web, mas exige adaptação estrutural e não reduz suficientemente a complexidade em relação ao wrapper.
- Menos previsível para RevenueCat/OneSignal e navegação no prazo do hackathon.

Escolha: abordagem A.

## Estrutura proposta

```text
Hackathon/
├── src/                       # web atual
├── worker/                    # Cloudflare Worker atual
├── apps/
│   └── mobile/
│       ├── App.tsx
│       ├── index.ts
│       ├── app.config.ts
│       ├── eas.json
│       ├── package.json
│       ├── tsconfig.json
│       ├── .env.example
│       └── src/
│           ├── config.ts
│           ├── revenuecat.ts
│           └── onesignal.ts
└── .github/workflows/
    ├── ci.yml                 # web/worker existente
    └── mobile-ci.yml          # validação independente do mobile
```

## Runtime mobile

### Conteúdo principal

`App.tsx` terá uma `WebView` apontando por padrão para:

`https://hackathon.nutricionistaalmeidavh.workers.dev`

A URL será configurável por `EXPO_PUBLIC_WEB_APP_URL` para facilitar preview sem alterar código.

O shell nativo terá uma pequena barra/ação de plano, sem duplicar as telas Hoje/Inbox/Radar/Mais. O botão de plano abre o Paywall/Customer Center nativo conforme o entitlement atual.

## RevenueCat

### Dependências

- `react-native-purchases`
- `react-native-purchases-ui`
- `expo-dev-client`

### Configuração

Variável pública no mobile:

```text
EXPO_PUBLIC_REVENUECAT_API_KEY=
```

Nenhuma secret key entra no Git.

### Entitlement

Identificador fixo nesta entrega:

```text
pro
```

### Fluxo

1. iniciar SDK no bootstrap;
2. carregar `CustomerInfo`;
3. `isPro = customerInfo.entitlements.active.pro != null`;
4. se não Pro, ação de plano chama `presentPaywallIfNeeded({ requiredEntitlementIdentifier: 'pro' })`;
5. se Pro, ação abre `presentCustomerCenter()`;
6. restauração disponível por `Purchases.restorePurchases()`;
7. alterações de `CustomerInfo` atualizam o estado e as tags do OneSignal.

### Ambiente de hackathon

Primeira validação usa RevenueCat Test Store. Isso evita dependência de App Store/Google Play para demonstrar compra e entitlement durante o hackathon.

## OneSignal

### Dependências

- `onesignal-expo-plugin` >= 2.6.0
- `react-native-onesignal` >= 5.5.1

### Configuração

Variável pública:

```text
EXPO_PUBLIC_ONESIGNAL_APP_ID=
```

O plugin será o primeiro item da lista de plugins Expo, com `mode: 'development'` e `disableLocation: true`.

### Fluxo

1. inicializar OneSignal somente quando houver App ID válido;
2. solicitar permissão de push em development build;
3. registrar listeners de click e foreground;
4. usar `OneSignal.login(userId)` quando houver identificador estável;
5. adicionar tag `plan=free|pro` a partir do RevenueCat;
6. deixar funções preparadas para tags futuras de Radar/Inbox sem acoplar o mobile à lógica financeira agora.

## Identidade do usuário

Nesta primeira etapa, se o web app ainda não expuser um ID de usuário autenticado ao shell, não será inventada identidade de conta. O OneSignal pode operar inicialmente como subscription de dispositivo; `login(userId)` ficará exposto em serviço para ativação quando o app possuir ID estável.

Isso evita misturar diferentes usuários no mesmo External ID.

## Expo/EAS

Configuração esperada:

- owner: `engenutri`
- slug: `wheresthemoney`
- EAS projectId: `6f7e9d85-5dd4-41e6-a37f-861c54a853d5`
- Expo SDK: 57.x
- New Architecture: habilitada
- development client: habilitado
- Android primeiro

Como o bundle/package Android anterior não está disponível nas evidências recuperadas, esta entrega usará `com.engenutri.wheresthemoney` como package novo apenas se a configuração EAS não impuser outro identificador. Antes de integrar ao `main`, a validação deve detectar conflito de configuração; não será feita publicação de loja nesta fase.

## iOS

A estrutura ficará preparada com `bundleIdentifier` correspondente, `UIBackgroundModes: ['remote-notification']` e entitlement APNs de desenvolvimento. Porém nenhuma etapa desta entrega depende de assinatura Apple, TestFlight ou App Store.

## Secrets e arquivos proibidos no Git

Nunca versionar:

- `.env`
- `.env.local`
- chaves secretas RevenueCat
- JSON de service account Firebase
- p8/p12 APNs
- `GoogleService-Info.plist`
- credenciais EAS

Somente `.env.example` com valores vazios será commitado.

## Testes e validação

O mobile terá pipeline próprio para não alterar o CI web/Worker:

1. `npm install` em `apps/mobile`;
2. `npm run typecheck`;
3. `npx expo-doctor`;
4. `npx expo config --type public`;
5. verificação estática de que projectId, plugins e variáveis esperadas existem;
6. build EAS Android será executado somente quando as credenciais/conta EAS permitirem e após a configuração pública RevenueCat/OneSignal.

O CI web existente continua executando testes, build Vite e `wrangler deploy --dry-run` independentemente.

## Critérios de aceite

- web e Worker permanecem sem alterações funcionais;
- `apps/mobile` instala e passa TypeScript/Expo Doctor;
- app Expo está ligado ao projectId EAS correto;
- RevenueCat inicializa quando a public SDK key for informada;
- `pro` governa o estado Free/Pro;
- Paywall, restore e Customer Center têm chamadas nativas implementadas;
- OneSignal inicializa quando o App ID for informado;
- push permission/listeners e tag `plan` estão implementados;
- nenhum segredo é commitado;
- Android development build é o próximo passo operacional após inserir as duas chaves públicas e configurar FCM no painel OneSignal.

## Fora de escopo nesta entrega

- publicar na App Store ou Google Play;
- webhook RevenueCat;
- reescrever Hoje/Inbox/Radar/Mais em React Native;
- autenticação mobile nova;
- sincronizar tags financeiras detalhadas sem uma identidade de usuário estável;
- Layers, Stripe ou Noise.
