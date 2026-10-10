import { useState } from 'react'
import { formatarMoeda, formatarPercentual } from '../utils/format'
import { nivelDeAlerta } from '../utils/calculos'
import './CartaoBanco.css'

// Um card para UM banco. Recebe:
// - cartao: dados do banco + gasto, limite_disponivel e uso (calculados pelo servidor)
// - aoSalvarLimite: função do pai (assíncrona) chamada quando o usuário confirma um novo limite
function CartaoBanco({ cartao, aoSalvarLimite }) {
  // useState: memória do componente. Quando muda, a tela é redesenhada.
  // editando -> está mostrando o campo de edição?  | rascunho -> texto digitado
  const [editando, setEditando] = useState(false)
  const [rascunho, setRascunho] = useState('')
  const [salvando, setSalvando] = useState(false) // aguardando a resposta da API?

  const banco = cartao
  const { gasto, limite_disponivel: disponivel, uso } = cartao
  const alerta = nivelDeAlerta(uso)

  function iniciarEdicao() {
    setRascunho(String(banco.limite_total)) // começa com o valor atual
    setEditando(true)
  }

  async function salvar(evento) {
    evento.preventDefault() // evita recarregar a página ao enviar o formulário
    const novoLimite = Number(rascunho.replace(',', '.'))
    if (Number.isNaN(novoLimite) || novoLimite <= 0) return // ignora valor inválido

    setSalvando(true)
    const deuCerto = await aoSalvarLimite(banco.id, novoLimite)
    setSalvando(false)
    if (deuCerto) setEditando(false) // se falhou, mantém aberto para tentar de novo
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
            {banco.tipo} · fecha dia {banco.dia_fechamento} · vence dia {banco.dia_vencimento}
          </p>
        </div>
        <span className={`cartao__selo cartao__selo--${alerta}`}>{formatarPercentual(uso)} usado</span>
      </div>

      <div className="cartao__disponivel">
        <p className="card-subtitle">Limite disponível</p>
        <p className="cartao__valor">{formatarMoeda(disponivel)}</p>
      </div>

      {/* Barra de progresso: a largura vem da porcentagem de uso */}
      <div
        className="barra"
        role="progressbar"
        aria-valuenow={Math.round(uso * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Uso do limite do ${banco.nome}`}
      >
        <div className={`barra__preenchimento barra__preenchimento--${alerta}`} style={{ width: `${uso * 100}%` }} />
      </div>

      <div className="cartao__detalhes">
        <span>Gasto: <strong>{formatarMoeda(gasto)}</strong></span>
        <span>Limite: <strong>{formatarMoeda(banco.limite_total)}</strong></span>
      </div>

      {/* Renderização condicional: mostra o formulário OU o botão */}
      {editando ? (
        <form className="cartao__form" onSubmit={salvar}>
          <input
            id={`limite-input-${banco.id}`}
            type="text"
            inputMode="decimal"
            value={rascunho}
            onChange={(e) => setRascunho(e.target.value)}
            aria-label={`Novo limite total do ${banco.nome}`}
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
          ✏️ Editar limite
        </button>
      )}
    </article>
  )
}

export default CartaoBanco
