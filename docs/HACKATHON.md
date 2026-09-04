# Hackathon — RevenueCat Shipaton 2026

## Produto

Where's the Money, da ARTISYS, transforma extratos e dados bancários em uma leitura acionável: o que foi gasto, o que está pendente de decisão e o que provavelmente vai acontecer com o caixa nos próximos 30 dias.

## Diferencial demonstrável

1. abrir a demonstração segura com dados 100% sintéticos (`?demo=1`) ou conectar Pluggy/importar arquivo;
2. mostrar categorias óbvias reconhecidas sem IA;
3. abrir Inbox e revisar a movimentação ambígua `PIX M J SILVA 9834`;
4. opcionalmente pedir uma sugestão Gemini, sempre sujeita a confirmação humana;
5. criar uma regra manual;
6. mostrar padrão recorrente com confiança, amostras, faixa típica e periodicidade;
7. abrir o Radar hero e mostrar o primeiro dia de risco, menor saldo e maiores drivers calculados localmente;
8. usar `Explicar com IA` para transformar apenas esses fatos determinísticos em linguagem simples;
9. mostrar o repositório, testes/CI e o fluxo de desenvolvimento pelo iPhone/iSH.

## Modo Demo

A URL abaixo ativa o cenário de julgamento sem depender de banco, Pluggy ou Gemini:

```text
https://hackathon.nutricionistaalmeidavh.workers.dev/?demo=1
```

O dataset é sintético e determinístico. Enquanto a demo está ativa ele não é persistido em `wtm-portable`; ao sair, o estado real anterior é restaurado.

## Limite entre motor e IA

O motor financeiro continua sendo a fonte de verdade. Ele calcula categorias determinísticas, recorrências, saldo projetado, primeiro dia negativo e drivers. Gemini é opcional e recebe somente um resumo pequeno desses fatos para explicação, ou os campos mínimos de uma movimentação ambígua para sugerir uma categoria.

Gemini não pode calcular saldo, criar movimentação, inventar recorrência nem salvar categoria automaticamente. Se `GEMINI_API_KEY` estiver ausente ou a API falhar, Inbox, Demo e Radar continuam funcionando normalmente.

## Transparência

A interface deixa claro quando algo veio de regra, heurística, provedor, padrão, cálculo determinístico ou explicação por IA. O aplicativo não apresenta uma classificação probabilística como fato absoluto.

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
- screenshot do iSH rodando `npm test`;
- screenshot do iSH rodando `npm run build`;
- `git status`, commit e push feitos pelo iPhone;
- primeiro EAS development build Android concluído;
- deploy automático gerado a partir do commit.

## Open source

O projeto inclui licença MIT e documentação de arquitetura, decisões, IA, demo e processo de build mobile.
