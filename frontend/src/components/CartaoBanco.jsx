import { useState } from 'react'
import { formatarMoeda, formatarPercentual, formatarMesAnoCurto } from '../utils/format'
import { nivelDeAlerta } from '../utils/calculos'
import './CartaoBanco.css'

// Um card para UM banco. Recebe:
// - cartao: dados do banco + gasto, limite_disponivel, uso, valor_fatura e fatura_paga
// - aoSalvarLimite: função do pai chamada para salvar novo limite
// - aoAlternarFatura: função para alternar status da fatura (aberta vs paga / adiantada)
// - mesReferencia: mês de referência (ex: '2026-10')
function CartaoBanco({ cartao, aoSalvarLimite, aoAlternarFatura, mesReferencia }) {
  const [editando, setEditando] = useState(false)
  const [rascunho, setRascunho] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [mostrarProximas, setMostrarProximas] = useState(true)
  const [faturaAbertaModal, setFaturaAbertaModal] = useState(null)

  // Estado do Modal de Pagamento / Adiantamento de Fatura
  const [modalPagamentoAberto, setModalPagamentoAberto] = useState(false)
  const [mesSelecionado, setMesSelecionado] = useState(mesReferencia || new Date().toISOString().slice(0, 7))
  const [tipoPagamento, setTipoPagamento] = useState('integral') // 'integral' ou 'parcial'
  const [valorParcialInput, setValorParcialInput] = useState('')
  const [salvandoPagamento, setSalvandoPagamento] = useState(false)

  const banco = cartao
  const { gasto, limite_disponivel: disponivel, uso } = cartao
  const alerta = nivelDeAlerta(uso)
  const ehBeneficio = banco.tipo === 'Benefício'
  const mesAtual = mesReferencia || new Date().toISOString().slice(0, 7)
  const proximaFatura = banco.proximas_faturas?.[0]

  // Se a fatura do mês atual já está paga, permite alternar ou focar na fatura aberta do ciclo seguinte (ex: Nov/26)
  const [faturaFocoMes, setFaturaFocoMes] = useState(null)
  const mesExibido = faturaFocoMes || (banco.fatura_paga && proximaFatura ? proximaFatura.mes : mesAtual)
  const ehFocoProxima = Boolean(proximaFatura && mesExibido === proximaFatura.mes)
  const faturaFocoDados = ehFocoProxima ? proximaFatura : null

  // Métricas dinâmicas da fatura selecionada no bloco
  const faturaExibidaPaga = ehFocoProxima
    ? (faturaFocoDados.valor_pago_adiantado >= faturaFocoDados.valor_lancado && faturaFocoDados.valor_lancado > 0)
    : banco.fatura_paga

  const faturaExibidaParcial = ehFocoProxima
    ? Boolean(faturaFocoDados.valor_pago_adiantado > 0 && faturaFocoDados.valor_pago_adiantado < faturaFocoDados.valor_lancado)
    : banco.fatura_parcial

  const faturaExibidaValor = ehFocoProxima
    ? (faturaExibidaParcial
        ? faturaFocoDados.saldo_lancado_restante
        : (faturaFocoDados.valor_lancado > 0 ? faturaFocoDados.valor_lancado : faturaFocoDados.valor))
    : (banco.fatura_parcial
        ? banco.saldo_restante_fatura
        : (banco.valor_fatura_lancada > 0 ? banco.valor_fatura_lancada : (banco.valor_fatura || 0)))

  const faturaExibidaAdiantado = ehFocoProxima
    ? faturaFocoDados.valor_pago_adiantado
    : banco.valor_pago_adiantado

  const faturaExibidaPrevisto = ehFocoProxima
    ? faturaFocoDados.valor
    : banco.valor_fatura

  const faturaExibidaTemACobrar = ehFocoProxima
    ? (faturaFocoDados.valor_a_cobrar > 0)
    : (banco.valor_fatura_a_cobrar > 0)

  function iniciarEdicao() {
    setRascunho(String(banco.limite_total))
    setEditando(true)
  }

  async function salvar(evento) {
    evento.preventDefault()
    const novoLimite = Number(rascunho.replace(',', '.'))
    if (Number.isNaN(novoLimite) || novoLimite < 0) return

    setSalvando(true)
    const deuCerto = await aoSalvarLimite(banco.id, novoLimite)
    setSalvando(false)
    if (deuCerto) setEditando(false)
  }

  function abrirModalPagamento(mesAlvo) {
    const alvo = mesAlvo || mesAtual
    setMesSelecionado(alvo)

    let info = null
    if (alvo === mesAtual) {
      info = {
        valor_pago_adiantado: banco.valor_pago_adiantado || 0,
      }
    } else {
      const pf = banco.proximas_faturas?.find((f) => f.mes === alvo)
      info = {
        valor_pago_adiantado: pf?.valor_pago_adiantado || 0,
      }
    }

    if (info && info.valor_pago_adiantado > 0) {
      setTipoPagamento('parcial')
      setValorParcialInput(String(info.valor_pago_adiantado))
    } else {
      setTipoPagamento('integral')
      setValorParcialInput('')
    }

    setModalPagamentoAberto(true)
  }

  function mudarMesNoModal(m) {
    setMesSelecionado(m)
    let info = null
    if (m === mesAtual) {
      info = { valor_pago_adiantado: banco.valor_pago_adiantado || 0 }
    } else {
      const pf = banco.proximas_faturas?.find((f) => f.mes === m)
      info = { valor_pago_adiantado: pf?.valor_pago_adiantado || 0 }
    }
    if (info && info.valor_pago_adiantado > 0) {
      setTipoPagamento('parcial')
      setValorParcialInput(String(info.valor_pago_adiantado))
    } else {
      setTipoPagamento('integral')
      setValorParcialInput('')
    }
  }

  async function confirmarPagamento(evento) {
    if (evento) evento.preventDefault()
    if (!aoAlternarFatura) return
    setSalvandoPagamento(true)
    try {
      if (tipoPagamento === 'integral') {
        await aoAlternarFatura(banco.id, { mes: mesSelecionado, pago: true, valor_pago: null })
      } else {
        const valor = Number(valorParcialInput.replace(',', '.'))
        if (!Number.isNaN(valor) && valor > 0) {
          await aoAlternarFatura(banco.id, { mes: mesSelecionado, pago: true, valor_pago: valor })
        }
      }
      setModalPagamentoAberto(false)
    } finally {
      setSalvandoPagamento(false)
    }
  }

  async function reabrirFatura() {
    if (!aoAlternarFatura) return
    setSalvandoPagamento(true)
    try {
      await aoAlternarFatura(banco.id, { mes: mesSelecionado, pago: false })
      setModalPagamentoAberto(false)
    } finally {
      setSalvandoPagamento(false)
    }
  }

  const faturaSelecionadaInfo = mesSelecionado === mesAtual
    ? {
        rotulo: `Fatura Atual (${formatarMesAnoCurto(mesAtual)})`,
        valorTotal: banco.valor_fatura || 0,
        valorLancado: banco.valor_fatura_lancada || 0,
        valorPago: banco.valor_pago_adiantado || 0,
        pago: banco.fatura_paga,
        parcial: banco.fatura_parcial,
      }
    : (() => {
        const pf = banco.proximas_faturas?.find((f) => f.mes === mesSelecionado)
        return {
          rotulo: `Fatura de ${formatarMesAnoCurto(mesSelecionado)}`,
          valorTotal: pf?.valor || 0,
          valorLancado: pf?.valor_lancado || 0,
          valorPago: pf?.valor_pago_adiantado || 0,
          pago: Boolean(pf && pf.valor_pago_adiantado >= pf.valor && pf.valor > 0),
          parcial: Boolean(pf && pf.valor_pago_adiantado > 0),
        }
      })()

  const temPagamentoNoMes = faturaSelecionadaInfo.pago || faturaSelecionadaInfo.parcial || faturaSelecionadaInfo.valorPago > 0

  return (
    <article id={`cartao-${banco.id}`} className="card cartao" style={{ '--cor-banco': banco.cor }}>
      <div className="cartao__topo">
        <div>
          <h3 className="cartao__nome">
            <span className="cartao__ponto" aria-hidden="true" />
            {banco.nome}
          </h3>
          <p className="card-subtitle">
            {ehBeneficio
              ? `Benefício Refeição · recarrega dia ${banco.dia_fechamento}`
              : `${banco.tipo} · fecha dia ${banco.dia_fechamento} · vence dia ${banco.dia_vencimento}`}
          </p>
        </div>
        <span className={`cartao__selo cartao__selo--${alerta}`}>
          {formatarPercentual(uso)} {ehBeneficio ? 'consumido' : 'usado'}
        </span>
      </div>

      <div className="cartao__disponivel">
        <p className="card-subtitle">{ehBeneficio ? 'Saldo restante' : 'Limite disponível'}</p>
        <p className="cartao__valor">{formatarMoeda(disponivel)}</p>
      </div>

      {/* Barra de progresso: a largura vem da porcentagem de uso */}
      <div
        className="barra"
        role="progressbar"
        aria-valuenow={Math.round(uso * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Uso do ${ehBeneficio ? 'saldo' : 'limite'} do ${banco.nome}`}
      >
        <div className={`barra__preenchimento barra__preenchimento--${alerta}`} style={{ width: `${uso * 100}%` }} />
      </div>

      <div className="cartao__detalhes">
        <span>Gasto: <strong>{formatarMoeda(gasto)}</strong></span>
        <span>{ehBeneficio ? 'Recarga:' : 'Limite:'} <strong>{formatarMoeda(banco.limite_total)}</strong></span>
      </div>

      {/* Bloco de Fatura do Mês e Botão de Quitação / Adiantamento */}
      {!ehBeneficio && (
        <div className={`cartao__fatura-bloco ${faturaExibidaPaga ? 'cartao__fatura-bloco--paga' : ''}`}>
          {/* Seletor rápido de faturas quando há próximas faturas ou quando o mês atual já está pago */}
          {proximaFatura && (
            <div className="cartao__fatura-abas">
              <button
                type="button"
                className={`cartao__fatura-aba ${mesExibido === mesAtual ? 'cartao__fatura-aba--ativa' : ''}`}
                onClick={() => setFaturaFocoMes(mesAtual)}
                title={`Ver fatura de ${formatarMesAnoCurto(mesAtual)}`}
              >
                {formatarMesAnoCurto(mesAtual)} {banco.fatura_paga ? '✓ Paga' : ''}
              </button>
              <button
                type="button"
                className={`cartao__fatura-aba ${mesExibido === proximaFatura.mes ? 'cartao__fatura-aba--ativa' : ''}`}
                onClick={() => setFaturaFocoMes(proximaFatura.mes)}
                title={`Ver fatura de ${formatarMesAnoCurto(proximaFatura.mes)}`}
              >
                {formatarMesAnoCurto(proximaFatura.mes)} {banco.fatura_paga ? '⏳ Atual Aberta' : ''}
              </button>
            </div>
          )}

          <div className="cartao__fatura-corpo">
            <div className="cartao__fatura-conteudo">
              <span className="cartao__fatura-rotulo">
                Fatura de {formatarMesAnoCurto(mesExibido)} {ehFocoProxima && banco.fatura_paga ? '(Atual Aberta)' : ''}:
              </span>
              <div className="cartao__fatura-valores-linha">
                <strong className="cartao__fatura-valor">
                  {formatarMoeda(faturaExibidaValor)}
                </strong>
                {faturaExibidaParcial && (
                  <span
                    className="cartao__fatura-sub-adiantado"
                    title={`Total: ${formatarMoeda(faturaExibidaPrevisto || 0)} | Adiantado: -${formatarMoeda(faturaExibidaAdiantado || 0)}`}
                  >
                    ⚡ {formatarMoeda(faturaExibidaAdiantado)} adiantado
                  </span>
                )}
                {!faturaExibidaParcial && faturaExibidaTemACobrar && (
                  <span className="cartao__fatura-sub-previsto" title={`Já lançado: ${formatarMoeda(faturaExibidaValor || 0)} | Previsto total: ${formatarMoeda(faturaExibidaPrevisto || 0)}`}>
                    previsto: {formatarMoeda(faturaExibidaPrevisto || 0)}
                  </span>
                )}
              </div>
              <span className="cartao__fatura-vencimento">
                Vencimento: dia {banco.dia_vencimento}
              </span>
            </div>

            <button
              id={`fatura-btn-${banco.id}`}
              type="button"
              className={`cartao__btn-fatura ${
                faturaExibidaPaga
                  ? 'cartao__btn-fatura--paga'
                  : faturaExibidaParcial
                  ? 'cartao__btn-fatura--parcial'
                  : 'cartao__btn-fatura--aberta'
              }`}
              onClick={() => abrirModalPagamento(mesExibido)}
              title={
                faturaExibidaPaga
                  ? 'Fatura quitada! Clique para gerenciar ou reabrir.'
                  : faturaExibidaParcial
                  ? `Adiantamento de ${formatarMoeda(faturaExibidaAdiantado)} realizado. Resta ${formatarMoeda(faturaExibidaValor)}. Clique para gerenciar.`
                  : 'Clique para registrar pagamento integral ou adiantamento desta fatura.'
              }
            >
              {faturaExibidaPaga
                ? '✓ Fatura Paga'
                : faturaExibidaParcial
                ? `⚡ ${formatarMoeda(faturaExibidaAdiantado)} Pago`
                : '⏳ Fatura Aberta'}
            </button>
          </div>
        </div>
      )}

      {/* Bloco de Previsão das Próximas Faturas */}
      {!ehBeneficio && banco.proximas_faturas && banco.proximas_faturas.length > 0 && (
        <div className="cartao__proximas-bloco">
          <div className="cartao__proximas-cabecalho">
            <span className="cartao__proximas-titulo">
              🔮 Faturas dos Próximos Meses:
            </span>
            <button
              type="button"
              className="cartao__proximas-toggle-btn"
              onClick={() => setMostrarProximas(!mostrarProximas)}
              aria-label={mostrarProximas ? 'Recolher próximas faturas' : 'Ver próximas faturas'}
            >
              {mostrarProximas ? 'Recolher ▲' : `Ver ${banco.proximas_faturas.length} meses ▼`}
            </button>
          </div>

          {mostrarProximas && (
            <div className="cartao__proximas-trilho">
              {banco.proximas_faturas.map((faturaFutura) => {
                const ativa = faturaAbertaModal?.mes === faturaFutura.mes
                const temACobrar = faturaFutura.valor_a_cobrar > 0
                return (
                  <button
                    key={faturaFutura.mes}
                    type="button"
                    className={`cartao__proxima-card ${ativa ? 'cartao__proxima-card--ativo' : ''}`}
                    onClick={() => {
                      setFaturaAbertaModal(ativa ? null : faturaFutura)
                      setFaturaFocoMes(faturaFutura.mes)
                    }}
                    title={`Clique para ver os lançamentos de ${formatarMesAnoCurto(faturaFutura.mes)}`}
                  >
                    <span className="cartao__proxima-mes">
                      {formatarMesAnoCurto(faturaFutura.mes)}
                    </span>
                    <strong className="cartao__proxima-valor">
                      {formatarMoeda(
                        faturaFutura.valor_lancado > 0
                          ? faturaFutura.saldo_lancado_restante ?? faturaFutura.valor_lancado
                          : faturaFutura.saldo_restante ?? faturaFutura.valor,
                      )}
                    </strong>
                    {faturaFutura.valor_pago_adiantado > 0 && (
                      <span
                        className="cartao__fatura-sub-adiantado"
                        title={`Lançado: ${formatarMoeda(faturaFutura.valor_lancado)} | Adiantado: -${formatarMoeda(faturaFutura.valor_pago_adiantado)}`}
                      >
                        ⚡ {formatarMoeda(faturaFutura.valor_pago_adiantado)} pago
                      </span>
                    )}
                    {temACobrar && (
                      <span className="cartao__proxima-sub-previsao" title={`Já lançado: ${formatarMoeda(faturaFutura.valor_lancado)} | A cobrar: ${formatarMoeda(faturaFutura.valor_a_cobrar)}`}>
                        previsto: {formatarMoeda(faturaFutura.saldo_restante ?? faturaFutura.valor)}
                      </span>
                    )}
                    <span className="cartao__proxima-qtd">
                      {faturaFutura.qtd_itens} {faturaFutura.qtd_itens === 1 ? 'item' : 'itens'}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Detalhes inline das contas que compõem a fatura futura selecionada */}
          {mostrarProximas && faturaAbertaModal && (
            <div className="cartao__proxima-detalhes">
              <div className="cartao__proxima-detalhes-topo">
                <span className="cartao__proxima-detalhes-titulo">
                  Contas em <strong>{formatarMesAnoCurto(faturaAbertaModal.mes)}</strong> ({faturaAbertaModal.qtd_itens}):
                </span>
                <div className="cartao__proxima-detalhes-acoes">
                  <button
                    type="button"
                    className="cartao__btn-adiantar-proxima"
                    onClick={() => abrirModalPagamento(faturaAbertaModal.mes)}
                    title={`Registrar adiantamento ou pagamento para ${formatarMesAnoCurto(faturaAbertaModal.mes)}`}
                  >
                    ⚡ Adiantar esta fatura
                  </button>
                  <button
                    type="button"
                    className="cartao__proxima-detalhes-fechar"
                    onClick={() => setFaturaAbertaModal(null)}
                    title="Fechar detalhe"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <ul className="cartao__proxima-lista">
                {faturaAbertaModal.itens.map((item, idx) => (
                  <li key={item.id ? `${item.id}-${idx}` : idx} className="cartao__proxima-item-linha">
                    <div className="cartao__proxima-item-info">
                      <span className="cartao__proxima-item-desc" title={item.descricao}>
                        {item.descricao}
                        {item.total_parcelas > 1 && (
                          <span className="cartao__proxima-parc-tag">
                            {' '}({item.parcela_atual ? `${item.parcela_atual}/` : ''}{item.total_parcelas}x)
                          </span>
                        )}
                      </span>
                      <span className={`cartao__item-badge ${item.lancado ? 'cartao__item-badge--lancado' : 'cartao__item-badge--a-cobrar'}`}>
                        {item.lancado ? '💳 Lançado' : `⏳ A cobrar ${item.dia_cobranca ? `dia ${item.dia_cobranca}` : ''}`}
                      </span>
                    </div>
                    <strong className="cartao__proxima-item-valor">{formatarMoeda(item.valor)}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Renderização condicional: mostra o formulário OU o botão */}
      {editando ? (
        <form className="cartao__form" onSubmit={salvar}>
          <input
            id={`limite-input-${banco.id}`}
            type="text"
            inputMode="decimal"
            value={rascunho}
            onChange={(e) => setRascunho(e.target.value)}
            aria-label={`Novo ${ehBeneficio ? 'saldo mensal' : 'limite total'} do ${banco.nome}`}
            autoFocus
          />
          <button type="submit" className="btn btn--primary" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
          <button type="button" className="btn" disabled={salvando} onClick={() => setEditando(false)}>
            Cancelar
          </button>
        </form>
      ) : (
        <button id={`editar-limite-${banco.id}`} className="btn" onClick={iniciarEdicao}>
          ✏️ {ehBeneficio ? 'Editar recarga mensal' : 'Editar limite'}
        </button>
      )}

      {/* Modal Interativo de Pagamento e Adiantamento de Fatura */}
      {modalPagamentoAberto && (
        <div className="cartao__modal-overlay" onClick={() => !salvandoPagamento && setModalPagamentoAberto(false)}>
          <div className="cartao__modal" onClick={(e) => e.stopPropagation()}>
            <div className="cartao__modal-cabecalho">
              <div>
                <h4 className="cartao__modal-titulo">💳 Pagamento / Adiantamento de Fatura</h4>
                <span className="cartao__modal-sub">{banco.nome}</span>
              </div>
              <button
                type="button"
                className="cartao__modal-fechar"
                onClick={() => setModalPagamentoAberto(false)}
                disabled={salvandoPagamento}
              >
                ✕
              </button>
            </div>

            <form onSubmit={confirmarPagamento} className="cartao__modal-form">
              <label className="cartao__modal-campo">
                <span className="cartao__modal-rotulo">Selecione o mês da fatura:</span>
                <select
                  value={mesSelecionado}
                  onChange={(e) => mudarMesNoModal(e.target.value)}
                  disabled={salvandoPagamento}
                >
                  <option value={mesAtual}>Fatura Atual ({formatarMesAnoCurto(mesAtual)})</option>
                  {banco.proximas_faturas?.map((pf) => (
                    <option key={pf.mes} value={pf.mes}>
                      Fatura de {formatarMesAnoCurto(pf.mes)} (lançado: {formatarMoeda(pf.valor_lancado || 0)})
                    </option>
                  ))}
                </select>
              </label>

              <div className="cartao__modal-resumo">
                <div className="cartao__modal-resumo-linha">
                  <span>Valor total da fatura:</span>
                  <strong>{formatarMoeda(faturaSelecionadaInfo.valorTotal)}</strong>
                </div>
                {faturaSelecionadaInfo.valorPago > 0 && (
                  <div className="cartao__modal-resumo-linha cartao__modal-resumo-linha--destaque">
                    <span>⚡ Adiantado até agora:</span>
                    <strong>{formatarMoeda(faturaSelecionadaInfo.valorPago)}</strong>
                  </div>
                )}
              </div>

              <div className="cartao__modal-opcoes">
                <label className={`cartao__modal-opcao ${tipoPagamento === 'integral' ? 'cartao__modal-opcao--ativa' : ''}`}>
                  <input
                    type="radio"
                    name="tipoPagamento"
                    value="integral"
                    checked={tipoPagamento === 'integral'}
                    onChange={() => setTipoPagamento('integral')}
                    disabled={salvandoPagamento}
                  />
                  <div>
                    <strong>✓ Quitar Fatura Integralmente</strong>
                    <small>Dá baixa de 100% no saldo e libera o limite correspondente</small>
                  </div>
                </label>

                <label className={`cartao__modal-opcao ${tipoPagamento === 'parcial' ? 'cartao__modal-opcao--ativa' : ''}`}>
                  <input
                    type="radio"
                    name="tipoPagamento"
                    value="parcial"
                    checked={tipoPagamento === 'parcial'}
                    onChange={() => setTipoPagamento('parcial')}
                    disabled={salvandoPagamento}
                  />
                  <div>
                    <strong>⚡ Adiantamento / Pagamento Parcial</strong>
                    <small>Para adiantar valor avulso antes do vencimento (ex: compras repassadas a terceiros)</small>
                  </div>
                </label>
              </div>

              {tipoPagamento === 'parcial' && (
                <label className="cartao__modal-campo">
                  <span className="cartao__modal-rotulo">Valor pago / adiantado (R$):</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Ex: 708,00"
                    value={valorParcialInput}
                    onChange={(e) => setValorParcialInput(e.target.value)}
                    disabled={salvandoPagamento}
                    autoFocus
                    required
                  />
                </label>
              )}

              <div className="cartao__modal-acoes">
                <button type="submit" className="btn btn--primary" disabled={salvandoPagamento}>
                  {salvandoPagamento ? 'Salvando…' : '✓ Confirmar Pagamento'}
                </button>
                {temPagamentoNoMes && (
                  <button
                    type="button"
                    className="btn btn--danger"
                    onClick={reabrirFatura}
                    disabled={salvandoPagamento}
                    title="Exclui o pagamento registrado e reabre a fatura"
                  >
                    🗑️ Reabrir / Limpar
                  </button>
                )}
                <button
                  type="button"
                  className="btn"
                  onClick={() => setModalPagamentoAberto(false)}
                  disabled={salvandoPagamento}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </article>
  )
}

export default CartaoBanco
