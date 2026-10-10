# Documento de Especificação de Requisitos (SPEC.md)

## Projeto: Assistente Financeiro Pessoal (PFM - Personal Finance Management)

### 1. Visão Geral do Produto
O **Assistente Financeiro Pessoal** é uma aplicação híbrida voltada para o controle financeiro diário, diagnóstico de orçamento em tempo real e projeção de faturas futuras (forecast). O sistema opera com dois canais de entrada e visualização:
* **Telegram Bot:** Interface de entrada ágil (low-friction) para cadastro rápido de despesas na rua e consultas imediatas via smartphone.
* **Web App Responsivo:** Dashboard analítico focado em visualização de gráficos, gestão de limites, acompanhamento de patrimônio acumulado (cofre) e previsão financeira dos próximos meses.

---

### 2. Entidades e Regras de Negócio

#### 2.1 Bancos e Limites
* **Instituições Iniciais:** Nubank (Banco Principal), Banco do Brasil, Itaú.
* **Gestão Flexível:** O usuário pode editar informações bancárias a qualquer momento.
* **Controle de Limites:** Cada banco possui um *limite total* configurável. O sistema deduz os gastos do mês no crédito e calcula o *Limite Disponível* em tempo real.

#### 2.2 Motor de Lançamentos
* **Despesas Fixas:** Contas recorrentes mensais (ex: internet, streaming). Devem ser processadas e abatidas do saldo/orçamento automaticamente na virada do mês.
* **Despesas Variáveis (Temporárias):** Gastos do dia a dia (ex: iFood, Uber, padaria). Inseridas manualmente via Bot ou Web App.
* **Receitas:** Cadastro de salário fixo e entradas avulsas.

#### 2.3 Cofre (Patrimônio)
* Área dedicada ao dinheiro guardado (Reserva de Emergência, Metas, etc.).
* O saldo é atualizado manualmente pelo usuário.

---

### 3. Modelagem de Dados Sugerida

Abaixo está a estrutura base de tabelas para o banco de dados (Relacional/SQL):

**Tabela: `Bancos`**
| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | UUID/INT | Identificador único |
| `nome` | VARCHAR | Ex: Nubank, Banco do Brasil, Itaú |
| `tipo` | ENUM | Débito, Crédito, Múltiplo |
| `limite_total` | DECIMAL | Valor editável do teto de crédito |
| `dia_fechamento` | INT | Dia do fechamento da fatura |
| `dia_vencimento` | INT | Dia do vencimento da fatura |

**Tabela: `Transacoes`**
| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | UUID/INT | Identificador único |
| `descricao` | VARCHAR | Título do gasto (ex: "Almoço") |
| `valor` | DECIMAL | Quantia da transação |
| `tipo` | ENUM | Receita ou Despesa |
| `banco_id` | FK | Chave estrangeira ligando à tabela Bancos |
| `categoria` | ENUM | Fixo ou Variável |
| `data_compra` | DATE | Quando a compra ocorreu |
| `parcela_atual` | INT | Número da parcela atual (ex: 1) |
| `total_parcelas` | INT | Total de parcelas (ex: 10) |

**Tabela: `Cofre`**
| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | UUID/INT | Identificador único |
| `objetivo` | VARCHAR | Ex: "Reserva de Emergência" |
| `saldo_atual` | DECIMAL | Valor guardado |

---

### 4. Fluxos e Interfaces

#### 4.1 Interface Móvel: Telegram Bot
Comandos rápidos via Webhook para garantir registro em menos de 5 segundos:
* **`/gasto [valor] [descrição] [banco] [tipo]`**: Registra uma nova despesa.
  * *Exemplo:* `/gasto 35.90 Uber nubank credito`
* **`/limite`**: Retorna os limites disponíveis de todos os cartões de crédito.
* **`/resumo`**: Exibe um mini-dashboard em texto (Receita Atual vs. Gastos Totais vs. Saldo Restante).

#### 4.2 Interface Web: Dashboard Responsivo
Arquitetura de componentes para visualização em Desktop e Mobile:
* **Header de Status:** Indicadores globais (Dinheiro no Cofre, Receita Líquida do Mês, Faturas Abertas).
* **Módulo de Despesas Fixas:** Lista gerenciável de assinaturas e contas fixas para débito automático no diagnóstico do mês.
* **Painel de Cartões:** Cards interativos para cada banco com barras de progresso (progress bars) mostrando visualmente o limite consumido vs. limite disponível. Permite edição rápida do limite total.
* **Módulo Forecast (Previsibilidade):** O coração da análise. Gráfico ou tabela projetando os próximos 6 a 12 meses. Pega o Saldo Base e subtrai as parcelas futuras de compras divididas, respondendo à pergunta: *"Quanto da minha renda futura já está comprometida?"*

---

### 5. Próximos Passos na Implementação (Sugestão)
1. **Configuração do Ambiente:** Inicializar repositório (ex: Node.js/Python para backend, React/Next.js para frontend).
2. **Banco de Dados:** Criar as migrações/esquemas das tabelas `Bancos`, `Transacoes` e `Cofre`.
3. **API Básica:** Criar endpoints (CRUD) para gerenciar transações e limites.
4. **Integração Telegram:** Configurar o bot via BotFather e conectar à API.
5. **Front-end:** Construir os dashboards consumindo os dados da API.