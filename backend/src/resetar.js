import { db, criarTabelas } from './db.js'
import { semearSeVazio } from './seed.js'

async function resetar() {
  await db.exec('DROP TABLE IF EXISTS transacoes CASCADE; DROP TABLE IF EXISTS cofre CASCADE; DROP TABLE IF EXISTS bancos CASCADE; DROP TABLE IF EXISTS configuracoes CASCADE;')
  await criarTabelas()
  await semearSeVazio()
  console.log('✅ Banco recriado com os dados iniciais.')
  process.exit(0)
}

resetar()
