// =====================================================
// SERVIDOR (Express)
// É o programa que fica "escutando" numa porta e responde
// às requisições HTTP do front-end (e, depois, do Telegram).
// =====================================================
import { config } from './config.js' // PRIMEIRO: carrega o .env antes de todo o resto
import express from 'express'
import cors from 'cors'
import { db, criarTabelas } from './db.js'
import { semearSeVazio } from './seed.js'
import bancosRouter from './rotas/bancos.js'
import transacoesRouter from './rotas/transacoes.js'
import cofreRouter from './rotas/cofre.js'
import analisesRouter from './rotas/analises.js'
import ofxRouter from './rotas/ofx.js'

// 1) Prepara o banco antes de aceitar qualquer requisição
await criarTabelas()
if (await semearSeVazio()) console.log('🌱 Banco vazio: dados iniciais inseridos.')

const app = express()
const PORTA = config.porta

// 2) Middlewares: funções que rodam ANTES das rotas, em ordem.
app.use(cors()) // libera o front para chamar a API de qualquer IP na rede local
app.use(express.json()) // permite ler o corpo (body) das requisições em formato JSON
app.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  next()
})

// 3) Rotas
app.get('/api/saude', async (_req, res) => {
  const contar = async (tabela) => (await db.prepare(`SELECT COUNT(*) AS total FROM ${tabela}`).get()).total
  res.json({
    status: 'ok',
    banco: {
      bancos: await contar('bancos'),
      transacoes: await contar('transacoes'),
      cofre: await contar('cofre'),
    },
  })
})

app.use('/api/bancos', bancosRouter)
app.use('/api/transacoes', transacoesRouter)
app.use('/api/cofre', cofreRouter)
app.use('/api/ofx', ofxRouter)
app.use('/api', analisesRouter) // /api/dashboard e /api/forecast

// 4) Rota inexistente -> 404 em JSON (em vez do HTML padrão do Express)
app.use((_req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada' })
})

// 5) Tratador de erros central (precisa ter 4 parâmetros para o Express reconhecê-lo).
//    Qualquer erro não tratado nas rotas cai aqui, e o servidor NÃO derruba.
app.use((erro, _req, res, _next) => {
  // JSON malformado no corpo da requisição
  if (erro.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON inválido no corpo da requisição' })
  }
  // Última linha de defesa: regras do próprio banco de dados
  if (String(erro.message).includes('UNIQUE constraint failed')) {
    return res.status(409).json({ erro: 'Já existe um registro com esse valor único (ex.: nome repetido)' })
  }
  if (String(erro.message).includes('constraint failed')) {
    return res.status(409).json({ erro: 'Operação viola uma regra de integridade dos dados' })
  }
  console.error('❌ Erro inesperado:', erro)
  res.status(500).json({ erro: 'Erro interno do servidor' })
})

app.listen(PORTA, () => {
  console.log(`🚀 API rodando em http://localhost:${PORTA}`)
})
