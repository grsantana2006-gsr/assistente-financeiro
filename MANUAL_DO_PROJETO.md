# 📖 Manual Completo: Assistente Financeiro Pessoal

Seja bem-vindo ao manual técnico e funcional definitivo do seu **Assistente Financeiro Pessoal**. Este documento foi estruturado como um guia de engenharia e negócios, explicando em detalhes como cada setor da página funciona, a lógica matemática por trás dos cálculos, como o código foi organizado e como as tecnologias de ponta na nuvem se conectam.

---

## 🏗️ 1. Arquitetura do Sistema (Visão Geral Full-Stack)

O seu sistema adota o padrão moderno de arquitetura **Full-Stack desacoplada**, dividida em três camadas independentes:

```
[ Usuário / Navegador / Celular ]
                │
                ▼
       1. FRONTEND (React + Vite na Vercel)
          - Renderiza a interface visual (Glassmorphism)
          - Gerencia estados e reatividade (useState, hooks)
          - Dispara chamadas HTTP via api.js
                │  (Requisições REST JSON)
                ▼
       2. BACKEND (Node.js + Express no Render)
          - "Fonte única da verdade" dos cálculos matemáticos
          - Validação defensiva de todos os campos
          - Executa regras de negócio (calculos.js)
                │  (SQL via Driver pg)
                ▼
       3. BANCO DE DADOS (PostgreSQL no Supabase)
          - Armazenamento persistente e relacional blindado
          - Tabelas: bancos, transacoes, cofre, pagamentos_fixas, configuracoes
```

* **Frontend (Vercel):** `https://assistente-financeiro-two-omega.vercel.app/`
* **Backend (Render):** `https://assistente-financeiro-tjdd.onrender.com/api`
* **Database (Supabase):** PostgreSQL em nuvem AWS (com Pooler de conexão para estabilidade IPv4).

---

## 🧭 2. Guia Detalhado de Cada Setor da Página

Cada seção da tela do aplicativo foi projetada como um **componente independente do React**, com responsabilidades bem definidas. A seguir, entenda o funcionamento, o conceito financeiro e os bastidores de código de cada um:

---

### 🌟 Setor 1: Header de Indicadores Globais (`StatusHeader.jsx`)

Localizado no topo da aplicação, este setor funciona como o **painel de bordo (cockpit)** da sua vida financeira. Ele resume instantaneamente a sua saúde financeira atual através de três cartões de destaque:

1. **🏦 Dinheiro no Cofre:**
   * **O que é:** O somatório de todo o dinheiro guardado em metas, reservas de emergência e objetivos.
   * **Origem do cálculo:** Calculado pelo backend somando a coluna `saldo_atual` da tabela `cofre`.
   * **Função financeira:** Representa o seu patrimônio líquido líquido protegido, que não deve ser misturado com o dinheiro de giro do dia a dia.
2. **📈 Receita Líquida do Mês:**
   * **O que é:** Todo o dinheiro que entra na sua conta no mês de referência.
   * **Origem do cálculo:** Função `calcularReceitaDoMes` no backend. Soma todas as receitas ativas com categoria `Fixo` (ex: Salário) mais qualquer receita avulsa pontual que tenha a data de compra dentro do mês.
   * **Função financeira:** Estabelece o teto máximo de recursos disponíveis para cobrir seus custos e poupar.
3. **💳 Faturas Abertas / Comprometimento:**
   * **O que é:** A soma de todas as despesas que pesam financeiramente no mês de referência.
   * **Origem do cálculo:** Função `contaNaFatura` no backend. Inclui todas as despesas fixas ativas, a parcela vigente das compras parceladas no cartão de crédito e as despesas variáveis à vista efetuadas no próprio mês.
   * **Função financeira:** Mostra o passivo imediato que você precisará liquidar no fechamento do mês.

---

### 💵 Setor 2: Receitas & Entradas (`Receitas.jsx`)

