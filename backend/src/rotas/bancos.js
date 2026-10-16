import { Router } from 'express'
import { db } from '../db.js'
import { validar } from '../validacao.js'
import { lerId, idInvalido, naoEncontrado, erroValidacao, inserir, atualizar } from '../ajudantes.js'

const router = Router()

const regras = {
  nome: { tipo: 'texto', obrigatorio: true, max: 60 },
  tipo: { tipo: 'enum', obrigatorio: true, valores: ['Débito', 'Crédito', 'Múltiplo', 'Benefício'] },
  limite_total: { tipo: 'numero', min: 0, padrao: 0 },
  dia_fechamento: { tipo: 'inteiro', obrigatorio: true, min: 1, max: 31 },
  dia_vencimento: { tipo: 'inteiro', obrigatorio: true, min: 1, max: 31 },
  cor: { tipo: 'texto', regex: /^#[0-9a-fA-F]{6}$/, padrao: '#8b5cf6' },
}

const buscarPorId = async (id) => await db.prepare('SELECT * FROM bancos WHERE id = ?').get(id)

router.get('/', async (_req, res) => {
  res.json(await db.prepare('SELECT * FROM bancos ORDER BY id').all())
})

router.get('/:id', async (req, res) => {
  const id = lerId(req)
  if (!id) return idInvalido(res)
  const banco = await buscarPorId(id)
  if (!banco) return naoEncontrado(res, 'Banco')
  res.json(banco)
})

router.post('/', async (req, res) => {
  const { dados, erros } = validar(req.body, regras)
  if (erros.length) return erroValidacao(res, erros)

  const id = await inserir('bancos', dados)
  res.status(201).json(await buscarPorId(id))
})

router.patch('/:id', async (req, res) => {
  const id = lerId(req)
  if (!id) return idInvalido(res)
  if (!(await buscarPorId(id))) return naoEncontrado(res, 'Banco')

  const { dados, erros } = validar(req.body, regras, { parcial: true })
  if (erros.length) return erroValidacao(res, erros)
  if (Object.keys(dados).length === 0) return erroValidacao(res, ['Envie ao menos um campo para atualizar'])

  await atualizar('bancos', id, dados)
  res.json(await buscarPorId(id))
})

router.delete('/:id', async (req, res) => {
  const id = lerId(req)
  if (!id) return idInvalido(res)
  if (!(await buscarPorId(id))) return naoEncontrado(res, 'Banco')

  const { total } = await db.prepare('SELECT COUNT(*) AS total FROM transacoes WHERE banco_id = ?').get(id)
  if (total > 0) {
    return res.status(409).json({ erro: `Não é possível excluir: o banco possui ${total} transação(ões)` })
  }

  await db.prepare('DELETE FROM bancos WHERE id = ?').run(id)
  res.status(204).end()
})

router.post('/:id/alternar-fatura', async (req, res) => {
  const id = lerId(req)
  if (!id) return idInvalido(res)
  const banco = await buscarPorId(id)
  if (!banco) return naoEncontrado(res, 'Banco')

  const mes = req.body?.mes || new Date().toISOString().slice(0, 7)
  const existente = await db.prepare('SELECT id FROM pagamentos_faturas WHERE banco_id = ? AND mes = ?').get(id, mes)

  let marcarComoPago = false
  if (typeof req.body?.pago === 'boolean') {
    marcarComoPago = req.body.pago
  } else {
    marcarComoPago = !existente
  }

  if (marcarComoPago) {
    await db.prepare('INSERT INTO pagamentos_faturas (banco_id, mes) VALUES (?, ?) ON CONFLICT (banco_id, mes) DO NOTHING').run(id, mes)
  } else {
    await db.prepare('DELETE FROM pagamentos_faturas WHERE banco_id = ? AND mes = ?').run(id, mes)
  }

  res.json({ banco_id: id, mes, pago: marcarComoPago })
})

export default router
