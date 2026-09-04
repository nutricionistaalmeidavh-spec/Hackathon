# Environment Variables e Secrets

## Regra principal

**O ENV real não vai para o GitHub.**

O Git recebe somente `.env.example`, com os nomes das variáveis e valores vazios. Os valores reais ficam:

- no iSH/PC, apenas para teste local;
- nos bindings/secrets do Cloudflare Worker em produção.

## O que vai para o Git

```text
.env.example
```

Exemplo:

```dotenv
PLUGGY_CLIENT_ID=
PLUGGY_CLIENT_SECRET=
GEMINI_API_KEY=
VITE_APP_ENV=development
```

`GEMINI_API_KEY` é opcional. Sem ela, a demonstração, Inbox, regras, recorrências e Radar determinístico continuam funcionando; apenas os botões de explicação/sugestão por IA retornam estado indisponível.

## O que nunca vai para o Git

```text
.env
.env.local
.env.production
.dev.vars
.dev.vars.*
```

O `.gitignore` já bloqueia esses arquivos.

## Local no iSH/PC

Para testar somente frontend/importação/demo:

```bash
npm run dev
```

Para testar também o Worker, Pluggy e Gemini, crie um arquivo local de secrets:

```bash
nano .dev.vars
```

Conteúdo:

```dotenv
PLUGGY_CLIENT_ID="valor_real_aqui"
PLUGGY_CLIENT_SECRET="valor_real_aqui"
GEMINI_API_KEY="valor_real_aqui"
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
GEMINI_API_KEY
```

`GEMINI_API_KEY` é acessada apenas pelo Worker nas rotas:

```text
/api/ai/explain
/api/ai/categorize
```

O navegador e o app Expo nunca recebem essa chave. O Worker envia ao Gemini apenas fatos financeiros mínimos e validados; extrato completo, token Pluggy, ID de conta, CPF e credenciais não fazem parte do contrato da IA.

A ausência dos secrets não impede build/deploy: o frontend continua disponível, `GET /api/open-finance/status` informa Pluggy como não configurada quando aplicável e as rotas de IA retornam `503 AI_NOT_CONFIGURED`.

## Configurar Gemini no Cloudflare

Depois de obter a chave no Google AI Studio, adicione-a como secret do Worker, nunca como variável `VITE_`:

```bash
npx wrangler secret put GEMINI_API_KEY --name hackathon
```

O código usa a Gemini Interactions API via Worker. A seleção do modelo fica centralizada server-side para poder ser atualizada sem alterar o frontend.

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
VITE_GEMINI_API_KEY
VITE_OPENAI_API_KEY
```

`PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET` e `GEMINI_API_KEY` permanecem somente no runtime do Worker.

## Por que o build funciona sem o ENV real

`npm run build` compila o frontend e verifica TypeScript do Worker e do helper server-side. Ele não precisa autenticar na Pluggy nem chamar Gemini.

Os secrets só são necessários quando as respectivas rotas são executadas:

```text
/api/open-finance/status
/api/open-finance/connect-token
/api/open-finance/data
/api/open-finance/webhook
/api/ai/explain
/api/ai/categorize
```
