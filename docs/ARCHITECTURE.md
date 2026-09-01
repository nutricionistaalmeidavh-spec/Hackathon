# Arquitetura

## Objetivo

Manter o domínio financeiro independente do provedor de build/deploy. O núcleo deve continuar funcionando se o projeto mudar de Vercel, Floot, AppDeploy ou qualquer outro host.

## Camadas

```text
src/App.tsx
   ↓
src/importers/statementImport.ts ──→ arquivos OFX/CSV/XLS/XLSX
   ↓
src/core/financeEngine.ts
   ├─ classificação determinística
   ├─ regras manuais
   ├─ recorrência
   └─ Radar 30 dias

src/integrations/pluggy.ts
   ↓ HTTP
api/open-finance/*
   ↓
Pluggy Sandbox / Open Finance
```

## Núcleo determinístico

O motor usa, nessa ordem lógica:

1. regra explicitamente criada pelo usuário;
2. evidência semântica forte na descrição/estabelecimento;
3. categoria fornecida pelo provedor;
4. padrão recorrente do mesmo estabelecimento e mesma direção;
5. se ainda houver ambiguidade, permanece em revisão.

Não existe fallback que invente categoria, saldo ou entrada futura.

## Recorrência

A chave do padrão inclui estabelecimento normalizado + direção. Créditos e débitos nunca são misturados.

Periodicidades aceitas inicialmente:

- semanal: ~7 dias;
- quinzenal: ~14 dias;
- mensal: ~30 dias.

A confiança combina número de amostras, consistência do intervalo, estabilidade de valor e, no mensal, consistência do dia do mês.

## Radar

O Radar:

- parte do saldo das contas não-cartão quando disponível;
- projeta recorrências fortes com a mediana dos valores;
- calcula média diária de débitos variáveis dos 30 dias anteriores;
- retira transações recorrentes da média variável para não contar duas vezes;
- mantém horizonte de 30 dias.

## Persistência

O protótipo salva estado no `localStorage`. Antes de uso comercial/multiusuário, a persistência deve migrar para banco com autenticação e isolamento por usuário.
