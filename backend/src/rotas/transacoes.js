import { Router } from 'express'
import { db } from '../db.js'
import { validar } from '../validacao.js'
import { lerId, idInvalido, naoEncontrado, erroValidacao, inserir, atualizar, transacaoParaApi } from '../ajudantes.js'
import { dataHoraLocalISO } from '../datas.js'
import { obterMesReferencia } from '../config.js'

const router = Router()

const agora = () => dataHoraLocalISO()

const regras = {
  descricao: { tipo: 'texto', obrigatorio: true, max: 120 },
  valor: { tipo: 'numero', obrigatorio: true, min: 0.01 },
  tipo: { tipo: 'enum', obrigatorio: true, valores: ['Receita', 'Despesa'] },
  banco_id: { tipo: 'inteiro', obrigatorio: true, min: 1 },
  categoria: { tipo: 'enum', obrigatorio: true, valores: ['Fixo', 'Variável'] },
  forma_pagamento: { tipo: 'enum', padrao: 'Crédito', valores: ['Crédito', 'Débito', 'PIX', 'Dinheiro', 'Voucher'] },
  data_compra: { tipo: 'data', padrao: agora },
  parcela_atual: { tipo: 'inteiro', min: 1, padrao: 1 },
  total_parcelas: { tipo: 'inteiro', min: 1, padrao: 1 },
  ativa: { tipo: 'bool', padrao: true },
}

const regrasFiltro = {
  tipo: regras.tipo,
  categoria: regras.categoria,
  banco_id: regras.banco_id,
  ativa: regras.ativa,
  mes: { tipo: 'texto', regex: /^\d{4}-(0[1-9]|1[0-2])$/ },
  mes_referencia: { tipo: 'texto', regex: /^\d{4}-(0[1-9]|1[0-2])$/ },
}

const buscarPorId = async (id, mesRef = obterMesReferencia()) =>
  await db.prepare(`
    SELECT t.*, (CASE WHEN pf.id IS NOT NULL THEN 1 ELSE 0 END) AS pago
    FROM transacoes t
    LEFT JOIN pagamentos_fixas pf ON pf.transacao_id = t.id AND (pf.mes = ? OR (SUBSTR(t.data_compra, 1, 7) > ? AND pf.mes = SUBSTR(t.data_compra, 1, 7)))
    WHERE t.id = ?
  `).get(mesRef, mesRef, id)

async function verificarConsistencia(t) {
  const erros = []
  if (t.parcela_atual > t.total_parcelas) {
    erros.push('"parcela_atual" não pode ser maior que "total_parcelas"')
  }
  const banco = await db.prepare('SELECT 1 FROM bancos WHERE id = ?').get(t.banco_id)
  if (!banco) {
    erros.push(`O banco_id ${t.banco_id} não existe`)
  }
  return erros
}

router.get('/', async (req, res) => {
  const { dados: filtros, erros } = validar(req.query, regrasFiltro, { parcial: true, coagir: true })
  if (erros.length) return erroValidacao(res, erros)

  const mesRef = filtros.mes_referencia || obterMesReferencia()

  const condicoes = []
  const valores = [mesRef, mesRef]
  for (const campo of ['tipo', 'categoria', 'banco_id', 'ativa']) {
    if (filtros[campo] !== undefined) {
      condicoes.push(`t.${campo} = ?`)
      valores.push(filtros[campo])
    }
  }
  if (filtros.mes) {
    condicoes.push('t.data_compra LIKE ?')
    valores.push(`${filtros.mes}%`)
  }

  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : ''
  const sql = `
    SELECT t.*, (CASE WHEN pf.id IS NOT NULL THEN 1 ELSE 0 END) AS pago
    FROM transacoes t
    LEFT JOIN pagamentos_fixas pf ON pf.transacao_id = t.id AND (pf.mes = ? OR (SUBSTR(t.data_compra, 1, 7) > ? AND pf.mes = SUBSTR(t.data_compra, 1, 7)))
    ${where}
    ORDER BY t.data_compra DESC, t.id DESC
  `
  const linhas = await db.prepare(sql).all(...valores)
  res.json(linhas.map(transacaoParaApi))
})

router.get('/:id', async (req, res) => {
  const id = lerId(req)
  if (!id) return idInvalido(res)
  const t = await buscarPorId(id)
  if (!t) return naoEncontrado(res, 'Transação')
  res.json(transacaoParaApi(t))
})

router.post('/', async (req, res) => {
  const { dados, erros } = validar(req.body, regras)
  if (erros.length) return erroValidacao(res, erros)

  const inconsistencias = await verificarConsistencia(dados)
  if (inconsistencias.length) return erroValidacao(res, inconsistencias)

  const id = await inserir('transacoes', dados)
  res.status(201).json(transacaoParaApi(await buscarPorId(id)))
})

router.patch('/:id', async (req, res) => {
  const id = lerId(req)
  if (!id) return idInvalido(res)
  const atual = await buscarPorId(id)
  if (!atual) return naoEncontrado(res, 'Transação')

  const { dados, erros } = validar(req.body, regras, { parcial: true })
  if (erros.length) return erroValidacao(res, erros)
  if (Object.keys(dados).length === 0) return erroValidacao(res, ['Envie ao menos um campo para atualizar'])

  const inconsistencias = await verificarConsistencia({ ...atual, ...dados })
  if (inconsistencias.length) return erroValidacao(res, inconsistencias)

  await atualizar('transacoes', id, dados)
  res.json(transacaoParaApi(await buscarPorId(id)))
})

router.post('/:id/alternar-pagamento', async (req, res) => {
  const id = lerId(req)
  if (!id) return idInvalido(res)
  const mes = req.body?.mes || obterMesReferencia()
  const t = await buscarPorId(id, mes)
  if (!t) return naoEncontrado(res, 'Transação')

  const existente = await db.prepare('SELECT id FROM pagamentos_fixas WHERE transacao_id = ? AND mes = ?').get(id, mes)

  let marcarComoPago = false
  if (typeof req.body?.pago === 'boolean') {
    marcarComoPago = req.body.pago
  } else {
    marcarComoPago = !existente
  }

  if (marcarComoPago) {
    await db.prepare('INSERT INTO pagamentos_fixas (transacao_id, mes) VALUES (?, ?) ON CONFLICT (transacao_id, mes) DO NOTHING').run(id, mes)
  } else {
    await db.prepare('DELETE FROM pagamentos_fixas WHERE transacao_id = ? AND mes = ?').run(id, mes)
  }

  const atualizado = await buscarPorId(id, mes)
  res.json(transacaoParaApi(atualizado))
})

router.delete('/:id', async (req, res) => {
  const id = lerId(req)
  if (!id) return idInvalido(res)
  if (!(await buscarPorId(id))) return naoEncontrado(res, 'Transação')

  await db.prepare('DELETE FROM transacoes WHERE id = ?').run(id)
  res.status(204).end()
})

export default router
