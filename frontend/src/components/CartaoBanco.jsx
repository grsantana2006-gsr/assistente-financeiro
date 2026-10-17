import { useState } from 'react'
import { formatarMoeda, formatarPercentual, formatarMesAnoCurto } from '../utils/format'
import { nivelDeAlerta } from '../utils/calculos'
import './CartaoBanco.css'

// Um card para UM banco. Recebe:
// - cartao: dados do banco + gasto, limite_disponivel, uso, valor_fatura e fatura_paga
// - aoSalvarLimite: função do pai chamada para salvar novo limite
// - aoAlternarFatura: função para alternar status da fatura (aberta vs paga)
// - mesReferencia: mês de referência (ex: '2026-10')
function CartaoBanco({ cartao, aoSalvarLimite, aoAlternarFatura, mesReferencia }) {
  // useState: memória do componente. Quando muda, a tela é redesenhada.
  const [editando, setEditando] = useState(false)
  const [rascunho, setRascunho] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [mostrarProximas, setMostrarProximas] = useState(true)
  const [faturaAbertaModal, setFaturaAbertaModal] = useState(null)

  const banco = cartao
  const { gasto, limite_disponivel: disponivel, uso } = cartao
  const alerta = nivelDeAlerta(uso)
  const ehBeneficio = banco.tipo === 'Benefício'
  const mesAtual = mesReferencia || new Date().toISOString().slice(0, 7)

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

      {/* Bloco de Fatura do Mês e Botão de Quitação */}
      {!ehBeneficio && (
        <div className={`cartao__fatura-bloco ${banco.fatura_paga ? 'cartao__fatura-bloco--paga' : ''}`}>
          <div className="cartao__fatura-conteudo">
            <span className="cartao__fatura-rotulo">
              Fatura de {formatarMesAnoCurto(mesAtual)}:
            </span>
            <div className="cartao__fatura-valores-linha">
              <strong className="cartao__fatura-valor">
                {banco.fatura_parcial
                  ? formatarMoeda(banco.saldo_restante_fatura)
                  : formatarMoeda(banco.valor_fatura_lancada > 0 ? banco.valor_fatura_lancada : (banco.valor_fatura || 0))}
              </strong>
              {banco.fatura_parcial && (
                <span
                  className="cartao__fatura-sub-adiantado"
                  title={`Total: ${formatarMoeda(banco.valor_fatura || 0)} | Adiantado: -${formatarMoeda(banco.valor_pago_adiantado || 0)}`}
                >
                  ⚡ {formatarMoeda(banco.valor_pago_adiantado)} adiantado
                </span>
              )}
              {!banco.fatura_parcial && banco.valor_fatura_a_cobrar > 0 && (
                <span className="cartao__fatura-sub-previsto" title={`Já lançado: ${formatarMoeda(banco.valor_fatura_lancada || 0)} | Ainda a cobrar: ${formatarMoeda(banco.valor_fatura_a_cobrar)}`}>
                  previsto: {formatarMoeda(banco.valor_fatura || 0)}
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
              banco.fatura_paga
                ? 'cartao__btn-fatura--paga'
                : banco.fatura_parcial
                ? 'cartao__btn-fatura--parcial'
                : 'cartao__btn-fatura--aberta'
            }`}
            onClick={() => aoAlternarFatura && aoAlternarFatura(banco.id)}
            title={
              banco.fatura_paga
                ? 'Fatura quitada! Clique para reabrir se necessário.'
                : banco.fatura_parcial
                ? `Adiantamento de ${formatarMoeda(banco.valor_pago_adiantado)} realizado. Resta ${formatarMoeda(banco.saldo_restante_fatura)}.`
                : 'Clique para marcar a fatura deste mês como paga e liberar o limite correspondente.'
            }
          >
            {banco.fatura_paga
              ? '✓ Fatura Paga'
              : banco.fatura_parcial
              ? `⚡ ${formatarMoeda(banco.valor_pago_adiantado)} Pago`
              : '⏳ Fatura Aberta'}
          </button>
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
                    onClick={() => setFaturaAbertaModal(ativa ? null : faturaFutura)}
                    title={`Clique para ver os lançamentos de ${formatarMesAnoCurto(faturaFutura.mes)}`}
                  >
                    <span className="cartao__proxima-mes">
                      {formatarMesAnoCurto(faturaFutura.mes)}
                    </span>
                    <strong className="cartao__proxima-valor">
                      {formatarMoeda(faturaFutura.valor_lancado > 0 ? faturaFutura.valor_lancado : faturaFutura.valor)}
                    </strong>
                    {temACobrar && (
                      <span className="cartao__proxima-sub-previsao" title={`Já lançado: ${formatarMoeda(faturaFutura.valor_lancado)} | A cobrar: ${formatarMoeda(faturaFutura.valor_a_cobrar)}`}>
                        previsto: {formatarMoeda(faturaFutura.valor)}
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
                <button
                  type="button"
                  className="cartao__proxima-detalhes-fechar"
                  onClick={() => setFaturaAbertaModal(null)}
                  title="Fechar detalhe"
                >
                  ✕
                </button>
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
    </article>
  )
}

export default CartaoBanco
