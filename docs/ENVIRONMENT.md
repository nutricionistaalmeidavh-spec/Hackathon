# Environment Variables e Secrets

## Regra principal

**O ENV real não vai para o GitHub.**

O Git recebe somente `.env.example`, com os nomes das variáveis e valores vazios. Os valores reais ficam:

- no iSH, apenas para teste local;
- nos bindings/secrets do Cloudflare Worker em produção.

## O que vai para o Git

```text
.env.example
```

Exemplo:

```dotenv
PLUGGY_CLIENT_ID=
PLUGGY_CLIENT_SECRET=
VITE_APP_ENV=development
```

## O que nunca vai para o Git

```text
.env
.env.local
.env.production
.dev.vars
.dev.vars.*
```

O `.gitignore` já bloqueia esses arquivos.

## Local no iSH

Para testar somente frontend/importação:

```bash
npm run dev
```

Para testar também o Worker e a Pluggy, crie um arquivo local de secrets:

```bash
nano .dev.vars
```

Conteúdo:

```dotenv
PLUGGY_CLIENT_ID="valor_real_aqui"
PLUGGY_CLIENT_SECRET="valor_real_aqui"
```

Depois:

```bash
npm run dev:worker
```

O Wrangler usa `.dev.vars` localmente. Esse arquivo não deve aparecer em:

```bash
git status
```

## Produção no Cloudflare Worker

O projeto de produção é o Worker `hackathon`. Os secrets de runtime são:

```text
PLUGGY_CLIENT_ID
PLUGGY_CLIENT_SECRET
```

O Worker lê esses valores por `env`. Eles não entram no bundle do React e não são enviados ao navegador.

A ausência dos secrets não impede build/deploy: o frontend continua disponível e `GET /api/open-finance/status` retorna a integração como não configurada.

## Pelo iSH

O fluxo principal continua sendo Git:

```bash
git pull
npm test
npm run build
git add .
git commit -m "feat: descrição"
git push
```

Com o Worker conectado ao GitHub, o push dispara build e deploy automaticamente.

Também existe deploy manual pelo Wrangler:

```bash
npx wrangler login
npm run deploy:worker
```

## Variáveis VITE_

Variáveis que começam com `VITE_` podem ser incorporadas ao JavaScript entregue ao navegador. Portanto devem ser tratadas como públicas.

Pode:

```text
VITE_APP_ENV
VITE_PUBLIC_ANALYTICS_ID
```

Nunca:

```text
VITE_PLUGGY_CLIENT_SECRET
VITE_OPENAI_API_KEY
```

`PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` permanecem somente no runtime do Worker.

## Por que o build funciona sem o ENV real

`npm run build` compila o frontend e verifica TypeScript do Worker e do helper server-side. Ele não precisa autenticar na Pluggy.

Os secrets só são necessários quando as rotas abaixo são executadas:

```text
/api/open-finance/status
/api/open-finance/connect-token
/api/open-finance/data
/api/open-finance/webhook
```
