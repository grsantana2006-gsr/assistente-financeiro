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
            <strong className="cartao__fatura-valor">
              {formatarMoeda(banco.valor_fatura || 0)}
            </strong>
            <span className="cartao__fatura-vencimento">
              Vencimento: dia {banco.dia_vencimento}
            </span>
          </div>

          <button
            id={`fatura-btn-${banco.id}`}
            type="button"
            className={`cartao__btn-fatura ${
              banco.fatura_paga ? 'cartao__btn-fatura--paga' : 'cartao__btn-fatura--aberta'
            }`}
            onClick={() => aoAlternarFatura && aoAlternarFatura(banco.id)}
            title={
              banco.fatura_paga
                ? 'Fatura quitada! Clique para reabrir se necessário.'
                : 'Clique para marcar a fatura deste mês como paga e liberar o limite correspondente.'
            }
          >
            {banco.fatura_paga ? '✓ Fatura Paga' : '⏳ Fatura Aberta'}
          </button>
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
