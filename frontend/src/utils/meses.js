// =====================================================
// UTILITÁRIOS DE NAVEGAÇÃO DE MESES
// Funções para avançar, retroceder e formatar meses em português
// =====================================================

const NOMES_MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

/**
 * Converte "AAAA-MM" para formato por extenso: "Outubro de 2026"
 */
export function formatarMesExtenso(mesStr) {
  if (!mesStr || !/^\d{4}-\d{2}$/.test(mesStr)) return mesStr || ''
  const [ano, mes] = mesStr.split('-').map(Number)
  const nome = NOMES_MESES[mes - 1] || mesStr
  return `${nome} de ${ano}`
}

/**
 * Retorna o mês anterior no formato "AAAA-MM"
 */
export function mesAnterior(mesStr) {
  if (!mesStr) return obterMesAtual()
  const [ano, mes] = mesStr.split('-').map(Number)
  const d = new Date(ano, mes - 2, 1)
  const anoResult = d.getFullYear()
  const mesResult = String(d.getMonth() + 1).padStart(2, '0')
  return `${anoResult}-${mesResult}`
}

/**
 * Retorna o próximo mês no formato "AAAA-MM"
 */
export function proximoMes(mesStr) {
  if (!mesStr) return obterMesAtual()
  const [ano, mes] = mesStr.split('-').map(Number)
  const d = new Date(ano, mes, 1)
  const anoResult = d.getFullYear()
  const mesResult = String(d.getMonth() + 1).padStart(2, '0')
  return `${anoResult}-${mesResult}`
}

/**
 * Retorna o mês corrente da máquina local no formato "AAAA-MM"
 */
export function obterMesAtual() {
  const d = new Date()
  const ano = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  return `${ano}-${mes}`
}

/**
 * Gera lista de opções de meses abrangendo anos anteriores e posteriores
 */
export function gerarOpcoesMeses(mesReferencia) {
  const baseStr = mesReferencia || obterMesAtual()
  const anoBase = Number(baseStr.slice(0, 4)) || new Date().getFullYear()

  const opcoes = []
  for (let ano = anoBase - 2; ano <= anoBase + 2; ano++) {
    for (let mes = 1; mes <= 12; mes++) {
      const valor = `${ano}-${String(mes).padStart(2, '0')}`
      opcoes.push({
        valor,
        rotulo: formatarMesExtenso(valor),
      })
    }
  }

  if (mesReferencia && !opcoes.some((op) => op.valor === mesReferencia)) {
    opcoes.push({
      valor: mesReferencia,
      rotulo: formatarMesExtenso(mesReferencia),
    })
    opcoes.sort((a, b) => a.valor.localeCompare(b.valor))
  }

  return opcoes
}
