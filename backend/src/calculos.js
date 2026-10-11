// =====================================================
// REGRAS DE NEGÓCIO (portadas do front-end para o servidor)
// A partir de agora, o servidor é a "fonte da verdade" dos cálculos.
// Assim o front e o bot do Telegram mostram sempre os mesmos números.
// =====================================================
import { arredondar } from './ajudantes.js'

const soma = (lista, campo = 'valor') => lista.reduce((total, item) => total + item[campo], 0)

// Uma despesa entra na fatura do mês de referência quando:
//  - está ativa; e
//  - é fixa (recorrente), OU está parcelada (a parcela atual pesa no mês),
//    OU foi comprada dentro do próprio mês.
// mesReferencia tem o formato "AAAA-MM".
export function contaNaFatura(t, mesReferencia) {
  if (t.tipo !== 'Despesa' || !t.ativa) return false
  if (t.categoria === 'Fixo') {
    if (t.total_parcelas > 1 && t.parcela_atual > t.total_parcelas) return false
    return true
  }
  if (t.total_parcelas > 1) {
    if (t.parcela_atual > t.total_parcelas) return false
    return true
  }
  return t.data_compra.startsWith(mesReferencia)
}

export function calcularGastoDoBanco(transacoes, bancoId, mesReferencia) {
  return soma(transacoes.filter((t) => t.banco_id === bancoId && contaNaFatura(t, mesReferencia) && t.forma_pagamento === 'Crédito'))
}

// Receita do mês = receitas ativas fixas (salário) + avulsas do próprio mês
export function calcularReceitaDoMes(transacoes, mesReferencia) {
  return soma(
    transacoes.filter(
      (t) => t.tipo === 'Receita' && t.ativa && (t.categoria === 'Fixo' || t.data_compra.startsWith(mesReferencia)),
    ),
  )
}

// Monta cada "card" de banco já com limite disponível e % de uso
export function montarCartoes(bancos, transacoes, mesReferencia) {
  return bancos.map((banco) => {
    const gasto = calcularGastoDoBanco(transacoes, banco.id, mesReferencia)
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

  const fixasContinuas = transacoes.filter(
    (t) => t.tipo === 'Despesa' && t.categoria === 'Fixo' && t.ativa && (t.total_parcelas === 1 || !t.total_parcelas),
  )
  const fixasTemporarias = transacoes.filter(
    (t) => t.tipo === 'Despesa' && t.categoria === 'Fixo' && t.ativa && t.total_parcelas > 1,
  )

  const parceladas = transacoes.filter(
    (t) => t.tipo === 'Despesa' && t.categoria !== 'Fixo' && t.total_parcelas > 1 && t.ativa,
  )

  const meses = []
  for (let k = 0; k < quantidadeDeMeses; k++) {
    const data = new Date(ano, mes - 1 + k, 1)

    // Renda no mês k (contínua + temporárias ainda dentro do prazo)
    const renda = soma(rendaContinuas) + soma(rendaTemporarias.filter((t) => t.parcela_atual + k <= t.total_parcelas))

    // Despesas fixas no mês k (contínuas + temporárias que ainda não acabaram)
    const fixasTemporariasNoMes = fixasTemporarias.filter((t) => t.parcela_atual + k <= t.total_parcelas)
    const fixas = soma(fixasContinuas) + soma(fixasTemporariasNoMes)

    // No mês k, a parcela é (parcela_atual + k); só cobra se ainda não passou do total
    const detalhesParcelas = parceladas
      .filter((t) => t.parcela_atual + k <= t.total_parcelas)
      .map((t) => ({ descricao: t.descricao, valor: t.valor, numero: t.parcela_atual + k, total: t.total_parcelas }))

    const parcelas = soma(detalhesParcelas)
    const comprometido = fixas + parcelas

    meses.push({
      indice: k,
      mes: `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`,
      rotulo: data.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
      rotuloCompleto: data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      renda: arredondar(renda),
      fixas: arredondar(fixas),
      parcelas: arredondar(parcelas),
      detalhesParcelas,
      comprometido: arredondar(comprometido),
      saldo: arredondar(renda - comprometido),
      percentual: renda > 0 ? comprometido / renda : 0,
    })
  }
  return meses
}