Este setor registra todos os ingressos de capital no seu orçamento.

* **Tipos de Receitas Suportadas:**
  * **Fixas (Recorrentes):** Salário formal, pró-labore de empresa, aluguel de imóvel recebido, pensão. Essas receitas se repetem todo mês e servem de âncora para o Forecast (previsão futura).
  * **Variáveis (Pontuais):** Vendas de itens usados, comissões extraordinárias, freelances ou bônus. Essas entram apenas no mês em que foram recebidas.
* **Recursos do Setor:**
  * **Totalizador Dinâmico:** Exibe o total mensal em verde apenas das receitas que estão com o interruptor ligado (`ativa === true`).
  * **Interruptor de Pausa:** Se você entrar de férias com pagamento adiantado ou tiver um contrato suspenso, pode pausar a receita com um toque sem precisar excluí-la.
  * **Exclusão Rápida:** Botão `✕` que remove o registro e dispara a exclusão na API.

---

### 🔁 Setor 3: Despesas Fixas & Checklist Mensal Inteligente (`DespesasFixas.jsx`)

Este é um dos setores mais avançados e importantes do sistema. Ele gerencia as contas recorrentes e foi desenhado para eliminar duas das maiores dores da gestão financeira pessoal: esquecer de pagar uma conta e distorcer a projeção futura com despesas que têm prazo de término.

#### A. Painel de Resumo do Mês (Checklist KPI)
No topo do card, você tem um resumo em tempo real:
* **Total Mensal:** Quanto suas contas fixas ativas somam no mês.
* **Pago este Mês (X/Y):** O valor exato que já saiu do seu bolso e a quantidade de contas liquidadas (ex: `R$ 900,00 (3/5)`).
* **A Pagar:** Quanto ainda falta pagar até o fim do mês, em destaque de alerta.
* **Barra de Progresso:** Um trilho visual que enche proporcionalmente conforme você liquida as contas.

#### B. O Botão Interativo "Pago / Pendente" (Checklist Inteligente)
Ao lado de cada conta fixa, há um botão inteligente de status:
* 🟡 **`⏳ Pendente`:** A conta ainda não foi paga neste mês.
* 🟢 **`✓ Pago`:** Ao apertar o botão, ele registra a quitação da conta.
* **A Lógica Mensal (Como funciona no banco):**
  * O sistema grava o pagamento na tabela `pagamentos_fixas` atrelando o `transacao_id` ao mês específico (ex: `2026-10`).
  * Quando o mês virar (ex: 01 de novembro), **todas as contas voltam automaticamente para `⏳ Pendente`** sem que você precise desmarcar nada manualmente!

#### C. Duração e Prazo Determinado (Recorrência Finita)
Nem toda conta fixa dura para sempre. Um curso de programação em 12x, um seguro de carro pago em 10 boletos mensais ou um consórcio têm início e fim.
* **Como Cadastrar:**
  * No formulário, você marca a caixinha: *"Tem duração / prazo determinado"*.
  * Você informa o **Total de meses** (ex: `12`) e o **Mês/parcela atual** (ex: `1` ou `3`).
* **Tag Visual:** A despesa ganha uma insígnia na lista: `⏱️ 1/12 meses`.
* **Comportamento no Forecast:**
  * O backend (`backend/src/calculos.js`) projeta a conta somente enquanto $\text{parcela\_atual} + k \le \text{total\_parcelas}$.
  * **Quando o curso acaba, o sistema retira automaticamente o valor das despesas fixas futuras**, fazendo com que o seu Saldo Projetado futuro suba automaticamente!

#### D. Data de Pagamento / Vencimento
Cada conta possui um campo de data editável diretamente na linha (`<input type="date">`). Alterar a data dispara uma requisição `PATCH` imediata para o servidor, mantendo suas datas de pagamento sempre organizadas.

---

