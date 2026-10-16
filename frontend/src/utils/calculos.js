// Funções de apresentação. Os CÁLCULOS financeiros (fatura, limite, forecast)
// agora vivem no servidor (backend/src/calculos.js).

// Define a "gravidade" da barra conforme o uso (0 a 1):
// até 70% normal, de 70% a 90% atenção, acima disso perigo.
export function nivelDeAlerta(uso) {
  if (uso >= 0.9) return 'danger'
  if (uso >= 0.7) return 'warning'
  return 'ok'
}

/**
 * Calcula em qual mês de fatura (mês de vencimento) uma transação cai,
 * respeitando as datas de fechamento e vencimento de cada banco.
 */
export function obterMesFatura(dataStr, diaFechamento, diaVencimento) {
  if (!dataStr) return null
  const partes = dataStr.slice(0, 10).split('-')
  let ano = Number(partes[0])
  let mes = Number(partes[1])
  const dia = Number(partes[2])

  if (!diaFechamento || !diaVencimento) {
    return `${ano}-${String(mes).padStart(2, '0')}`
  }

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
