// =====================================================
// DATAS NO FUSO LOCAL
// Atenção: new Date().toISOString() devolve a data em UTC. No Brasil (UTC-3/-4),
// depois das 20h/21h o UTC já está no dia seguinte, então uma despesa registrada
// à noite cairia na data errada (e, no fim do mês, no mês errado!).
// Estas funções usam o relógio local da máquina.
// =====================================================

const doisDigitos = (n) => String(n).padStart(2, '0')

// "AAAA-MM-DD" do dia local
export function dataLocalISO(data = new Date()) {
  return `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}`
}

// "AAAA-MM-DDTHH:mm:ss" do dia e hora local
export function dataHoraLocalISO(data = new Date()) {
  return `${dataLocalISO(data)}T${doisDigitos(data.getHours())}:${doisDigitos(data.getMinutes())}:${doisDigitos(data.getSeconds())}`
}

// "AAAA-MM" do mês local
export function mesLocalAtual(data = new Date()) {
  return dataLocalISO(data).slice(0, 7)
}
