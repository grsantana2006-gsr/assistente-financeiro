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
          - Motor de Conciliação e Importação Bancária (importador_ofx.js)
                │  (SQL via Driver pg)
                ▼
       3. BANCO DE DADOS (PostgreSQL no Supabase)
          - Armazenamento persistente e relacional blindado
          - Tabelas: bancos, transacoes (com fitid único), cofre, pagamentos_fixas, pagamentos_faturas (com valor_pago), configuracoes
```

* **Frontend (Vercel):** `https://assistente-financeiro-two-omega.vercel.app/`
* **Backend (Render):** `https://assistente-financeiro-tjdd.onrender.com/api`
* **Database (Supabase):** PostgreSQL em nuvem AWS (com Pooler de conexão para estabilidade IPv4).
* **Segurança & Privacidade:** Arquivos de extratos bancários (`*.ofx`), credenciais e `.env` são blindados pelo `.gitignore` na raiz, impedindo vazamentos no repositório.

---

## 🧭 2. Guia Detalhado de Cada Setor da Página

Cada seção da tela do aplicativo foi projetada como um **componente independente do React**, com responsabilidades bem definidas. A seguir, entenda o funcionamento, o conceito financeiro e os bastidores de código de cada um:

---

### 🌟 Setor 1: Header de Indicadores Globais (`StatusHeader.jsx`)

Localizado no topo da aplicação, este setor funciona como o **painel de bordo (cockpit)** da sua vida financeira. Ele resume instantaneamente a sua saúde financeira atual através do **Banner Executivo de Veredito** e de **quatro cartões de indicadores**:

#### A. Banner de Veredito: No Azul (Superávit) vs. No Vermelho (Déficit)
Logo abaixo da saudação, uma barra visual inteligente calcula a equação fundamental das finanças:
$$\text{Saldo Real do Mês} = \text{Receita} - (\text{Faturas no Cartão} + \text{Gastos em Débito/PIX})$$
* 🟢 **No Azul (Superávit):** Se suas receitas forem maiores que suas saídas, o banner se acende em verde indicando exatamente quanto dinheiro você tem de folga/lucro livre neste mês.
* 🔴 **No Vermelho (Déficit):** Se seus compromissos superarem suas entradas, o banner dispara um alerta vermelho com o valor negativo exato do prejuízo, avisando que você está gastando mais do que ganha.

#### B. Os Quatro Indicadores Chave:
1. **🏦 Dinheiro no Cofre:**
   * **O que é:** O somatório de todo o dinheiro guardado em metas, reservas de emergência e objetivos.
   * **Origem do cálculo:** Calculado pelo backend somando a coluna `saldo_atual` da tabela `cofre`.
   * **Função financeira:** Representa o seu patrimônio líquido protegido, que não deve ser misturado com o dinheiro de giro do dia a dia.
2. **📈 Receita Líquida do Mês:**
   * **O que é:** Todo o dinheiro que entra na sua conta no mês de referência (salário fixo + rendimentos avulsos).
   * **Origem do cálculo:** Função `calcularReceitaDoMes` no backend.
   * **Função financeira:** Estabelece o teto máximo de recursos disponíveis.
3. **💳 Faturas no Cartão (Crédito):**
   * **O que é:** Exclusivamente as despesas e parcelas cobradas no cartão de crédito que vencem na fatura do mês.
   * **Origem do cálculo:** Soma de todas as despesas do mês com `forma_pagamento === 'Crédito'`.
   * **Função financeira:** Mostra o passivo de cartão que você precisará liquidar no fechamento da fatura.
4. **⚡ Débito & PIX (Conta Corrente):**
   * **O que é:** Todos os pagamentos que saem diretamente do saldo bancário (PIX, débito em conta, limite especial/cheque especial ou dinheiro).
   * **Origem do cálculo:** Soma de todas as despesas do mês com `forma_pagamento !== 'Crédito'`.
   * **Função financeira:** Evita o "ponto cego" de achar que sobrou dinheiro na conta quando na verdade já há contas em débito agendadas.

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

