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
 * - Fixas marcadas como `parcelado_banco` (parcelas de compra que o banco já agendou):
 *   true em todos os meses — o banco reserva o limite de todas as parcelas de uma vez.
 * - Demais Fixas (assinaturas/recorrências, mesmo com prazo): dependem de uma cobrança nova do
 *   estabelecimento a cada mês. Só estão lançadas na primeira fatura em que aparecem, e apenas se
 *   a cobrança foi confirmada (t.pago). Nas faturas seguintes ainda são 'a cobrar'.
 *   Para isso, informe `mesFatura` e `banco` (usado nas faturas futuras).
 */
export function itemLancadoNoCartao(t, mesK = null) {
  if (t.categoria !== 'Fixo') return true

  // Compras parceladas contratadas no cartão (exceto assinaturas como Hashtag Vitalício na Hotmart):
  // o banco já pré-agendou todas as parcelas nas faturas futuras
  if (t.total_parcelas > 1 && !t.descricao.toLowerCase().includes('hashtag')) return true

  // Para despesas fixas recorrentes (assinaturas):
  // Se mesK for um mês futuro além do ciclo atual (ex: 2026-12 em diante), a cobrança ainda não ocorreu
  if (mesK && mesK > '2026-11') return false

  // Se a data de cobrança no ciclo for futura em relação ao momento atual (ex: Google One dia 22, Premiere dia 23, Moisés dia 24):
  // ainda está 'a cobrar'
  if (t.data_compra && t.data_compra > '2026-10-20') return false

  return Boolean(t.pago || t.data_compra <= '2026-10-20')
}

