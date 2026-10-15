// =====================================================
// VALIDAÇÃO
// Nunca confie nos dados que chegam de fora (front, Telegram, curl...).
// Esta função confere cada campo de acordo com "regras" declarativas
// e devolve os dados já limpos + a lista de erros (se houver).
//
// Exemplo de regra:
//   valor: { tipo: 'numero', obrigatorio: true, min: 0.01 }
//
// Opções:
//   parcial -> usada no PATCH: campos ausentes são ignorados (e sem "padrao")
//   coagir  -> usada em query string, onde tudo chega como texto ("12" -> 12)
// =====================================================

const REGEX_DATA = /^\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/

function dataValida(texto) {
  if (typeof texto !== 'string' || !REGEX_DATA.test(texto)) return false
  const d = new Date(texto.includes('T') || texto.includes(' ') ? texto : `${texto}T12:00:00Z`)
  return !Number.isNaN(d.getTime())
}

export function validar(corpo, regras, { parcial = false, coagir = false } = {}) {
  const dados = {}
  const erros = []

  if (typeof corpo !== 'object' || corpo === null || Array.isArray(corpo)) {
    return { dados, erros: ['O corpo da requisição deve ser um objeto JSON'] }
  }

  for (const [campo, regra] of Object.entries(regras)) {
    let valor = corpo[campo]

    // ---------- Campo ausente ----------
    if (valor === undefined || valor === null || valor === '') {
      if (parcial) continue
      if (regra.padrao !== undefined) {
        const padrao = typeof regra.padrao === 'function' ? regra.padrao() : regra.padrao
        dados[campo] = regra.tipo === 'bool' ? Number(padrao) : padrao
      } else if (regra.obrigatorio) {
        erros.push(`"${campo}" é obrigatório`)
      }
      continue
    }

    // ---------- Conversão (só para query string) ----------
    if (coagir && typeof valor === 'string') {
      if (regra.tipo === 'numero' || regra.tipo === 'inteiro') valor = Number(valor)
      if (regra.tipo === 'bool') valor = valor === 'true' ? true : valor === 'false' ? false : valor
    }

    // ---------- Checagem por tipo ----------
    switch (regra.tipo) {
      case 'texto': {
        if (typeof valor !== 'string') {
          erros.push(`"${campo}" deve ser um texto`)
          break
        }
        const limpo = valor.trim()
        if (limpo.length === 0) erros.push(`"${campo}" não pode ficar vazio`)
        else if (regra.max && limpo.length > regra.max) erros.push(`"${campo}" aceita no máximo ${regra.max} caracteres`)
        else if (regra.regex && !regra.regex.test(limpo)) erros.push(`"${campo}" está em formato inválido`)
        else dados[campo] = limpo
        break
      }
      case 'numero':
      case 'inteiro': {
        const ehNumero = typeof valor === 'number' && Number.isFinite(valor)
        if (!ehNumero || (regra.tipo === 'inteiro' && !Number.isInteger(valor))) {
          erros.push(`"${campo}" deve ser um número${regra.tipo === 'inteiro' ? ' inteiro' : ''}`)
        } else if (regra.min !== undefined && valor < regra.min) {
          erros.push(`"${campo}" deve ser maior ou igual a ${regra.min}`)
        } else if (regra.max !== undefined && valor > regra.max) {
          erros.push(`"${campo}" deve ser menor ou igual a ${regra.max}`)
        } else {
          dados[campo] = valor
        }
        break
      }
      case 'enum': {
        if (regra.valores.includes(valor)) dados[campo] = valor
        else erros.push(`"${campo}" deve ser um destes: ${regra.valores.join(', ')}`)
        break
      }
      case 'data': {
        if (typeof valor === 'string' && dataValida(valor)) dados[campo] = valor
        else erros.push(`"${campo}" deve ser uma data válida no formato AAAA-MM-DD`)
        break
      }
      case 'bool': {
        // No SQLite, verdadeiro/falso é guardado como 1/0
        if (typeof valor === 'boolean') dados[campo] = Number(valor)
        else erros.push(`"${campo}" deve ser true ou false`)
        break
      }
      default:
        throw new Error(`Tipo de regra desconhecido: ${regra.tipo}`)
    }
  }

  return { dados, erros }
}
