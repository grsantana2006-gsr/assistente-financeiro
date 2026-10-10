# API do Assistente Financeiro

Base: `http://localhost:3000/api` · Formato: JSON · Subir com `npm run dev`

| Método | Rota | O que faz |
| :--- | :--- | :--- |
| GET | `/saude` | Confere servidor e banco |
| GET | `/bancos` | Lista bancos |
| GET | `/bancos/:id` | Busca um banco |
| POST | `/bancos` | Cria banco |
| PATCH | `/bancos/:id` | Altera campos (ex.: `{ "limite_total": 9000 }`) |
| DELETE | `/bancos/:id` | Remove (409 se tiver transações) |
| GET | `/transacoes` | Lista. Filtros: `tipo`, `categoria`, `banco_id`, `ativa`, `mes=AAAA-MM` |
| GET | `/transacoes/:id` | Busca uma |
| POST | `/transacoes` | Cria |
| PATCH | `/transacoes/:id` | Altera (ex.: `{ "ativa": false }` pausa a despesa) |
| DELETE | `/transacoes/:id` | Remove |
| GET | `/cofre` | Lista objetivos + total |
| POST | `/cofre` | Cria objetivo |
| PATCH | `/cofre/:id` | Altera saldo/nome |
| DELETE | `/cofre/:id` | Remove |
| GET | `/dashboard?mes=AAAA-MM` | Totais do header + cartões com limite disponível |
| GET | `/forecast?mes=AAAA-MM&meses=6` | Projeção mensal (1 a 24 meses) |

## Códigos de resposta

| Código | Significado |
| :--- | :--- |
| 200 | OK |
| 201 | Criado |
| 204 | Removido (sem corpo) |
| 400 | Dados inválidos (`{ erro, detalhes: [...] }`) |
| 404 | Não encontrado |
| 409 | Conflito (nome repetido, banco com transações...) |
| 500 | Erro interno |

## Exemplo: criar uma despesa

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/transacoes `
  -ContentType 'application/json' `
  -Body '{"descricao":"Uber","valor":35.9,"tipo":"Despesa","banco_id":1,"categoria":"Variável"}'
```

Campos opcionais e seus padrões: `data_compra` (hoje), `parcela_atual` (1), `total_parcelas` (1), `ativa` (true).