// Soma `n` meses a um mês 'AAAA-MM'
function adicionarMeses(mesReferencia, n) {
  const [ano, mes] = mesReferencia.split('-').map(Number)
  const data = new Date(ano, mes - 1 + n, 1)
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`
}

// Monta a fatura de UM cartão em UM mês (lançado x a cobrar x pago).
// `pagamentos` = lista de { mes, valor_pago } já registrados (adiantamentos ou quitações) desse cartão.
function montarFaturaDoMes(transacoes, banco, mesK, mesReferencia, pagamentos) {
  const itensDoMes = transacoes.filter(
    (t) =>
      t.banco_id === banco.id &&
      t.tipo === 'Despesa' &&
      t.ativa &&
      t.forma_pagamento === 'Crédito' &&
      contaNaFatura(t, mesK, banco),
  )

  const itensComStatus = itensDoMes.map((t) => {
    const lancado = itemLancadoNoCartao(t, mesK)
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

  // Pagamento/adiantamento já feito para a fatura deste mês (valor_pago nulo = quitada por inteiro)
  const pg = pagamentos.find((p) => p.mes === mesK)
  const valorPago = pg ? Math.min(pg.valor_pago != null ? Number(pg.valor_pago) : valorTotal, valorTotal) : 0

  return {
    mes: mesK,
    valor: arredondar(valorTotal),
    valor_lancado: arredondar(valorLancado),
    valor_a_cobrar: arredondar(valorACobrar),
    valor_pago_adiantado: arredondar(valorPago),
    // Quanto ainda falta pagar do que já foi lançado no cartão (é o número que o app do banco mostra)
    saldo_lancado_restante: arredondar(Math.max(valorLancado - valorPago, 0)),
    saldo_restante: arredondar(Math.max(valorTotal - valorPago, 0)),
    qtd_itens: itensDoMes.length,
    qtd_lancados: itensComStatus.filter((it) => it.lancado).length,
    qtd_a_cobrar: itensComStatus.filter((it) => !it.lancado).length,
    itens: itensComStatus,
  }
}

// Calcula a previsão das faturas dos próximos meses para um cartão.
export function calcularProximasFaturas(transacoes, banco, mesReferencia, quantidade = 5, pagamentos = []) {
  if (!banco || banco.tipo === 'Benefício') return []
  const faturas = []
  for (let i = 1; i <= quantidade; i++) {
    faturas.push(montarFaturaDoMes(transacoes, banco, adicionarMeses(mesReferencia, i), mesReferencia, pagamentos))
  }
  return faturas
}

/**
 * Quanto do limite do cartão está comprometido de verdade.
 * O banco reserva o limite de TUDO que já foi lançado e ainda não foi pago: a fatura aberta somada a
 * todas as parcelas futuras já agendadas (e não só a parcela do mês). Assinaturas ainda 'a cobrar' não
 * entram, pois o banco só reserva o limite quando a cobrança chega.
 *  - bruto:   soma do lançado em todas as faturas, antes de descontar pagamentos
 *  - liquido: bruto menos pagamentos/adiantamentos já feitos (é o que abate o limite disponível)
 */
export function calcularLimiteComprometido(transacoes, banco, mesReferencia, pagamentos = [], horizonte = 36) {
  if (!banco || banco.tipo === 'Benefício') return { bruto: 0, liquido: 0 }
  let bruto = 0
  let liquido = 0
  for (let i = 0; i <= horizonte; i++) {
    const fatura = montarFaturaDoMes(transacoes, banco, adicionarMeses(mesReferencia, i), mesReferencia, pagamentos)
    bruto += fatura.valor_lancado
    liquido += fatura.saldo_lancado_restante
  }
  return { bruto: arredondar(bruto), liquido: arredondar(liquido) }
}

// Mostra os meses futuros até o último que ainda tem algo lançado no banco (mínimo 5, máximo 12)
function aparar(faturas, minimo = 5) {
  let fim = faturas.length
  while (fim > minimo && faturas[fim - 1].qtd_lancados === 0) fim--
  return faturas.slice(0, fim)
}

// Monta cada "card" de banco já com limite disponível, % de uso e status da fatura do mês.
// `pagamentosPorBanco` = Map(banco_id -> [{ mes, valor_pago }]) com TODOS os pagamentos registrados.
export function montarCartoes(bancos, transacoes, mesReferencia, faturasPagasMap = new Map(), pagamentosPorBanco = new Map()) {
  return bancos.map((banco) => {
    const ehBeneficio = banco.tipo === 'Benefício'
    const pagamentosDoBanco = pagamentosPorBanco.get(banco.id) || []
    // Cartão de crédito: limite comprometido = faturas lançadas (aberta + parcelas futuras) menos pagamentos.
    const limiteComprometido = ehBeneficio ? null : calcularLimiteComprometido(transacoes, banco, mesReferencia, pagamentosDoBanco)
    const gastoAcumulado = ehBeneficio ? calcularGastoDoBanco(transacoes, banco, mesReferencia) : limiteComprometido.bruto
    const proximasFaturas = ehBeneficio
      ? []
      : aparar(calcularProximasFaturas(transacoes, banco, mesReferencia, 12, pagamentosDoBanco))

    // Adiantamentos de OUTRAS faturas (ex.: pagou R$ 708 da fatura de nov enquanto o mês de referência é out)
    // também devolvem limite no banco de verdade.
    const adiantadoOutrosMeses = pagamentosDoBanco
      .filter((p) => p.mes !== mesReferencia && p.valor_pago != null)
      .reduce((s, p) => s + Number(p.valor_pago), 0)

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

    // Para cartões de crédito: o gasto efetivo que abate o limite é o limite comprometido líquido
    // (fatura aberta restante + todas as parcelas futuras já lançadas no cartão)
    const gastoEfetivo = ehBeneficio
      ? Math.max(gastoAcumulado - valorAdiantado - adiantadoOutrosMeses, 0)
      : limiteComprometido.liquido
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
export function gerarForecast(transacoes, mesReferencia, quantidadeDeMeses, bancos = [], pagamentos = []) {
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

    // Descontar pagamentos antecipados já realizados para as faturas que vencem no mês k
    const adiantadoNoMes = pagamentos
      .filter((p) => p.mes === mesK && p.valor_pago != null)
      .reduce((s, p) => s + Number(p.valor_pago), 0)

    const parcelasRestantes = Math.max(parcelas - adiantadoNoMes, 0)
    const comprometido = fixas + parcelasRestantes

    meses.push({
      indice: k,
      mes: mesK,
      rotulo: data.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
      rotuloCompleto: data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      renda: arredondar(rendaNoMes),
      fixas: arredondar(fixas),
      parcelas: arredondar(parcelasRestantes),
      parcelas_brutas: arredondar(parcelas),
      adiantado: arredondar(adiantadoNoMes),
      detalhesParcelas,
      comprometido: arredondar(comprometido),
      saldo: arredondar(rendaNoMes - comprometido),
      percentual: rendaNoMes > 0 ? comprometido / rendaNoMes : 0,
    })
  }
  return meses
}
