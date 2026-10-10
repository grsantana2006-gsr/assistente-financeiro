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

  return {
    mes,
    total_cofre: arredondar(cofre),
    receita_mes: arredondar(calcularReceitaDoMes(transacoes, mes)),
    faturas_abertas: arredondar(
      transacoes.filter((t) => contaNaFatura(t, mes)).reduce((soma, t) => soma + t.valor, 0),
    ),
    cartoes: montarCartoes(bancos, transacoes, mes),
  }
}
