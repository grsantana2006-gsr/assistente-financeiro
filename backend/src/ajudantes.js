// =====================================================
// AJUDANTES REUTILIZADOS PELAS ROTAS
// =====================================================
import { db } from './db.js'

export function lerId(req) {
  const id = Number(req.params.id)
  return Number.isInteger(id) && id > 0 ? id : null
}

export function erroValidacao(res, detalhes) {
  return res.status(400).json({ erro: 'Dados inválidos', detalhes })
}
export function idInvalido(res) {
  return res.status(400).json({ erro: 'O id informado na URL é inválido' })
}
export function naoEncontrado(res, entidade) {
  return res.status(404).json({ erro: `${entidade} não encontrado(a)` })
}

export function transacaoParaApi(linha) {
  return { ...linha, ativa: linha.ativa === 1 }
}

export async function inserir(tabela, dados) {
  const colunas = Object.keys(dados)
  const sql = `INSERT INTO ${tabela} (${colunas.join(', ')}) VALUES (${colunas.map(() => '?').join(', ')})`
  const resultado = await db.prepare(sql).run(...Object.values(dados))
  return Number(resultado.lastInsertRowid)
}

export async function atualizar(tabela, id, dados) {
  const colunas = Object.keys(dados)
  const sql = `UPDATE ${tabela} SET ${colunas.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`
  await db.prepare(sql).run(...Object.values(dados), id)
}

export function arredondar(valor) {
  return Math.round(valor * 100) / 100
}
