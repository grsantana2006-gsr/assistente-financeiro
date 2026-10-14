import { db } from './db.js'
import { transacaoParaApi, arredondar } from './ajudantes.js'
import { calcularReceitaDoMes, contaNaFatura, montarCartoes } from './calculos.js'

export async function carregarTransacoes() {
  const transacoes = await db.prepare('SELECT * FROM transacoes').all()
  return transacoes.map(transacaoParaApi)
}

export async function calcularDashboard(mes) {
  const transacoes = await carregarTransacoes()
  const bancos = await db.prepare('SELECT * FROM bancos ORDER BY id').all()
  const result = await db.prepare('SELECT COALESCE(SUM(saldo_atual), 0) AS total FROM cofre').get()
  const cofre = Number(result?.total || 0)

  const receitaMes = calcularReceitaDoMes(transacoes, mes)
  const despesasMes = transacoes.filter((t) => t.tipo === 'Despesa' && contaNaFatura(t, mes))

  // Faturas de Cartão de Crédito (apenas forma Crédito)
  const faturasCartao = despesasMes
    .filter((t) => t.forma_pagamento === 'Crédito')
    .reduce((soma, t) => soma + t.valor, 0)

  // Saídas da Conta Corrente (PIX, Débito em Conta, Limite Especial, Dinheiro - excluindo Voucher)
  const despesasContaPix = despesasMes
    .filter((t) => t.forma_pagamento !== 'Crédito' && t.forma_pagamento !== 'Voucher')
    .reduce((soma, t) => soma + t.valor, 0)

  // Gastos com Benefício (Voucher / Vale Refeição - não saem da conta bancária)
  const despesasVoucher = despesasMes
    .filter((t) => t.forma_pagamento === 'Voucher')
    .reduce((soma, t) => soma + t.valor, 0)

  const totalDespesas = faturasCartao + despesasContaPix
  const saldoMes = receitaMes - totalDespesas

  return {
    mes,
    total_cofre: arredondar(cofre),
    receita_mes: arredondar(receitaMes),
    faturas_cartao: arredondar(faturasCartao),
    faturas_abertas: arredondar(faturasCartao), // mantido para compatibilidade
    despesas_conta_pix: arredondar(despesasContaPix),
    despesas_voucher: arredondar(despesasVoucher),
    total_despesas: arredondar(totalDespesas),
    saldo_mes: arredondar(saldoMes),
    status_mes: saldoMes >= 0 ? 'positivo' : 'negativo',
    cartoes: montarCartoes(bancos, transacoes, mes),
  }
}
