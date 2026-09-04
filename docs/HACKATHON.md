# Hackathon — RevenueCat Shipaton 2026

## Produto

Where's the Money, da ARTISYS, transforma extratos e dados bancários em uma leitura acionável: o que foi gasto, o que está pendente de decisão e o que provavelmente vai acontecer com o caixa.

## Diferencial demonstrável

1. abrir a Demo Pro segura com dados 100% sintéticos (`?demo=1`) ou importar arquivo;
2. mostrar categorias óbvias reconhecidas sem IA;
3. abrir Inbox e revisar a movimentação ambígua `PIX M J SILVA 9834`;
4. opcionalmente pedir uma sugestão Gemini, sempre sujeita a confirmação humana;
5. criar uma regra manual;
6. mostrar padrão recorrente com confiança, amostras, faixa típica e periodicidade;
7. abrir o Radar hero e mostrar o primeiro dia de risco, menor saldo e maiores drivers calculados localmente;
8. usar `Explicar com IA` para transformar apenas esses fatos determinísticos em linguagem simples;
9. abrir `Mais` e mostrar a monetização integrada ao produto;
10. demonstrar o Paywall RevenueCat nativo quando a Test Store estiver configurada;
11. mostrar o repositório, testes/CI e o fluxo de desenvolvimento pelo iPhone/iSH.

## Monetização / HAMM

A monetização foi desenhada ao redor de valor percebido, não de um paywall aleatório.

**Free** mantém o produto útil: importação, Inbox, categorização, até 3 regras ativas e uma prévia honesta de 7 dias do Radar.

**Pro** é a camada de automação e antecipação: Open Finance automático, Radar completo de 30 dias, regras ilimitadas, recorrências avançadas e explicação do Radar com Gemini quando configurado.

Os principais momentos de upgrade são contextuais:

- ao tentar conectar Open Finance;
- ao chegar ao fim da prévia de 7 dias;
- ao tentar criar/ativar uma quarta regra;
- ao tentar abrir detalhes avançados de recorrência.

A interface web envia uma solicitação à camada Expo e o SDK RevenueCat nativo abre Paywall ou Customer Center. O entitlement real `pro` nunca é criado pelo frontend.

## Modo Demo Pro

A URL abaixo ativa o cenário de julgamento sem depender de banco, Pluggy, RevenueCat ou Gemini:

```text
https://hackathon.nutricionistaalmeidavh.workers.dev/?demo=1
```

O dataset é sintético e determinístico. Enquanto a demo está ativa ele não é persistido em `wtm-portable`; ao sair, o estado real anterior é restaurado.

`demo-pro` libera toda a experiência visual, mas **não representa uma compra**: não altera RevenueCat e não muda a tag OneSignal. Isso permite gravar uma apresentação previsível e, separadamente, demonstrar uma compra Test Store real.

## Limite entre motor e IA

O motor financeiro continua sendo a fonte de verdade. Ele calcula categorias determinísticas, recorrências, saldo projetado, primeiro dia negativo e drivers. Gemini é opcional e recebe somente um resumo pequeno desses fatos para explicação, ou os campos mínimos de uma movimentação ambígua para sugerir uma categoria.

Gemini não pode calcular saldo, criar movimentação, inventar recorrência nem salvar categoria automaticamente. Se `GEMINI_API_KEY` estiver ausente ou a API falhar, Inbox, Demo e Radar continuam funcionando normalmente.

## Limite entre produto e RevenueCat

RevenueCat nativo é a fonte de verdade do `pro` real. A bridge suporta somente três comandos do web app: pedir estado, abrir plano e restaurar compra. Mensagens desconhecidas são ignoradas.

Sem `EXPO_PUBLIC_REVENUECAT_API_KEY`, o aplicativo não quebra: abre como Free, mantém a Demo Pro disponível e informa que o checkout nativo ainda não está configurado.

## Transparência

A interface deixa claro quando algo veio de regra, heurística, provedor, padrão, cálculo determinístico, demonstração ou explicação por IA. O aplicativo não apresenta uma classificação probabilística como fato absoluto e não apresenta a Demo Pro como assinatura real.

## Build in Public

Evidências recomendadas para `docs/evidence/`:

- screenshot do primeiro Connect Pluggy;
- importação das movimentações do sandbox;
- bug do Radar antes da correção;
- teste de regressão após a correção;
- primeira execução do Modo Demo;
- Radar hero mostrando risco e drivers;
- fallback da IA sem `GEMINI_API_KEY`;
- primeira explicação Gemini real;
- primeira tela Free com Radar de 7 dias;
- primeira abertura do Paywall RevenueCat Test Store;
- compra Test Store ativando `pro` e alterando a UI;
- screenshot do iSH rodando `npm test`;
- screenshot do iSH rodando `npm run build`;
- `git status`, commit e push feitos pelo iPhone;
- primeiro EAS development build Android concluído;
- deploy automático gerado a partir do commit.

## Open source

O projeto inclui licença MIT e documentação de arquitetura, decisões, IA, Demo Pro, RevenueCat/Free/Pro e processo de build mobile.