#### A. Painel de Resumo do Mês (Checklist KPI em 4 Blocos)
No topo do card, você tem um resumo em tempo real que separa a realidade de caixa da realidade de fatura:
* **Total Mensal:** Quanto suas contas fixas ativas somam no mês atual.
* **Liquidado na Conta:** O valor das contas via PIX, Débito em Conta ou Dinheiro que já foram efetivamente pagas e saíram do saldo bancário.
* **Lançado nas Faturas:** O valor das assinaturas e contas fixas no Cartão de Crédito que já foram cobradas pela operadora e estão aguardando o vencimento da fatura.
* **Ainda Pendente:** Quanto ainda falta confirmar/pagar até o fim do mês, em destaque de alerta.
* **Barra de Progresso Bicolor:** Um trilho visual que enche em gradiente conforme você confirma as liquidações e lançamentos.

#### B. O Botão Interativo Inteligente (Conta vs Cartão)
Ao lado de cada conta fixa, o botão inteligente adapta seu comportamento e rótulo dependendo da forma de pagamento:
* **Se a conta for no Cartão de Crédito:**
  * ⚪ **`⏳ A Cobrar`:** A operadora ainda não processou a cobrança da assinatura neste mês.
  * 🟣 **`💳 Na Fatura`:** A cobrança já foi confirmada na fatura do cartão (você pagará no vencimento da fatura). Ao clicar, o sistema exibe feedback imediato `⏳ Salvando…` e atualiza a fatura de destino.
  * **Tooltip Explicativo:** Ao passar o mouse sobre o botão, o sistema detalha o destino exato: *"Lançada na fatura de Nov/26 do Nubank"*, eliminando qualquer dúvida de ciclo bancário.
* **Se a conta for via PIX / Débito em Conta / Dinheiro:**
  * 🟡 **`⏳ Pendente`:** A conta ainda não foi paga neste mês.
  * 🟢 **`✓ Liquidado`:** O dinheiro já saiu da sua conta bancária.
* **A Lógica Mensal (Como funciona no banco):**
  * O sistema grava a confirmação na tabela `pagamentos_fixas` atrelando o `transacao_id` ao mês específico (ex: `2026-10`).
  * Quando o mês virar (ex: 01 de novembro), **todas as contas voltam automaticamente para o estado inicial (`⏳ Pendente` ou `⏳ A Cobrar`)** sem que você precise desmarcar nada manualmente!

#### C. Duração e Prazo Determinado (Recorrência Finita)
Nem toda conta fixa dura para sempre. Um curso de programação em 12x, um seguro de carro pago em 10 boletos mensais ou um consórcio têm início e fim.
* **Como Cadastrar:**
  * No formulário, você marca a caixinha: *"Tem duração / prazo determinado"*.
  * Você informa o **Total de meses** (ex: `12`) e o **Mês/parcela atual** (ex: `1` ou `3`).
* **Tag Visual:** A despesa ganha uma insígnia na lista: `⏱️ 1/12 meses`.
* **Comportamento no Forecast:**
  * O backend (`backend/src/calculos.js`) projeta a conta somente enquanto $\text{parcela\_atual} + k \le \text{total\_parcelas}$.
  * **Quando o curso acaba, o sistema retira automaticamente o valor das despesas fixas futuras**, fazendo com que o seu Saldo Projetado futuro suba automaticamente!

