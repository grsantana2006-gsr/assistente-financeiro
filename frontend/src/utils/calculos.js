// Funções de apresentação. Os CÁLCULOS financeiros (fatura, limite, forecast)
// agora vivem no servidor (backend/src/calculos.js).

// Define a "gravidade" da barra conforme o uso (0 a 1):
// até 70% normal, de 70% a 90% atenção, acima disso perigo.
export function nivelDeAlerta(uso) {
  if (uso >= 0.9) return 'danger'
  if (uso >= 0.7) return 'warning'
  return 'ok'
}
