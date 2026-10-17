import { db } from './db.js'
import { transacaoParaApi, arredondar } from './ajudantes.js'
import { calcularReceitaDoMes, contaNaFatura, montarCartoes, calcularFaturaDoBanco } from './calculos.js'

export async function carregarTransacoes(mes) {
  if (mes) {
    const sql = `
      SELECT t.*, (CASE WHEN pf.id IS NOT NULL THEN 1 ELSE 0 END) AS pago
      FROM transacoes t
      LEFT JOIN pagamentos_fixas pf ON pf.transacao_id = t.id AND pf.mes = ?
    `
    const transacoes = await db.prepare(sql).all(mes)
    return transacoes.map(transacaoParaApi)
  }
  const transacoes = await db.prepare('SELECT * FROM transacoes').all()
  return transacoes.map(transacaoParaApi)
}

export async function calcularDashboard(mes) {
  const transacoes = await carregarTransacoes(mes)
  const bancos = await db.prepare('SELECT * FROM bancos ORDER BY id').all()
  const bancosMap = new Map(bancos.map((b) => [b.id, b]))
  const result = await db.prepare('SELECT COALESCE(SUM(saldo_atual), 0) AS total FROM cofre').get()
  const cofre = Number(result?.total || 0)

  // Status de faturas pagas no mês
  const pagamentosFaturas = await db.prepare('SELECT banco_id FROM pagamentos_faturas WHERE mes = ?').all(mes)
  const faturasPagasMap = new Map(pagamentosFaturas.map((pf) => [pf.banco_id, true]))

  const receitaMes = calcularReceitaDoMes(transacoes, mes)
  const despesasMes = transacoes.filter((t) => {
    if (t.tipo !== 'Despesa') return false
    const banco = bancosMap.get(t.banco_id)
    return contaNaFatura(t, mes, banco)
  })

  // Faturas de Cartão de Crédito (apenas forma Crédito com vencimento no mês 'mes')
  const faturasCartao = despesasMes
    .filter((t) => t.forma_pagamento === 'Crédito')
    .reduce((soma, t) => soma + t.valor, 0)

  // Métricas de faturas pagas vs pendentes de quitação
  const cartoesCredito = bancos.filter((b) => b.tipo !== 'Benefício')
  let faturasPagasTotal = 0
  let qtdFaturasPagas = 0
  let qtdFaturasTotal = 0

  for (const b of cartoesCredito) {
    const valFatura = calcularFaturaDoBanco(transacoes, b, mes)
    if (valFatura > 0) {
      qtdFaturasTotal++
      if (faturasPagasMap.get(b.id)) {
        faturasPagasTotal += valFatura
        qtdFaturasPagas++
      }
    }
  }
  const faturasPendentesTotal = Math.max(faturasCartao - faturasPagasTotal, 0)

  // Saídas da Conta Corrente (PIX, Débito em Conta, Limite Especial, Dinheiro - excluindo Voucher)
  const despesasContaPix = despesasMes
    .filter((t) => t.forma_pagamento !== 'Crédito' && t.forma_pagamento !== 'Voucher')
    .reduce((soma, t) => soma + t.valor, 0)

  // Gastos com Benefício (Voucher / Vale Refeição - não saem da conta bancária)
  const despesasVoucher = transacoes
    .filter((t) => {
      if (t.tipo !== 'Despesa' || !t.ativa || t.forma_pagamento !== 'Voucher') return false
      const mesInicio = t.data_compra ? t.data_compra.slice(0, 7) : null
      if (t.categoria === 'Fixo') {
        return !mesInicio || mesInicio <= mes
      }
      return mesInicio === mes
    })
    .reduce((soma, t) => soma + t.valor, 0)

  const totalDespesas = faturasCartao + despesasContaPix
  const saldoMes = receitaMes - totalDespesas

  return {
    mes,
    total_cofre: arredondar(cofre),
    receita_mes: arredondar(receitaMes),
    faturas_cartao: arredondar(faturasCartao),
    faturas_abertas: arredondar(faturasPendentesTotal),
    faturas_pagas_total: arredondar(faturasPagasTotal),
    faturas_pendentes_total: arredondar(faturasPendentesTotal),
    qtd_faturas_pagas: qtdFaturasPagas,
    qtd_faturas_total: qtdFaturasTotal,
    todas_faturas_pagas: qtdFaturasTotal > 0 && qtdFaturasPagas === qtdFaturasTotal,
    despesas_conta_pix: arredondar(despesasContaPix),
    despesas_voucher: arredondar(despesasVoucher),
    total_despesas: arredondar(totalDespesas),
    saldo_mes: arredondar(saldoMes),
    status_mes: saldoMes >= 0 ? 'positivo' : 'negativo',
    cartoes: montarCartoes(bancos, transacoes, mes, faturasPagasMap),
  }
}
