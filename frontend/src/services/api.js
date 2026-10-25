// =====================================================
// CAMADA DE API
// Único lugar do front que conhece a URL do servidor e usa fetch().
// Os componentes só chamam funções como api.obterDashboard().
// Se a API mudar, você ajusta aqui e o resto do app continua igual.
// =====================================================

// Pode ser trocada criando um arquivo frontend/.env com VITE_API_URL=...
const BASE = import.meta.env.VITE_API_URL ?? `http://${window.location.hostname}:3000/api`

// Erro com informações úteis: o status HTTP e a lista de detalhes da validação
export class ErroApi extends Error {
  constructor(mensagem, status, detalhes = []) {
    super(mensagem)
    this.name = 'ErroApi'
    this.status = status // 0 = nem chegou ao servidor
    this.detalhes = detalhes
  }
}

// Transforma { erro: "Dados inválidos", detalhes: ["...", "..."] } numa frase só
function montarMensagem(json, status) {
  if (!json?.erro) return `Erro inesperado (código ${status})`
  return json.detalhes?.length ? `${json.erro}: ${json.detalhes.join('; ')}` : json.erro
}

async function requisitar(metodo, caminho, corpo) {
  let resposta
  try {
    resposta = await fetch(BASE + caminho, {
      method: metodo,
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    })
  } catch {
    // fetch só "lança" erro quando não consegue falar com o servidor (desligado, sem rede...)
    throw new ErroApi('Não foi possível conectar ao servidor. Ele está ligado?', 0)
  }

  if (resposta.status === 204) return null // sucesso sem conteúdo (DELETE)

  const json = await resposta.json().catch(() => null)
  if (!resposta.ok) throw new ErroApi(montarMensagem(json, resposta.status), resposta.status, json?.detalhes)
  return json
}

export const api = {
  // Leitura
  obterDashboard: (mes) => requisitar('GET', `/dashboard?mes=${mes}`),
  obterForecast: (mes, meses) => requisitar('GET', `/forecast?mes=${mes}&meses=${meses}`),
  obterCofre: () => requisitar('GET', '/cofre'),
  listarDespesasFixas: (mes) =>
    requisitar('GET', `/transacoes?tipo=Despesa&categoria=Fixo${mes ? `&mes_referencia=${mes}` : ''}`),
  listarDespesasVariaveis: () => requisitar('GET', '/transacoes?tipo=Despesa&categoria=Variável'),
  listarReceitas: () => requisitar('GET', '/transacoes?tipo=Receita'),

  // Escrita
  atualizarBanco: (id, dados) => requisitar('PATCH', `/bancos/${id}`, dados),
  criarTransacao: (dados) => requisitar('POST', '/transacoes', dados),
  atualizarTransacao: (id, dados) => requisitar('PATCH', `/transacoes/${id}`, dados),
  alternarPagamentoFixa: (id, payload) => {
    const corpo = typeof payload === 'object' && payload !== null ? payload : { mes: payload }
    return requisitar('POST', `/transacoes/${id}/alternar-pagamento`, corpo)
  },
  alternarPagamentoFatura: (bancoId, payload) => {
    const corpo = typeof payload === 'object' && payload !== null ? payload : { mes: payload }
    return requisitar('POST', `/bancos/${bancoId}/alternar-fatura`, corpo)
  },
  adicionarAdiantamentoFatura: (bancoId, dados) =>
    requisitar('POST', `/bancos/${bancoId}/adiantamentos`, dados),
  removerAdiantamentoFatura: (bancoId, pagamentoId) =>
    requisitar('DELETE', `/bancos/${bancoId}/adiantamentos/${pagamentoId}`),
  removerTransacao: (id) => requisitar('DELETE', `/transacoes/${id}`),
  criarCofre: (dados) => requisitar('POST', '/cofre', dados),
  atualizarCofre: (id, dados) => requisitar('PATCH', `/cofre/${id}`, dados),
  removerCofre: (id) => requisitar('DELETE', `/cofre/${id}`),
}
