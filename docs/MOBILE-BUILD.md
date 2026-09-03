# Mobile Build — desenvolvimento pelo iPhone

## Visão

Where's the Money é mantido com um fluxo em que o celular é a estação de desenvolvimento. O iPhone executa o iSH como terminal Linux, Git faz o versionamento, GitHub é a fonte oficial e o Cloudflare Worker executa o deploy.

```text
iPhone → iSH → Git → GitHub → Cloudflare Worker → Produção
```

O telefone controla o processo. Build de produção, API serverless e distribuição global ficam na nuvem.

## Preparar o iSH

No Alpine/iSH:

```bash
apk update
apk add git openssh nodejs npm nano
```

Valide:

```bash
git --version
node --version
npm --version
ssh -T git@github.com
```

## Clonar

```bash
git clone git@github.com:nutricionistaalmeidavh-spec/Hackathon.git
cd Hackathon
npm install
```

## Ciclo diário

```bash
git pull

# editar

npm test
npm run build

git status
git add .
git commit -m "feat: descreva a mudança"
git push origin main
```

Com o GitHub conectado ao Worker `hackathon`, o último comando inicia o deploy automaticamente.

## Interface local

```bash
npm run dev
```

Isso é suficiente para interface, motor determinístico, Radar e importação de arquivos.

## App completo local com Open Finance

Crie `.dev.vars` com as credenciais reais e execute:

```bash
npm run dev:worker
```

Esse comando gera `dist` e inicia o Worker local com as rotas Open Finance e o binding de assets.

## Editar pelo celular

Para mudanças rápidas:

```bash
nano src/App.tsx
```

Arquivos mais importantes:

```text
src/App.tsx
src/core/financeEngine.ts
src/importers/statementImport.ts
src/integrations/pluggy.ts
worker/index.ts
worker/routes/open-finance/
server/pluggy.ts
wrangler.toml
```

## Regra de ouro

Antes do push:

```bash
npm test && npm run build && npx wrangler deploy --dry-run
```

O GitHub Actions repete testes, build e dry-run do Worker na nuvem.
