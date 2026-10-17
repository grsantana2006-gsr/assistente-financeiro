// =====================================================
// REGRAS DE NEGÓCIO (portadas do front-end para o servidor)
// A partir de agora, o servidor é a "fonte da verdade" dos cálculos.
// Assim o front e o bot do Telegram mostram sempre os mesmos números.
// =====================================================
import { arredondar } from './ajudantes.js'

const soma = (lista, campo = 'valor') => lista.reduce((total, item) => total + item[campo], 0)

/**
 * Calcula em qual mês de fatura (mês de vencimento) uma transação no cartão de crédito cai,
 * respeitando com precisão matemática as datas de fechamento e vencimento de cada banco.
 *
 * Exemplo 1: Itaú (fecha 03, vence 10)
 *   - Compra em 02/10 -> fatura 2026-10
 *   - Compra em 04/10 (após o fechamento) -> fatura 2026-11
 *
 * Exemplo 2: Nubank (fecha 27, vence 03) / Banco do Brasil (fecha 28, vence 10)
 *   - Compra em 14/10 -> fatura que vence em 10/11 (2026-11)
 *   - Compra em 29/10 (após o fechamento de 28/out) -> fatura que vence em 10/12 (2026-12)
 */
export function obterMesFatura(dataStr, diaFechamento, diaVencimento) {
  if (!dataStr) return null
  const partes = dataStr.slice(0, 10).split('-')
  let ano = Number(partes[0])
  let mes = Number(partes[1])
  const dia = Number(partes[2])

  if (!diaFechamento || !diaVencimento) {
    return `${ano}-${String(mes).padStart(2, '0')}`
  }

  if (diaFechamento < diaVencimento) {
    // Fechamento e vencimento ocorrem no mesmo mês
    if (dia > diaFechamento) {
      mes += 1
      if (mes > 12) {
        mes = 1
        ano += 1
      }
    }
  } else {
    // diaFechamento > diaVencimento (ex: Nubank fecha 27 e vence dia 3; BB fecha 28 e vence dia 10)
    // O fechamento ocorre no final do mês anterior ao mês de vencimento.
    if (dia <= diaFechamento) {
      mes += 1
      if (mes > 12) {
        mes = 1
        ano += 1
      }
    } else {
      mes += 2
      if (mes > 12) {
        mes -= 12
        ano += 1
      }
    }
  }

  return `${ano}-${String(mes).padStart(2, '0')}`
}

/**
 * Retorna o mês em que a despesa deve ser efetivamente cobrada/paga.
 * Para cartão de crédito: leva em conta o fechamento e vencimento da fatura.
 * Para débito/PIX/dinheiro: é a data do pagamento em si.
 */
export function mesDaTransacao(t, banco) {
  if (t.forma_pagamento === 'Crédito' && banco && banco.tipo !== 'Benefício') {
    return obterMesFatura(t.data_compra, banco.dia_fechamento, banco.dia_vencimento)
  }
  return t.data_compra ? t.data_compra.slice(0, 7) : null
}

// Uma despesa entra na fatura ou pagamentos do mês de referência quando:
//  - está ativa; e
//  - para débito/PIX/dinheiro: data de pagamento no mês de referência;
//  - para crédito: o mês de vencimento da fatura (calculado por obterMesFatura) cai no mês de referência.
export function contaNaFatura(t, mesReferencia, banco) {
  if (t.tipo !== 'Despesa' || !t.ativa) return false
  const forma = t.forma_pagamento || 'Crédito'

  // Voucher não entra em faturas de conta corrente nem de cartão
  if (forma === 'Voucher') return false

  const ehCredito = forma === 'Crédito' && banco && banco.tipo !== 'Benefício'
  const mesInicio = ehCredito
    ? obterMesFatura(t.data_compra, banco.dia_fechamento, banco.dia_vencimento)
    : (t.data_compra ? t.data_compra.slice(0, 7) : null)

  if (!mesInicio) return false

  if (t.total_parcelas > 1) {
    const [anoRef, mRef] = mesReferencia.split('-').map(Number)
    const [anoIni, mIni] = mesInicio.split('-').map(Number)
    const diffMeses = (anoRef - anoIni) * 12 + (mRef - mIni)
    const numParcela = (t.parcela_atual || 1) + diffMeses
    return numParcela >= 1 && numParcela <= t.total_parcelas
  }

  if (t.categoria === 'Fixo') {
    // Para despesa fixa contínua (ex: assinaturas ou contas recorrentes):
    // Entra a partir do mês em que começou a cobrança/fatura
    return mesReferencia >= mesInicio
  }

  // Compra à vista (1x)
  return mesInicio === mesReferencia
}

