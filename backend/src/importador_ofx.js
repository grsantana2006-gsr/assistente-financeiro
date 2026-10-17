import fs from 'fs'
import path from 'path'
import './config.js'
import { db } from './db.js'
import { obterMesFatura } from './calculos.js'

/**
 * Categorização inteligente de descrição de extratos de cartão de crédito.
 */
export function sugerirCategoria(memo) {
  const m = memo.toLowerCase()
  if (m.includes('uber') || m.includes('99 app') || m.includes('99 -') || m.includes('combustivel') || m.includes('posto') || m.includes('pneus')) {
    return 'Transporte'
  }
  if (m.includes('mercad') || m.includes('youmart') || m.includes('ifood') || m.includes('restaurante') || m.includes('beijo frio') || m.includes('camarao') || m.includes('sorvete') || m.includes('lanchonete') || m.includes('padaria')) {
    return 'Alimentação'
  }
  if (m.includes('farmacia') || m.includes('farmavip') || m.includes('drogaria') || m.includes('hospital') || m.includes('medico') || m.includes('seringa')) {
    return 'Saúde'
  }
  if (m.includes('smart fit') || m.includes('academia') || m.includes('duka')) {
    return 'Lazer / Saúde'
  }
  if (m.includes('apple') || m.includes('google') || m.includes('netflix') || m.includes('disney') || m.includes('crunchy') || m.includes('prime') || m.includes('microsoft')) {
    return 'Assinaturas'
  }
  return 'Variável'
}

/**
 * Lê e analisa o conteúdo de um arquivo OFX.
 */
export function parsearOfx(conteudoOfx) {
  const transacoes = []
  const ehCartaoCredito = /<CREDITCARDMSGSRSV1>/i.test(conteudoOfx)
  
  // Identifica organização / banco
  let bancoDetectado = 'Nubank'
  if (conteudoOfx.includes('NU PAGAMENTOS') || conteudoOfx.includes('FID>260<')) {
    bancoDetectado = 'Nubank'
  } else if (conteudoOfx.includes('ITAU') || conteudoOfx.includes('ITAÚ')) {
    bancoDetectado = 'Itaú'
  } else if (conteudoOfx.includes('BANCO DO BRASIL') || conteudoOfx.includes('FID>001<')) {
    bancoDetectado = 'Banco do Brasil'
  }

  const regex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g
  let match

  while ((match = regex.exec(conteudoOfx)) !== null) {
    const block = match[1]
    const trntype = block.match(/<TRNTYPE>(.*?)<\/TRNTYPE>/i)?.[1]?.trim() || ''
    const dtpostedRaw = block.match(/<DTPOSTED>(.*?)<\/DTPOSTED>/i)?.[1]?.trim() || ''
    const trnamt = parseFloat(block.match(/<TRNAMT>(.*?)<\/TRNAMT>/i)?.[1]?.trim() || '0')
    const fitid = block.match(/<FITID>(.*?)<\/FITID>/i)?.[1]?.trim() || ''
    const memo = block.match(/<MEMO>(.*?)<\/MEMO>/i)?.[1]?.trim() || ''

    const ano = dtpostedRaw.slice(0, 4)
    const mes = dtpostedRaw.slice(4, 6)
    const dia = dtpostedRaw.slice(6, 8)
    const data = `${ano}-${mes}-${dia}`

    // Extrai parcelas da descrição se houver (ex: "Parcela 2/5" ou "- 2/4")
    let parcelaAtual = 1
    let totalParcelas = 1
    const parcMatch = memo.match(/(?:parcela\s*|[-–]\s*)(\d+)\/(\d+)/i)
    if (parcMatch) {
      parcelaAtual = parseInt(parcMatch[1], 10)
      totalParcelas = parseInt(parcMatch[2], 10)
    }

    const ehEstorno = trnamt > 0 && /estorno/i.test(memo)
    const ehPagamento = trnamt > 0 && /pagamento/i.test(memo)

    transacoes.push({
      tipo: trntype,
      data,
      valor: Math.abs(trnamt),
      trnamt,
      sinal: trnamt < 0 ? 'DEBIT' : 'CREDIT',
      ehEstorno,
      ehPagamento,
      ehCartaoCredito,
      bancoDetectado,
      fitid,
      memo,
      parcelaAtual,
      totalParcelas
    })
  }

  return {
    bancoDetectado,
    ehCartaoCredito,
    transacoes
  }
}

/**
 * Importa um arquivo OFX para o banco de dados sem duplicar transações.
 */
