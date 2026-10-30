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

/**
 * Classifica uma despesa fixa para um determinado mês de referência.
 * Retorna se ela é:
 * - 'ativa': está em vigor no mês de referência (calcula também a parcela específica do mês)
 * - 'futura': agendada para começar após o mês de referência
 * - 'encerrada': despesa com prazo que já foi concluída antes do mês de referência
 */
export function classificarDespesaFixa(t, mesReferencia, bancos = []) {
  const banco = bancos.find((b) => b.id === t.banco_id)
  const ehCredito = t.forma_pagamento === 'Crédito' && banco && banco.tipo !== 'Benefício'
  const mesInicio = ehCredito
    ? obterMesFatura(t.data_compra, banco.dia_fechamento, banco.dia_vencimento)
    : (t.data_compra ? t.data_compra.slice(0, 7) : null)

  const mesRef = mesReferencia || new Date().toISOString().slice(0, 7)

  if (!mesInicio) {
    return {
      status: 'ativa',
      parcelaNoMes: t.parcela_atual || 1,
      totalParcelas: t.total_parcelas || 1,
      mesInicio: mesRef,
    }
  }

  const [anoRef, mRef] = mesRef.split('-').map(Number)
  const [anoIni, mIni] = mesInicio.split('-').map(Number)
  const diffMeses = (anoRef - anoIni) * 12 + (mRef - mIni)

  if (t.total_parcelas > 1) {
    const parcelaNoMes = (t.parcela_atual || 1) + diffMeses
    if (parcelaNoMes < 1) {
      return {
        status: 'futura',
        parcelaNoMes,
        totalParcelas: t.total_parcelas,
        mesInicio,
      }
    }
    if (parcelaNoMes > t.total_parcelas) {
      return {
        status: 'encerrada',
        parcelaNoMes,
        totalParcelas: t.total_parcelas,
        mesInicio,
      }
    }
    return {
      status: 'ativa',
      parcelaNoMes,
      totalParcelas: t.total_parcelas,
      mesInicio,
    }
  }

  // Despesa fixa contínua (ex: assinaturas mensais)
  if (mesRef < mesInicio) {
    return {
      status: 'futura',
      parcelaNoMes: 1,
      totalParcelas: 1,
      mesInicio,
    }
  }

  return {
    status: 'ativa',
    parcelaNoMes: 1,
    totalParcelas: 1,
    mesInicio,
  }
}