#### D. Formas de Pagamento & Isolamento do Limite do Cartão
Nem toda conta fixa é paga no cartão de crédito. Aluguel, condomínio e luz normalmente são pagos via PIX ou débito em conta (às vezes usando o limite especial do Banco do Brasil ou Itaú). Além disso, despesas com alimentação corporativa podem ser vinculadas ao **Voucher (Vale Refeição)**.
* **Seletor de Forma de Pagamento:**
  * Ao cadastrar (e editável diretamente em cada linha), você escolhe:
    * ⚡ **PIX / Transferência:** Sai do saldo da conta, **NÃO consome** limite do cartão.
    * 🏦 **Débito em Conta / PIX:** Sai da conta corrente, **NÃO consome** limite do cartão. *(Nota: O Limite Especial/Cheque Especial é rotativo e não deve ser cadastrado como fixa; caso haja cobrança pontual, lança-se em Gastos Variáveis).*
    * 💳 **Cartão de Crédito:** Entra na fatura mensal e consome o limite daquele banco (Nubank, Itaú, Banco do Brasil, PicPay).
    * 🍽️ **Voucher (Vale Refeição):** Desconta do saldo do cartão de benefício, sem tocar no seu salário líquido.
    * 💵 **Dinheiro:** Não consome limite de banco.
* **Benefício:** O limite do seu cartão de crédito fica protegido e reflete apenas as compras reais de crédito!

#### E. Contas Agendadas para Início Futuro (Pré-Agendamento Inteligente)
Se você vai começar a pagar uma nova despesa fixa somente daqui a alguns meses (por exemplo, um curso ou assinatura que começa em **Dezembro**), você pode cadastrá-la hoje mesmo sem poluir o mês atual:
* **Como Funciona:**
  * Basta preencher o campo de data com o mês de início (ex: `01/12/2026` ou `05/11/2026`).
  * O sistema reconhece automaticamente que a data é futura em relação ao mês de referência atual (`2026-10`).
* **Visualização Separada & Confirmação:**
  * A conta **NÃO** entra no cálculo de "Total Mensal" nem no "A Pagar" de Outubro.
  * Ela é agrupada em uma seção dedicada: **🗓️ Início Futuro**, exibindo uma etiqueta destacada (ex: `🗓️ Inicia em Dezembro/2026`).
  * **Interatividade Garantida:** Mesmo agendada para o futuro, a conta possui o botão de status (`⏳ Agendada`), permitindo que você confirme o lançamento ou liquidação antecipada se a cobrança já tiver ocorrido, sem bloqueios.
* **Integração com o Forecast:**
  * No gráfico de previsão futura, a conta **só começa a ser contabilizada a partir do mês programado** (Dezembro em diante), mantendo sua projeção precisa e realista.

#### F. Data de Pagamento / Vencimento
Cada conta possui um campo de data editável diretamente na linha (`<input type="date">`). Alterar a data dispara uma requisição `PATCH` imediata para o servidor, mantendo suas datas de pagamento sempre organizadas. Se você alterar a data para um mês futuro, ela migra instantaneamente para a seção de agendadas!

#### G. Filtro Rápido no Topo da Lista (`Todas` | `⚡ Conta/PIX` | `💳 Cartão`)
Para facilitar a auditoria sem poluição visual, você pode filtrar as contas fixas do mês em um clique:
* **📋 Todas:** Exibe a visão completa do checklist mensal.
* **⚡ Conta / PIX:** Isola apenas aluguel, condomínio, luz e contas que saem da conta bancária.
* **💳 Cartão de Crédito:** Isola exclusivamente assinaturas de streaming, nuvem e academias que cobram no cartão.

#### H. Tag da Fatura de Destino nas Assinaturas
O sistema calcula a data de fechamento do cartão vinculado à assinatura (ex: Nubank fecha dia 27, BB dia 28, Itaú dia 03, PicPay dia 04).
* Se a cobrança da assinatura ocorrer após a data de fechamento daquele cartão, o sistema exibe uma etiqueta informativa: `🗓️ Fatura Nov/26` ou `🗓️ Fatura Dez/26`.
* Dessa forma, você sabe exatamente em qual mês aquela assinatura vai te cobrar no boleto da fatura.

