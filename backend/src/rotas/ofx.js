import { Router } from 'express'
import path from 'path'
import fs from 'fs'
import { importarArquivoOfx, importarTodosOfxDaPasta } from '../importador_ofx.js'

const router = Router()
const pastaRaiz = path.resolve(process.cwd(), '..')

// Lista arquivos OFX encontrados na raiz do projeto
router.get('/arquivos', (req, res) => {
  try {
    const arquivos = fs.readdirSync(pastaRaiz)
      .filter(f => f.toLowerCase().endsWith('.ofx'))
      .map(f => {
        const stats = fs.statSync(path.join(pastaRaiz, f))
        return {
          nome: f,
          tamanhoBytes: stats.size,
          modificadoEm: stats.mtime
        }
      })
    res.json({ pasta: pastaRaiz, arquivos })
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

// Importa todos os arquivos OFX da raiz
router.post('/importar-todos', async (req, res) => {
  try {
    const resultados = await importarTodosOfxDaPasta(pastaRaiz)
    res.json({ sucesso: true, resultados })
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

export default router
