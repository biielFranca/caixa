# Fechamento de Caixa

Substitui a planilha `FECHAMENTO_DE_CAIXAAA.xlsx` — 488 abas, uma por dia — por um
site. Next.js hospedado na Vercel, Postgres no Supabase.

Todo o histórico da planilha já está importado: **486 dias**, de 05/02/2025 a
15/09/2026, com 10.562 lançamentos e R$ 653.711,42 de faturamento.

---

## 1. Acesso

| | |
|---|---|
| **Login** | `biel.ribeirofranca@gmail.com` |
| **Senha** | `qjVg8VBNetQo3TYxtMew` |
| **Banco** | Supabase, projeto `fechamento-caixa` (`hvozklupjiwlbsgbyuxy`, região sa-east-1) |

**Troque a senha.** Ela passou por um chat e por um script. Em
Supabase → Authentication → Users → seu usuário → *Reset password*.

Existe **um login só**. Não há cadastro aberto: para criar outro usuário, use
Supabase → Authentication → *Add user* (marque "Auto Confirm User").

---

## 2. Stack

| Camada | Escolha | Por quê |
|---|---|---|
| Front + back | Next.js 16 (App Router) | Uma coisa só pra manter, deploy nativo na Vercel |
| Banco | Supabase (Postgres) | Free tier, RLS pronto, backup automático |
| Auth | Supabase Auth (e-mail/senha) | Sem construir sessão do zero |
| Estilo | Tailwind | Sem lib de componente pesada |
| Gráfico | Recharts | Única dependência de UI |

Sem ORM, sem state manager, sem camada de API própria: as telas falam direto com
o Supabase e o RLS decide o que pode. Menos peça, menos coisa pra quebrar.

---

## 3. Rodar localmente

```bash
npm install
cp .env.example .env.local     # preencha URL e ANON KEY
npm run dev                    # http://localhost:3000
```

`.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://hvozklupjiwlbsgbyuxy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_WNCeDPTvfXjSiwhkkK4v7w_ux1AhDAI
```

Essas duas variáveis são públicas por design — vão pro navegador e quem protege
os dados é o RLS, não elas.

---

## 4. Deploy na Vercel

**Isto ainda falta fazer.** A conexão Vercel usada aqui não tem permissão para
criar projetos (403 `forbidden`), então os passos ficaram para você:

1. [vercel.com/new](https://vercel.com/new) → **Import Git Repository** → `biielFranca/caixa`
2. Framework: **Next.js** (detecta sozinho). Root directory: raiz.
3. **Environment Variables** — adicione as duas, em Production/Preview/Development:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://hvozklupjiwlbsgbyuxy.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `sb_publishable_WNCeDPTvfXjSiwhkkK4v7w_ux1AhDAI`
4. **Deploy.**

O código está na branch `claude/spreadsheet-to-vercel-site-9ctvuc`. A Vercel
publica a branch de produção (`main`) — junte a branch na `main` para o site
entrar no ar; qualquer push depois disso redeploya sozinho.

Depois do primeiro deploy, pegue a URL e coloque em Supabase → Authentication →
URL Configuration → *Site URL* e *Redirect URLs*.

**Nunca** coloque a `SUPABASE_SERVICE_ROLE_KEY` na Vercel. Ela ignora o RLS e só
serve ao script de importação, rodando na sua máquina.

---

## 5. Banco de dados

Sete tabelas e uma view. Todas com RLS ligado: sem sessão, não se lê nem escreve nada.

| Tabela | Guarda | Detalhe |
|---|---|---|
| `days` | Um fechamento por dia | `date` é **único** — acabou o problema da planilha de ter duas abas para o mesmo dia |
| `entries` | Cada valor lançado | `method`: `dinheiro`, `pix` ou `cartao` |
| `employees` | Cadastro e regra de pagamento | Cada um tem a própria diária, valor por entrega e franquia |
| `day_shifts` | Quem trabalhou em cada dia | Único por (dia, funcionário) |
| `platform_revenue` | O bloco "TOTAL LIVRE" | `99`, `ifood`, `keeta`, `caderno` |
| `savings` | Dinheiro guardado por pessoa | Valor negativo = retirada |
| `settings` | Padrões de pagamento | Linha única |

### A view `day_summary`

Totais e conferência **nunca são gravados** — são calculados na hora, pela view.
Essa é a diferença central em relação à planilha, onde o total era uma fórmula
que dava pra quebrar. E quebrou: havia `=SUM(H5:H181)` num bloco de 14 linhas e
`=SUM(H3,E3,B3,)` com vírgula sobrando.

Colunas: `total_dinheiro`, `total_pix`, `total_cartao`, `total_caderno`,
`total_caixa`, `difference`, `total_funcionarios`, `total_livre`.

---

## 6. As duas regras de negócio

### Conferência do caixa

Exatamente como a planilha fazia:

```
TOTAL CADERNO = dinheiro + pix + cartão            (tudo que foi lançado)
TOTAL CAIXA   = (dinheiro contado + moeda contada + pix + cartão)
                − dinheiro inicial − moeda inicial  (o que existe de fato)
DIFERENÇA     = TOTAL CAIXA − TOTAL CADERNO         (+ sobra, − falta)
```

Código em `src/lib/calc.ts` (`dayTotals`) e na view `day_summary`. Os dois
resultados batem — foi conferido contra os valores da própria planilha em 479
dos 486 dias.

### Pagamento do entregador

```
valor = (entregas − entregas_inclusas) × valor_por_entrega + diária
      = (entregas − 10) × 7 + 120                (padrão atual)
```

**Não existe piso, de propósito.** Assim como na planilha, 5 entregas dão
`(5−10)×7+120 = R$ 85,00`, abaixo da diária. Quem não trabalhou fica sem turno
lançado e recebe zero — que é como a planilha zerava a linha na mão.

Cozinha tem valor fixo (R$ 339,00), não depende de entregas.

Os padrões ficam em **Config**; cada funcionário pode ter regra própria em
**Funcionários**. O campo "valor (sobrescrever)" na tela do caixa ignora a regra
naquele dia específico.

---

## 7. As telas

### `/` — Painel
Fechamento de hoje, totais do mês (faturamento, média por dia, sobra/falta
acumulada, folha, total livre), gráfico dos últimos 30 dias lançados e as 5
maiores diferenças de caixa do mês.

### `/caixa/[data]` — Fechamento do dia
A tela principal, a que substitui a aba da planilha. Mesmos blocos e mesma ordem:

- **Abertura e contagem** — dinheiro/moeda inicial e o que foi contado no fim
- **Três colunas de lançamento** — digite o valor e dê Enter; aceita `12,50` e `12.50`
- **Conferência** — caderno, caixa, sobra/falta e total livre, recalculados a cada tecla
- **Funcionários** — marque quem trabalhou, informe as entregas, o valor sai sozinho
- **Total livre** e **observações do dia**

Navegação por dia anterior/próximo. `Salvar fechamento` grava tudo de uma vez.
Salvar substitui os lançamentos daquele dia — é reescrita do dia inteiro, não
diferença.

### `/historico` — Histórico
Um mês por vez, com totais no topo e uma linha por dia. **Exportar CSV** gera
arquivo com `;` e vírgula decimal, que o Excel em português abre direto.

### `/funcionarios` — Funcionários
Cadastro, edição da regra de pagamento e, para o mês escolhido, dias
trabalhados, entregas e total pago. Funcionário não se apaga, se **desativa** —
o histórico dele continua de pé.

### `/guardado` — Dinheiro guardado
Substitui a aba `dinheiro guardado`, onde os valores eram texto solto
(`"04-09 $33,00"`) e ninguém conseguia somar. Agora cada pessoa tem saldo.

### `/config` — Configuração
Padrões de pagamento, com simulação ao vivo, e a lista dos dias importados que
precisam de conferência.

---

## 8. Como a planilha foi importada

Dois passos, ambos versionados:

```bash
python3 scripts/extract.py caminho/FECHAMENTO_DE_CAIXAAA.xlsx data
node scripts/import.mjs            # --reset apaga tudo antes
```

`extract.py` lê o xlsx e gera `data/extract.json` + `data/import-report.md`.
`import.mjs` sobe para o Supabase. O import exige `SUPABASE_SERVICE_ROLE_KEY` no
`.env.local` — pegue em Supabase → Project Settings → API. Rode só localmente.

### O que precisou de conserto

A planilha tinha bem mais problema do que aparenta:

| Problema | O que foi feito |
|---|---|
| Nome de aba em 5 formatos (`DIA 05-02`, `09-05 sexta`, `26-08-2026`, `segunda 24-0`) | Parser com reparo por vizinhança |
| `quarta 05-02` e `quinta 06-02` entre abas de março | Mês corrigido para 03 pelos vizinhos |
| `segunda 24-0`, truncada | Resolvida como 24-03 |
| Virada de ano sem marcação | Ano vira só quando o mês vai de 12 para 1 |
| **19 abas chamadas `Planilha1`…`Planilha19`, com fechamento real dentro** | Data inferida pela posição; as ambíguas ficaram marcadas |
| Ranges de soma errados (`=SUM(H5:H181)`) | Lido o range da própria fórmula, e não uma janela fixa |
| Datas repetidas | Deslocadas e marcadas |

O primeiro parser, que lia uma janela fixa de linhas, divergia da planilha em
108 dias. Passando a ler o range declarado em cada fórmula `SUM`, a divergência
caiu para 7 — e esses 7 são abas cuja fórmula original já estava quebrada.

### Os 27 dias marcados

Aparecem em **Config** e com etiqueta `revisar` no histórico. Abra, confira,
salve — ao salvar a marcação some. São de data incerta, não de valor errado.
Lista completa em [`data/import-report.md`](data/import-report.md).

### O que **não** é erro de importação

262 dias têm diferença de caixa acima de R$ 1,00. **Isso é dado real do
negócio** — a planilha já tinha essas diferenças, e o cálculo daqui bate com o
dela em 460 dos 471 dias que tinham a conferência preenchida. A sobra acumulada
do período todo é de R$ 5.591,72.

Dos 56 nomes encontrados, **7 ficaram ativos** (os que aparecem nos últimos 60
dias) e 49 inativos. Reative em Funcionários quem precisar.

---

## 9. Segurança

- **RLS em todas as tabelas.** Sem sessão válida, o Postgres não devolve linha nenhuma.
- **Toda página protegida confere a sessão no servidor**, via `requireUser()`. O
  `proxy.ts` só redireciona e renova cookie — conveniência, não barreira. Essa
  separação é de propósito: middleware de Next já teve CVE de bypass de auth.
- **Next 16**, sem vulnerabilidade conhecida (`npm audit` limpo). A versão 15.0.3,
  usada no primeiro scaffold, tinha 26 advisories incluindo bypass de autorização.
- A `anon key` é pública e pode ficar no navegador. A `service_role` **não** —
  ela ignora RLS e só existe para o script de importação.

---

## 10. Estrutura

```
src/
  app/
    page.tsx                 painel
    login/page.tsx
    caixa/page.tsx           redireciona para hoje
    caixa/[data]/page.tsx    fechamento do dia
    historico/page.tsx
    funcionarios/page.tsx
    guardado/page.tsx
    config/page.tsx
  components/
    CaixaEditor.tsx          a tela principal
    EntryColumn.tsx          coluna de lançamentos
    EmployeeManager.tsx
    SavingsManager.tsx
    SettingsForm.tsx
    RevenueChart.tsx
    ExportButton.tsx  MonthSelect.tsx  Nav.tsx  Stat.tsx
  lib/
    calc.ts                  conferência e regra de pagamento
    types.ts
    supabase/client.ts       navegador
    supabase/server.ts       servidor + requireUser()
  proxy.ts                   renova sessão e redireciona
scripts/
  extract.py                 xlsx  -> JSON + relatório
  import.mjs                 JSON  -> Supabase
data/
  import-report.md           o que precisou de conserto
```

---

## 11. O que ficou de fora, e por quê

| Não tem | Motivo |
|---|---|
| Grade editável estilo planilha | Custa 3x mais e entrega pior que o formulário |
| Login por funcionário, permissões | Um login resolve o uso atual; permissão é tela, cadastro e risco |
| Modo offline / PWA | Exige sincronização e resolução de conflito. Vale como V2 se a internet do caixa cair de verdade |
| Relatório fiscal, PDF, multi-loja | Não há demanda provada |

Duas coisas que ficam mais fáceis depois de um tempo de uso real: **fechamento
do mês** (travar o mês e comparar folha com faturamento) e **alerta de
diferença** (avisar quando a falta do dia passar de um limite). Nenhuma das duas
antes de existirem dados novos.