#### I. Alerta de Cobrança Prevista Ultrapassada
Se a data programada para a conta fixa já passou no calendário atual (ex: data era dia 10 e hoje já é dia 16) e a despesa ainda estiver com status pendente (`⏳ Pendente` ou `⏳ A Cobrar`), o sistema exibe uma insígnia sutil: `⚠️ Passou do dia 10`. Isso serve como um lembrete preventivo para conferir se o pagamento foi esquecido ou se houve recusa no cartão.

---

### 🛒 Setor 4: Gastos Variáveis & Compras Parceladas (`Extrato.jsx`)

Este setor registra a dinâmica do dia a dia: alimentação, farmácia, transporte, lazer e compras parceladas no cartão de crédito.

* **Formas de Pagamento Suportadas:**
  * **💳 Crédito:** Abate o limite disponível do cartão selecionado (Nubank, Banco do Brasil, Itaú ou PicPay).
  * **🏦 Débito / ⚡ PIX / 💵 Dinheiro:** Registra a despesa à vista sem comprometer limite de crédito.
  * **🍽️ Voucher (Vale Refeição):** Dedicado exclusivamente a alimentação e refeições. Abate o saldo disponível do seu cartão **Vale Refeição**, sem descontar da conta corrente e sem gerar faturas de crédito no seu nome.
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

### 💳 Setor 6: Painel de Cartões de Crédito, Benefícios & Bancos (`PainelCartoes.jsx` e `CartaoBanco.jsx`)

Aqui você acompanha e gerencia os tetos operacionais e o ciclo de fatura de cada instituição financeira cadastrada:
* 🟣 **Nubank:** Cartão de crédito roxo (limite R$ 4.800) · **Fecha dia 27** · **Vence dia 03**.
* 🟡 **Banco do Brasil:** Cartão múltiplo amarelo (limite R$ 1.000) · **Fecha dia 28** · **Vence dia 10**.
* 🟠 **Itaú:** Cartão de crédito laranja (limite R$ 350) · **Fecha dia 03** · **Vence dia 10**.
* 🟢 **PicPay:** Cartão de crédito verde PicPay (limite R$ 200) · **Fecha dia 04** · **Vence dia 10**.
* 🌿 **Vale Refeição:** Cartão de benefício corporativo exclusivo (recarga mensal de R$ 600) · **Recarrega dia 01**.

* **Automação Inteligente de Fechamento de Fatura:**
  * O sistema agora calcula com precisão matemática em qual fatura cada compra no crédito vai cair:
    * Se você fizer uma compra **antes ou no dia do fechamento**, ela entra no vencimento da fatura daquele ciclo.
    * Se você fizer uma compra **no dia seguinte ao fechamento** (o "melhor dia de compra"), o sistema joga a despesa automaticamente para a fatura do mês seguinte!
    * **Exemplo real:** A fatura do Banco do Brasil fecha dia 28 de outubro (com vencimento em 10 de novembro). Compras feitas no dia 29 de outubro já caem automaticamente na fatura de **Dezembro** (vencimento em 10 de dezembro)!
  * **Etiqueta Visual no Extrato:** Cada compra no crédito ganha uma tag visual indicando em qual fatura ela vai vencer (ex: `📅 Fatura: Nov/26`), e o formulário avisa em tempo real qual fatura receberá as compras feitas hoje.

* **Métricas por Cartão de Crédito:**
  * **Limite Total:** O limite total concedido pela instituição (ex: R$ 4.800 no Nubank).
  * **Limite Comprometido (Gasto Real):** Exatamente como o banco opera na vida real: $\text{Saldo a pagar da fatura aberta} + \sum (\text{Todas as parcelas futuras de compras já contratadas})$. Assinaturas ainda 'a cobrar' não retêm limite antes da cobrança.
  * **Limite Disponível:** $\text{Limite Total} - \text{Limite Comprometido}$ (bate centavo a centavo com o aplicativo do banco).
  * **Percentual de Uso:** $\frac{\text{Limite Comprometido}}{\text{Limite Total}}$.