### 🛒 Setor 4: Gastos Variáveis & Compras Parceladas (`Extrato.jsx`)

Este setor registra a dinâmica do dia a dia: alimentação, farmácia, transporte, lazer e compras parceladas no cartão de crédito.

* **Formas de Pagamento:**
  * **Crédito:** Abate o limite disponível do cartão selecionado.
  * **Débito / PIX / Dinheiro:** Registra a despesa à vista sem comprometer limite de cartão.
* **Lógica de Parcelamento:**
  * Ao cadastrar uma compra parcelada (ex: um celular de R$ 1.200 em 10x):
    * Você informa o valor total (`1200`) e a quantidade de parcelas (`10`).
    * O sistema divide automaticamente e grava cada parcela com o valor real (`120`).
    * A parcela atual compromete a fatura deste mês.
    * As parcelas futuras entram no **Forecast**, sendo debitadas mês a mês até a 10ª parcela.
* **Limite de Exibição:** Mostra os 50 registros mais recentes com uma faixa colorida à esquerda com a cor exata do banco utilizado.

---

### 🛡️ Setor 5: Cofre & Reservas Financeiras (`Cofre.jsx`)

O Cofre é a blindagem do seu patrimônio. Ele funciona como uma carteira de objetivos e reservas:

* **Exemplos de Uso:**
  * *Reserva de Emergência* (6 meses de custos fixos).
  * *Meta de Viagem* ou *Troca de Carro*.
  * *Reserva de Oportunidade / Aportes*.
* **Edição Instantânea ("OnBlur"):**
  * Você não precisa de telas complexas para atualizar o saldo guardado. Basta clicar sobre o número, digitar o novo valor e clicar fora (evento `onBlur`). O componente detecta a mudança e atualiza o banco no Supabase na mesma hora.

---

### 💳 Setor 6: Painel de Cartões de Crédito & Bancos (`PainelCartoes.jsx` e `CartaoBanco.jsx`)

Aqui você acompanha e gerencia os tetos operacionais de cada instituição financeira cadastrada (Nubank, Inter, Itaú, etc.).

* **Métricas por Banco:**
  * **Limite Total:** O limite concedido pela instituição.
  * **Limite Comprometido (Gasto):** Calculado pelo backend somando todas as compras no crédito vigentes no mês de referência.
  * **Limite Disponível:** $\text{Limite Total} - \text{Gasto}$.
  * **Percentual de Uso:** $\frac{\text{Gasto}}{\text{Limite Total}}$.
* **Sistema de Semáforo de Alerta (`nivelDeAlerta`):**
  * 🟢 **Ok (Verde):** Uso até 70% do limite.
  * 🟡 **Warning (Amarelo):** Uso entre 70% e 90% (atenção redobrada).
  * 🔴 **Danger (Vermelho):** Uso acima de 90% (risco iminente de estourar o cartão).
* **Ciclo da Fatura:**
  * Exibe o dia de fechamento e o dia de vencimento de cada cartão.
* **Ajuste de Teto em Tempo Real:**
  * Ao clicar sobre o limite, abre-se um campo para digitar um novo limite. Ao salvar, uma chamada `PATCH /api/bancos/:id` persiste o novo valor no banco de dados.

---

### 🔮 Setor 7: Forecast — A Máquina de Previsão Financeira (`Forecast.jsx`)

O **Forecast** é a funcionalidade mais estratégica do sistema. Ele responde à pergunta fundamental que planilhas comuns não conseguem responder:
> *"Quanto da minha renda dos próximos 6 ou 12 meses já está comprometida com dívidas e contratos que já assumi?"*

