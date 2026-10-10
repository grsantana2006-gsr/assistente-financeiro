import { Router } from 'express'
import { db } from '../db.js'
import { validar } from '../validacao.js'
import { lerId, idInvalido, naoEncontrado, erroValidacao, inserir, atualizar } from '../ajudantes.js'

const router = Router()

const regras = {
  objetivo: { tipo: 'texto', obrigatorio: true, max: 80 },
  saldo_atual: { tipo: 'numero', min: 0, padrao: 0 },
}

const buscarPorId = async (id) => await db.prepare('SELECT * FROM cofre WHERE id = ?').get(id)

router.get('/', async (_req, res) => {
  const itens = await db.prepare('SELECT * FROM cofre ORDER BY id').all()
  const total = itens.reduce((soma, i) => soma + i.saldo_atual, 0)
  res.json({ total: Math.round(total * 100) / 100, itens })
})

router.post('/', async (req, res) => {
  const { dados, erros } = validar(req.body, regras)
  if (erros.length) return erroValidacao(res, erros)

  const id = await inserir('cofre', dados)
  res.status(201).json(await buscarPorId(id))
})

router.patch('/:id', async (req, res) => {
  const id = lerId(req)
  if (!id) return idInvalido(res)
  if (!(await buscarPorId(id))) return naoEncontrado(res, 'Objetivo do cofre')

  const { dados, erros } = validar(req.body, regras, { parcial: true })
  if (erros.length) return erroValidacao(res, erros)
  if (Object.keys(dados).length === 0) return erroValidacao(res, ['Envie ao menos um campo para atualizar'])

  await atualizar('cofre', id, dados)
  res.json(await buscarPorId(id))
})

router.delete('/:id', async (req, res) => {
  const id = lerId(req)
  if (!id) return idInvalido(res)
  if (!(await buscarPorId(id))) return naoEncontrado(res, 'Objetivo do cofre')

  await db.prepare('DELETE FROM cofre WHERE id = ?').run(id)
  res.status(204).end()
})

export default router