* **Métricas para o Vale Refeição (Benefício):**
  * **Recarga Mensal:** Saldo disponibilizado mensalmente (editável).
  * **Gasto no Mês:** Total de compras feitas na função Voucher.
  * **Saldo Restante:** Quanto ainda resta para gastar em alimentação até a próxima recarga.
  * **Consumo (%):** Percentual consumido da sua recarga.
* **Sistema de Semáforo de Alerta (`nivelDeAlerta`):**
  * 🟢 **Ok (Verde):** Uso até 70% do limite.
  * 🟡 **Warning (Amarelo):** Uso entre 70% e 90% (atenção redobrada).
  * 🔴 **Danger (Vermelho):** Uso acima de 90% (risco iminente de estourar o cartão).
* **Ciclo da Fatura & Recarga:**
  * Exibe o dia de fechamento e o dia de vencimento de cada cartão (ou dia de recarga no caso de benefícios).
* **Ajuste de Teto em Tempo Real:**
  * Ao clicar no botão **✏️ Editar limite** (ou **✏️ Editar recarga mensal**), abre-se um campo para digitar o novo valor. Ao salvar, uma chamada `PATCH /api/bancos/:id` persiste o novo valor no banco de dados.

* **Fatura do Mês & Sistema de Quitação (`✓ Fatura Paga` e `⚡ Adiantamento`):**
  * Cada cartão de crédito possui agora um bloco dedicado exibindo a **Fatura do Ciclo Ativo** com abas de alternância rápida:
    * Se a fatura do mês de referência (ex: `Out/26`) já foi quitada no banco, o cartão disponibiliza as abas `[Out/26 ✓ Paga]` e `[Nov/26 ⏳ Atual Aberta]`, dando foco automático na fatura que está em aberto acumulando os gastos do momento!
    * Você pode clicar em qualquer uma das abas para inspecionar valores, status e registrar pagamentos na fatura desejada.
  * **Ciclo de Fechamento Unificado:**
    * Tanto para despesas fixas (assinaturas e compras parceladas) quanto para despesas variáveis no cartão, o mês da fatura segue estritamente o ciclo do banco (`dia_fechamento` e `dia_vencimento`).
    * Exemplo Nubank (fecha dia 27, vence dia 03): assinaturas e compras cobradas ao longo de Outubro (como Google One, Premiere, ou compras de mercado) entram automaticamente na fatura que vence em **Novembro** (`Nov/26`), sem contaminar o boleto de Outubro.
  * **Botão Interativo de Status:**
    * 🟡 **`⏳ Fatura Aberta`:** Indica que a fatura daquele mês ainda está aguardando quitação.
    * 🟢 **`✓ Fatura Paga`:** Fatura quitada integralmente no banco.
    * ⚡ **`⚡ R$ X Pago (Adiantamento / Parcial)`:** Caso você tenha pago uma parte da fatura antes do fechamento (ou adiantou dinheiro para liberar limite).
  * **⚡ Suporte a Pagamentos Antecipados & Parciais:**
    * Muito comum na rotina: você passa uma compra alta no cartão para um amigo ou familiar (ex: Lucas Pereira R$ 722,45), recebe o PIX dele logo em seguida e **paga o cartão imediatamente**.
    * **Como Registrar no Sistema (2 Cliques):**
      * Basta clicar no botão de status da fatura (ex: `⏳ Fatura Aberta` ou `⚡ R$ 708,00 Pago`) em qualquer cartão, OU no botão `⚡ Adiantar esta fatura` ao abrir os detalhes de um mês futuro.
      * O modal interativo **💳 Pagamento / Adiantamento de Fatura** se abre:
        1. **Mês da Fatura:** Você escolhe a fatura de destino (atual ou qualquer mês futuro).
        2. **Modo:** Escolha entre **✓ Quitar Fatura Integralmente** (100% quitada) ou **⚡ Adiantamento / Pagamento Parcial** (digita o valor exato pago em R$, ex: `708,00`).
        3. **Salvar:** Clique em **✓ Confirmar Pagamento**. O sistema grava no banco de dados na hora!
      * Para desfazer ou reabrir: basta abrir o modal e clicar em **🗑️ Reabrir / Limpar**.
    * O card exibe o saldo líquido restante a pagar, a insígnia brilhante `⚡ R$ 708,00 adiantado` e **restaura o limite disponível na hora** na quantia exata que você pagou!
  * **Restabelecimento Automático e Fiel de Limite:**
    * Quando a fatura é marcada como paga (ou adiantada), o sistema **libera imediatamente e estritamente o valor que foi pago**, exatamente como o banco faz na vida real!
    * Todas as parcelas futuras de compras parceladas e gastos do próximo ciclo continuam retendo o limite comprometido.
  * **Integração com o Topo (`StatusHeader`):**
    * O card "Faturas de Cartão" no topo passa a exibir o total pendente de pagamento e o progresso de quitação (ex: `2/3 faturas pagas (R$ 481,39 quitados)`).
    * Ao quitar todas as faturas do mês, o painel exibe o selo comemorativo: `🎉 Faturas (Todas Pagas)`.
  * **🔮 Faturas dos Próximos Meses (Previsão por Cartão):**
    * Abaixo do bloco da fatura atual, cada cartão de crédito agora possui um trilho interativo exibindo a **previsão das faturas dos próximos 5 meses** (ex: `Nov/26`, `Dez/26`, `Jan/27`, `Fev/27`, `Mar/27`).
    * **Distinção Inteligente entre "Lançado" e "A Cobrar":**
      * O valor principal exibido reflete estritamente o que **já foi cobrado/lançado** no cartão até hoje (ex: compras variáveis e assinaturas confirmadas).
      * Se houver assinaturas com data nos próximos dias que ainda estão com status `⏳ A Cobrar` (ex: Google One no dia 22, Premiere no dia 23), o card exibe uma etiqueta discreta com o **Total Previsto** (ex: `previsto: R$ 1.784,15`).
      * **Detalhamento Interativo:** Ao tocar ou clicar em qualquer mês futuro, o card abre um painel inline revelando cada conta com seu respectivo selo: `💳 Lançado` ou `⏳ A cobrar dia DD`.
    * Inclui botão para recolher ou expandir a visão dos próximos meses quando desejar.
    * **Adiantamentos em faturas futuras:** o pagamento registrado para um mês (ex.: R$ 708 adiantados na fatura de Nov/26) é abatido no card daquele mês, que passa a mostrar o **saldo que falta pagar** (igual ao app do banco) + o selo `⚡ R$ 708,00 pago`. O valor adiantado também devolve limite ao cartão.
    * **Conferência com o banco:** a fatura "lançada" de um mês deve bater centavo a centavo com o extrato OFX. O que ainda não foi cobrado (assinaturas `⏳ A cobrar`) aparece apenas em `previsto`.
  * **Persistência no Banco de Dados:** Registrado na tabela `pagamentos_faturas(banco_id, mes, pago_em, valor_pago)`. Mudar de mês reseta o status para o ciclo correspondente de forma 100% automatizada.

