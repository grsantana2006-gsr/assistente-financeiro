export function obterMesFatura(dataStr, diaFechamento, diaVencimento) {
  if (!dataStr) return null
  const partes = dataStr.slice(0, 10).split('-')
  let ano = Number(partes[0])
  let mes = Number(partes[1])
  const dia = Number(partes[2])

  if (!diaFechamento || !diaVencimento) return `${ano}-${String(mes).padStart(2, '0')}`

  if (diaFechamento < diaVencimento) {
    if (dia > diaFechamento) {
      mes += 1
      if (mes > 12) {
        mes = 1
        ano += 1
      }
    }
  } else {
    if (dia <= diaFechamento) {
      mes += 1
      if (mes > 12) {
        mes = 1
        ano += 1
      }
    } else {
      mes += 2
      if (mes > 12) {
        mes -= 12
        ano += 1
      }
    }
  }
  return `${ano}-${String(mes).padStart(2, '0')}`
}

export function rotuloMesFatura(mesStr) {
  if (!mesStr) return ''
  const [ano, m] = mesStr.split('-')
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${meses[Number(m) - 1]}/${ano.slice(2)}`
}
