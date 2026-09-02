# Mobile Build — desenvolvimento pelo iPhone

## Visão

Where's the Money é mantido com um fluxo em que o celular é a estação de desenvolvimento. O iPhone executa o iSH como terminal Linux, Git faz o versionamento, GitHub é a fonte oficial e o Cloudflare Pages executa o deploy.

```text
iPhone → iSH → Git → GitHub → Cloudflare Pages → Produção
```

O telefone controla o processo. Build de produção, Pages Functions e distribuição global ficam na nuvem.

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

Com o GitHub conectado ao Pages, o último comando inicia o deploy automaticamente.

## Interface local

```bash
npm run dev
```

Isso é suficiente para interface, motor determinístico, Radar e importação de arquivos.

## App completo local com Open Finance

Crie `.dev.vars` com as credenciais reais e execute:

```bash
npm run dev:pages
```

Esse comando gera `dist` e inicia o runtime local do Cloudflare Pages com as Functions.

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
functions/api/open-finance/
server/pluggy.ts
```

## Regra de ouro

Antes do push:

```bash
npm test && npm run build
```

O GitHub Actions repete essa verificação na nuvem.
