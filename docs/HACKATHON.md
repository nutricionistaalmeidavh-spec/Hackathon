# Hackathon — RevenueCat Shipaton 2026

## Produto

Where's the Money, da ARTISYS, transforma extratos e dados bancários em uma leitura acionável: o que foi gasto, o que está pendente de decisão, o que provavelmente vai acontecer com o caixa e como prioridades concorrentes podem virar um plano acompanhável.

A tese desta versão é simples: **o usuário não precisa de cinco calculadoras isoladas; precisa de uma conversa financeira sustentada por números auditáveis**.

## Diferencial demonstrável

1. abrir a Demo Pro segura com dados e planejamento 100% sintéticos (`?demo=1`) ou importar arquivo;
2. mostrar categorias óbvias reconhecidas sem IA e revisar `PIX M J SILVA 9834`;
3. mostrar recorrências com confiança, amostras, faixa típica e periodicidade;
4. abrir o **Radar B+**: uma visão calma da trajetória e uma camada separada **Fique de olho** para pressão/risco;
5. mostrar o diagnóstico Essenciais / Flexíveis / Futuro e explicar que 50/30/20 é referência editável;
6. abrir **Planejar** e mostrar aposentadoria, carro e viagem na mesma conversa/plano;
7. demonstrar que fatos extraídos pela IA aparecem como candidatos e só entram no estado estruturado depois de confirmação humana;
8. mostrar a capacidade mensal derivada apenas de ajustes confirmados e os três cenários determinísticos de distribuição;
9. pesquisar um ativo/contexto com Gemini + Google Search grounding quando o secret estiver configurado;
10. mudar taxa/aporte em uma simulação e mostrar que o Scenario Engine, não a IA, recalcula o resultado;
11. abrir `Mais` e mostrar Free/Pro e o Paywall RevenueCat nativo quando a Test Store estiver configurada;
12. mostrar o repositório, testes/CI e o fluxo de desenvolvimento pelo iPhone/iSH.

## Fluxo principal

```text
Open Finance / arquivo
        ↓
motor determinístico
        ↓
Inbox + recorrências + Radar + saúde do orçamento
        ↓
conversa sobre objetivos e restrições
        ↓
fatos candidatos → confirmação humana
        ↓
plano estruturado
        ↓
pesquisa contextual opcional
        ↓
Scenario Engine determinístico
        ↓
plano vivo → Radar atualizado
```

Isso mantém o produto como uma única experiência. Radar não é uma calculadora; Planejar não é um formulário; pesquisa de mercado não é uma recomendação automática.

## Monetização / HAMM

A monetização foi desenhada ao redor de valor percebido, não de um paywall aleatório.

**Free** mantém o produto útil: importação, Inbox, categorização, até 3 regras ativas, uma prévia honesta de 7 dias do Radar e estrutura básica de objetivos.

**Pro** é a camada de automação, antecipação e profundidade: Open Finance automático, Radar completo de 30 dias, Fique de olho, regras ilimitadas, planejador conversacional completo, pesquisa contextual e cenários avançados.

Os principais momentos de upgrade são contextuais:

- ao tentar conectar Open Finance;
- ao tentar abrir detalhes além da janela Free do Radar;
- ao tentar criar/ativar uma quarta regra;
- ao tentar abrir detalhes avançados de recorrência;
- ao tentar usar conversa completa, pesquisa contextual ou cenários avançados no Planejador.

A interface web envia uma solicitação à camada Expo e o SDK RevenueCat nativo abre Paywall ou Customer Center. O entitlement real `pro` nunca é criado pelo frontend.

## Modo Demo Pro

A URL abaixo ativa o cenário de julgamento sem depender de banco, Pluggy, RevenueCat ou Gemini:

```text
https://hackathon.nutricionistaalmeidavh.workers.dev/?demo=1
```

O dataset e o `PlanningState` são sintéticos e determinísticos. Enquanto a demo está ativa eles não são persistidos em `wtm-portable`; ao sair, movimentações, regras, contas e planejamento reais anteriores são restaurados.

A demo inclui três objetivos concorrentes — aposentadoria, carro e viagem — e ajustes de gasto confirmados que produzem capacidade mensal limitada. Isso torna os cenários demonstráveis sem fabricar uma “decisão ótima”.

`demo-pro` libera toda a experiência visual, mas **não representa uma compra**: não altera RevenueCat e não muda a tag OneSignal. Isso permite gravar uma apresentação previsível e, separadamente, demonstrar uma compra Test Store real.

