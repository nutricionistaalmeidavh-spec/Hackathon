# Environment Variables e Secrets

## Resposta curta

**O `.env` real não vai para o Git.**

O Git recebe somente `.env.example`, com os nomes das variáveis e valores vazios. O arquivo real (`.env.local`, por exemplo) existe apenas no iSH para testes locais. Em produção, os valores são cadastrados diretamente no provedor de deploy, como Vercel.

## Arquivos

Commitado:

```text
.env.example
```

Nunca commitados:

```text
.env
.env.local
.env.production
.env.*.local
```

O `.gitignore` já protege esses arquivos.

## Local no iSH

Crie sua cópia local:

```bash
cp .env.example .env.local
nano .env.local
```

Preencha no iSH, não no Git:

```dotenv
PLUGGY_CLIENT_ID=valor_real_aqui
PLUGGY_CLIENT_SECRET=valor_real_aqui
VITE_APP_ENV=development
```

Depois confirme que o Git não está vendo o arquivo:

```bash
git status
```

`.env.local` não deve aparecer.

## Produção no Vercel

Ao conectar o repositório ao Vercel, abra o projeto e cadastre em **Settings → Environment Variables**:

```text
PLUGGY_CLIENT_ID
PLUGGY_CLIENT_SECRET
```

Marque pelo menos o ambiente `Production`; normalmente também `Preview` para testar branches/PRs.

Depois disso, cada push ao GitHub pode disparar um build. O Vercel injeta as variáveis no backend durante execução/deploy; elas não entram no repositório.

## Pelo CLI no iSH

Se preferir fazer tudo pelo terminal:

```bash
npm install -g vercel
vercel login
vercel link
vercel env add PLUGGY_CLIENT_ID production
vercel env add PLUGGY_CLIENT_SECRET production
```

O CLI pede o valor de forma interativa. Não coloque o secret no comando para evitar histórico do shell.

Para puxar variáveis do projeto para um arquivo local:

```bash
vercel env pull .env.local
```

## O que pode começar com VITE_

Variáveis `VITE_*` são incorporadas ao JavaScript enviado ao navegador. Portanto são **públicas**.

Pode:

```text
VITE_APP_ENV
VITE_PUBLIC_ANALYTICS_ID
```

Não pode:

```text
VITE_PLUGGY_CLIENT_SECRET
VITE_OPENAI_API_KEY
```

A Pluggy Client Secret permanece apenas em `api/open-finance/*` no servidor.

## Por que `npm run build` funciona sem o secret

O build do frontend compila a interface. As credenciais da Pluggy são necessárias quando as funções serverless executam em runtime. Portanto é possível rodar `npm run build` no iSH sem colocar secrets no Git.

Para testar Open Finance localmente, aí sim o runtime local (`vercel dev`) precisa acessar `.env.local`.
