# Woodpecker QA — Where's the Money

O projeto usa o Woodpecker self-hosted da ArtiSys para executar QA no Windows sem depender de GitHub Actions ou de operacao manual pelo Termius.

## Host confiavel

- UI: `https://ci.artisys.dev`
- Agent: Windows `windows/amd64`, backend `local`
- Workspace do Agent: `C:\Users\Marcio\ArtiSys\woodpecker-work`
- Config do Agent: `C:\Users\Marcio\ArtiSys\woodpecker-agent\agent.conf`
- Utilidades compartilhadas: `C:\VICTOR\Artisys\AgroFrota\utilidades`
- Reporter GitHub: `artisys-ci-reporter`
- Evidencias persistentes: `C:\VICTOR\Hackathon-QA\woodpecker`

O backend local executa os comandos diretamente no Windows. Somente repositorios confiaveis devem ser habilitados nesse Agent.

## Pipelines

### `hackathon-static`

Executa em `push` para `main` e manualmente:

1. `npm ci` raiz;
2. `npm ci` mobile;
3. testes mobile;
4. typecheck mobile;
5. testes web/Worker;
6. build de producao;
7. reporte de sucesso/falha no GitHub.

### `hackathon-android`

Executa em `push` para `main` e manualmente:

1. copia apenas `.env`/`.dev.vars` do host confiavel, sem imprimir valores;
2. valida `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=pro`;
3. reutiliza um emulador conectado ou inicia `Pixel_9` headless;
4. inicia Metro em background e configura `adb reverse`;
5. gera/instala o development build atual;
6. valida a navegacao nativa `Hoje / Inbox / Radar / Planejar / Mais`;
7. consulta `/api/integrations/status` do Worker publicado e exige Pluggy + Gemini configurados;
8. abre a area de assinatura, automatiza o paywall RevenueCat e tenta `TEST VALID PURCHASE`;
9. fecha/reabre o app e exige `Plano Pro ativo`/gerenciamento real;
10. tenta `Restore Purchases` e confirma que o estado Pro permanece;
11. salva XMLs do UIAutomator, screenshots, Metro log e `qa-summary.json`;
12. publica status detalhado com `artisys-ci-reporter`.

## Segredos

Segredos nao sao versionados. O Agent copia os arquivos ignorados a partir de:

- `C:\Users\Marcio\StudioProjects\Hackathon\apps\mobile\.env`
- `C:\Users\Marcio\StudioProjects\Hackathon\.dev.vars`

O pipeline nunca imprime os valores desses arquivos.

## Concorrencia

O Agent esta preparado para dois workflows. As pipelines estatica e Android podem rodar em paralelo. O Android runner usa um mutex local para impedir duas execucoes Android concorrentes de disputarem o mesmo AVD/ADB.

## Resultado esperado

Depois de o repositorio estar habilitado no `ci.artisys.dev`, o fluxo normal passa a ser:

```text
push main
  -> Woodpecker static QA
  -> Woodpecker Android QA
  -> evidencias locais
  -> PASS/FAIL no GitHub
```

Termius fica apenas para manutencao emergencial do host/Agent, nao para o QA cotidiano.
