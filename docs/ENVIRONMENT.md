# Environment Variables e Secrets

## Regra principal

**O ENV real não vai para o GitHub.**

O Git recebe somente `.env.example`, com os nomes das variáveis e valores vazios. Os valores reais ficam em dois lugares possíveis:

- no iSH, apenas para teste local;
- no Cloudflare Pages, para Preview e Production.

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

Para testar também as Pages Functions e a Pluggy, crie um arquivo local de secrets:

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
npm run dev:pages
```

O Wrangler usa `.dev.vars` localmente. Esse arquivo não deve aparecer em:

```bash
git status
```

## Produção no Cloudflare Pages

Depois de criar o projeto no Cloudflare Pages com este repositório:

1. abra **Workers & Pages**;
2. selecione o projeto;
3. abra **Settings**;
4. entre em **Variables and Secrets**;
5. adicione:

```text
PLUGGY_CLIENT_ID
PLUGGY_CLIENT_SECRET
```

Cadastre os valores reais para **Production** e, se quiser testar branches/PRs, também para **Preview**.

As Pages Functions leem esses valores em runtime através de `context.env`. Eles não entram no bundle do React e não são enviados ao navegador.

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

Se o projeto do Cloudflare estiver conectado ao GitHub, o push dispara o build e o deploy automaticamente.

Também existe deploy manual pelo Wrangler:

```bash
npx wrangler login
npm run deploy:pages
```

Para um projeto conectado por Git, prefira o deploy automático pelo push.

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

`PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` permanecem no runtime das Cloudflare Pages Functions.

## Por que o build funciona sem o ENV real

`npm run build` compila o frontend e verifica o código das Functions. Ele não precisa autenticar na Pluggy.

Os secrets só são necessários quando as rotas abaixo são executadas:

```text
/api/open-finance/status
/api/open-finance/connect-token
/api/open-finance/data
/api/open-finance/webhook
```
