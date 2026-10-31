import { db } from './db.js'
import { transacaoParaApi, arredondar } from './ajudantes.js'
import { calcularReceitaDoMes, contaNaFatura, montarCartoes, calcularFaturaDoBanco } from './calculos.js'

export async function carregarTransacoes(mes) {
  if (mes) {
    const sql = `
      SELECT t.*, (CASE WHEN pf.id IS NOT NULL THEN 1 ELSE 0 END) AS pago
      FROM transacoes t
      LEFT JOIN pagamentos_fixas pf ON pf.transacao_id = t.id AND (pf.mes = ? OR (SUBSTR(t.data_compra, 1, 7) > ? AND pf.mes = SUBSTR(t.data_compra, 1, 7)))
    `
    const transacoes = await db.prepare(sql).all(mes, mes)
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

  // Status de faturas pagas ou adiantadas (de qualquer mês)
  const todosPagamentos = await db.prepare(
    'SELECT id, banco_id, mes, valor_pago, pago_em, descricao FROM pagamentos_faturas ORDER BY pago_em ASC, id ASC'
  ).all()

  const pagamentosPorBanco = new Map()
  for (const pf of todosPagamentos) {
    if (!pagamentosPorBanco.has(pf.banco_id)) pagamentosPorBanco.set(pf.banco_id, [])
    pagamentosPorBanco.get(pf.banco_id).push({
      id: pf.id,
      mes: pf.mes,
      valor_pago: pf.valor_pago != null ? Number(pf.valor_pago) : null,
      pago_em: pf.pago_em,
      descricao: pf.descricao || 'Adiantamento',
    })
  }

  const faturasPagasMap = new Map()
  for (const b of bancos) {
    const pgs = (pagamentosPorBanco.get(b.id) || []).filter((p) => p.mes === mes)
    if (pgs.length > 0) {
      const quitadaIntegral = pgs.some((p) => p.valor_pago == null)
      const somaAdiantamentos = pgs.reduce((s, p) => s + (p.valor_pago != null ? Number(p.valor_pago) : 0), 0)
      faturasPagasMap.set(b.id, {
        pago: quitadaIntegral,
        valor_pago: quitadaIntegral ? null : somaAdiantamentos,
        pagamentos: pgs,
      })
    }
  }

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

  // Métricas de faturas de cartão de crédito no mês
  const cartoesCredito = bancos.filter((b) => b.tipo !== 'Benefício')
  let faturasMesCargoSalarioTotal = 0
  let faturasQuitadasTotal = 0
  let faturasPendentesTotal = 0
  let adiantamentosTotal = 0
  let qtdFaturasPagas = 0
  let qtdFaturasTotal = 0

  for (const b of cartoesCredito) {
    const valFaturaBruta = calcularFaturaDoBanco(transacoes, b, mes)
    if (valFaturaBruta > 0) {
      qtdFaturasTotal++
      const pgs = (pagamentosPorBanco.get(b.id) || []).filter((p) => p.mes === mes)
      const somaAd = pgs.reduce((s, p) => s + (p.valor_pago != null ? Number(p.valor_pago) : 0), 0)
      adiantamentosTotal += somaAd

      // A parte da fatura a cargo do salário do mês é a fatura bruta menos adiantamentos já pagos
      const faturaCargoSalario = Math.max(valFaturaBruta - somaAd, 0)
      faturasMesCargoSalarioTotal += faturaCargoSalario

      const quitadaIntegral = pgs.some((p) => p.valor_pago == null)
      if (quitadaIntegral || faturaCargoSalario === 0) {
        qtdFaturasPagas++
        faturasQuitadasTotal += faturaCargoSalario
      } else {
        faturasPendentesTotal += faturaCargoSalario
      }
    }
  }

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

  // Despesas totais a cargo da receita do mês:
  // As faturas do mês (a cargo do salário) + contas em débito/PIX da conta corrente.
  // IMPORTANTE: Mesmo que uma fatura já tenha sido paga/quitada no mês, o valor pago SAIU do salário
  // e portanto continua sendo uma despesa do mês. O saldo não volta como sobra fictícia.
  const totalDespesas = faturasMesCargoSalarioTotal + despesasContaPix
  const saldoMes = receitaMes - totalDespesas

  // Detalhamento individual das despesas para visualização detalhada em modais
  const itensFaturas = despesasMes
    .filter((t) => t.forma_pagamento === 'Crédito')
    .map((t) => {
      const banco = bancosMap.get(t.banco_id)
      return {
        id: t.id,
        descricao: t.descricao,
        valor: arredondar(t.valor),
        categoria: t.categoria,
        forma_pagamento: t.forma_pagamento,
        banco_id: t.banco_id,
        banco_nome: banco?.nome || 'Cartão',
        parcela_atual: t.parcela_atual,
        total_parcelas: t.total_parcelas,
        data_compra: t.data_compra,
      }
    })

  const itensContaPix = despesasMes
    .filter((t) => t.forma_pagamento !== 'Crédito' && t.forma_pagamento !== 'Voucher')
    .map((t) => {
      const banco = bancosMap.get(t.banco_id)
      return {
        id: t.id,
        descricao: t.descricao,
        valor: arredondar(t.valor),
        categoria: t.categoria,
        forma_pagamento: t.forma_pagamento,
        banco_id: t.banco_id,
        banco_nome: banco?.nome || 'Conta',
        parcela_atual: t.parcela_atual,
        total_parcelas: t.total_parcelas,
        data_compra: t.data_compra,
        pago: t.pago,
      }
    })

  return {
    mes,
    total_cofre: arredondar(cofre),
    receita_mes: arredondar(receitaMes),
    faturas_cartao: arredondar(faturasMesCargoSalarioTotal),
    faturas_cartao_bruto: arredondar(faturasCartao),
    faturas_abertas: arredondar(faturasPendentesTotal),
    faturas_pagas_total: arredondar(faturasQuitadasTotal),
    faturas_pendentes_total: arredondar(faturasPendentesTotal),
    faturas_adiantadas_total: arredondar(adiantamentosTotal),
    faturas_mes_cargo_salario: arredondar(faturasMesCargoSalarioTotal),
    qtd_faturas_pagas: qtdFaturasPagas,
    qtd_faturas_total: qtdFaturasTotal,
    todas_faturas_pagas: qtdFaturasTotal > 0 && qtdFaturasPagas === qtdFaturasTotal,
    despesas_conta_pix: arredondar(despesasContaPix),
    despesas_voucher: arredondar(despesasVoucher),
    total_despesas: arredondar(totalDespesas),
    saldo_mes: arredondar(saldoMes),
    status_mes: saldoMes >= 0 ? 'positivo' : 'negativo',
    cartoes: montarCartoes(bancos, transacoes, mes, faturasPagasMap, pagamentosPorBanco),
    itens_faturas: itensFaturas,
    itens_conta_pix: itensContaPix,
  }
}
