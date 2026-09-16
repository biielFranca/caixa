# Fechamento de Caixa

Sistema de fechamento diário de caixa da lanchonete. Substitui a planilha que eu
usava desde fevereiro de 2025 — uma aba por dia, 488 no total.

**Produção:** https://caixa-lyart.vercel.app

Todo o histórico da planilha está migrado: 486 dias, 10.562 lançamentos,
R$ 653 mil em faturamento.

## Stack

Next.js 16 (App Router) na Vercel, Postgres no Supabase com RLS, Tailwind e
Recharts. Sem ORM e sem camada de API própria — as telas consultam o Supabase
direto e o RLS decide o acesso.

## Modelo de dados

| Tabela | |
|---|---|
| `days` | Um fechamento por dia. `date` é único |
| `entries` | Lançamentos individuais — `dinheiro`, `pix` ou `cartao` |
| `employees` | Cadastro e regra de pagamento de cada um |
| `day_shifts` | Quem trabalhou em cada dia |
| `platform_revenue` | Faturamento por canal: 99, iFood, Keeta, caderno |
| `savings` | Dinheiro guardado por pessoa |
| `settings` | Padrões de pagamento |

Totais e conferência ficam na view `day_summary`, calculados na consulta e nunca
gravados. Foi a mudança mais importante em relação à planilha, onde cada total
era uma fórmula que dava pra quebrar — e quebrava: havia `=SUM(H5:H181)` num
bloco de 14 linhas e `=SUM(H3,E3,B3,)` com vírgula sobrando.

## Regras de cálculo

Conferência do caixa, igual à planilha:

```
TOTAL CADERNO = dinheiro + pix + cartão
TOTAL CAIXA   = (dinheiro contado + moeda contada + pix + cartão)
                − dinheiro inicial − moeda inicial
DIFERENÇA     = TOTAL CAIXA − TOTAL CADERNO
```

Pagamento do entregador:

```
(entregas − entregas_inclusas) × valor_por_entrega + diária
(entregas − 10) × 7 + 120
```

Sem piso, de propósito: 5 entregas dão R$ 85, abaixo da diária, exatamente como
a planilha calculava. Quem não trabalhou não tem turno lançado. Cozinha é valor
fixo.

Os padrões ficam em Config e valem para cadastros novos; cada funcionário pode
ter regra própria. Implementação em `src/lib/calc.ts` e na view.

## Telas

| Rota | |
|---|---|
| `/` | Totais do dia e do mês, faturamento dos últimos 30 dias, maiores diferenças |
| `/caixa/[data]` | O fechamento em si — abertura, lançamentos, conferência ao vivo, funcionários, canais |
| `/historico` | Um mês por vez, com export CSV |
| `/funcionarios` | Cadastro, regra de pagamento e totais do mês |
| `/guardado` | Saldo de dinheiro guardado por pessoa |
| `/config` | Padrões de pagamento e dias importados pendentes de conferência |

## Migração da planilha

`scripts/extract.py` lê o xlsx e gera o JSON e o relatório;
`scripts/import.mjs` carrega no Supabase.

A planilha tinha mais inconsistência do que aparentava. Nome de aba em cinco
formatos diferentes, duas abas de março datadas como fevereiro, uma truncada
(`segunda 24-0`), virada de ano sem marcação e 19 abas chamadas `Planilha1..19`
com fechamento real dentro.

O que mais importou: a primeira versão do extrator lia uma janela fixa de linhas
e divergia da planilha em 108 dias. Lendo o range declarado em cada fórmula
`SUM`, a divergência caiu para 7 — e esses 7 têm a fórmula original quebrada.

27 dias ficaram marcados para conferência, todos por data incerta e não por
valor. Estão listados em `data/import-report.md` e aparecem em Config.

Os 262 dias com diferença acima de R$ 1,00 não são erro de migração: a planilha
já os tinha, e o cálculo daqui bate com o dela em 460 dos 471 dias que tinham a
conferência preenchida.

## Rodando local

```bash
npm install
cp .env.example .env.local   # URL e anon key do Supabase
npm run dev
```

A `service_role key` só é usada pelo script de importação, nunca pela aplicação
nem pela Vercel.

## Notas

Um login apenas, criado direto no Supabase — não há cadastro aberto. Toda página
protegida valida a sessão no servidor via `requireUser()`; o `proxy.ts` apenas
redireciona e renova o cookie, e não é tratado como barreira de segurança.

Ficaram de fora por decisão: grade editável estilo planilha, login por
funcionário, modo offline e relatório fiscal. Fechamento de mês e alerta de
diferença fazem sentido depois de rodar um tempo com dados novos.
