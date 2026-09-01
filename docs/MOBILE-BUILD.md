# Mobile Build — desenvolvimento pelo iPhone

## Visão

Where's the Money é mantido com um fluxo em que o celular é a estação de desenvolvimento. O iPhone executa o iSH como terminal Linux, Git faz o versionamento, GitHub é a fonte oficial e o CI/CD executa os builds de produção.

```text
iPhone → iSH → Git → GitHub → CI/CD → Produção
```

A vantagem não é fingir que o telefone substitui um servidor de build. O telefone controla o processo; builds pesados e publicação ficam na nuvem.

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

## Clonar o projeto

```bash
git clone git@github.com:nutricionistaalmeidavh-spec/Hackathon.git
cd Hackathon
npm install
```

## Ciclo diário

```bash
git pull
npm test
npm run build
# editar arquivos
npm test
npm run build
git status
git add .
git commit -m "feat: descreva a mudança"
git push origin main
```

## Editar pelo iPhone

Para pequenas alterações, `nano` funciona bem:

```bash
nano src/App.tsx
```

Também é possível usar editores iOS que abrem a pasta do iSH, mas o fluxo não depende deles.

## Rodar a interface no celular

```bash
npm run dev
```

O Vite imprime o endereço local. No mesmo iPhone, abra o endereço indicado pelo terminal no navegador. Se quiser testar as funções `/api` e Open Finance localmente, use `vercel dev` em vez de `npm run dev`.

## Regra de ouro

Antes de todo push que pretende ir para produção:

```bash
npm test && npm run build
```

O mesmo check deve existir no CI para impedir que um commit quebrado seja promovido.