#### A. A Filosofia: "Conservador e Pessimista"
O sistema projeta:
* ✅ Renda fixa garantida (Salário).
* ✅ Despesas fixas contínuas (Aluguel, Luz, Internet).
* ✅ Despesas fixas com prazo em vigor (Cursos, seguros).
* ✅ Parcelas futuras de cartão de crédito ainda não quitadas.
* ❌ **Não projeta:** Gastos variáveis à vista (iFood, combustível, Uber).
* *Por que?* Porque é impossível adivinhar quanto você vai gastar de restaurante daqui a 9 meses. Ao projetar apenas o que já está contratado, o sistema garante que o seu **Saldo Projetado** seja uma base segura: tudo o que sobrar ali é margem de manobra real.

#### B. Gráfico de Barras Empilhadas em SVG
* **Eixo Vertical (Y):** Escala monetária formatada (ex: `1,5k`, `3,0k`).
* **Camada Roxa:** Total de despesas fixas daquele mês específico.
* **Camada Ciano / Azul:** Parcelas de cartão e compras temporárias que vencem naquele mês.
* **Linha Tracejada:** A sua renda mensal esperada. Se a barra ultrapassar a linha, significa que naquele mês você estará no vermelho!

#### C. Interatividade Mês a Mês
* Você pode alternar entre visão de **6 meses** e **12 meses**.
* Ao passar o mouse ou tocar em qualquer coluna, o card inferior revela o raio-X completo daquele mês futuro:
  * Valor das contas fixas.
  * Valor das parcelas.
  * Percentual total da renda comprometido.
  * **Saldo Projetado Livre**.
  * Lista detalhada de todas as compras que ainda estarão sendo pagas naquele mês (com indicação do número da parcela, ex: `Notebook (7/10)`).

---

## ⚡ 3. O Ciclo de Vida de uma Ação (Fluxo Ponta a Ponta)

Para entender como a engenharia funciona quando você clica em um botão, veja este exemplo real de quando você marca uma conta como **Paga**:

1. **Ação do Usuário:** Você clica no botão `⏳ Pendente` da conta de luz no seu celular.
2. **Componente React:** O `DespesasFixas.jsx` chama a função recebida via propriedade: `aoAlternarPagamento(id)`.
3. **Gerenciador de Estado (`App.jsx`):** O `App.jsx` executa a função com o mês de referência atual (`2026-10`).
4. **Camada de Rede (`api.js`):** O `api.js` faz um `fetch` HTTP:
   `POST https://assistente-financeiro-tjdd.onrender.com/api/transacoes/2/alternar-pagamento` com `{ mes: "2026-10" }`.
5. **Servidor Express (`rotas/transacoes.js`):**
   * O servidor recebe a requisição.
   * Confere no PostgreSQL se já existe registro em `pagamentos_fixas` para aquela conta naquele mês.
   * Se não existir, faz um `INSERT INTO pagamentos_fixas ...`. Se já existia, faz um `DELETE`.
   * Responde para o celular com o status HTTP `200 OK` e os novos dados.
6. **Reatividade Instantânea:**
   * A função `executar()` no `App.jsx` recebe a resposta de sucesso e incrementa o contador `versao`.
   * Como a dependência `[versao]` mudou, os hooks `useDados` buscam as informações atualizadas.
   * O botão na tela muda para 🟢 **`✓ Pago`**, o cartão "Pago este Mês" no topo sobe e a barra de progresso avança!

---

## 🛠️ 4. Como Manter, Evoluir e Testar

* **Rodar localmente no seu computador:**
  * Terminal 1 (Backend): `cd backend && npm run dev` (roda na porta 3000).
  * Terminal 2 (Frontend): `cd frontend && npm run dev` (roda na porta 5173).
* **Fazer alterações e enviar para o ar:**
  * Faça suas mudanças no código.
  * Abra o terminal e execute:
    ```bash
    git add .
    git commit -m "sua melhoria aqui"
    git push origin main
    ```
  * O GitHub recebe o código, a **Vercel** e o **Render** detectam o push e atualizam o seu site no ar automaticamente em menos de 2 minutos!

---

*Manual atualizado e sincronizado com a versão em produção.* 🚀