## Limite entre motor e IA

O motor financeiro continua sendo a fonte de verdade para dinheiro e matemática. Ele calcula categorias determinísticas, recorrências, saldo projetado, drivers, distribuição de orçamento, capacidade mensal, alocações entre metas, juros compostos e financiamento.

Gemini é opcional e limitado a três papéis:

- explicar fatos já calculados;
- sugerir categoria para uma movimentação ambígua, sempre com confirmação;
- conduzir a conversa, extrair **fatos candidatos** e pesquisar contexto de mercado quando configurado.

Gemini não pode calcular saldo, criar movimentação, inventar recorrência, salvar categoria automaticamente nem inserir premissa ambígua diretamente no plano. Se `GEMINI_API_KEY` estiver ausente ou a API falhar, Inbox, Demo, Radar B+ e o Planejador em fallback determinístico continuam funcionando.

## Pesquisa de mercado sem recomendação automática

`/api/ai/market-research` pode usar Google Search grounding para identificar e contextualizar consultas como `ITSA4`, `Bitcoin` e `Tesouro IPCA`. A camada normaliza entidade, fatos, data e fontes para a interface.

A pesquisa **não escolhe um ativo** para o usuário e não fornece ordem de compra/venda. Simulações permanecem no Scenario Engine e exibem explicitamente:

> Simulação informativa, não previsão. Não constitui recomendação de investimento, oferta ou indicação de compra/venda. Retornos passados não garantem resultados futuros.

## Radar B+

A primeira tela do Radar evita dramatizar um número isolado. Ela mostra horizonte e trajetória. Quando existe informação que merece atenção, o usuário abre **Fique de olho**, onde ficam mínimo projetado, saldo final, drivers e estrutura do orçamento.

Sem Pro, o sistema recebe somente os pontos da janela de 7 dias e não faz afirmação sobre o período bloqueado. Com Pro/Demo Pro, usa a projeção completa de 30 dias.

Vermelho/coral fica reservado a território monetário negativo; âmbar comunica atenção. Sweep do Radar e brilho da linha respeitam `prefers-reduced-motion`.

## Planejador conversacional

O `PlanningState` persiste no modo real junto com `txs`, `rules` e `accounts`. Estados antigos sem `planning` continuam carregando com defaults seguros.

O plano aceita múltiplos objetivos e buckets personalizados. A referência 50/30/20 é editável e o motor sinaliza soma acima de 100% em vez de corrigir silenciosamente.

A capacidade mensal vem apenas da diferença entre gasto atual e gasto-alvo de ajustes **confirmados**. O Scenario Engine compara:

- Prioridades primeiro;
- Equilibrado;
- Futuro primeiro.

Nenhum cenário pode alocar mais do que a capacidade mensal disponível.

## Limite entre produto e RevenueCat

RevenueCat nativo é a fonte de verdade do `pro` real. A bridge suporta somente três comandos do web app: pedir estado, abrir plano e restaurar compra. Mensagens desconhecidas são ignoradas.

Sem `EXPO_PUBLIC_REVENUECAT_API_KEY`, o aplicativo não quebra: abre como Free, mantém a Demo Pro disponível e informa que o checkout nativo ainda não está configurado.

## Transparência

A interface deixa claro quando algo veio de regra, heurística, provedor, padrão, cálculo determinístico, pesquisa, demonstração ou IA. O aplicativo não apresenta uma classificação probabilística como fato absoluto, uma simulação como previsão ou a Demo Pro como assinatura real.

## Build in Public

Evidências recomendadas para `docs/evidence/`:

- importação das movimentações do sandbox;
- teste de regressão do Radar;
- primeira execução do Modo Demo;
- Radar B+ com animação e Fique de olho;
- Planejador mostrando três objetivos simultâneos;
- confirmação de um fato candidato antes de entrar no plano;
- três cenários recalculados pelo motor;
- fallback da IA sem `GEMINI_API_KEY`;
- primeira pesquisa grounded real com fontes;
- primeira tela Free com Radar de 7 dias;
- primeira abertura do Paywall RevenueCat Test Store;
- compra Test Store ativando `pro` e alterando a UI;
- CI verde com testes/build/Wrangler dry-run;
- primeiro EAS development build Android concluído;
- deploy automático gerado a partir do commit.

## Open source

O projeto inclui licença MIT e documentação de arquitetura, decisões, IA, Demo Pro, Radar B+, Planejador, RevenueCat/Free/Pro e processo de build mobile.