export function calcularGastoDoBanco(transacoes, banco, mesReferencia) {
  const bancoId = typeof banco === 'object' ? banco.id : banco
  const ehBeneficio = typeof banco === 'object' && banco.tipo === 'Benefício'

  if (ehBeneficio) {
    return soma(
      transacoes.filter((t) => {
        if (!t.ativa || t.banco_id !== bancoId || t.forma_pagamento !== 'Voucher') return false
        const mesInicio = t.data_compra ? t.data_compra.slice(0, 7) : null
        if (mesInicio && mesInicio > mesReferencia) return false
        return true
      })
    )
  }

  // Para cartões de crédito: o gasto que abate o limite é o passivo acumulado no cartão
  // que ainda compromete o limite (fatura aberta + parcelas a vencer)
  return soma(
    transacoes.filter((t) => {
      if (t.banco_id !== bancoId || !t.ativa) return false
      return t.forma_pagamento === 'Crédito'
    })
  )
}

// Receita do mês = receitas ativas fixas que já iniciaram (salário) + avulsas do próprio mês
export function calcularReceitaDoMes(transacoes, mesReferencia) {
  return soma(
    transacoes.filter((t) => {
      if (t.tipo !== 'Receita' || !t.ativa) return false
      const mesInicio = t.data_compra ? t.data_compra.slice(0, 7) : null
      if (t.categoria === 'Fixo') {
        if (mesInicio && mesReferencia < mesInicio) return false
        return true
      }
      return t.data_compra.startsWith(mesReferencia)
    })
  )
}

// Calcula apenas o valor da fatura de um banco específico para o mês de referência
export function calcularFaturaDoBanco(transacoes, banco, mesReferencia) {
  const bancoId = typeof banco === 'object' ? banco.id : banco
  const bancoObj = typeof banco === 'object' ? banco : null
  return soma(
    transacoes.filter((t) => {
      if (t.banco_id !== bancoId || t.tipo !== 'Despesa' || !t.ativa || t.forma_pagamento !== 'Crédito') return false
      return contaNaFatura(t, mesReferencia, bancoObj)
    })
  )
}

/**
 * Determina se uma transação que cai na fatura já foi efetivamente lançada no cartão.
 * - Gastos Variáveis: sempre true (compras feitas no cartão já foram cobradas no ato).
 * - Despesas Fixas: se marcada como cobrada/paga (t.pago === true), está lançada (true); caso contrário, está 'a cobrar' (false).
 */
export function itemLancadoNoCartao(t) {
  if (t.categoria !== 'Fixo') return true
  return Boolean(t.pago)
}

// Calcula a previsão das faturas dos próximos meses para um cartão
export function calcularProximasFaturas(transacoes, banco, mesReferencia, quantidade = 5) {
  if (!banco || banco.tipo === 'Benefício') return []
  const [ano, mes] = mesReferencia.split('-').map(Number)
  const faturas = []

  for (let i = 1; i <= quantidade; i++) {
    const data = new Date(ano, mes - 1 + i, 1)
    const anoK = data.getFullYear()
    const mesKNum = data.getMonth() + 1
    const mesK = `${anoK}-${String(mesKNum).padStart(2, '0')}`

    const itensDoMes = transacoes.filter(
      (t) =>
        t.banco_id === banco.id &&
        t.tipo === 'Despesa' &&
        t.ativa &&
        t.forma_pagamento === 'Crédito' &&
        contaNaFatura(t, mesK, banco),
    )

    const itensComStatus = itensDoMes.map((t) => {
      const lancado = itemLancadoNoCartao(t)
      const diaCobranca = t.data_compra ? Number(t.data_compra.slice(8, 10)) : null
      return {
        id: t.id,
        descricao: t.descricao,
        valor: t.valor,
        parcela_atual: t.parcela_atual,
        total_parcelas: t.total_parcelas,
        lancado,
        dia_cobranca: diaCobranca,
      }
    })

    const valorLancado = itensComStatus.filter((it) => it.lancado).reduce((s, it) => s + it.valor, 0)
    const valorACobrar = itensComStatus.filter((it) => !it.lancado).reduce((s, it) => s + it.valor, 0)
    const valorTotal = valorLancado + valorACobrar

    faturas.push({
      mes: mesK,
      valor: arredondar(valorTotal),
      valor_lancado: arredondar(valorLancado),
      valor_a_cobrar: arredondar(valorACobrar),
      qtd_itens: itensDoMes.length,
      qtd_lancados: itensComStatus.filter((it) => it.lancado).length,
      qtd_a_cobrar: itensComStatus.filter((it) => !it.lancado).length,
      itens: itensComStatus,
    })
  }

  return faturas
}

