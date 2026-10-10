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