---

### 🏦 Setor 6.1: O Motor de Conciliação e Importação Bancária OFX (`importador_ofx.js` e `/api/ofx`)

Este é o motor bancário automatizado do sistema. Ele foi construído para permitir que você traga o extrato real do seu banco (Nubank, Itaú, Banco do Brasil, etc.) para dentro do seu sistema financeiro com **zero esforço manual** e **zero duplicação**:

#### A. O que é o Formato OFX (Open Financial Exchange)?
O arquivo `.ofx` é o padrão ouro da indústria financeira internacional. Ao contrário de uma planilha de Excel ou PDF, ele carrega metadados eletrônicos precisos emitidos diretamente pelo servidor do banco.

#### B. A Chave Mestra da Deduplicação: O `FITID`
Cada compra emitida no extrato bancário recebe um código alfanumérico global exclusivo chamado **`FITID`** (Financial Institution Transaction ID).
* O nosso banco de dados agora possui uma coluna blindada com restrição de unicidade: `transacoes (..., fitid TEXT UNIQUE)`.
* **Idempotência Absoluta:** Você pode importar o mesmo arquivo `.ofx` 1 vez ou 100 vezes: o sistema lê, compara os `FITIDs` e **ignora silenciosamente qualquer transação que já exista**, garantindo que nenhuma conta seja cadastrada duas vezes!

