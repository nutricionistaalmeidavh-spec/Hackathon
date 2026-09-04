# Mobile Build — Expo, EAS e Android Emulator

## Visão

O repositório mantém o web app e o Cloudflare Worker na raiz e a camada nativa em `apps/mobile`.

```text
Web/Vite + Worker (raiz)
          ↓
Cloudflare Worker publicado
          ↓
Expo development client (`apps/mobile`)
          ├── WebView = única superfície visual do produto
          ├── RevenueCat nativo = fonte de verdade do `pro`
          ├── bridge WebView ↔ RevenueCat
          └── OneSignal nativo
```

O antigo cabeçalho nativo separado de `Plano Pro / Restaurar` foi removido. Assinar, restaurar e gerenciar aparecem dentro da aba **Mais** da própria interface web; o Expo executa as ações nativas quando solicitado pela bridge.

O app Expo está vinculado ao EAS project `@engenutri/wheresthemoney`, projectId `6f7e9d85-5dd4-41e6-a37f-861c54a853d5`.

## Desenvolvimento web pelo iPhone/iSH

No Alpine/iSH:

```bash
apk update
apk add git openssh nodejs npm nano
```

Clone e valide o web app:

```bash
git clone git@github.com:nutricionistaalmeidavh-spec/Hackathon.git
cd Hackathon
npm install
npm test
npm run build
```

Push em `main` continua disparando a build do Cloudflare Worker `hackathon`.

## Preparar o mobile

No PC ou qualquer ambiente com Node 22:

```bash
cd apps/mobile
cp .env.example .env
npm install
```

As únicas variáveis públicas necessárias são:

```text
EXPO_PUBLIC_WEB_APP_URL=https://hackathon.nutricionistaalmeidavh.workers.dev
EXPO_PUBLIC_REVENUECAT_API_KEY=
EXPO_PUBLIC_ONESIGNAL_APP_ID=
```

Nunca coloque secret API keys, service-account JSON, APNs p8/p12 ou keystore no `.env` versionado.

Sem `EXPO_PUBLIC_REVENUECAT_API_KEY`, o app inicia normalmente em Free. A Demo Pro continua disponível e os comandos de compra/restauração retornam um estado seguro de configuração ausente.

## Bridge de assinatura

A WebView envia apenas três comandos:

```text
WTM_SUBSCRIPTION_REQUEST_STATE
WTM_SUBSCRIPTION_OPEN_PLAN
WTM_SUBSCRIPTION_RESTORE
```

O Expo responde com eventos `wtm:native` contendo estado ou resultado da ação. O frontend nunca cria `isPro=true` por conta própria; somente o `CustomerInfo` do RevenueCat pode ativar o Pro real.

A Demo Pro é um override somente de apresentação no web app e não passa pela bridge. Por isso ela não altera a tag `plan=free|pro` do OneSignal.

## Validação antes do build

```bash
npm test
npm run typecheck
npm run config
npx expo-doctor
```

Os testes mobile também validam o parser da bridge e a geração do script de evento para a WebView.

## Android Emulator no Windows

### 1. Instalar Android Studio

Durante a instalação mantenha:

- Android SDK;
- Android SDK Platform-Tools;
- Android Emulator;
- Android Virtual Device.

### 2. Verificar virtualização

No Gerenciador de Tarefas:

```text
Desempenho → CPU → Virtualização: Habilitada
```

Se estiver desabilitada, habilite Intel VT-x/AMD-V no BIOS/UEFI. No Windows, `Windows Hypervisor Platform` também pode ser necessária.

### 3. Criar o aparelho virtual

Android Studio → Device Manager → Create Virtual Device.

Para o ambiente usado neste projeto:

```text
Device: Pixel 9
System Image: Android x86_64 com Google Play
```

Use imagem com o selo **Google Play**, porque FCM/OneSignal depende do Google Play Services.

### 4. Confirmar ADB

Com o emulador aberto:

```bash
adb devices
```

No Windows, se `adb` não estiver no PATH:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" devices
```

## Gerar o development client

RevenueCat e OneSignal adicionam código nativo; portanto o fluxo completo usa Development Client, não somente Expo Go.

Na pasta `apps/mobile`:

```bash
eas login
eas project:info
eas build --platform android --profile development
```

O profile `development` gera APK para instalação direta. Um development APK deste projeto já foi produzido com sucesso no EAS; novos builds só são necessários quando alterações nativas exigirem recompilação.

## Instalar o APK no emulador

O caminho mais simples para o último build EAS é:

```bash
npx eas-cli build:run --platform android --latest
```

Alternativamente, arraste o APK para o Android Emulator ou use:

```bash
adb install -r caminho/para/app.apk
```

## Rodar durante o desenvolvimento

Com o development client já instalado:

```bash
npx expo start --dev-client
```

Abra o Where's the Money no emulador e conecte-o ao Metro mostrado pelo Expo.

## RevenueCat — teste do hackathon

No RevenueCat Dashboard configure:

```text
Project: Where's the Money
Entitlement: pro
Offering: default
Product: pro_monthly_test (Test Store)
Paywall: Where's the Money Pro
```

Coloque a **public SDK key** do Test Store em:

```text
EXPO_PUBLIC_REVENUECAT_API_KEY=test_...
```

Depois reinicie o Metro/build conforme necessário e teste o fluxo dentro da interface do produto:

```text
Mais
→ Plano Free
→ Assinar Pro
→ Paywall RevenueCat nativo
→ Successful Purchase (Test Store)
→ entitlement pro ativo
→ evento nativo atualiza a WebView
→ Plano Pro ativo
→ Radar 30 dias / Open Finance / regras ilimitadas liberados
→ Gerenciar assinatura abre Customer Center
```

`Restaurar compra` envia `WTM_SUBSCRIPTION_RESTORE` pela bridge e o shell executa `Purchases.restorePurchases()`.

Também valide o downgrade visual/estado Free após remover o entitlement no ambiente de teste.

## OneSignal — Android

1. Crie o projeto/app no OneSignal.
2. Configure Android/FCM com o Firebase Cloud Messaging API v1.
3. O JSON de service account é enviado ao painel OneSignal e **não** vai para este repositório.
4. Copie apenas o OneSignal App ID público para:

```text
EXPO_PUBLIC_ONESIGNAL_APP_ID=
```

O app:

- inicializa o SDK;
- solicita permissão;
- registra listeners de click/foreground;
- mantém `plan=free` ou `plan=pro` conforme **entitlement RevenueCat real**;
- não altera a tag durante Demo Pro;
- expõe função para `OneSignal.login(userId)` quando existir identidade estável no produto.

Para testar, abra Audience/Subscriptions no OneSignal, marque o emulador como test user e envie uma push de teste.

## iOS

No Windows não existe iOS Simulator oficial. Para iOS use:

- iPhone físico + EAS development build; ou
- macOS + Xcode Simulator.

Esta entrega deixa o bundle iOS preparado, mas não exige Apple Developer para o primeiro checkpoint Android/RevenueCat Test Store.

## Regra de ouro

Web/Worker antes do push:

```bash
npm test && npm run build && npx wrangler deploy --dry-run
```

Mobile antes de buildar:

```bash
cd apps/mobile
npm test && npm run typecheck && npm run config && npx expo-doctor
```

O GitHub Actions possui pipelines separados para web/Worker e mobile.
