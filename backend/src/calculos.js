// =====================================================
// REGRAS DE NEGÓCIO (portadas do front-end para o servidor)
// A partir de agora, o servidor é a "fonte da verdade" dos cálculos.
// Assim o front e o bot do Telegram mostram sempre os mesmos números.
// =====================================================
import { arredondar } from './ajudantes.js'

const soma = (lista, campo = 'valor') => lista.reduce((total, item) => total + item[campo], 0)

// Uma despesa entra na fatura do mês de referência quando:
//  - está ativa; e
//  - é fixa e já iniciou (data_compra <= mês de referência), OU está parcelada,
//    OU foi comprada dentro do próprio mês.
// mesReferencia tem o formato "AAAA-MM".
export function contaNaFatura(t, mesReferencia) {
  if (t.tipo !== 'Despesa' || !t.ativa) return false
  const mesInicio = t.data_compra ? t.data_compra.slice(0, 7) : null

  if (t.categoria === 'Fixo') {
    // Se a despesa fixa foi agendada para um mês futuro, ela ainda não entra na fatura atual
    if (mesInicio && mesReferencia < mesInicio) return false

    // Se tem prazo determinado, verifica se já passou do total de parcelas
    if (t.total_parcelas > 1) {
      if (mesInicio) {
        const [anoRef, mRef] = mesReferencia.split('-').map(Number)
        const [anoIni, mIni] = mesInicio.split('-').map(Number)
        const diffMeses = (anoRef - anoIni) * 12 + (mRef - mIni)
        if (t.parcela_atual + diffMeses > t.total_parcelas) return false
      } else if (t.parcela_atual > t.total_parcelas) {
        return false
      }
    }
    return true
  }

  if (t.total_parcelas > 1) {
    if (t.parcela_atual > t.total_parcelas) return false
    return true
  }
  return t.data_compra.startsWith(mesReferencia)
}

export function calcularGastoDoBanco(transacoes, banco, mesReferencia) {
  const bancoId = typeof banco === 'object' ? banco.id : banco
  const ehBeneficio = typeof banco === 'object' && banco.tipo === 'Benefício'

  return soma(
    transacoes.filter((t) => {
      if (t.banco_id !== bancoId || !contaNaFatura(t, mesReferencia)) return false
      if (ehBeneficio) {
        // Para cartões de benefício (Vale Refeição), soma todas as despesas vinculadas a ele
        return true
      }
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

// Monta cada "card" de banco já com limite disponível e % de uso
export function montarCartoes(bancos, transacoes, mesReferencia) {
  return bancos.map((banco) => {
    const gasto = calcularGastoDoBanco(transacoes, banco, mesReferencia)
    return {
      ...banco,
      gasto: arredondar(gasto),
      limite_disponivel: arredondar(Math.max(banco.limite_total - gasto, 0)),
      uso: banco.limite_total > 0 ? Math.min(gasto / banco.limite_total, 1) : 0,
    }
  })
}

// Projeta os próximos meses: renda fixa, despesas fixas (contínuas e temporárias) e parcelas restantes.
// Gastos variáveis à vista não são projetados (impossível prever).
export function gerarForecast(transacoes, mesReferencia, quantidadeDeMeses) {
  const [ano, mes] = mesReferencia.split('-').map(Number)

  const rendaContinuas = transacoes.filter(
    (t) => t.tipo === 'Receita' && t.categoria === 'Fixo' && t.ativa && (t.total_parcelas === 1 || !t.total_parcelas),
  )
  const rendaTemporarias = transacoes.filter(
    (t) => t.tipo === 'Receita' && t.categoria === 'Fixo' && t.ativa && t.total_parcelas > 1,
  )

  // Despesas fixas (desconsidera Voucher, pois o VR não compromete a renda salarial líquida pessoal)
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

  const parceladas = transacoes.filter(
    (t) =>
      t.tipo === 'Despesa' &&
      t.categoria !== 'Fixo' &&
      t.total_parcelas > 1 &&
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

    // Fixas contínuas no mês k: só conta a partir de mesInicio
    const fixasContinuasNoMes = fixasContinuas.filter((t) => {
      const mesInicio = t.data_compra ? t.data_compra.slice(0, 7) : null
      return !mesInicio || mesK >= mesInicio
    })

    // Fixas temporárias no mês k: só conta a partir de mesInicio até total_parcelas
    const fixasTemporariasNoMes = fixasTemporarias.filter((t) => {
      const mesInicio = t.data_compra ? t.data_compra.slice(0, 7) : null
      if (mesInicio && mesK < mesInicio) return false
      const diffMeses = mesInicio
        ? (anoK - Number(mesInicio.slice(0, 4))) * 12 + (mesKNum - Number(mesInicio.slice(5, 7)))
        : k
      return t.parcela_atual + diffMeses <= t.total_parcelas
    })

    const fixas = soma(fixasContinuasNoMes) + soma(fixasTemporariasNoMes)

    // No mês k, a parcela é (parcela_atual + k); só cobra se ainda não passou do total
    const detalhesParcelas = parceladas
      .filter((t) => t.parcela_atual + k <= t.total_parcelas)
      .map((t) => ({ descricao: t.descricao, valor: t.valor, numero: t.parcela_atual + k, total: t.total_parcelas }))

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
