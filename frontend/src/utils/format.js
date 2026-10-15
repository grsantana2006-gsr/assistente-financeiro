// Funções auxiliares de formatação, usadas em vários componentes.

// Transforma 1234.5 em "R$ 1.234,50"
export function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor)
}

// Transforma 0.756 em "76%"
export function formatarPercentual(fracao) {
  return `${Math.round(fracao * 100)}%`
}

// Formata data e hora evitando recuo de fuso horário UTC no Brasil
export function formatarDataHora(dataStr) {
  if (!dataStr) return '—'
  // Se for apenas data no formato YYYY-MM-DD (sem horário)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
    const [ano, mes, dia] = dataStr.split('-')
    return `${dia}/${mes}/${ano}`
  }

  const d = new Date(dataStr)
  if (Number.isNaN(d.getTime())) return dataStr

  const dia = String(d.getDate()).padStart(2, '0')
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const ano = d.getFullYear()
  const hora = String(d.getHours()).padStart(2, '0')
  const minuto = String(d.getMinutes()).padStart(2, '0')

  return `${dia}/${mes}/${ano} às ${hora}:${minuto}`
}
