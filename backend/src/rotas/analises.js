import { Router } from 'express'
import { db } from '../db.js'
import { validar } from '../validacao.js'
import { erroValidacao } from '../ajudantes.js'
import { gerarForecast } from '../calculos.js'
import { calcularDashboard, carregarTransacoes } from '../servicos.js'
import { obterMesReferencia } from '../config.js'

const router = Router()

const regrasConsulta = {
  mes: { tipo: 'texto', regex: /^\d{4}-(0[1-9]|1[0-2])$/, padrao: obterMesReferencia },
  meses: { tipo: 'inteiro', min: 1, max: 24, padrao: 6 },
}

router.get('/dashboard', async (req, res) => {
  const { dados, erros } = validar(req.query, regrasConsulta, { coagir: true })
  if (erros.length) return erroValidacao(res, erros)

  res.json(await calcularDashboard(dados.mes))
})

router.get('/forecast', async (req, res) => {
  const { dados, erros } = validar(req.query, regrasConsulta, { coagir: true })
  if (erros.length) return erroValidacao(res, erros)

  const transacoes = await carregarTransacoes()
  const bancos = await db.prepare('SELECT * FROM bancos ORDER BY id').all()
  res.json({
    mes_base: dados.mes,
    projecao: gerarForecast(transacoes, dados.mes, dados.meses, bancos),
  })
})

export default router