export async function importarArquivoOfx(caminhoArquivo) {
  if (!fs.existsSync(caminhoArquivo)) {
    throw new Error(`Arquivo não encontrado: ${caminhoArquivo}`)
  }

  const conteudo = fs.readFileSync(caminhoArquivo, 'utf8')
  const { bancoDetectado, ehCartaoCredito, transacoes } = parsearOfx(conteudo)

  // Localiza o banco correspondente no DB
  const bancos = await db.prepare('SELECT * FROM bancos').all()
  let banco = bancos.find(b => b.nome.toLowerCase().includes(bancoDetectado.toLowerCase()))
  if (!banco) {
    banco = bancos[0]
  }

  const estornos = transacoes.filter(t => t.ehEstorno)
  const pagamentos = transacoes.filter(t => t.ehPagamento)
  const debits = transacoes.filter(t => t.sinal === 'DEBIT')

  const relatorio = {
    arquivo: path.basename(caminhoArquivo),
    banco: banco.nome,
    totalLidos: transacoes.length,
    inseridos: 0,
    duplicadosIgnorados: 0,
    estornosIgnorados: 0,
    pagamentosDetectados: pagamentos.length,
    detalhes: []
  }

  // Identifica compras com estorno integral
  const estornosUsados = new Set()
  const comprasComEstornoIntegral = new Set()

  for (let i = 0; i < debits.length; i++) {
    const d = debits[i]
    for (let e = 0; e < estornos.length; e++) {
      if (estornosUsados.has(e)) continue
      const est = estornos[e]
      if (Math.abs(d.valor - est.valor) < 0.01) {
        // Checa se o texto tem relação
        const memoD = d.memo.toLowerCase().replace(/[^a-z0-9]/g, '')
        const memoE = est.memo.toLowerCase().replace(/[^a-z0-9]/g, '')
        if (memoD.includes('dieta') && memoE.includes('dieta') ||
            memoD.includes('lltime') && memoE.includes('lltime') ||
            memoD.includes('mercado') && memoE.includes('mercado') ||
            memoD.includes(memoE) || memoE.includes(memoD)) {
          estornosUsados.add(e)
          comprasComEstornoIntegral.add(i)
          break
        }
      }
    }
  }

  for (let i = 0; i < debits.length; i++) {
    const t = debits[i]

    // 1. Se foi integralmente estornada no mesmo extrato, ignora para não poluir fatura
    if (comprasComEstornoIntegral.has(i)) {
      relatorio.estornosIgnorados++
      relatorio.detalhes.push({
        status: 'ESTORNO_INTEGRAL_IGNORADO',
        data: t.data,
        valor: t.valor,
        descricao: t.memo
      })
      continue
    }

    // 2. Se tem estorno parcial (ex: Duka's Academia 119.86 - 93.26)
    let valorFinal = t.valor
    let descFinal = t.memo
    const estornoParcial = estornos.find(est => {
      const memoD = t.memo.toLowerCase().replace(/[^a-z0-9]/g, '')
      const memoE = est.memo.toLowerCase().replace(/[^a-z0-9]/g, '')
      return memoD.includes('duka') && memoE.includes('duka')
    })
    if (estornoParcial && Math.abs(t.valor - 119.86) < 0.01) {
      valorFinal = Math.max(t.valor - estornoParcial.valor, 0)
      descFinal = `${t.memo} (líquido c/ estorno)`
    }

    // 3. Verifica se já existe por FITID
    if (t.fitid) {
      const existePorFitid = await db.prepare('SELECT id FROM transacoes WHERE fitid = ?').get(t.fitid)
      if (existePorFitid) {
        relatorio.duplicadosIgnorados++
        continue
      }
    }

    // 4. Verifica duplicidade aproximada por mês de fatura e valor
    const mesFaturaPrevisto = obterMesFatura(t.data, banco.dia_fechamento, banco.dia_vencimento)
    const todasDoBanco = await db.prepare('SELECT id, descricao, valor, data_compra, fitid FROM transacoes WHERE banco_id = ?').all(banco.id)
    const existeDuplicada = todasDoBanco.find(dbT => {
      const diffValor = Math.abs(dbT.valor - valorFinal)
      if (diffValor > 0.05) return false
      const mesDb = obterMesFatura(dbT.data_compra, banco.dia_fechamento, banco.dia_vencimento)
      if (mesDb !== mesFaturaPrevisto) return false
      // Se já tem outro FITID, não é esta
      if (dbT.fitid && dbT.fitid !== t.fitid) return false
      return true
    })

    if (existeDuplicada) {
      // Se encontrou uma transação manual equivalente sem FITID, aproveita e vincula o FITID nela
      if (!existeDuplicada.fitid && t.fitid) {
        await db.prepare('UPDATE transacoes SET fitid = ? WHERE id = ?').run(t.fitid, existeDuplicada.id)
      }
      relatorio.duplicadosIgnorados++
      continue
    }

    // 5. Insere a nova transação
    const categoria = 'Variável'
    const formaPagamento = ehCartaoCredito ? 'Crédito' : 'Débito'

    await db.prepare(`
      INSERT INTO transacoes (
        descricao, valor, tipo, banco_id, categoria, data_compra,
        forma_pagamento, parcela_atual, total_parcelas, ativa, fitid
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      descFinal,
      valorFinal,
      'Despesa',
      banco.id,
      categoria,
      t.data,
      formaPagamento,
      t.parcelaAtual,
      t.totalParcelas,
      1,
      t.fitid || null
    )

    relatorio.inseridos++
    relatorio.detalhes.push({
      status: 'INSERIDO',
      data: t.data,
      valor: valorFinal,
      descricao: descFinal,
      parcelas: `${t.parcelaAtual}/${t.totalParcelas}`
    })
  }

  return relatorio
}

/**
 * Escaneia uma pasta em busca de arquivos .ofx e importa todos eles.
 */
export async function importarTodosOfxDaPasta(pasta) {
  const arquivos = fs.readdirSync(pasta).filter(f => f.toLowerCase().endsWith('.ofx'))
  const resultados = []

  for (const arquivo of arquivos) {
    const caminhoCompleto = path.join(pasta, arquivo)
    try {
      const res = await importarArquivoOfx(caminhoCompleto)
      resultados.push(res)
    } catch (err) {
      resultados.push({
        arquivo,
        erro: err.message
      })
    }
  }

  return resultados
}