#### C. Inteligência Automática de Estornos (Cancelamentos & Devoluções)
Quando uma compra é cancelada ou estornada pelo lojista, o banco emite dois registros: o débito da compra e o crédito do estorno.
* **Estorno Integral:** Se uma compra for estornada integralmente no mesmo ciclo (ex: Dieta Flexível R$ 34,75, Lltimehibrid R$ 70,59, Mercado Livre R$ 71,20), o motor reconhece o par correspondente e **descarta a compra automaticamente**, evitando poluir o seu painel com valores fantasmas.
* **Estorno Parcial:** Se houver ajuste de valor (ex: Duka's Academia cobrou R$ 119,86 e devolveu R$ 93,26), o sistema calcula a diferença e registra unicamente o **valor líquido real pago** (R$ 26,60).

#### D. Categorização Automática por Padrão de Nomes
O motor analisa o texto do estabelecimento (`MEMO`) e classifica as novas despesas automaticamente:
* Palavras com `uber`, `99`, `posto`, `combustivel` ➔ **Transporte**
* Palavras com `mercad`, `youmart`, `ifood`, `restaurante`, `lanchonete`, `padaria` ➔ **Alimentação**
* Palavras com `farmacia`, `drogaria`, `farmavip`, `hospital`, `medico` ➔ **Saúde**
* Palavras com `smart fit`, `academia`, `duka` ➔ **Lazer / Saúde**
* Palavras com `apple`, `google`, `netflix`, `disney`, `crunchy`, `prime` ➔ **Assinaturas**

#### E. Como Usar no Dia a Dia:
1. Acesse o aplicativo do seu banco (ex: Nubank) e baixe o extrato da fatura em formato `.ofx`.
2. Salve o arquivo na pasta do projeto (ele é automaticamente protegido de subir para a internet pelo `.gitignore`).
3. O sistema varre os arquivos e sincroniza tudo com o banco de dados em segundos!

---

### 🔮 Setor 7: Forecast — A Máquina de Previsão Financeira (`Forecast.jsx`)

O **Forecast** é a funcionalidade mais estratégica do sistema. Ele responde à pergunta fundamental que planilhas comuns não conseguem responder:
> *"Quanto da minha renda dos próximos 6 ou 12 meses já está comprometida com dívidas e contratos que já assumi?"*

#### A. A Filosofia: Previsibilidade Real de Faturas
O sistema projeta com precisão:
* ✅ Renda fixa garantida (Salário).
* ✅ Despesas fixas contínuas (Aluguel, Luz, Internet).
* ✅ Despesas fixas com prazo em vigor (Cursos, seguros).
* ✅ Parcelas futuras de compras no cartão de crédito (`3x`, `6x`, `10x...`).
* ✅ Compras no crédito à vista (`1x`) programadas para vencer na fatura do respectivo ciclo (ex: compras feitas no Nubank em Outubro que vencem na fatura de Novembro).
* ❌ **Não projeta:** Gastos à vista no débito, PIX ou dinheiro de meses futuros (já que saem no ato e não geram faturas).

#### B. Gráfico de Barras Empilhadas em SVG
* **Eixo Vertical (Y):** Escala monetária formatada (ex: `1,5k`, `3,0k`).
* **Camada Roxa:** Total de despesas fixas daquele mês específico.
* **Camada Ciano / Azul:** Faturas de crédito e parcelas de compras temporárias que vencem naquele mês.
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