// Monta cada "card" de banco já com limite disponível, % de uso e status da fatura do mês
export function montarCartoes(bancos, transacoes, mesReferencia, faturasPagasMap = new Map()) {
  return bancos.map((banco) => {
    const gastoAcumulado = calcularGastoDoBanco(transacoes, banco, mesReferencia)
    const ehBeneficio = banco.tipo === 'Benefício'
    const proximasFaturas = ehBeneficio ? [] : calcularProximasFaturas(transacoes, banco, mesReferencia, 5)

    // Detalhamento da fatura do mês de referência
    const itensFaturaAtual = ehBeneficio
      ? []
      : transacoes.filter(
          (t) =>
            t.banco_id === banco.id &&
            t.tipo === 'Despesa' &&
            t.ativa &&
            t.forma_pagamento === 'Crédito' &&
            contaNaFatura(t, mesReferencia, banco),
        )

    const itensAtualComStatus = itensFaturaAtual.map((t) => ({
      id: t.id,
      descricao: t.descricao,
      valor: t.valor,
      parcela_atual: t.parcela_atual,
      total_parcelas: t.total_parcelas,
      lancado: itemLancadoNoCartao(t),
      dia_cobranca: t.data_compra ? Number(t.data_compra.slice(8, 10)) : null,
    }))

    const valorFaturaLancada = itensAtualComStatus.filter((it) => it.lancado).reduce((s, it) => s + it.valor, 0)
    const valorFaturaACobrar = itensAtualComStatus.filter((it) => !it.lancado).reduce((s, it) => s + it.valor, 0)
    const valorFaturaTotal = valorFaturaLancada + valorFaturaACobrar

    const infoPagamento = faturasPagasMap.get(banco.id)
    const ehPagoObjeto = infoPagamento && typeof infoPagamento === 'object'
    const faturaPagaTotal = ehPagoObjeto
      ? (infoPagamento.valor_pago == null || infoPagamento.valor_pago >= valorFaturaTotal)
      : Boolean(infoPagamento)
    const valorAdiantado = ehPagoObjeto && infoPagamento.valor_pago != null
      ? infoPagamento.valor_pago
      : (faturaPagaTotal ? valorFaturaTotal : 0)
    const faturaParcial = Boolean(ehPagoObjeto && infoPagamento.valor_pago != null && infoPagamento.valor_pago < valorFaturaTotal && infoPagamento.valor_pago > 0)

    // Se a fatura do mês atual já foi paga ou teve adiantamento, aquele valor é liberado do limite comprometido
    const gastoEfetivo = Math.max(gastoAcumulado - valorAdiantado, 0)
    const saldoRestanteFatura = Math.max(valorFaturaTotal - valorAdiantado, 0)

    return {
      ...banco,
      gasto: arredondar(gastoEfetivo),
      gasto_acumulado: arredondar(gastoAcumulado),
      valor_fatura: arredondar(valorFaturaTotal),
      valor_fatura_lancada: arredondar(valorFaturaLancada),
      valor_fatura_a_cobrar: arredondar(valorFaturaACobrar),
      valor_pago_adiantado: arredondar(valorAdiantado),
      saldo_restante_fatura: arredondar(saldoRestanteFatura),
      fatura_paga: faturaPagaTotal,
      fatura_parcial: faturaParcial,
      proximas_faturas: proximasFaturas,
      limite_disponivel: arredondar(Math.max(banco.limite_total - gastoEfetivo, 0)),
      uso: banco.limite_total > 0 ? Math.min(gastoEfetivo / banco.limite_total, 1) : 0,
    }
  })
}

