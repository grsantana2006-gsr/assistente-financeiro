import { db } from './db.js'

const bancos = [
  { nome: 'Nubank', tipo: 'Crédito', limite_total: 4800, dia_fechamento: 3, dia_vencimento: 10, cor: '#8b5cf6' },
  { nome: 'Banco do Brasil', tipo: 'Múltiplo', limite_total: 1000, dia_fechamento: 20, dia_vencimento: 27, cor: '#fbbf24' },
  { nome: 'Itaú', tipo: 'Crédito', limite_total: 350, dia_fechamento: 15, dia_vencimento: 22, cor: '#fb923c' },
  { nome: 'PicPay', tipo: 'Crédito', limite_total: 200, dia_fechamento: 1, dia_vencimento: 8, cor: '#11c76f' },
  { nome: 'Vale Refeição', tipo: 'Benefício', limite_total: 600, dia_fechamento: 1, dia_vencimento: 1, cor: '#10b981' },
]

const transacoes = [
  ['Salário', 5200, 'Receita', 'Nubank', 'Fixo', '2026-10-05', 'PIX', 1, 1],
  ['Freelance', 650, 'Receita', 'Nubank', 'Variável', '2026-10-12', 'PIX', 1, 1],
  ['Internet', 99.9, 'Despesa', 'Banco do Brasil', 'Fixo', '2026-10-02', 'Débito', 1, 1],
  ['Netflix', 55.9, 'Despesa', 'Nubank', 'Fixo', '2026-10-04', 'Crédito', 1, 1],
  ['Spotify', 21.9, 'Despesa', 'Nubank', 'Fixo', '2026-10-06', 'Crédito', 1, 1],
  ['Academia', 119.9, 'Despesa', 'Itaú', 'Fixo', '2026-10-08', 'Crédito', 1, 1],
  ['iFood', 62.4, 'Despesa', 'Nubank', 'Variável', '2026-10-03', 'PIX', 1, 1],
  ['Uber', 35.9, 'Despesa', 'Nubank', 'Variável', '2026-10-07', 'PIX', 1, 1],
  ['Supermercado', 412.35, 'Despesa', 'Itaú', 'Variável', '2026-10-06', 'Crédito', 1, 1],
  ['Notebook', 389.9, 'Despesa', 'Nubank', 'Variável', '2026-08-14', 'Crédito', 3, 10],
  ['Tênis', 150, 'Despesa', 'Itaú', 'Variável', '2026-09-20', 'Crédito', 2, 6],
  ['Celular', 275, 'Despesa', 'Banco do Brasil', 'Variável', '2026-07-10', 'Crédito', 4, 12],
]

const cofre = [
  ['Reserva de Emergência', 9800],
  ['Viagem', 2350],
  ['Novo PC', 1200],
]

export async function semearSeVazio() {
  const result = await db.prepare('SELECT COUNT(*) AS total FROM bancos').get()
  const total = Number(result?.total || 0)
  if (total > 0) return false

  const inserirBanco = db.prepare('INSERT INTO bancos (nome, tipo, limite_total, dia_fechamento, dia_vencimento, cor) VALUES (?, ?, ?, ?, ?, ?)')
  const buscarBanco = db.prepare('SELECT id FROM bancos WHERE nome = ?')
  const inserirTransacao = db.prepare(
    `INSERT INTO transacoes
      (descricao, valor, tipo, banco_id, categoria, data_compra, forma_pagamento, parcela_atual, total_parcelas)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  const inserirCofre = db.prepare('INSERT INTO cofre (objetivo, saldo_atual) VALUES (?, ?)')

  for (const b of bancos) {
    await inserirBanco.run(b.nome, b.tipo, b.limite_total, b.dia_fechamento, b.dia_vencimento, b.cor)
  }
  for (const [descricao, valor, tipo, nomeBanco, categoria, data, forma, atual, total_parc] of transacoes) {
    const row = await buscarBanco.get(nomeBanco)
    if (row) {
      await inserirTransacao.run(descricao, valor, tipo, row.id, categoria, data, forma, atual, total_parc)
    }
  }
  for (const [objetivo, saldo] of cofre) {
    await inserirCofre.run(objetivo, saldo)
  }
  
  return true
}