// Projeta os próximos meses: renda fixa, despesas fixas (contínuas e temporárias) e parcelas/faturas restantes.
export function gerarForecast(transacoes, mesReferencia, quantidadeDeMeses, bancos = []) {
  const [ano, mes] = mesReferencia.split('-').map(Number)
  const bancosMap = new Map(bancos.map((b) => [b.id, b]))

  const rendaContinuas = transacoes.filter(
    (t) => t.tipo === 'Receita' && t.categoria === 'Fixo' && t.ativa && (t.total_parcelas === 1 || !t.total_parcelas),
  )
  const rendaTemporarias = transacoes.filter(
    (t) => t.tipo === 'Receita' && t.categoria === 'Fixo' && t.ativa && t.total_parcelas > 1,
  )

  const fixasContinuas = transacoes.filter(
    (t) =>
      t.tipo === 'Despesa' &&
      t.categoria === 'Fixo' &&
      t.ativa &&
      t.forma_pagamento !== 'Voucher' &&
      (t.total_parcelas === 1 || !t.total_parcelas),
  )
  const fixasTemporarias = transacoes.filter(
    (t) =>
      t.tipo === 'Despesa' &&
      t.categoria === 'Fixo' &&
      t.ativa &&
      t.forma_pagamento !== 'Voucher' &&
      t.total_parcelas > 1,
  )

  const variaveis = transacoes.filter(
    (t) =>
      t.tipo === 'Despesa' &&
      t.categoria !== 'Fixo' &&
      t.ativa &&
      t.forma_pagamento !== 'Voucher',
  )

  const meses = []
  for (let k = 0; k < quantidadeDeMeses; k++) {
    const data = new Date(ano, mes - 1 + k, 1)
    const anoK = data.getFullYear()
    const mesKNum = data.getMonth() + 1
    const mesK = `${anoK}-${String(mesKNum).padStart(2, '0')}`

    // Renda no mês k: só conta a partir do mês em que a renda foi programada
    const rendaNoMes =
      soma(
        rendaContinuas.filter((t) => {
          const mesInicio = t.data_compra ? t.data_compra.slice(0, 7) : null
          return !mesInicio || mesK >= mesInicio
        })
      ) +
      soma(
        rendaTemporarias.filter((t) => {
          const mesInicio = t.data_compra ? t.data_compra.slice(0, 7) : null
          if (mesInicio && mesK < mesInicio) return false
          const diffMeses = mesInicio
            ? (anoK - Number(mesInicio.slice(0, 4))) * 12 + (mesKNum - Number(mesInicio.slice(5, 7)))
            : k
          return t.parcela_atual + diffMeses <= t.total_parcelas
        })
      )

    // Fixas contínuas no mês k: só conta a partir de mesInicio (levando em conta a fatura se for crédito)
    const fixasContinuasNoMes = fixasContinuas.filter((t) => {
      const banco = bancosMap.get(t.banco_id)
      const mesInicio = mesDaTransacao(t, banco)
      return !mesInicio || mesK >= mesInicio
    })

    // Fixas temporárias no mês k: só conta a partir de mesInicio até total_parcelas
    const fixasTemporariasNoMes = fixasTemporarias.filter((t) => {
      const banco = bancosMap.get(t.banco_id)
      const mesInicio = mesDaTransacao(t, banco)
      if (mesInicio && mesK < mesInicio) return false
      const diffMeses = mesInicio
        ? (anoK - Number(mesInicio.slice(0, 4))) * 12 + (mesKNum - Number(mesInicio.slice(5, 7)))
        : k
      return t.parcela_atual + diffMeses <= t.total_parcelas
    })

    const fixas = soma(fixasContinuasNoMes) + soma(fixasTemporariasNoMes)

    // Parcelas e faturas que vencem no mês k
    const detalhesParcelas = []
    for (const t of variaveis) {
      const banco = bancosMap.get(t.banco_id)
      const mesFatura1 = mesDaTransacao(t, banco)
      if (!mesFatura1) continue

      const [ano1, m1] = mesFatura1.split('-').map(Number)
      const diff = (anoK - ano1) * 12 + (mesKNum - m1)

      if (t.total_parcelas > 1) {
        const numParcela = t.parcela_atual + diff
        if (numParcela >= 1 && numParcela <= t.total_parcelas) {
          detalhesParcelas.push({
            descricao: t.descricao,
            valor: t.valor,
            numero: numParcela,
            total: t.total_parcelas,
          })
        }
      } else {
        // Compra à vista (1x): entra exatamente no mês de vencimento da fatura
        if (diff === 0) {
          detalhesParcelas.push({
            descricao: t.descricao,
            valor: t.valor,
            numero: 1,
            total: 1,
          })
        }
      }
    }

    const parcelas = soma(detalhesParcelas)
    const comprometido = fixas + parcelas

    meses.push({
      indice: k,
      mes: mesK,
      rotulo: data.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
      rotuloCompleto: data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      renda: arredondar(rendaNoMes),
      fixas: arredondar(fixas),
      parcelas: arredondar(parcelas),
      detalhesParcelas,
      comprometido: arredondar(comprometido),
      saldo: arredondar(rendaNoMes - comprometido),
      percentual: rendaNoMes > 0 ? comprometido / rendaNoMes : 0,
    })
  }
  return meses
}
